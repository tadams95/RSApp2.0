/* eslint-disable */
'use strict';

const {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { db } = require('./admin');
const admin = require('firebase-admin');
const { checkContent } = require('./moderation');

// --- Lightweight Rate Limiting Config ---
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_POSTS = 3; // max posts allowed in window

async function updatePostCounter(postId, field, delta) {
  const postRef = db.collection('posts').doc(postId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const current = typeof data[field] === 'number' ? data[field] : 0;
    const next = Math.max(0, current + delta);
    tx.update(postRef, { [field]: next });
  });
}

// Paginated deletion with safety cap to avoid runaway loops / timeouts.
async function deleteQueryInChunks(queryRef, label, options = {}) {
  const batchSize = options.batchSize || 400;
  const maxChunks = options.maxChunks || 50; // ~20k docs worst-case
  const perChunkDelayMs = options.perChunkDelayMs || 0;
  let total = 0;
  let chunks = 0;
  while (chunks < maxChunks) {
    const snap = await queryRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    chunks++;
    if (snap.size < batchSize) break; // last page
    if (perChunkDelayMs) await new Promise((r) => setTimeout(r, perChunkDelayMs));
  }
  const truncated = chunks >= maxChunks;
  logger.info('deleteQueryInChunks complete', { label, total, chunks, truncated });
  return { total, chunks, truncated };
}

exports.onPostLikeCreate = onDocumentCreated('postLikes/{likeId}', async (event) => {
  const like = event.data?.data() || {};
  const postId = like.postId;
  if (!postId) return null;
  try {
    await updatePostCounter(postId, 'likeCount', 1);
  } catch (err) {
    logger.error('onPostLikeCreate failed', { postId, err });
  }
  return null;
});

exports.onPostLikeDelete = onDocumentDeleted('postLikes/{likeId}', async (event) => {
  const like = event.data?.data() || {};
  const postId = like.postId;
  if (!postId) return null;
  try {
    await updatePostCounter(postId, 'likeCount', -1);
  } catch (err) {
    logger.error('onPostLikeDelete failed', { postId, err });
  }
  return null;
});

exports.onPostCommentCreate = onDocumentCreated('postComments/{commentId}', async (event) => {
  const c = event.data?.data() || {};
  const postId = c.postId;
  if (!postId) return null;
  try {
    await updatePostCounter(postId, 'commentCount', 1);
  } catch (err) {
    logger.error('onPostCommentCreate failed', { postId, err });
  }
  return null;
});

exports.onPostCommentDelete = onDocumentDeleted('postComments/{commentId}', async (event) => {
  const c = event.data?.data() || {};
  const postId = c.postId;
  if (!postId) return null;
  try {
    await updatePostCounter(postId, 'commentCount', -1);
  } catch (err) {
    logger.error('onPostCommentDelete failed', { postId, err });
  }
  return null;
});

// --- Comment Likes ---
async function updateCommentCounter(commentId, field, delta) {
  const commentRef = db.collection('postComments').doc(commentId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(commentRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const current = typeof data[field] === 'number' ? data[field] : 0;
    const next = Math.max(0, current + delta);
    tx.update(commentRef, { [field]: next });
  });
}

exports.onCommentLikeCreate = onDocumentCreated('postCommentLikes/{likeId}', async (event) => {
  const like = event.data?.data() || {};
  const commentId = like.commentId;
  if (!commentId) return null;
  try {
    await updateCommentCounter(commentId, 'likeCount', 1);
  } catch (err) {
    logger.error('onCommentLikeCreate failed', { commentId, err });
  }
  return null;
});

exports.onCommentLikeDelete = onDocumentDeleted('postCommentLikes/{likeId}', async (event) => {
  const like = event.data?.data() || {};
  const commentId = like.commentId;
  if (!commentId) return null;
  try {
    await updateCommentCounter(commentId, 'likeCount', -1);
  } catch (err) {
    logger.error('onCommentLikeDelete failed', { commentId, err });
  }
  return null;
});

// --- Reposts ---
exports.onRepostCreate = onDocumentCreated('postReposts/{repostId}', async (event) => {
  const repost = event.data?.data() || {};
  const postId = repost.postId;
  const reposterId = repost.userId;
  const repostPostId = repost.repostPostId; // The new post doc representing the repost
  if (!postId || !reposterId) return null;

  try {
    // Increment repostCount on original post
    await updatePostCounter(postId, 'repostCount', 1);
    logger.info('onRepostCreate counter incremented', { postId, reposterId });

    // Fan-out repost to reposter's followers' feeds
    if (repostPostId) {
      const followersSnap = await db
        .collection('follows')
        .where('followedId', '==', reposterId)
        .get();
      const recipients = new Set([reposterId]);
      followersSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.followerId) recipients.add(d.followerId);
      });

      const ts = repost.timestamp || admin.firestore.FieldValue.serverTimestamp();
      const writes = [];
      for (const uid of recipients) {
        const feedDoc = db
          .collection('userFeeds')
          .doc(uid)
          .collection('feedItems')
          .doc(repostPostId);
        writes.push((batch) =>
          batch.set(
            feedDoc,
            {
              postId: repostPostId,
              authorId: reposterId,
              isPublic: true,
              timestamp: ts,
            },
            { merge: true },
          ),
        );
      }
      await commitInChunks(writes);
      logger.info('onRepostCreate fan-out complete', {
        postId,
        repostPostId,
        reposterId,
        recipients: writes.length,
      });
    }
  } catch (err) {
    logger.error('onRepostCreate failed', { postId, reposterId, err });
  }
  return null;
});

exports.onRepostDelete = onDocumentDeleted('postReposts/{repostId}', async (event) => {
  const repost = event.data?.data() || {};
  const postId = repost.postId;
  const reposterId = repost.userId;
  const repostPostId = repost.repostPostId;
  if (!postId) return null;

  try {
    // Decrement repostCount on original post
    await updatePostCounter(postId, 'repostCount', -1);
    logger.info('onRepostDelete counter decremented', { postId, reposterId });

    // Remove from followers' feeds
    if (repostPostId) {
      const followersSnap = await db
        .collection('follows')
        .where('followedId', '==', reposterId)
        .get();
      const recipients = new Set([reposterId]);
      followersSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.followerId) recipients.add(d.followerId);
      });

      const writes = [];
      for (const uid of recipients) {
        const feedDoc = db
          .collection('userFeeds')
          .doc(uid)
          .collection('feedItems')
          .doc(repostPostId);
        writes.push((batch) => batch.delete(feedDoc));
      }
      await commitInChunks(writes);
      logger.info('onRepostDelete fan-out removal complete', {
        postId,
        repostPostId,
        reposterId,
        recipients: writes.length,
      });
    }
  } catch (err) {
    logger.error('onRepostDelete failed', { postId, reposterId, err });
  }
  return null;
});

// --- Personal feed fan-out (userFeeds/{userId}/feedItems) ---

async function commitInChunks(writes) {
  if (!writes.length) return;
  let batch = db.batch();
  let count = 0;
  for (const fn of writes) {
    fn(batch);
    count++;
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
}

exports.onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data() || {};
  const postId = event.params.postId;
  const authorId = post.userId;
  if (!authorId || !postId) return null;

  try {
    // --- Moderation Gate (hate / incitement) ---
    const moderation = checkContent(post.content || '');
    if (!moderation.allowed) {
      await db
        .collection('moderationLog')
        .doc(postId)
        .set({
          postId,
          authorId,
          action: 'removed',
          reasons: moderation.reasons,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          snapshot: {
            content: post.content || '',
            isPublic: !!post.isPublic,
            mediaUrls: post.mediaUrls || [],
          },
        });
      await db.collection('posts').doc(postId).delete();
      logger.info('onPostCreated moderation removal', {
        postId,
        authorId,
        reasons: moderation.reasons,
      });
      return null;
    }
    // Lightweight server-side rate limit: delete if over limit to avoid fan-out
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentSnap = await db
      .collection('posts')
      .where('userId', '==', authorId)
      .where('timestamp', '>', windowStart)
      .orderBy('timestamp', 'desc')
      .limit(RATE_LIMIT_MAX_POSTS + 1)
      .get();
    if (recentSnap.size > RATE_LIMIT_MAX_POSTS) {
      await db.collection('posts').doc(postId).delete();
      logger.info('onPostCreated rate-limit: post deleted', {
        postId,
        authorId,
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxPosts: RATE_LIMIT_MAX_POSTS,
        recentCount: recentSnap.size,
      });
      return null;
    }

    logger.info('onPostCreated fan-out start', { postId, authorId, isPublic: post.isPublic });
    // Fetch followers of author
    const followersSnap = await db.collection('follows').where('followedId', '==', authorId).get();

    // Build recipients: author always, followers if public
    const recipients = new Set([authorId]);
    if (post.isPublic) {
      followersSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.followerId) recipients.add(d.followerId);
      });
    }

    const ts = post.timestamp || admin.firestore.FieldValue.serverTimestamp();
    const writes = [];
    for (const uid of recipients) {
      const feedDoc = db.collection('userFeeds').doc(uid).collection('feedItems').doc(postId);
      writes.push((batch) =>
        batch.set(
          feedDoc,
          {
            postId,
            authorId,
            isPublic: !!post.isPublic,
            timestamp: ts,
          },
          { merge: true },
        ),
      );
    }
    await commitInChunks(writes);
    logger.info('onPostCreated fan-out complete', { postId, authorId, recipients: writes.length });
  } catch (err) {
    logger.error('onPostCreated fan-out failed', { postId, authorId, err });
  }
  return null;
});

exports.onPostDeleted = onDocumentDeleted('posts/{postId}', async (event) => {
  const post = event.data?.data() || {};
  const postId = event.params.postId;
  const authorId = post.userId;
  if (!authorId || !postId) return null;

  try {
    // Idempotency guard via deletion tombstone
    const tombstoneRef = db.collection('postDeletions').doc(postId);
    const tombstoneSnap = await tombstoneRef.get();
    if (tombstoneSnap.exists && tombstoneSnap.data()?.completed) {
      logger.info('onPostDeleted already processed (tombstone present)', { postId, authorId });
      return null;
    }
    await tombstoneRef.set(
      { startedAt: admin.firestore.FieldValue.serverTimestamp(), completed: false },
      { merge: true },
    );

    logger.info('onPostDeleted cleanup start', { postId, authorId });
    const followersSnap = await db.collection('follows').where('followedId', '==', authorId).get();

    const recipients = new Set([authorId]);
    followersSnap.forEach((doc) => {
      const d = doc.data() || {};
      if (d.followerId) recipients.add(d.followerId);
    });

    const writes = [];
    for (const uid of recipients) {
      const feedDoc = db.collection('userFeeds').doc(uid).collection('feedItems').doc(postId);
      writes.push((batch) => batch.delete(feedDoc));
    }
    await commitInChunks(writes);

    // Cleanup likes and comments for this post with safeguards (higher cap for comments)
    const likeDel = await deleteQueryInChunks(
      db.collection('postLikes').where('postId', '==', postId),
      'delete_post_likes',
      { maxChunks: 100 },
    );
    const commentDel = await deleteQueryInChunks(
      db.collection('postComments').where('postId', '==', postId),
      'delete_post_comments',
      { maxChunks: 200 },
    );

    // Delete any Storage media for this post
    try {
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `posts/${postId}/` });
    } catch (storageErr) {
      logger.warn('Storage cleanup failed (non-fatal)', { postId, storageErr });
    }
    // Mark tombstone completed
    await tombstoneRef.set(
      { completed: true, finishedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );

    logger.info('onPostDeleted cleanup complete', {
      postId,
      authorId,
      likeDocsDeleted: likeDel.total,
      commentDocsDeleted: commentDel.total,
      likesTruncated: likeDel.truncated,
      commentsTruncated: commentDel.truncated,
    });
  } catch (err) {
    logger.error('onPostDeleted fan-out cleanup failed', {
      postId,
      authorId,
      err,
    });
  }
  return null;
});

// Handle updates to posts: visibility toggles and edit audit fields
exports.onPostUpdated = onDocumentUpdated('posts/{postId}', async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  const postId = event.params.postId;
  const authorId = after.userId || before.userId;
  if (!authorId || !postId) return null;

  // Visibility change handling
  const visBefore = !!before.isPublic;
  const visAfter = !!after.isPublic;

  // Early exit if no relevant changes (avoid unnecessary work)
  const contentChanged = before.content !== after.content;
  const mediaChanged =
    JSON.stringify(before.mediaUrls || []) !== JSON.stringify(after.mediaUrls || []);
  const visibilityChanged = visBefore !== visAfter;
  if (!contentChanged && !mediaChanged && !visibilityChanged) {
    logger.info('onPostUpdated early-exit (non-material changes only)', {
      postId,
      changedKeys: Object.keys(after).filter((k) => before[k] !== after[k]),
    });
    return null;
  }

  try {
    if (visBefore !== visAfter) {
      logger.info('onPostUpdated visibility toggle start', {
        postId,
        authorId,
        from: visBefore,
        to: visAfter,
      });
      // Fetch followers once when needed
      const followersSnap = await db
        .collection('follows')
        .where('followedId', '==', authorId)
        .get();

      const recipients = new Set([authorId]);
      followersSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (d.followerId) recipients.add(d.followerId);
      });

      const writes = [];
      for (const uid of recipients) {
        const feedDoc = db.collection('userFeeds').doc(uid).collection('feedItems').doc(postId);
        if (visAfter) {
          // Ensure presence for followers; author always has it
          writes.push((batch) =>
            batch.set(
              feedDoc,
              {
                postId,
                authorId,
                isPublic: true,
                timestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            ),
          );
        } else {
          // Remove from others, but keep for author
          if (uid === authorId) {
            writes.push((batch) =>
              batch.set(
                feedDoc,
                {
                  postId,
                  authorId,
                  isPublic: false,
                  timestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              ),
            );
          } else {
            writes.push((batch) => batch.delete(feedDoc));
          }
        }
      }
      await commitInChunks(writes);
      logger.info('onPostUpdated visibility toggle applied', {
        postId,
        authorId,
        to: visAfter,
        recipientOps: writes.length,
      });
    }

    // If fields edited (content/media), ensure audit flags present
    const editedFieldsChanged = contentChanged || mediaChanged || visibilityChanged;
    if (editedFieldsChanged && !after.edited) {
      await db.collection('posts').doc(postId).set(
        {
          edited: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      logger.info('onPostUpdated audit flags applied', { postId });
    }
  } catch (err) {
    logger.error('onPostUpdated failed', { postId, authorId, err });
  }

  return null;
});

exports.onFollowCreate = onDocumentCreated('follows/{edgeId}', async (event) => {
  const edge = event.data?.data() || {};
  const followerId = edge.followerId;
  const followedId = edge.followedId;
  if (!followerId || !followedId) return null;

  try {
    logger.info('onFollowCreate backfill start', { followerId, followedId });
    // Backfill latest public posts from followed user into follower's feed
    const postsSnap = await db
      .collection('posts')
      .where('userId', '==', followedId)
      .where('isPublic', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const writes = [];
    postsSnap.forEach((doc) => {
      const p = doc.data() || {};
      const postId = doc.id;
      const ts = p.timestamp || admin.firestore.FieldValue.serverTimestamp();
      const feedDoc = db
        .collection('userFeeds')
        .doc(followerId)
        .collection('feedItems')
        .doc(postId);
      writes.push((batch) =>
        batch.set(
          feedDoc,
          {
            postId,
            authorId: followedId,
            isPublic: true,
            timestamp: ts,
          },
          { merge: true },
        ),
      );
    });
    await commitInChunks(writes);
    logger.info('onFollowCreate backfill complete', {
      followerId,
      followedId,
      count: writes.length,
    });
  } catch (err) {
    logger.error('onFollowCreate backfill failed', {
      followerId,
      followedId,
      err,
    });
  }
  return null;
});

exports.onFollowDelete = onDocumentDeleted('follows/{edgeId}', async (event) => {
  const edge = event.data?.data() || {};
  const followerId = edge.followerId;
  const followedId = edge.followedId;
  if (!followerId || !followedId) return null;

  try {
    logger.info('onFollowDelete cleanup start', { followerId, followedId });
    // Remove items from follower's feed authored by followedId
    const feedSnap = await db
      .collection('userFeeds')
      .doc(followerId)
      .collection('feedItems')
      .where('authorId', '==', followedId)
      .get();

    const writes = [];
    feedSnap.forEach((doc) => {
      writes.push((batch) => batch.delete(doc.ref));
    });
    await commitInChunks(writes);
    logger.info('onFollowDelete cleanup complete', {
      followerId,
      followedId,
      count: writes.length,
    });
  } catch (err) {
    logger.error('onFollowDelete cleanup failed', {
      followerId,
      followedId,
      err,
    });
  }
  return null;
});

// --- Scheduled Feed Trim ---

const MAX_FEED_ITEMS = 500; // Keep most recent N
const PROCESS_USERS_LIMIT = 200; // Safety cap per run
const MAX_FEED_ITEM_AGE_DAYS = 30; // Age-based pruning enabled (days)

exports.scheduledFeedTrim = onSchedule('every 60 minutes', async (event) => {
  const start = Date.now();
  let processedUsers = 0;
  let trimmedDocs = 0;
  try {
    logger.info('scheduledFeedTrim start', { max: MAX_FEED_ITEMS });
    const userFeedsSnap = await db.collection('userFeeds').limit(PROCESS_USERS_LIMIT).get();
    const agePruneThreshold = MAX_FEED_ITEM_AGE_DAYS
      ? Date.now() - MAX_FEED_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000
      : null;
    for (const uf of userFeedsSnap.docs) {
      processedUsers++;
      const userId = uf.id;
      const feedItemsCol = uf.ref.collection('feedItems');
      // Get the Nth document (the last one we will keep)
      const keepSnap = await feedItemsCol.orderBy('timestamp', 'desc').limit(MAX_FEED_ITEMS).get();
      if (keepSnap.size < MAX_FEED_ITEMS) continue; // Nothing to trim
      const lastKeepDoc = keepSnap.docs[keepSnap.docs.length - 1];
      if (!lastKeepDoc) continue;
      // Fetch older items after that doc (paged)
      let pageCursor = lastKeepDoc;
      while (true) {
        const olderSnap = await feedItemsCol
          .orderBy('timestamp', 'desc')
          .startAfter(pageCursor)
          .limit(400)
          .get();
        if (olderSnap.empty) break;
        let batch = db.batch();
        olderSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        trimmedDocs += olderSnap.size;
        if (olderSnap.size < 400) break; // last page
        pageCursor = olderSnap.docs[olderSnap.docs.length - 1];
      }
      // Optional age-based pruning separate from size trimming
      if (agePruneThreshold) {
        const oldByAgeSnap = await feedItemsCol
          .where('timestamp', '<', new Date(agePruneThreshold))
          .limit(400)
          .get();
        if (!oldByAgeSnap.empty) {
          let batch = db.batch();
          oldByAgeSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          trimmedDocs += oldByAgeSnap.size;
        }
      }
    }
    logger.info('scheduledFeedTrim complete', {
      processedUsers,
      trimmedDocs,
      ms: Date.now() - start,
      sizePrune: true,
      agePruneDays: MAX_FEED_ITEM_AGE_DAYS,
    });
  } catch (err) {
    logger.error('scheduledFeedTrim failed', { err, processedUsers, trimmedDocs });
  }
  return null;
});
