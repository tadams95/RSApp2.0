/* eslint-disable */
"use strict";

/**
 * Video Transcoding Cloud Function
 *
 * Triggers on video uploads to `posts/{postId}/{filename}` and transcodes to
 * 720p H.264 MP4, storing the result in `posts-optimized/{postId}/{filename}.mp4`.
 *
 * Storage structure separation allows safe lifecycle rules:
 * - `posts/` prefix: 7-day lifecycle rule deletes originals
 * - `posts-optimized/` prefix: No lifecycle rule, kept forever
 */

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const { db, admin } = require("./admin");
const path = require("path");
const os = require("os");
const fs = require("fs");

// FFmpeg libraries - works in Cloud Functions Gen 2
let ffmpeg;
try {
  ffmpeg = require("fluent-ffmpeg");
  const ffmpegPath = require("ffmpeg-static");
  ffmpeg.setFfmpegPath(ffmpegPath);
} catch (err) {
  logger.warn("fluent-ffmpeg or ffmpeg-static not available", err);
}

// Storage bucket name derived from project ID
const STORAGE_BUCKET = `${process.env.GCLOUD_PROJECT || "ragestate-app"}.appspot.com`;

// GCS bucket reference
const bucket = admin.storage().bucket();

// Video MIME types we support for transcoding
const VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/avi",
  "video/mov",
];

/**
 * Extract postId from storage path
 * Supports both formats:
 *   - posts/{postId}/{filename} (nested)
 *   - posts/{filename} (flat - queries Firestore to find postId)
 */
function extractPostId(filePath) {
  const parts = filePath.split("/");

  // Nested format: posts/{postId}/{filename}
  if (parts[0] === "posts" && parts.length >= 3) {
    return parts[1];
  }

  // Flat format: posts/{filename} - return null, will need to query Firestore
  if (parts[0] === "posts" && parts.length === 2) {
    return null; // Signal to use findPostByMediaUrl
  }

  return null;
}

/**
 * Find postId by searching Firestore for a post containing this media URL
 * Used for flat storage structure: posts/{filename}
 */
async function findPostByMediaUrl(fileUrl) {
  try {
    // Query posts where mediaUrls array contains this URL
    const snapshot = await db
      .collection("posts")
      .where("mediaUrls", "array-contains", fileUrl)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // Also try without ?alt=media suffix
    const cleanUrl = fileUrl.replace("?alt=media", "");
    const snapshot2 = await db
      .collection("posts")
      .where("mediaUrls", "array-contains", cleanUrl)
      .limit(1)
      .get();

    if (!snapshot2.empty) {
      return snapshot2.docs[0].id;
    }

    return null;
  } catch (err) {
    logger.error("findPostByMediaUrl failed", { fileUrl, error: err.message });
    return null;
  }
}

/**
 * Check if this is a video file based on content type
 */
function isVideoFile(contentType) {
  if (!contentType) return false;
  return VIDEO_MIMES.some((m) => contentType.startsWith(m.split("/")[0] + "/"));
}

/**
 * Update Firestore post document with transcoding status
 */
async function updatePostProcessingStatus(
  postId,
  isProcessing,
  optimizedUrl = null
) {
  const postRef = db.collection("posts").doc(postId);

  const update = { isProcessing };
  if (optimizedUrl) {
    // Add optimized URL to the array (or create it)
    update.optimizedMediaUrls =
      admin.firestore.FieldValue.arrayUnion(optimizedUrl);
  }

  try {
    await postRef.update(update);
    logger.info("Updated post processing status", {
      postId,
      isProcessing,
      optimizedUrl,
    });
  } catch (err) {
    // Post may have been deleted before transcode finished
    logger.warn("Failed to update post processing status", {
      postId,
      error: err.message,
    });
  }
}

/**
 * Transcode video to 720p H.264 MP4
 */
async function transcodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        "scale=-2:720", // Scale to 720p height, auto width (divisible by 2)
        "-c:v",
        "libx264", // H.264 codec
        "-preset",
        "fast", // Faster encoding (good tradeoff for Cloud Functions)
        "-crf",
        "23", // Quality (18-28 is good, 23 is default)
        "-c:a",
        "aac", // AAC audio codec
        "-b:a",
        "128k", // Audio bitrate
        "-movflags",
        "+faststart", // Enable streaming (moov atom at start)
        "-y", // Overwrite output
      ])
      .output(outputPath)
      .on("start", (cmd) => logger.info("FFmpeg started", { cmd }))
      .on("progress", (progress) => {
        if (progress.percent) {
          logger.info("Transcoding progress", {
            percent: Math.round(progress.percent),
          });
        }
      })
      .on("end", () => {
        logger.info("FFmpeg completed");
        resolve();
      })
      .on("error", (err) => {
        logger.error("FFmpeg error", err);
        reject(err);
      })
      .run();
  });
}

/**
 * Main Cloud Function: Triggered when a file is uploaded to Storage
 */
exports.onVideoUpload = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: "us-central1",
    memory: "2GiB", // Video processing needs more memory
    timeoutSeconds: 540, // 9 minutes max (Cloud Functions limit)
    cpu: 2, // More CPU for faster encoding
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    // Skip if not in posts folder or is in the optimized folder
    if (
      !filePath.startsWith("posts/") ||
      filePath.startsWith("posts-optimized/")
    ) {
      logger.info("Skipping non-post or already-optimized file", { filePath });
      return null;
    }

    // Skip if not a video
    if (!isVideoFile(contentType)) {
      logger.info("Skipping non-video file", { filePath, contentType });
      return null;
    }

    // Skip if ffmpeg is not available
    if (!ffmpeg) {
      logger.error("FFmpeg not available, skipping transcode");
      return null;
    }

    // Try to extract postId from path (nested format)
    let postId = extractPostId(filePath);

    // For flat format (posts/{filename}), query Firestore to find the post
    if (!postId) {
      // Construct the Storage URL to search for
      const bucketName = STORAGE_BUCKET;
      const possibleUrls = [
        `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
          filePath
        )}?alt=media`,
        `https://storage.googleapis.com/${bucketName}/${filePath}`,
      ];

      for (const url of possibleUrls) {
        postId = await findPostByMediaUrl(url);
        if (postId) {
          logger.info("Found postId via Firestore query", { postId, url });
          break;
        }
      }

      if (!postId) {
        // Still couldn't find - might be an orphaned file or post not created yet
        // Wait a bit and retry once (post creation might be in progress)
        logger.info("PostId not found, waiting 5s and retrying...", {
          filePath,
        });
        await new Promise((r) => setTimeout(r, 5000));

        for (const url of possibleUrls) {
          postId = await findPostByMediaUrl(url);
          if (postId) {
            logger.info("Found postId on retry", { postId, url });
            break;
          }
        }
      }
    }

    if (!postId) {
      logger.warn("Could not find postId for file", { filePath });
      return null;
    }

    const fileName = path.basename(filePath);
    const fileNameWithoutExt = path.parse(fileName).name;
    const outputFileName = `${fileNameWithoutExt}.mp4`;

    // Temp paths for local processing
    const tempInputPath = path.join(
      os.tmpdir(),
      `input_${Date.now()}_${fileName}`
    );
    const tempOutputPath = path.join(
      os.tmpdir(),
      `output_${Date.now()}_${outputFileName}`
    );

    // Destination path in Storage (separate top-level folder for safe lifecycle rules)
    const optimizedPath = `posts-optimized/${postId}/${outputFileName}`;

    logger.info("Starting video transcode", {
      postId,
      inputPath: filePath,
      outputPath: optimizedPath,
      contentType,
      size: object.size,
    });

    try {
      // Mark post as processing
      await updatePostProcessingStatus(postId, true);

      // Download original file to temp
      logger.info("Downloading original video...");
      await bucket.file(filePath).download({ destination: tempInputPath });

      // Transcode
      logger.info("Transcoding video to 720p H.264...");
      await transcodeVideo(tempInputPath, tempOutputPath);

      // Check output file size
      const outputStats = fs.statSync(tempOutputPath);
      logger.info("Transcode complete", {
        inputSize: object.size,
        outputSize: outputStats.size,
        reduction: `${Math.round((1 - outputStats.size / object.size) * 100)}%`,
      });

      // Upload optimized file
      logger.info("Uploading optimized video...");
      await bucket.upload(tempOutputPath, {
        destination: optimizedPath,
        metadata: {
          contentType: "video/mp4",
          metadata: {
            originalPath: filePath,
            transcodedAt: new Date().toISOString(),
          },
        },
      });

      // Make the optimized file publicly accessible
      await bucket.file(optimizedPath).makePublic();

      // Get the public URL
      const optimizedUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${optimizedPath}`;

      // Update Firestore with optimized URL and clear processing flag
      await updatePostProcessingStatus(postId, false, optimizedUrl);

      logger.info("Video transcode complete", { postId, optimizedUrl });

      // Cleanup temp files
      fs.unlinkSync(tempInputPath);
      fs.unlinkSync(tempOutputPath);

      return { success: true, optimizedUrl };
    } catch (err) {
      logger.error("Video transcode failed", {
        postId,
        error: err.message,
        stack: err.stack,
      });

      // Clear processing flag on error so video still plays (original quality)
      await updatePostProcessingStatus(postId, false);

      // Cleanup temp files on error
      try {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      } catch (cleanupErr) {
        logger.warn("Temp file cleanup failed", cleanupErr);
      }

      return { success: false, error: err.message };
    }
  }
);
