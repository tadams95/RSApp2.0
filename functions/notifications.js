/* eslint-disable */
'use strict';

// Basic notification creation triggers (Phase 1)
// Creates in-app notification docs; push sending handled later.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { admin, db } = require('./admin');
const { checkRateLimit } = require('./rateLimit');

// --- Test Helpers (exposed via module.exports._test) ---
// These pure functions mirror logic inside the push sender trigger so we can unit test
// core decision branches (quiet hours suppression & aggregation summarization) without
// requiring the Firestore emulator or sendEachForMulticast side-effects.
function evaluateQuietHours(now, quietHours) {
  if (!quietHours || typeof quietHours !== 'object') return false;
  const { start, end, timezone } = quietHours;
  if (!start || !end || !timezone) return false;
  try {
    let parts;
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      });
      parts = fmt.format(now);
    } catch (_) {
      parts = now.toISOString().slice(11, 16); // UTC fallback
    }
    const [nh, nm] = parts.split(':').map(Number);
    const nowMinutes = nh * 60 + nm;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);
    const inQuiet =
      startMinutes < endMinutes
        ? nowMinutes >= startMinutes && nowMinutes < endMinutes
        : nowMinutes >= startMinutes || nowMinutes < endMinutes; // overnight window
    return inQuiet;
  } catch (e) {
    return false; // fail open (no suppression) on unexpected errors
  }
}

function aggregateActivity(baseNotification, recentLikeCommentDocs) {
  // baseNotification: { type, title, body, data: { postId } }
  // recentLikeCommentDocs: Array<{ type, data: { actorId } }>
  if (!baseNotification || !baseNotification.data || !baseNotification.data.postId) {
    return { title: baseNotification?.title, body: baseNotification?.body };
  }
  const relevant = recentLikeCommentDocs.filter(
    (d) => d && ['post_liked', 'comment_added'].includes(d.type),
  );
  if (relevant.length <= 1) {
    return { title: baseNotification.title, body: baseNotification.body };
  }
  let likeCount = 0;
  let commentCount = 0;
  const actorIds = new Set();
  relevant.forEach((r) => {
    if (r.data && r.data.actorId) actorIds.add(r.data.actorId);
    if (r.type === 'post_liked') likeCount++;
    if (r.type === 'comment_added') commentCount++;
  });
  const actorsPart = actorIds.size > 1 ? `${actorIds.size} people` : 'Someone';
  let aggregatedTitle;
  let aggregatedBody;
  if (likeCount && commentCount) {
    aggregatedTitle = 'New activity on your post';
    aggregatedBody = `${actorsPart} added activity (${likeCount} like${
      likeCount > 1 ? 's' : ''
    }, ${commentCount} comment${commentCount > 1 ? 's' : ''})`;
  } else if (likeCount) {
    aggregatedTitle = 'Post getting likes';
    aggregatedBody = `${actorsPart} liked your post (${likeCount} like${likeCount > 1 ? 's' : ''})`;
  } else if (commentCount) {
    aggregatedTitle = 'New comments on your post';
    aggregatedBody = `${actorsPart} commented (${commentCount} comment${
      commentCount > 1 ? 's' : ''
    })`;
  }
  return {
    title: aggregatedTitle || baseNotification.title,
    body: aggregatedBody || baseNotification.body,
  };
}

// Attach test helpers for Jest (non-enumerable to avoid accidental serialization)
Object.defineProperty(module.exports, '_test', {
  value: { evaluateQuietHours, aggregateActivity },
  enumerable: false,
});

// Helper: safe increment unreadNotifications
async function incrementUnread(uid, tx) {
  const userRef = db.collection('users').doc(uid);
  const snap = await tx.get(userRef);
  const current =
    snap.exists && typeof snap.data().unreadNotifications === 'number'
      ? snap.data().unreadNotifications
      : 0;
  tx.update(userRef, { unreadNotifications: current + 1 });
}

function nowTs() {
  return admin.firestore.FieldValue.serverTimestamp();
}

async function createNotification({
  uid,
  type,
  title,
  body,
  data = {},
  link = '/',
  deepLink = 'ragestate://home',
  sendPush = true,
}) {
  if (!uid || uid === data.actorId) return null; // skip self notifications
  const notifRef = db.collection('users').doc(uid).collection('notifications').doc();
  const payload = {
    type,
    title,
    body,
    data,
    link,
    deepLink,
    createdAt: nowTs(),
    seenAt: null,
    read: false,
    sendPush,
    pushSentAt: null,
    pushStatus: 'pending',
  };
  await db.runTransaction(async (tx) => {
    tx.set(notifRef, payload);
    await incrementUnread(uid, tx);
  });
  return notifRef.id;
}

// --- postLikes onCreate -> post owner gets post_liked ---
exports.onPostLikeCreateNotify = onDocumentCreated('postLikes/{likeId}', async (event) => {
  try {
    const like = event.data?.data() || {};
    const { postId, userId: actorId, postOwnerId } = like; // ensure like doc includes postOwnerId for efficiency
    if (!postId || !postOwnerId) return null;
    await createNotification({
      uid: postOwnerId,
      type: 'post_liked',
      title: 'New like',
      body: 'Someone liked your post',
      data: { postId, actorId: actorId || null },
      link: `/post/${postId}`,
      deepLink: `ragestate://post/${postId}`,
    });
  } catch (err) {
    logger.error('onPostLikeCreateNotify failed', { err });
  }
  return null;
});

// --- postComments onCreate -> post owner gets comment_added ---
exports.onPostCommentCreateNotify = onDocumentCreated('postComments/{commentId}', async (event) => {
  try {
    const c = event.data?.data() || {};
    const { postId, userId: actorId, postOwnerId, content } = c;
    if (!postId || !postOwnerId) return null;
    await createNotification({
      uid: postOwnerId,
      type: 'comment_added',
      title: 'New comment',
      body: 'Someone commented on your post',
      data: { postId, actorId: actorId || null, commentId: event.params.commentId || null },
      link: `/post/${postId}`,
      deepLink: `ragestate://post/${postId}`,
    });

    // Mentions: naive pattern @usernameLower (alphanumeric + underscore)
    if (content && typeof content === 'string') {
      const mentionMatches = content.match(/@([a-z0-9_]{3,30})/gi) || [];
      const usernames = [...new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))];
      if (usernames.length) {
        // Resolve usernames -> userIds via usernames collection (usernameLower doc id pattern assumed)
        const lookups = await Promise.all(
          usernames.map((uname) => db.collection('usernames').doc(uname).get()),
        );
        await Promise.all(
          lookups.map(async (snap) => {
            if (!snap.exists) return null;
            const targetUid = snap.data().uid;
            if (!targetUid || targetUid === actorId || targetUid === postOwnerId) return null;
            return createNotification({
              uid: targetUid,
              type: 'mention',
              title: 'You were mentioned',
              body: 'Someone mentioned you in a comment',
              data: {
                postId,
                actorId: actorId || null,
                commentId: event.params.commentId || null,
              },
              link: `/post/${postId}`,
              deepLink: `ragestate://post/${postId}`,
            });
          }),
        );
      }
    }
  } catch (err) {
    logger.error('onPostCommentCreateNotify failed', { err });
  }
  return null;
});

// --- posts onCreate -> notify mentioned users in post content ---
exports.onPostCreateNotifyMentions = onDocumentCreated('posts/{postId}', async (event) => {
  try {
    const post = event.data?.data() || {};
    const { userId: authorId, content } = post;
    const postId = event.params.postId;
    if (!authorId || !postId || !content || typeof content !== 'string') return null;

    // Match @usernameLower pattern (alphanumeric + underscore, 3-30 chars)
    const mentionMatches = content.match(/@([a-z0-9_]{3,30})/gi) || [];
    const usernames = [...new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))];
    if (!usernames.length) return null;

    // Resolve usernames -> userIds
    const lookups = await Promise.all(
      usernames.map((uname) => db.collection('usernames').doc(uname).get()),
    );
    await Promise.all(
      lookups.map(async (snap) => {
        if (!snap.exists) return null;
        const targetUid = snap.data().uid;
        if (!targetUid || targetUid === authorId) return null; // skip self-mention
        return createNotification({
          uid: targetUid,
          type: 'mention',
          title: 'You were mentioned',
          body: 'Someone mentioned you in a post',
          data: { postId, actorId: authorId },
          link: `/post/${postId}`,
          deepLink: `ragestate://post/${postId}`,
        });
      }),
    );
  } catch (err) {
    logger.error('onPostCreateNotifyMentions failed', { err });
  }
  return null;
});

// --- follows onCreate -> target user gets new_follower ---
exports.onFollowCreateNotify = onDocumentCreated('follows/{followId}', async (event) => {
  try {
    const f = event.data?.data() || {};
    const { followerId: actorId, followedId: targetUid } = f;
    if (!actorId || !targetUid) return null;
    await createNotification({
      uid: targetUid,
      type: 'new_follower',
      title: 'New follower',
      body: 'You have a new follower',
      data: { actorId },
      link: `/profile/${actorId}`,
      deepLink: `ragestate://profile/${actorId}`,
    });
  } catch (err) {
    logger.error('onFollowCreateNotify failed', { err });
  }
  return null;
});

// --- postReposts onCreate -> original post owner gets post_reposted ---
exports.onRepostCreateNotify = onDocumentCreated('postReposts/{repostId}', async (event) => {
  try {
    const repost = event.data?.data() || {};
    const { postId, userId: actorId, originalAuthorId } = repost;
    if (!postId || !originalAuthorId) return null;
    await createNotification({
      uid: originalAuthorId,
      type: 'post_reposted',
      title: 'Your post was reposted',
      body: 'Someone reposted your post',
      data: { postId, actorId: actorId || null },
      link: `/post/${postId}`,
      deepLink: `ragestate://post/${postId}`,
    });
  } catch (err) {
    logger.error('onRepostCreateNotify failed', { err });
  }
  return null;
});

// NOTE: push sending will be a separate trigger or queue; this phase only creates docs and increments counters.

// --- Callable: batchMarkNotificationsRead ---
// Input: { notificationIds?: string[], markAll?: boolean, max?: number }
// Rules:
//  - Caller must be authenticated.
//  - Operates only on caller's own notifications.
//  - If markAll=true, scans newest unread up to 'max' (default 100, hard cap 300).
//  - Returns counts: { updated, remainingUnread }
//  - Rate limited: 10 calls per minute per user
exports.batchMarkNotificationsRead = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx || !ctx.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = ctx.uid;

  // Rate limit check
  const rateLimitResult = await checkRateLimit('BATCH_MARK_READ', uid);
  if (!rateLimitResult.allowed) {
    logger.warn('batchMarkNotificationsRead rate limited', { uid });
    throw new HttpsError('resource-exhausted', rateLimitResult.message);
  }

  const { notificationIds, markAll, max } = request.data || {};
  const HARD_CAP = 300;
  const limit = Math.min(typeof max === 'number' && max > 0 ? max : 100, HARD_CAP);

  let targets = [];
  if (markAll) {
    // Query unread notifications newest first
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    targets = snap.docs;
  } else if (Array.isArray(notificationIds) && notificationIds.length) {
    // Fetch specific docs (dedupe & cap)
    const unique = [...new Set(notificationIds.filter((x) => typeof x === 'string'))].slice(
      0,
      HARD_CAP,
    );
    if (unique.length) {
      const reads = await Promise.all(
        unique.map((id) =>
          db.collection('users').doc(uid).collection('notifications').doc(id).get(),
        ),
      );
      targets = reads.filter((d) => d.exists && d.data().read === false);
    }
  } else {
    return { updated: 0, remainingUnread: null };
  }

  if (!targets.length) {
    // Nothing to do; compute remaining unread quickly
    const remainingSnap = await db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .where('read', '==', false)
      .limit(1)
      .get();
    return { updated: 0, remainingUnread: remainingSnap.empty ? 0 : undefined };
  }

  // Transaction: update notifications + decrement unread counter by count actually changed.
  const updatedIds = [];
  await db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await tx.get(userRef);
    const currentUnread =
      userSnap.exists && typeof userSnap.data().unreadNotifications === 'number'
        ? userSnap.data().unreadNotifications
        : 0;
    let decrement = 0;
    for (const docSnap of targets) {
      // Re-read inside txn to ensure latest read state
      const notifRef = docSnap.ref;
      const latest = await tx.get(notifRef);
      if (latest.exists && latest.data().read === false) {
        tx.update(notifRef, { read: true, seenAt: nowTs() });
        decrement++;
        updatedIds.push(notifRef.id);
      }
    }
    if (decrement > 0) {
      tx.update(userRef, { unreadNotifications: Math.max(0, currentUnread - decrement) });
    }
  });

  // Compute remaining unread count (cheap query if small; optional optimization to skip)
  let remainingUnread = undefined;
  try {
    const remainSnap = await db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .where('read', '==', false)
      .limit(1)
      .get();
    remainingUnread = remainSnap.empty ? 0 : undefined; // undefined => still >0 but unknown exact number (avoid extra count query)
  } catch (e) {
    // non-fatal
  }

  logger.info('batchMarkNotificationsRead', {
    uid,
    requested: notificationIds?.length || null,
    markAll: !!markAll,
    updated: updatedIds.length,
  });
  return { updated: updatedIds.length, remainingUnread };
});

// --- Push Sender Trigger (Phase 2) ---
// Sends push for newly created notification docs if sendPush == true and user prefs allow.
// Path: users/{uid}/notifications/{nid}
exports.onUserNotificationCreatedSendPush = onDocumentCreated(
  'users/{uid}/notifications/{nid}',
  async (event) => {
    const notifSnap = event.data;
    if (!notifSnap) return null;
    const notif = notifSnap.data();
    const uid = event.params.uid;
    // Correlation ID for this push processing (short random base36 slice)
    const correlationId = Math.random().toString(36).slice(2, 10);
    let aggregationApplied = false;

    try {
      if (!notif.sendPush) {
        logger.debug('sendPush disabled on notification', { uid, nid: event.params.nid });
        return null;
      }
      // Skip if already processed somehow
      if (notif.pushStatus && notif.pushStatus !== 'pending') return null;

      // Load user prefs
      const prefsRef = db
        .collection('users')
        .doc(uid)
        .collection('settings')
        .doc('notificationPrefs');
      const prefsSnap = await prefsRef.get();
      const prefs = prefsSnap.exists ? prefsSnap.data() : {};
      if (prefs && prefs[notif.type] === false) {
        logger.debug('Notification type disabled in prefs', { uid, type: notif.type });
        await notifSnap.ref.update({ pushStatus: 'skipped_prefs' });
        return null;
      }

      // Quiet hours check (timezone-aware minimal implementation)
      if (prefs.quietHours && typeof prefs.quietHours === 'object') {
        const { start, end, timezone } = prefs.quietHours || {};
        if (start && end && timezone && typeof timezone === 'string') {
          try {
            const now = new Date();
            // Format time in user timezone HH:MM (24h). Fallback to UTC on error.
            let parts;
            try {
              const fmt = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: timezone,
              });
              parts = fmt.format(now); // e.g. "07:05"
            } catch (tzErr) {
              parts = now.toISOString().slice(11, 16); // UTC fallback
            }
            const [nh, nm] = parts.split(':').map(Number);
            const nowMinutes = nh * 60 + nm;
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const startMinutes = sh * 60 + (sm || 0);
            const endMinutes = eh * 60 + (em || 0);
            const inQuiet =
              startMinutes < endMinutes
                ? nowMinutes >= startMinutes && nowMinutes < endMinutes
                : nowMinutes >= startMinutes || nowMinutes < endMinutes; // overnight window
            if (inQuiet) {
              await notifSnap.ref.update({ pushStatus: 'suppressed_quiet_hours' });
              return null;
            }
          } catch (qhErr) {
            logger.warn('Quiet hours evaluation failed; continuing', { qhErr });
          }
        }
      }

      // Simple aggregation: collapse rapid like/comment bursts on same post into a single push window (5 min)
      // Only affects push payload; individual notification docs still created.
      let aggregatedTitle = notif.title;
      let aggregatedBody = notif.body;
      if (['post_liked', 'comment_added'].includes(notif.type) && notif.data?.postId) {
        try {
          const windowMinutes = 5;
          const since = new Date(Date.now() - windowMinutes * 60 * 1000);
          const baseRef = db.collection('users').doc(uid).collection('notifications');
          const likeOrCommentSnap = await baseRef
            .where('data.postId', '==', notif.data.postId)
            .where('createdAt', '>=', since)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
          const relevant = likeOrCommentSnap.docs.filter((d) => {
            const dt = d.data();
            return ['post_liked', 'comment_added'].includes(dt.type);
          });
          if (relevant.length > 1) {
            // Count likes and comments separately for clarity
            let likeCount = 0;
            let commentCount = 0;
            const actorIds = new Set();
            relevant.forEach((r) => {
              const rd = r.data();
              if (rd.data && rd.data.actorId) actorIds.add(rd.data.actorId);
              if (rd.type === 'post_liked') likeCount++;
              if (rd.type === 'comment_added') commentCount++;
            });
            const actorsPart = actorIds.size > 1 ? `${actorIds.size} people` : 'Someone';
            if (likeCount && commentCount) {
              aggregatedTitle = 'New activity on your post';
              aggregatedBody = `${actorsPart} ${
                actorIds.size > 1 ? 'added activity' : 'added activity'
              } (${likeCount} like${likeCount > 1 ? 's' : ''}, ${commentCount} comment${
                commentCount > 1 ? 's' : ''
              })`;
            } else if (likeCount) {
              aggregatedTitle = 'Post getting likes';
              aggregatedBody = `${actorsPart} liked your post (${likeCount} like${
                likeCount > 1 ? 's' : ''
              })`;
            } else if (commentCount) {
              aggregatedTitle = 'New comments on your post';
              aggregatedBody = `${actorsPart} commented (${commentCount} comment${
                commentCount > 1 ? 's' : ''
              })`;
            }
            aggregationApplied = true;
          }
        } catch (aggErr) {
          logger.debug('Aggregation window query failed, using single notification', { aggErr });
        }
      }

      // Fetch active device tokens
      const devicesSnap = await db
        .collection('users')
        .doc(uid)
        .collection('devices')
        .where('enabled', '==', true)
        .get();
      if (devicesSnap.empty) {
        await notifSnap.ref.update({ pushStatus: 'no_devices' });
        return null;
      }

      const fcmTokens = [];
      const deviceRefs = [];
      devicesSnap.forEach((d) => {
        const data = d.data();
        if (data.provider === 'fcm' && data.token) {
          fcmTokens.push(data.token);
          deviceRefs.push(d.ref);
        }
      });
      if (!fcmTokens.length) {
        await notifSnap.ref.update({ pushStatus: 'no_fcm_tokens' });
        return null;
      }

      const message = {
        tokens: fcmTokens,
        notification: {
          title: aggregatedTitle || notif.title || 'Notification',
          body: aggregatedBody || notif.body || '',
        },
        data: Object.fromEntries(
          Object.entries(notif.data || {}).flatMap(([k, v]) =>
            typeof v === 'string' ? [[k, v]] : [],
          ),
        ),
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
        webpush: { fcmOptions: { link: notif.link || '/' } },
      };

      const res = await admin.messaging().sendEachForMulticast(message);
      let success = res.successCount;
      let failure = res.failureCount;

      // Cleanup invalid tokens
      const invalidTokens = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error && r.error.code ? r.error.code : 'unknown';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-argument') ||
            code.includes('messaging/invalid-registration-token')
          ) {
            invalidTokens.push(fcmTokens[idx]);
          }
        }
      });
      if (invalidTokens.length) {
        // Remove invalid tokens (best-effort)
        await Promise.all(
          deviceRefs.map(async (ref, idx) => {
            const token = fcmTokens[idx];
            if (invalidTokens.includes(token)) {
              try {
                await ref.update({
                  enabled: false,
                  disabledAt: nowTs(),
                  disableReason: 'invalid_token',
                });
              } catch (e) {
                logger.warn('Failed to disable invalid token', { token, e });
              }
            }
          }),
        );
      }

      await notifSnap.ref.update({
        pushStatus: failure === 0 && success > 0 ? 'sent' : success > 0 ? 'partial' : 'failed',
        pushSentAt: nowTs(),
        pushMeta: { success, failure },
      });
      logger.info('Push notification sent', {
        uid,
        nid: event.params.nid,
        success,
        failure,
        correlationId,
        aggregationApplied,
      });
    } catch (err) {
      logger.error('onUserNotificationCreatedSendPush failed', {
        uid,
        nid: event.params.nid,
        err,
        correlationId,
      });
      try {
        await notifSnap.ref.update({ pushStatus: 'error' });
      } catch (_) {}
    }
    return null;
  },
);

// --- Scheduled: pruneStaleDevices ---
// Disables device docs that have not been seen in >30 days OR have invalid/missing token data.
// Collection path: users/{uid}/devices/{deviceId}
// Strategy: collection group query (if available) else per-user iteration (here we use collectionGroup for efficiency)
// Marks documents with enabled=false, disabledAt, disableReason='stale'.
exports.pruneStaleDevices = onSchedule(
  { schedule: 'every 24 hours', timeoutSeconds: 180 },
  async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ms
    const cutoffDate = new Date(cutoff);
    const batchSize = 300;
    let processed = 0;
    let disabled = 0;
    try {
      // Query devices where enabled == true and lastSeenAt < cutoff OR missing lastSeenAt createdAt older than cutoff
      const cg = db.collectionGroup('devices');
      // We can't do OR queries directly; approach: fetch enabled==true and manually filter by timestamp fields.
      const snap = await cg.where('enabled', '==', true).limit(batchSize).get();
      if (snap.empty) {
        logger.info('pruneStaleDevices: no enabled devices found (batch)');
        return null;
      }
      const writes = [];
      snap.docs.forEach((doc) => {
        processed++;
        const d = doc.data() || {};
        const lastSeen = d.lastSeenAt && d.lastSeenAt.toDate ? d.lastSeenAt.toDate() : null;
        const created = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : null;
        const token = d.token;
        const provider = d.provider;
        // Determine staleness: no lastSeen and created < cutoff OR lastSeen < cutoff OR missing token/provider
        let isStale = false;
        if (!token || !provider) isStale = true;
        if (lastSeen) {
          if (lastSeen < cutoffDate) isStale = true;
        } else if (created && created < cutoffDate) {
          isStale = true;
        }
        if (isStale) {
          disabled++;
          writes.push(
            doc.ref.update({
              enabled: false,
              disabledAt: admin.firestore.FieldValue.serverTimestamp(),
              disableReason: 'stale',
            }),
          );
        }
      });
      if (writes.length) await Promise.all(writes);
      logger.info('pruneStaleDevices complete', { processed, disabled });
    } catch (err) {
      logger.error('pruneStaleDevices failed', { err, processed, disabled });
    }
    return null;
  },
);

// --- Prefs Sanitization: on write to users/{uid}/settings/notificationPrefs ---
// Strips unknown fields to enforce a stable schema and prevents unexpected payload inflation.
// Allowed top-level boolean fields correspond to notification types plus future-safe flags.
// quietHours shape: { start: 'HH:MM', end: 'HH:MM', timezone: string }
// Updated 2024-12-27: added new_post_from_follow and marketing keys
exports.onNotificationPrefsWrittenSanitize = onDocumentWritten(
  'users/{uid}/settings/notificationPrefs',
  async (event) => {
    try {
      const after = event.data?.after;
      if (!after || !after.exists) return null; // ignore deletes
      const data = after.data() || {};

      // Define allowed boolean preference keys
      const allowedBooleanKeys = new Set([
        'post_liked',
        'comment_added',
        'mention',
        'new_follower',
        'new_post_from_follow',
        'post_reposted',
        'marketing',
        // add future types here as they are introduced
      ]);
      const sanitized = {};

      // Copy allowed boolean keys with actual boolean values
      for (const k of allowedBooleanKeys) {
        if (typeof data[k] === 'boolean') sanitized[k] = data[k];
      }

      // quietHours validation - preserve null (disabled) or valid object
      if (data.quietHours === null) {
        sanitized.quietHours = null;
      } else if (data.quietHours && typeof data.quietHours === 'object') {
        const { start, end, timezone } = data.quietHours;
        const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h
        if (
          typeof start === 'string' &&
          typeof end === 'string' &&
          timeRe.test(start) &&
          timeRe.test(end) &&
          typeof timezone === 'string' &&
          timezone.length < 100
        ) {
          sanitized.quietHours = { start, end, timezone };
        }
      }

      // Preserve updatedAt timestamp if present
      if (data.updatedAt) {
        sanitized.updatedAt = data.updatedAt;
      }

      // If sanitized differs from stored data, update doc.
      // Shallow compare keys/values only (sufficient for our limited schema).
      let differs = false;
      const keys = new Set([...Object.keys(data), ...Object.keys(sanitized)]);
      for (const k of keys) {
        const a = data[k];
        const b = sanitized[k];
        if (typeof a === 'object' || typeof b === 'object') {
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            differs = true;
            break;
          }
        } else if (a !== b) {
          differs = true;
          break;
        }
      }
      if (differs) {
        await after.ref.set(sanitized, { merge: false });
        logger.info('notificationPrefs sanitized', { uid: event.params.uid });
      }
    } catch (err) {
      logger.error('onNotificationPrefsWrittenSanitize failed', { err, uid: event.params.uid });
    }
    return null;
  },
);
// --- Callable: testSendPush (Admin/Dev only) ---
// Sends a test push notification to a specific user's devices
// Input: { uid?: string, title?: string, body?: string }
// If uid omitted, uses caller's uid.
// Returns: { success, devicesFound, fcmResult }
// Rate limited: 5 calls per minute per user
// Updated: 2025-12-28 - Force redeploy after VAPID key configuration
exports.testSendPush = onCall(async (request) => {
  const ctx = request.auth;
  if (!ctx || !ctx.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const callerUid = ctx.uid;

  // Rate limit check
  const rateLimitResult = await checkRateLimit('TEST_PUSH', callerUid);
  if (!rateLimitResult.allowed) {
    logger.warn('testSendPush rate limited', { callerUid });
    throw new HttpsError('resource-exhausted', rateLimitResult.message);
  }

  const { uid: targetUid, title, body } = request.data || {};
  const uid = targetUid || callerUid;

  // Security: Only allow sending to self (unless caller has admin claim)
  const isAdmin = ctx.token?.admin === true;
  if (uid !== callerUid && !isAdmin) {
    throw new HttpsError('permission-denied', 'Cannot send push to other users');
  }

  // Fetch active device tokens
  const devicesSnap = await db
    .collection('users')
    .doc(uid)
    .collection('devices')
    .where('enabled', '==', true)
    .get();

  if (devicesSnap.empty) {
    return { success: false, devicesFound: 0, error: 'No enabled devices found' };
  }

  const fcmTokens = [];
  devicesSnap.forEach((d) => {
    const data = d.data();
    if (data.provider === 'fcm' && data.token) {
      fcmTokens.push(data.token);
    }
  });

  if (!fcmTokens.length) {
    return {
      success: false,
      devicesFound: devicesSnap.size,
      fcmTokens: 0,
      error: 'No FCM tokens found',
    };
  }

  const message = {
    tokens: fcmTokens,
    notification: {
      title: title || 'Test Push Notification',
      body: body || `Test notification sent at ${new Date().toISOString()}`,
    },
    data: {
      type: 'test',
      timestamp: String(Date.now()),
    },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
    webpush: { fcmOptions: { link: '/account' } },
  };

  try {
    const res = await admin.messaging().sendEachForMulticast(message);
    logger.info('testSendPush result', {
      uid,
      callerUid,
      success: res.successCount,
      failure: res.failureCount,
    });
    return {
      success: res.successCount > 0,
      devicesFound: devicesSnap.size,
      fcmTokens: fcmTokens.length,
      fcmResult: { successCount: res.successCount, failureCount: res.failureCount },
      errors: res.responses.filter((r) => !r.success).map((r) => r.error?.code || 'unknown'),
    };
  } catch (err) {
    logger.error('testSendPush failed', { uid, err });
    return { success: false, error: err.message || 'FCM send failed' };
  }
});
