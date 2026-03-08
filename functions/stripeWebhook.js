/* eslint-disable */
/**
 * Stripe Webhook Handler
 *
 * Receives webhook events from Stripe for payment lifecycle events.
 * Acts as a safety net to catch payments the client-side finalize-order
 * flow may have missed (app crash, network failure after payment).
 *
 * Webhook Events Handled:
 * - payment_intent.succeeded → verify fulfillment exists, log if missing
 * - payment_intent.payment_failed → log for monitoring
 * - charge.refunded → update fulfillment/purchase status
 * - charge.dispute.created → flag for admin review
 *
 * Idempotency:
 * Uses processedWebhookEvents collection (same pattern as Printify).
 * Stripe event IDs (evt_*) are unique and stable across retries.
 *
 * TRADE-OFF: The dedup record is written BEFORE the handler executes.
 * If the handler fails after dedup write, retries will be skipped.
 * This prevents duplicate side-effects (double fulfillment, duplicate
 * emails) which are harder to undo than a missed update.
 *
 * @module functions/stripeWebhook
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('./admin');

// Secrets
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Verify Stripe webhook signature using the Stripe SDK.
 * Returns the parsed event or null if verification fails.
 */
function verifyStripeSignature(rawBody, signature, webhookSecret, stripeKey) {
  try {
    const stripe = require('stripe')(stripeKey);
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logger.warn('Stripe signature verification failed', {
      error: err.message,
    });
    return null;
  }
}

/**
 * Handle payment_intent.succeeded
 * Check that fulfillment exists — if not, log a warning for manual review.
 * The actual fulfillment is created by the client-side finalize-order call;
 * this handler is a safety net, not the primary fulfillment path.
 */
async function handlePaymentSucceeded(event) {
  const pi = event.data.object;
  const paymentIntentId = pi.id;
  const firebaseId = pi.metadata?.firebaseId || null;

  logger.info('payment_intent.succeeded received', {
    paymentIntentId,
    amount: pi.amount,
    currency: pi.currency,
    firebaseId,
  });

  // Check if fulfillment already exists (created by finalize-order)
  const fulfillRef = db.collection('fulfillments').doc(paymentIntentId);
  const fulfillDoc = await fulfillRef.get();

  if (fulfillDoc.exists) {
    logger.info('Fulfillment already exists for payment', { paymentIntentId });
    return { status: 'already_fulfilled', paymentIntentId };
  }

  // No fulfillment yet — this could mean the client hasn't called finalize-order yet.
  // Log a warning. A separate scheduled job or alert could pick these up for manual review.
  logger.warn('Payment succeeded but no fulfillment found', {
    paymentIntentId,
    firebaseId,
    amount: pi.amount,
    currency: pi.currency,
    customerEmail: pi.receipt_email || pi.metadata?.email || '',
  });

  // Record the unfulfilled payment for monitoring
  await db.collection('unfulfilledPayments').doc(paymentIntentId).set({
    paymentIntentId,
    firebaseId,
    amount: pi.amount,
    currency: pi.currency,
    customerEmail: pi.receipt_email || pi.metadata?.email || '',
    stripeEventId: event.id,
    detectedAt: FieldValue.serverTimestamp(),
    status: 'pending_review',
  });

  return { status: 'unfulfilled_flagged', paymentIntentId };
}

/**
 * Handle payment_intent.payment_failed
 * Log for monitoring and analytics.
 */
async function handlePaymentFailed(event) {
  const pi = event.data.object;
  const lastError = pi.last_payment_error;

  logger.warn('payment_intent.payment_failed', {
    paymentIntentId: pi.id,
    firebaseId: pi.metadata?.firebaseId || null,
    errorCode: lastError?.code || 'unknown',
    errorMessage: lastError?.message || 'unknown',
    amount: pi.amount,
  });

  return { status: 'logged', paymentIntentId: pi.id };
}

/**
 * Handle charge.refunded
 * Update fulfillment and purchase records with refund status.
 */
async function handleChargeRefunded(event) {
  const charge = event.data.object;
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    logger.warn('charge.refunded missing payment_intent', { chargeId: charge.id });
    return { status: 'skipped', reason: 'no_payment_intent' };
  }

  logger.info('charge.refunded received', {
    chargeId: charge.id,
    paymentIntentId,
    amountRefunded: charge.amount_refunded,
    refunded: charge.refunded, // true if fully refunded
  });

  // Update fulfillment if it exists
  const fulfillRef = db.collection('fulfillments').doc(paymentIntentId);
  const fulfillDoc = await fulfillRef.get();

  if (fulfillDoc.exists) {
    await fulfillRef.update({
      refundStatus: charge.refunded ? 'full' : 'partial',
      amountRefunded: charge.amount_refunded,
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Update any matching purchase documents
  try {
    const purchaseQuery = await db
      .collection('purchases')
      .where('paymentIntentId', '==', paymentIntentId)
      .limit(5)
      .get();

    for (const doc of purchaseQuery.docs) {
      await doc.ref.update({
        refundStatus: charge.refunded ? 'full' : 'partial',
        amountRefunded: charge.amount_refunded,
        refundedAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    logger.warn('Failed to update purchase docs for refund', {
      paymentIntentId,
      error: err.message,
    });
  }

  return { status: 'processed', paymentIntentId, refunded: charge.refunded };
}

/**
 * Handle charge.dispute.created
 * Flag for admin review.
 */
async function handleDisputeCreated(event) {
  const dispute = event.data.object;
  const chargeId = dispute.charge;
  const paymentIntentId = dispute.payment_intent;

  logger.error('charge.dispute.created — REQUIRES ADMIN REVIEW', {
    disputeId: dispute.id,
    chargeId,
    paymentIntentId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status,
  });

  // Record dispute for admin dashboard
  await db.collection('disputes').doc(dispute.id).set({
    disputeId: dispute.id,
    chargeId,
    paymentIntentId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    stripeEventId: event.id,
    createdAt: FieldValue.serverTimestamp(),
    reviewStatus: 'pending',
  });

  return { status: 'flagged', disputeId: dispute.id };
}

/**
 * Main Stripe webhook handler.
 * Verifies signature, deduplicates events, and routes to handler.
 */
async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = req.rawBody?.toString('utf8') || '';
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    logger.warn('Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
  const stripeKey = STRIPE_SECRET.value();

  if (!webhookSecret || !stripeKey) {
    logger.error('Stripe secrets not configured');
    return res.status(500).json({ error: 'Webhook secrets not configured' });
  }

  // Verify signature and parse event
  const event = verifyStripeSignature(rawBody, signature, webhookSecret, stripeKey);
  if (!event) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventId = event.id;
  const eventType = event.type;

  logger.info('Stripe webhook received', { eventId, eventType });

  // Idempotency: skip already-processed events (Stripe retries on timeout).
  //
  // TRADE-OFF: Dedup record written BEFORE handler executes.
  // If handler fails after dedup write, retries will be skipped.
  // This prevents duplicate side-effects (double fulfillment, duplicate
  // status updates) which are harder to undo than a missed webhook.
  const dedupRef = db.collection('processedWebhookEvents').doc(eventId);
  const dedupDoc = await dedupRef.get();
  if (dedupDoc.exists) {
    logger.info('Duplicate Stripe webhook skipped', { eventId, eventType });
    return res.status(200).json({ success: true, skipped: true, eventId });
  }

  // Record this event before processing (with 30-day TTL for auto-cleanup)
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await dedupRef.set({
    processedAt: FieldValue.serverTimestamp(),
    expireAt: thirtyDaysFromNow,
    source: 'stripe',
    eventType,
    eventId,
  });

  // Route to handler
  let result;
  try {
    switch (eventType) {
      case 'payment_intent.succeeded':
        result = await handlePaymentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(event);
        break;
      case 'charge.refunded':
        result = await handleChargeRefunded(event);
        break;
      case 'charge.dispute.created':
        result = await handleDisputeCreated(event);
        break;
      default:
        logger.info('Unhandled Stripe event type', { eventType });
        result = { handled: false, eventType };
    }
  } catch (err) {
    logger.error('Stripe webhook handler error', {
      eventType,
      eventId,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Handler failed', message: err.message });
  }

  return res.status(200).json({ success: true, eventType, result });
}

// Export the Cloud Function
exports.stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
    invoker: 'public', // Stripe needs to call this publicly
  },
  handleWebhook,
);
