// Pure helper functions for notifications logic (quiet hours + aggregation)
// These contain no firebase-admin or firebase-functions dependencies so they can
// be unit tested without emulator setup.

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
    return false; // fail open (no suppression)
  }
}

function aggregateActivity(baseNotification, recentLikeCommentDocs) {
  if (!baseNotification || !baseNotification.data || !baseNotification.data.postId) {
    return { title: baseNotification?.title, body: baseNotification?.body };
  }
  const relevant = (recentLikeCommentDocs || []).filter(
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

module.exports = { evaluateQuietHours, aggregateActivity };
