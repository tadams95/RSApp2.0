/* eslint-disable */
'use strict';

/**
 * Server-side rate limiting utility for Cloud Functions.
 * Uses Firestore for persistent tracking across function invocations.
 *
 * This provides a more robust rate limiting than client-side localStorage,
 * since it cannot be bypassed by clearing browser storage.
 */

const logger = require('firebase-functions/logger');
const { db } = require('./admin');

// Rate limit configurations
const RATE_LIMIT_CONFIGS = {
  // Notifications batch mark as read: 10 calls per minute
  BATCH_MARK_READ: {
    collection: 'rateLimits',
    maxAttempts: 10,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'batch_mark_read',
  },
  // Test push: 5 calls per minute (admin only, but still rate limited)
  TEST_PUSH: {
    collection: 'rateLimits',
    maxAttempts: 5,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'test_push',
  },
  // Create Stripe customer: 3 calls per 5 minutes
  CREATE_CUSTOMER: {
    collection: 'rateLimits',
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
    keyPrefix: 'create_customer',
  },
  // Generic auth action: 10 per minute (for API endpoints)
  AUTH_ACTION: {
    collection: 'rateLimits',
    maxAttempts: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'auth_action',
  },
};

/**
 * Check and record a rate-limited action.
 * Uses Firestore transaction for atomic check-and-increment.
 *
 * @param {string} configKey - Key from RATE_LIMIT_CONFIGS (e.g., 'BATCH_MARK_READ')
 * @param {string} identifier - User ID, IP address, or other unique identifier
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: Date | null, message: string }>}
 */
async function checkRateLimit(configKey, identifier) {
  const config = RATE_LIMIT_CONFIGS[configKey];
  if (!config) {
    logger.warn('Unknown rate limit config key', { configKey });
    return { allowed: true, remaining: 0, resetAt: null, message: '' };
  }

  const { collection, maxAttempts, windowMs, keyPrefix } = config;
  const docId = `${keyPrefix}_${identifier}`;
  const docRef = db.collection(collection).doc(docId);
  const now = Date.now();

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      let data = snap.exists ? snap.data() : { attempts: [], windowStart: now };

      // Clean up attempts outside the current window
      const windowStart = now - windowMs;
      const recentAttempts = (data.attempts || []).filter((ts) => ts > windowStart);

      // Check if rate limited
      if (recentAttempts.length >= maxAttempts) {
        const oldestAttempt = Math.min(...recentAttempts);
        const resetAt = new Date(oldestAttempt + windowMs);
        const remainingMs = resetAt.getTime() - now;
        const remainingSecs = Math.ceil(remainingMs / 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Rate limit exceeded. Please try again in ${remainingSecs} seconds.`,
        };
      }

      // Record this attempt
      recentAttempts.push(now);
      tx.set(docRef, {
        attempts: recentAttempts,
        lastAttempt: now,
        identifier,
        updatedAt: now,
      });

      return {
        allowed: true,
        remaining: maxAttempts - recentAttempts.length,
        resetAt: null,
        message: '',
      };
    });

    return result;
  } catch (err) {
    // On error, fail open (allow the request) but log it
    logger.error('Rate limit check failed', { configKey, identifier, err });
    return { allowed: true, remaining: 0, resetAt: null, message: '' };
  }
}

/**
 * Higher-order function to wrap an onCall handler with rate limiting.
 * Throws HttpsError if rate limited.
 *
 * @param {string} configKey - Key from RATE_LIMIT_CONFIGS
 * @param {Function} handler - The actual onCall handler function
 * @param {Object} [options] - Options for identifier extraction
 * @param {Function} [options.getIdentifier] - Custom function to extract identifier from request
 * @returns {Function} Wrapped handler
 */
function withRateLimit(configKey, handler, options = {}) {
  const { HttpsError } = require('firebase-functions/v2/https');

  return async (request) => {
    // Default: use authenticated user's UID, or fall back to IP
    const getIdentifier =
      options.getIdentifier ||
      ((req) => {
        if (req.auth && req.auth.uid) return req.auth.uid;
        // For HTTP requests, try to get IP
        if (req.rawRequest && req.rawRequest.ip) return req.rawRequest.ip;
        return 'anonymous';
      });

    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(configKey, identifier);

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit enforced', { configKey, identifier });
      throw new HttpsError('resource-exhausted', rateLimitResult.message);
    }

    // Call the original handler
    return handler(request);
  };
}

/**
 * Middleware-style rate limiter for Express routes.
 * Returns early with 429 if rate limited.
 *
 * @param {string} configKey - Key from RATE_LIMIT_CONFIGS
 * @param {Object} [options] - Options for identifier extraction
 * @param {Function} [options.getIdentifier] - Custom function to extract identifier from req
 * @returns {Function} Express middleware
 */
function rateLimitMiddleware(configKey, options = {}) {
  return async (req, res, next) => {
    const getIdentifier =
      options.getIdentifier ||
      ((r) => {
        // Try to get authenticated user ID from request
        if (r.user && r.user.uid) return r.user.uid;
        // Fall back to IP address
        return r.ip || r.headers['x-forwarded-for'] || 'anonymous';
      });

    const identifier = getIdentifier(req);
    const rateLimitResult = await checkRateLimit(configKey, identifier);

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit enforced via middleware', { configKey, identifier });
      return res.status(429).json({
        error: 'rate_limited',
        message: rateLimitResult.message,
        resetAt: rateLimitResult.resetAt ? rateLimitResult.resetAt.toISOString() : null,
      });
    }

    next();
  };
}

/**
 * Cleanup old rate limit documents (run periodically via scheduler).
 * Removes documents that haven't been updated in 24 hours.
 *
 * @returns {Promise<{ deleted: number }>}
 */
async function cleanupRateLimitDocs() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
  const snapshot = await db
    .collection('rateLimits')
    .where('updatedAt', '<', cutoff)
    .limit(500)
    .get();

  if (snapshot.empty) {
    return { deleted: 0 };
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  logger.info('Cleaned up rate limit docs', { deleted: snapshot.size });
  return { deleted: snapshot.size };
}

// --- Scheduled Cloud Function for cleanup ---
const { onSchedule } = require('firebase-functions/v2/scheduler');

/**
 * Scheduled function to clean up old rate limit documents.
 * Runs daily at 3 AM UTC.
 */
const scheduledRateLimitCleanup = onSchedule('0 3 * * *', async (event) => {
  logger.info('Running scheduled rate limit cleanup');
  const result = await cleanupRateLimitDocs();
  logger.info('Rate limit cleanup complete', result);
  return result;
});

module.exports = {
  RATE_LIMIT_CONFIGS,
  checkRateLimit,
  withRateLimit,
  rateLimitMiddleware,
  cleanupRateLimitDocs,
  scheduledRateLimitCleanup,
};
