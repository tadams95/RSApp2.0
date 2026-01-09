/**
 * One-time backfill function to fix comments missing user data
 * Run once via Firebase Console or CLI, then disable/delete
 *
 * Usage:
 *   firebase functions:call backfillCommentsUserData --data '{}'
 *   OR call from Firebase Console Functions tab
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

/**
 * Backfill missing userDisplayName and userVerified for comments
 * Only processes comments where userDisplayName is missing or empty
 */
exports.backfillCommentsUserData = onCall(
  {
    timeoutSeconds: 540, // 9 minutes max
    memory: "512MiB",
  },
  async (request) => {
    // Optional: Add admin check
    // if (!request.auth || !isAdmin(request.auth.uid)) {
    //   throw new HttpsError("permission-denied", "Admin access required");
    // }

    const batchSize = 100;
    let processed = 0;
    let updated = 0;
    let errors = [];
    let lastDoc = null;

    console.log("Starting comment backfill...");

    // Process in batches
    while (true) {
      let query = db
        .collection("postComments")
        .orderBy("timestamp", "desc")
        .limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log("No more comments to process");
        break;
      }

      const batch = db.batch();
      let batchUpdates = 0;

      for (const commentDoc of snapshot.docs) {
        processed++;
        const comment = commentDoc.data();

        // Skip if already has valid userDisplayName
        if (comment.userDisplayName && comment.userDisplayName.trim() !== "") {
          continue;
        }

        // Fetch user profile data
        try {
          const userId = comment.userId;
          if (!userId) {
            errors.push({
              commentId: commentDoc.id,
              error: "No userId",
            });
            continue;
          }

          // Try profiles collection first (social data)
          const profileDoc = await db.collection("profiles").doc(userId).get();
          const profileData = profileDoc.exists ? profileDoc.data() : null;

          // Fallback to customers collection
          const customerDoc = await db
            .collection("customers")
            .doc(userId)
            .get();
          const customerData = customerDoc.exists ? customerDoc.data() : null;

          // Determine display name
          const displayName =
            profileData?.displayName ||
            customerData?.displayName ||
            customerData?.firstName
              ? `${customerData.firstName} ${
                  customerData.lastName || ""
                }`.trim()
              : null;

          // Determine verification status
          const isVerified =
            profileData?.isVerified === true ||
            customerData?.verificationStatus === "verified" ||
            customerData?.verificationStatus === "artist";

          // Determine profile picture
          const profilePicture =
            profileData?.photoURL ||
            profileData?.profilePicture ||
            customerData?.profilePicture ||
            null;

          if (displayName) {
            const updateData = {
              userDisplayName: displayName,
              userVerified: isVerified,
            };

            if (profilePicture && !comment.userProfilePicture) {
              updateData.userProfilePicture = profilePicture;
            }

            batch.update(commentDoc.ref, updateData);
            batchUpdates++;
            updated++;

            console.log(
              `Updating comment ${commentDoc.id}: ${displayName} (verified: ${isVerified})`
            );
          } else {
            errors.push({
              commentId: commentDoc.id,
              userId,
              error: "Could not find display name in profiles or customers",
            });
          }
        } catch (err) {
          errors.push({
            commentId: commentDoc.id,
            error: err.message,
          });
        }
      }

      // Commit batch if there are updates
      if (batchUpdates > 0) {
        await batch.commit();
        console.log(`Committed batch with ${batchUpdates} updates`);
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Safety limit
      if (processed >= 10000) {
        console.log("Reached safety limit of 10,000 comments");
        break;
      }
    }

    const result = {
      processed,
      updated,
      errorsCount: errors.length,
      errors: errors.slice(0, 20), // Return first 20 errors only
    };

    console.log("Backfill complete:", result);
    return result;
  }
);
