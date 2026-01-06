/* eslint-disable */
/**
 * Printify Webhook Handler
 *
 * Receives webhook events from Printify for order status updates.
 * Updates fulfillment records in Firestore when orders ship or status changes.
 *
 * Reference: docs/Phase-2-Checklist.md - Section 4: Webhook Implementation
 *
 * Webhook Events Handled:
 * - order:shipment:created → tracking available, email customer
 * - order:shipment:delivered → mark delivered
 * - order:updated → status changes (in-production, fulfilled, etc.)
 *
 * @module functions/printifyWebhook
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('./admin');

const { validateWebhookSignature } = require('./printify');
const { sendEmail } = require('./sesEmail');

// Secrets
const PRINTIFY_WEBHOOK_SECRET = defineSecret('PRINTIFY_WEBHOOK_SECRET');
const PRINTIFY_API_TOKEN = defineSecret('PRINTIFY_API_TOKEN');
const PRINTIFY_SHOP_ID = defineSecret('PRINTIFY_SHOP_ID');
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const AWS_SES_REGION = defineSecret('AWS_SES_REGION');

/**
 * Map Printify order status to our internal status.
 */
function mapPrintifyStatus(printifyStatus) {
  const statusMap = {
    pending: 'pending',
    'on-hold': 'on-hold',
    'sending-to-production': 'processing',
    'in-production': 'in-production',
    'has-issues': 'has-issues',
    shipped: 'shipped',
    delivered: 'delivered',
    canceled: 'canceled',
  };
  return statusMap[printifyStatus] || printifyStatus;
}

/**
 * Find fulfillment document by Printify order ID.
 * Searches fulfillments collection for matching printifyOrderId.
 *
 * @param {string} printifyOrderId - The Printify order ID
 * @returns {Promise<{ref: FirebaseFirestore.DocumentReference, data: Object}|null>}
 */
async function findFulfillmentByPrintifyOrderId(printifyOrderId) {
  const snapshot = await db
    .collection('fulfillments')
    .where('printifyOrderId', '==', printifyOrderId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

/**
 * Handle order:shipment:created webhook.
 * Stores tracking info and can trigger customer email.
 */
async function handleShipmentCreated(payload) {
  const { id: printifyOrderId, shipments } = payload;

  if (!printifyOrderId) {
    logger.warn('shipment:created missing order id', { payload });
    return { updated: false, reason: 'missing_order_id' };
  }

  const fulfillment = await findFulfillmentByPrintifyOrderId(printifyOrderId);
  if (!fulfillment) {
    logger.warn('shipment:created no matching fulfillment', { printifyOrderId });
    return { updated: false, reason: 'fulfillment_not_found' };
  }

  // Extract tracking info from the first shipment (most common case)
  const shipment = shipments?.[0] || {};
  const trackingNumber = shipment.tracking_number || null;
  const carrier = shipment.carrier || null;
  const trackingUrl = shipment.tracking_url || null;

  const updateData = {
    printifyStatus: 'shipped',
    trackingNumber,
    carrier,
    trackingUrl,
    shippedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await fulfillment.ref.update(updateData);

  logger.info('shipment:created processed', {
    printifyOrderId,
    fulfillmentId: fulfillment.ref.id,
    trackingNumber,
    carrier,
  });

  // Also update the corresponding purchase document if it exists
  const { firebaseId } = fulfillment.data;
  if (firebaseId) {
    try {
      const purchaseQuery = await db
        .collection('purchases')
        .where('paymentIntentId', '==', fulfillment.ref.id)
        .where('userId', '==', firebaseId)
        .limit(1)
        .get();

      if (!purchaseQuery.empty) {
        await purchaseQuery.docs[0].ref.update({
          shippingStatus: 'shipped',
          trackingNumber,
          carrier,
          trackingUrl,
          shippedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.warn('Failed to update purchase doc', { error: err.message });
    }
  }

  // Send shipping confirmation email
  const customerEmail = fulfillment.data.customerEmail;
  if (customerEmail && trackingNumber) {
    try {
      // Set AWS creds for SES
      process.env.AWS_ACCESS_KEY_ID = AWS_ACCESS_KEY_ID.value();
      process.env.AWS_SECRET_ACCESS_KEY = AWS_SECRET_ACCESS_KEY.value();
      process.env.AWS_SES_REGION = AWS_SES_REGION.value() || 'us-east-1';

      await sendEmail({
        to: customerEmail,
        from: 'RAGESTATE <orders@ragestate.com>',
        subject: '📦 Your RAGESTATE order has shipped!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #000;">Your order is on its way!</h1>
            <p>Great news! Your RAGESTATE order has shipped.</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Carrier:</strong> ${carrier || 'Standard Shipping'}</p>
              <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
              ${trackingUrl ? `<p style="margin: 0;"><a href="${trackingUrl}" style="color: #000; font-weight: bold;">Track Your Package →</a></p>` : ''}
            </div>
            <p>Thanks for raging with us! 🔥</p>
            <p style="color: #666; font-size: 14px;">— The RAGESTATE Team</p>
          </div>
        `,
      });
      logger.info('Shipping confirmation email sent', { customerEmail, trackingNumber });
    } catch (emailErr) {
      logger.warn('Failed to send shipping email', { error: emailErr.message, customerEmail });
    }
  }

  return { updated: true, trackingNumber, carrier, emailSent: !!customerEmail };
}

/**
 * Handle order:shipment:delivered webhook.
 * Marks order as delivered.
 */
async function handleShipmentDelivered(payload) {
  const { id: printifyOrderId } = payload;

  if (!printifyOrderId) {
    logger.warn('shipment:delivered missing order id', { payload });
    return { updated: false, reason: 'missing_order_id' };
  }

  const fulfillment = await findFulfillmentByPrintifyOrderId(printifyOrderId);
  if (!fulfillment) {
    logger.warn('shipment:delivered no matching fulfillment', { printifyOrderId });
    return { updated: false, reason: 'fulfillment_not_found' };
  }

  const updateData = {
    printifyStatus: 'delivered',
    deliveredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await fulfillment.ref.update(updateData);

  logger.info('shipment:delivered processed', {
    printifyOrderId,
    fulfillmentId: fulfillment.ref.id,
  });

  // Also update purchase document
  const { firebaseId } = fulfillment.data;
  if (firebaseId) {
    try {
      const purchaseQuery = await db
        .collection('purchases')
        .where('paymentIntentId', '==', fulfillment.ref.id)
        .where('userId', '==', firebaseId)
        .limit(1)
        .get();

      if (!purchaseQuery.empty) {
        await purchaseQuery.docs[0].ref.update({
          shippingStatus: 'delivered',
          deliveredAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.warn('Failed to update purchase doc', { error: err.message });
    }
  }

  return { updated: true };
}

/**
 * Handle order:updated webhook.
 * Updates status when order moves through production stages.
 */
async function handleOrderUpdated(payload) {
  const { id: printifyOrderId, status } = payload;

  if (!printifyOrderId) {
    logger.warn('order:updated missing order id', { payload });
    return { updated: false, reason: 'missing_order_id' };
  }

  const fulfillment = await findFulfillmentByPrintifyOrderId(printifyOrderId);
  if (!fulfillment) {
    // This is expected for orders not yet in our system
    logger.debug('order:updated no matching fulfillment', { printifyOrderId });
    return { updated: false, reason: 'fulfillment_not_found' };
  }

  const mappedStatus = mapPrintifyStatus(status);
  const updateData = {
    printifyStatus: mappedStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await fulfillment.ref.update(updateData);

  logger.info('order:updated processed', {
    printifyOrderId,
    fulfillmentId: fulfillment.ref.id,
    status: mappedStatus,
  });

  return { updated: true, status: mappedStatus };
}

/**
 * Main webhook handler.
 * Validates signature and routes to appropriate handler.
 */
async function handleWebhook(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for signature validation
  const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
  const signature = req.headers['x-pfy-signature'];

  // Validate signature
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('PRINTIFY_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!validateWebhookSignature(rawBody, signature, secret)) {
    logger.warn('Invalid webhook signature', {
      signature: signature?.substring(0, 10) + '...',
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse event
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    logger.warn('Failed to parse webhook payload', { error: err.message });
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const topic = req.headers['x-pfy-topic'] || payload.type || 'unknown';

  logger.info('Printify webhook received', {
    topic,
    orderId: payload.id,
  });

  // Route to handler
  let result;
  try {
    switch (topic) {
      case 'order:shipment:created':
        result = await handleShipmentCreated(payload);
        break;
      case 'order:shipment:delivered':
        result = await handleShipmentDelivered(payload);
        break;
      case 'order:updated':
        result = await handleOrderUpdated(payload);
        break;
      default:
        logger.info('Unhandled webhook topic', { topic });
        result = { handled: false, topic };
    }
  } catch (err) {
    logger.error('Webhook handler error', {
      topic,
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Handler failed', message: err.message });
  }

  return res.status(200).json({ success: true, topic, result });
}

// Export the Cloud Function
exports.printifyWebhook = onRequest(
  {
    secrets: [
      PRINTIFY_WEBHOOK_SECRET,
      PRINTIFY_API_TOKEN,
      PRINTIFY_SHOP_ID,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_SES_REGION,
    ],
    invoker: 'public', // Printify needs to call this publicly
  },
  handleWebhook,
);
