'use strict';

/**
 * Analytics aggregation Cloud Functions.
 * Runs daily to compute metrics from purchases, customers, and posts.
 * Stores results in analytics/{date} and analytics/totals for fast dashboard reads.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { admin, db } = require('./admin');

/**
 * Get start and end timestamps for a given date (UTC).
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {{ start: Date, end: Date }}
 */
function getDateRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

/**
 * Format a Date object as YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string in YYYY-MM-DD format.
 * @returns {string}
 */
function getYesterdayDateStr() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDateKey(yesterday);
}

/**
 * Aggregate metrics for a specific date.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Aggregated metrics
 */
async function aggregateMetricsForDate(dateStr) {
  const { start, end } = getDateRange(dateStr);
  const startTimestamp = admin.firestore.Timestamp.fromDate(start);
  const endTimestamp = admin.firestore.Timestamp.fromDate(end);

  logger.info(`Aggregating metrics for ${dateStr}`, {
    start: start.toISOString(),
    end: end.toISOString(),
  });

  // Run all queries in parallel
  const [revenueData, userData, feedData] = await Promise.all([
    aggregateRevenue(startTimestamp, endTimestamp),
    aggregateUsers(startTimestamp, endTimestamp),
    aggregateFeed(startTimestamp, endTimestamp),
  ]);

  return {
    date: dateStr,
    revenue: revenueData,
    users: userData,
    feed: feedData,
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: 1,
  };
}

/**
 * Aggregate revenue from purchases collection.
 */
async function aggregateRevenue(startTimestamp, endTimestamp) {
  try {
    const purchasesSnapshot = await db
      .collection('purchases')
      .where('orderDate', '>=', startTimestamp)
      .where('orderDate', '<=', endTimestamp)
      .get();

    let total = 0;
    let ticketRevenue = 0;
    let merchRevenue = 0;
    let orderCount = 0;

    purchasesSnapshot.forEach((doc) => {
      const data = doc.data();
      // totalAmount is stored as string like "15.00", convert to cents
      const amountStr = data.totalAmount || '0';
      const amountCents = Math.round(parseFloat(amountStr) * 100) || 0;

      total += amountCents;
      orderCount += 1;

      // Categorize by item type if available
      if (data.hasEventItems && !data.hasMerchandiseItems) {
        ticketRevenue += amountCents;
      } else if (data.hasMerchandiseItems && !data.hasEventItems) {
        merchRevenue += amountCents;
      } else if (data.hasEventItems && data.hasMerchandiseItems) {
        // Mixed cart - split proportionally based on item counts
        const eventRatio = (data.eventItemCount || 0) / (data.itemCount || 1);
        ticketRevenue += Math.round(amountCents * eventRatio);
        merchRevenue += Math.round(amountCents * (1 - eventRatio));
      } else {
        // Legacy orders without itemTypes - count as ticket revenue
        ticketRevenue += amountCents;
      }
    });

    logger.info('Revenue aggregated', { total, ticketRevenue, merchRevenue, orderCount });
    return { total, ticketRevenue, merchRevenue, orderCount };
  } catch (err) {
    logger.error('Error aggregating revenue', err);
    return { total: 0, ticketRevenue: 0, merchRevenue: 0, orderCount: 0 };
  }
}

/**
 * Aggregate new user signups from customers collection.
 */
async function aggregateUsers(startTimestamp, endTimestamp) {
  try {
    const customersSnapshot = await db
      .collection('customers')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get();

    const newSignups = customersSnapshot.size;

    // Get cumulative total (all customers)
    const totalSnapshot = await db.collection('customers').count().get();
    const cumulative = totalSnapshot.data().count;

    logger.info('Users aggregated', { newSignups, cumulative });
    return { newSignups, cumulative };
  } catch (err) {
    logger.error('Error aggregating users', err);
    return { newSignups: 0, cumulative: 0 };
  }
}

/**
 * Aggregate feed engagement from posts collection.
 */
async function aggregateFeed(startTimestamp, endTimestamp) {
  try {
    const postsSnapshot = await db
      .collection('posts')
      .where('createdAt', '>=', startTimestamp)
      .where('createdAt', '<=', endTimestamp)
      .get();

    let newPosts = 0;
    let newLikes = 0;
    let newComments = 0;
    const activePosterIds = new Set();

    postsSnapshot.forEach((doc) => {
      const data = doc.data();
      newPosts += 1;
      newLikes += data.likeCount || 0;
      newComments += data.commentCount || 0;
      if (data.authorId) {
        activePosterIds.add(data.authorId);
      }
    });

    const activePosters = activePosterIds.size;

    // Get all-time totals for posts
    const totalPostsSnapshot = await db.collection('posts').count().get();
    const totalPosts = totalPostsSnapshot.data().count;

    logger.info('Feed aggregated', { newPosts, newLikes, newComments, activePosters, totalPosts });
    return { newPosts, newLikes, newComments, activePosters, totalPosts };
  } catch (err) {
    logger.error('Error aggregating feed', err);
    return { newPosts: 0, newLikes: 0, newComments: 0, activePosters: 0, totalPosts: 0 };
  }
}

/**
 * Write daily analytics document and update running totals.
 * Idempotent: overwrites existing doc for the same date.
 */
async function writeAnalytics(dateStr, metrics) {
  const batch = db.batch();

  // Write daily snapshot
  const dailyRef = db.collection('analytics').doc(dateStr);
  batch.set(dailyRef, metrics);

  // Update running totals
  const totalsRef = db.collection('analytics').doc('totals');

  // First, read current totals to compute new values
  const totalsDoc = await totalsRef.get();
  const currentTotals = totalsDoc.exists ? totalsDoc.data() : {};

  // Check if we're updating or adding to totals
  // If we already aggregated this date before, we need to replace not add
  const previousDailyDoc = await dailyRef.get();
  const previousMetrics = previousDailyDoc.exists ? previousDailyDoc.data() : null;

  let totalRevenue = currentTotals.totalRevenue || 0;
  let totalOrders = currentTotals.totalOrders || 0;
  let totalLikes = currentTotals.totalLikes || 0;
  let totalComments = currentTotals.totalComments || 0;

  if (previousMetrics) {
    // Subtract previous values before adding new ones (idempotent update)
    totalRevenue -= previousMetrics.revenue?.total || 0;
    totalOrders -= previousMetrics.revenue?.orderCount || 0;
    totalLikes -= previousMetrics.feed?.newLikes || 0;
    totalComments -= previousMetrics.feed?.newComments || 0;
  }

  // Add new values
  totalRevenue += metrics.revenue.total;
  totalOrders += metrics.revenue.orderCount;
  totalLikes += metrics.feed.newLikes;
  totalComments += metrics.feed.newComments;

  const newTotals = {
    totalRevenue,
    totalOrders,
    totalUsers: metrics.users.cumulative, // Use fresh count
    totalPosts: metrics.feed.totalPosts, // Use fresh count
    totalLikes,
    totalComments,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    lastDate: dateStr,
  };

  batch.set(totalsRef, newTotals, { merge: true });

  await batch.commit();
  logger.info('Analytics written', { dateStr, totals: newTotals });

  return newTotals;
}

/**
 * Main aggregation function - aggregates metrics for a given date.
 * @param {string} dateStr - Date in YYYY-MM-DD format (defaults to yesterday)
 */
async function runDailyAggregation(dateStr = null) {
  const targetDate = dateStr || getYesterdayDateStr();
  logger.info(`Starting daily aggregation for ${targetDate}`);

  try {
    const metrics = await aggregateMetricsForDate(targetDate);
    const totals = await writeAnalytics(targetDate, metrics);

    return {
      success: true,
      date: targetDate,
      metrics,
      totals,
    };
  } catch (err) {
    logger.error('Daily aggregation failed', err);
    return {
      success: false,
      date: targetDate,
      error: err.message,
    };
  }
}

/**
 * Scheduled function - runs daily at 2 AM UTC.
 * Aggregates the previous day's metrics.
 */
const aggregateDailyMetrics = onSchedule(
  {
    schedule: '0 2 * * *', // 2:00 AM UTC daily
    timeZone: 'UTC',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (_event) => {
    logger.info('Scheduled aggregateDailyMetrics triggered');
    const result = await runDailyAggregation();
    logger.info('Scheduled aggregation complete', result);
    return result;
  },
);

module.exports = {
  aggregateDailyMetrics,
  runDailyAggregation,
  aggregateMetricsForDate,
  getDateRange,
  formatDateKey,
};
