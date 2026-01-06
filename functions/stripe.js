/* eslint-disable */
'use strict';

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const express = require('express');
const cors = require('cors');
const { admin, db } = require('./admin');
const { createShopifyOrder, isShopifyConfigured } = require('./shopifyAdmin');
const { checkRateLimit } = require('./rateLimit');
const { sendEmail, sendBulkEmail } = require('./sesEmail');
const {
  isPrintifyConfigured,
  createOrder: createPrintifyOrder,
  findByVariantSku,
  createWebhook: createPrintifyWebhook,
  getWebhooks: getPrintifyWebhooks,
} = require('./printify');
const { runDailyAggregation } = require('./analytics');

// Secret Manager: define secrets. Also support process.env for local dev.
const STRIPE_SECRET = defineSecret('STRIPE_SECRET');
const PROXY_KEY = defineSecret('PROXY_KEY');
const SHOPIFY_ADMIN_ACCESS_TOKEN = defineSecret('SHOPIFY_ADMIN_ACCESS_TOKEN');
const SHOPIFY_SHOP_NAME = defineSecret('SHOPIFY_SHOP_NAME');
// AWS SES secrets for ticket transfer emails
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const AWS_SES_REGION = defineSecret('AWS_SES_REGION');
// Printify fulfillment secrets
const PRINTIFY_API_TOKEN = defineSecret('PRINTIFY_API_TOKEN');
const PRINTIFY_SHOP_ID = defineSecret('PRINTIFY_SHOP_ID');
const PRINTIFY_WEBHOOK_SECRET = defineSecret('PRINTIFY_WEBHOOK_SECRET');
let stripeClient;
function getStripe() {
  const key = STRIPE_SECRET.value() || process.env.STRIPE_SECRET;
  if (!key) return null;
  if (!stripeClient || stripeClient._apiKey !== key) {
    stripeClient = require('stripe')(key);
    stripeClient._apiKey = key;
  }
  return stripeClient;
}

// Metrics helper: increment per-event counters without failing the main path
async function incrementEventMetrics(eventId, increments) {
  try {
    if (!eventId || typeof eventId !== 'string') return;
    const ref = db.collection('metrics').doc('events').collection('events').doc(eventId);
    const payload = Object.assign(
      { lastUpdated: admin.firestore.FieldValue.serverTimestamp() },
      Object.fromEntries(
        Object.entries(increments || {}).map(([k, v]) => [
          k,
          admin.firestore.FieldValue.increment(v),
        ]),
      ),
    );
    await ref.set(payload, { merge: true });
  } catch (e) {
    try {
      logger.warn('incrementEventMetrics failed (non-fatal)', { message: e?.message });
    } catch (_e) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-APP NOTIFICATION HELPER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create an in-app notification for a user
 * Simplified version for ticket transfer notifications
 */
async function createTransferNotification({
  uid,
  type,
  title,
  body,
  data = {},
  link = '/',
  sendPush = true,
}) {
  if (!uid) return null;
  try {
    const notifRef = db.collection('users').doc(uid).collection('notifications').doc();
    const payload = {
      type,
      title,
      body,
      data,
      link,
      deepLink: `ragestate://${link.replace(/^\//, '')}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      seenAt: null,
      read: false,
      sendPush,
      pushSentAt: null,
      pushStatus: 'pending',
    };
    await db.runTransaction(async (tx) => {
      tx.set(notifRef, payload);
      // Increment unread counter
      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);
      const current =
        userSnap.exists && typeof userSnap.data().unreadNotifications === 'number'
          ? userSnap.data().unreadNotifications
          : 0;
      tx.update(userRef, { unreadNotifications: current + 1 });
    });
    return notifRef.id;
  } catch (err) {
    logger.warn('createTransferNotification failed (non-fatal)', { uid, type, error: String(err) });
    return null;
  }
}

const app = express();
// CORS: allow all origins in development and valid origins in prod via Firebase hosting/proxy.
const corsMiddleware = cors({ origin: true });
app.use(corsMiddleware);
// Respond to preflight requests so the browser receives CORS headers
app.options('*', corsMiddleware);
app.use(express.json());

// Lightweight request logger to help debug routing vs. handler logic
app.use((req, _res, next) => {
  try {
    logger.info('incoming request', {
      method: req.method,
      path: req.path,
      origin: req.get('origin') || '',
      ua: req.get('user-agent') || '',
    });
  } catch (_e) {
    // no-op
  }
  next();
});

app.get('/health', (_req, res) => {
  const configured = Boolean(STRIPE_SECRET.value() || process.env.STRIPE_SECRET);
  res.json({ ok: true, stripeConfigured: configured });
});

// Test endpoint to verify Shopify Admin API connection
app.get('/test-shopify', async (req, res) => {
  try {
    // Check proxy key for security
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const shopifyConfigured = isShopifyConfigured();

    if (!shopifyConfigured) {
      return res.json({
        ok: false,
        shopifyConfigured: false,
        message:
          'Shopify Admin API not configured. Set SHOPIFY_ADMIN_ACCESS_TOKEN and SHOPIFY_SHOP_NAME secrets.',
      });
    }

    // Try to fetch shop info to verify the connection
    const shopName = process.env.SHOPIFY_SHOP_NAME;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const apiVersion = '2024-10';

    const response = await fetch(
      `https://${shopName}.myshopify.com/admin/api/${apiVersion}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Shopify] Test connection failed', {
        status: response.status,
        error: errorText,
      });
      return res.json({
        ok: false,
        shopifyConfigured: true,
        connectionTest: 'failed',
        status: response.status,
        error: errorText,
      });
    }

    const data = await response.json();
    const shop = data.shop;

    logger.info('[Shopify] Test connection successful', {
      shopName: shop.name,
      domain: shop.domain,
    });

    return res.json({
      ok: true,
      shopifyConfigured: true,
      connectionTest: 'passed',
      shop: {
        name: shop.name,
        email: shop.email,
        domain: shop.domain,
        currency: shop.currency,
        plan: shop.plan_name,
      },
    });
  } catch (error) {
    logger.error('[Shopify] Test connection exception', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Test endpoint to create a DRAFT order in Shopify (safe - doesn't affect inventory)
app.post('/test-shopify-draft-order', async (req, res) => {
  try {
    // Check proxy key for security
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const shopName = process.env.SHOPIFY_SHOP_NAME;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!shopName || !accessToken) {
      return res.json({
        ok: false,
        error: 'Shopify not configured',
      });
    }

    const apiVersion = '2024-10';

    // Create a simple draft order with a custom line item (no real product needed)
    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: 'TEST ITEM - Delete This Order',
            price: '0.01',
            quantity: 1,
            requires_shipping: true,
          },
        ],
        customer: {
          email: 'test@ragestate.com',
          first_name: 'Test',
          last_name: 'Order',
        },
        shipping_address: {
          first_name: 'Test',
          last_name: 'Order',
          address1: '123 Test Street',
          city: 'Los Angeles',
          province: 'CA',
          zip: '90001',
          country: 'US',
        },
        note: 'TEST DRAFT ORDER - Safe to delete. Created by RAGESTATE integration test.',
        tags: 'test, auto-delete, ragestate-integration-test',
      },
    };

    logger.info('[Shopify] Creating test draft order');

    const response = await fetch(
      `https://${shopName}.myshopify.com/admin/api/${apiVersion}/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(draftOrderPayload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Shopify] Draft order creation failed', {
        status: response.status,
        error: errorText,
      });
      return res.json({
        ok: false,
        error: 'Failed to create draft order',
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
    const draftOrder = data.draft_order;

    logger.info('[Shopify] Test draft order created successfully', {
      draftOrderId: draftOrder.id,
      name: draftOrder.name,
    });

    return res.json({
      ok: true,
      message: 'Draft order created successfully! Check your Shopify Admin > Orders > Drafts',
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        status: draftOrder.status,
        total_price: draftOrder.total_price,
        created_at: draftOrder.created_at,
        admin_url: `https://${shopName}.myshopify.com/admin/draft_orders/${draftOrder.id}`,
      },
      note: 'This is a TEST draft order. You can safely delete it from Shopify Admin.',
    });
  } catch (error) {
    logger.error('[Shopify] Draft order test exception', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// Example placeholder; add endpoints when Stripe is reactivated
app.post('/create-payment-intent', async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe disabled' });
    // Enforce that requests come via our Next.js proxy when configured
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const {
      amount,
      currency = 'usd',
      customerEmail,
      name,
      firebaseId,
      cartItems,
      promoCode, // NEW: Optional promo code
    } = req.body || {};

    // Basic input validation (server-side)
    const parsedAmount = Number.isFinite(amount) ? Math.floor(Number(amount)) : 0;
    const MIN_AMOUNT = 50; // 50 cents
    if (!parsedAmount || parsedAmount < MIN_AMOUNT) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Validate and apply promo code if provided
    let finalAmount = parsedAmount;
    let promoValidation = null;
    if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
      promoValidation = await validatePromoCodeInternal(promoCode.trim(), parsedAmount);
      if (promoValidation.valid) {
        finalAmount = Math.max(MIN_AMOUNT, parsedAmount - promoValidation.discountAmount);
        logger.info('Promo code applied to payment intent', {
          originalAmount: parsedAmount,
          discountAmount: promoValidation.discountAmount,
          finalAmount,
          promoCode: promoValidation.promoId,
        });
      } else {
        // Promo code invalid - return error so client can handle
        return res.status(400).json({
          error: 'Invalid promo code',
          promoError: promoValidation.message,
        });
      }
    }

    const idempotencyKey = req.get('x-idempotency-key') || undefined;

    const pi = await stripe.paymentIntents.create(
      {
        amount: finalAmount,
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          firebaseId: firebaseId || '',
          email: customerEmail || '',
          name: name || '',
          cartSize: Array.isArray(cartItems) ? String(cartItems.length) : '0',
          // Store promo info for finalize-order to use
          promoCode: promoValidation?.promoId || '',
          promoCollection: promoValidation?.promoCollection || '',
          promoDiscountAmount: promoValidation?.discountAmount
            ? String(promoValidation.discountAmount)
            : '',
          originalAmount: promoValidation?.valid ? String(parsedAmount) : '',
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    // Return client secret plus promo info for UI
    const response = { client_secret: pi.client_secret };
    if (promoValidation?.valid) {
      response.promo = {
        applied: true,
        code: promoValidation.displayCode,
        discountAmount: promoValidation.discountAmount,
        originalAmount: parsedAmount,
        finalAmount,
        promoId: promoValidation.promoId,
        promoCollection: promoValidation.promoCollection,
      };
    }
    res.json(response);
  } catch (err) {
    logger.error('create-payment-intent error', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// HTTPS endpoint to create (or reuse) a Stripe customer, gated by PROXY_KEY
app.post('/create-customer', async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe disabled' });

    // Enforce that requests come via our Next.js proxy when configured
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { uid, email, name } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email required' });
    }

    // If we have a uid, reuse existing mapping from Firestore if present
    let existingId = '';
    if (uid && typeof uid === 'string' && uid.trim()) {
      try {
        const custRef = db.collection('customers').doc(uid);
        const snap = await custRef.get();
        if (snap.exists && snap.data() && snap.data().stripeCustomerId) {
          existingId = snap.data().stripeCustomerId;
        }
      } catch (e) {
        logger.warn('Firestore read failed when checking existing customer (non-fatal)', e);
      }
    }

    if (existingId) {
      const description =
        uid && String(uid).trim() ? `${email} — ${uid}` : `${email} — ${existingId}`;
      // Best-effort enrich existing mapping and Stripe record
      try {
        await stripe.customers.update(existingId, {
          description,
          metadata: Object.assign({}, uid ? { uid } : {}, {
            app: 'ragestate',
            source: 'firebase-functions-v2',
          }),
        });
      } catch (e) {
        logger.warn('Stripe customer update (reuse) failed (non-fatal)', e);
      }
      if (uid && typeof uid === 'string' && uid.trim()) {
        try {
          await db
            .collection('customers')
            .doc(uid)
            .set(
              { email, name, description, lastUpdated: new Date().toISOString() },
              { merge: true },
            );
        } catch (e) {
          logger.warn('Failed to update customer doc on reuse (non-fatal)', e);
        }
      }
      return res.json({ id: existingId, ok: true, reused: true, description });
    }

    // Create a new customer (metadata will be enriched after we have the id)
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: uid ? { uid } : undefined,
    });

    // Add a helpful description and enrich metadata (uid/app/source). Include uid if available, else customer id.
    const description =
      uid && String(uid).trim() ? `${email} — ${uid}` : `${email} — ${customer.id}`;
    try {
      await stripe.customers.update(customer.id, {
        description,
        metadata: Object.assign({}, uid ? { uid } : {}, {
          app: 'ragestate',
          source: 'firebase-functions-v2',
        }),
      });
    } catch (e) {
      logger.warn('Stripe customer update (description/metadata) failed (non-fatal)', e);
    }

    // Persist mapping in Firestore (and best-effort RTDB) when uid is available
    if (uid && typeof uid === 'string' && uid.trim()) {
      try {
        await Promise.all([
          db.collection('customers').doc(uid).set(
            {
              stripeCustomerId: customer.id,
              email,
              name,
              description,
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            },
            { merge: true },
          ),
          (async () => {
            try {
              await admin.database().ref(`users/${uid}/stripeCustomerId`).set(customer.id);
            } catch (e) {
              logger.warn('RTDB write failed (non-fatal)', e);
            }
          })(),
        ]);
      } catch (e) {
        logger.warn('Failed to persist Stripe customer mapping (non-fatal)', e);
      }
    }

    return res.json({ id: customer.id, ok: true, description });
  } catch (err) {
    logger.error('create-customer error', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ============================================================================
// ITEM TYPE DETECTION HELPERS
// FIX: Distinguish merchandise (Shopify products) from event tickets (Firestore events)
// Reference: MERCH_CHECKOUT_FIXES.md - Phase 1: Robust item-type detection
// ============================================================================

/**
 * Determines if a product ID represents a Shopify merchandise item.
 * Shopify product IDs contain 'gid://shopify' or are long numeric strings (10+ digits).
 * Event IDs in Firestore are typically shorter alphanumeric strings.
 *
 * @param {string} productId - The product identifier to check
 * @param {object} item - The full cart item for additional context
 * @returns {boolean} - True if this is a Shopify merchandise item
 */
function isShopifyMerchandise(productId, item) {
  if (!productId || typeof productId !== 'string') return false;

  // Check for Shopify GID format (e.g., 'gid://shopify/Product/12345678901')
  if (productId.includes('gid://shopify') || productId.toLowerCase().includes('shopify')) {
    return true;
  }

  // Shopify numeric IDs are typically 10+ digits
  if (/^\d{10,}$/.test(productId)) {
    return true;
  }

  // Check item properties that indicate merchandise
  // Merchandise has isDigital: false and no eventDetails
  if (item) {
    // If explicitly marked as digital (like event tickets), it's not merchandise
    if (item.isDigital === true) {
      return false;
    }
    // If it has eventDetails, it's an event ticket
    if (item.eventDetails != null) {
      return false;
    }
    // If it has a variantId (Shopify variant), it's merchandise
    if (item.variantId && String(item.variantId).includes('gid://shopify')) {
      return true;
    }
    // If it has size/color selections typical of apparel, likely merchandise
    if ((item.selectedSize || item.size) && (item.selectedColor || item.color)) {
      // Could be merchandise, but need to verify it's not an event
      // Events typically don't have both size AND color
    }
  }

  // If productId is short (< 30 chars) and doesn't look like Shopify, assume event
  if (productId.length < 30 && !/^\d+$/.test(productId)) {
    return false;
  }

  // Default: if it looks like a long ID, assume Shopify merchandise
  return productId.length >= 30;
}

/**
 * Categorizes cart items into event tickets and merchandise.
 * @param {Array} items - Array of cart items
 * @returns {{eventItems: Array, merchandiseItems: Array}}
 */
function categorizeCartItems(items) {
  const eventItems = [];
  const merchandiseItems = [];

  for (const item of items) {
    const productId = String(item?.productId || '').trim();
    if (!productId) continue;

    if (isShopifyMerchandise(productId, item)) {
      merchandiseItems.push(item);
    } else {
      eventItems.push(item);
    }
  }

  return { eventItems, merchandiseItems };
}

/**
 * Internal helper to validate a promo code
 * Reusable by both /validate-promo-code endpoint and /create-payment-intent
 * @param {string} code - The promo code to validate
 * @param {number} cartTotalCents - Cart total in cents
 * @returns {Object} Validation result
 */
async function validatePromoCodeInternal(code, cartTotalCents) {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Promo code is required' };
  }

  const codeLower = code.trim().toLowerCase();
  if (!codeLower) {
    return { valid: false, message: 'Promo code is required' };
  }

  // Look up promo code - try new collection first, fall back to legacy
  let promoDoc = await db.collection('promoCodes').doc(codeLower).get();
  let collectionUsed = 'promoCodes';

  if (!promoDoc.exists) {
    promoDoc = await db.collection('promoterCodes').doc(codeLower).get();
    collectionUsed = 'promoterCodes';
  }

  if (!promoDoc.exists) {
    return { valid: false, message: 'Invalid promo code' };
  }

  const promo = promoDoc.data();

  // Check if active
  if (promo.active === false) {
    return { valid: false, message: 'This promo code is no longer active' };
  }

  // Check expiration
  if (promo.expiresAt) {
    const expiresAt = promo.expiresAt.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt);
    if (expiresAt < new Date()) {
      return { valid: false, message: 'This promo code has expired' };
    }
  }

  // Check max uses
  const currentUses = promo.currentUses || 0;
  const maxUses = promo.maxUses;
  if (maxUses !== null && maxUses !== undefined && currentUses >= maxUses) {
    return { valid: false, message: 'This promo code has reached its usage limit' };
  }

  // Check minimum purchase
  const minPurchase = promo.minPurchase || 0;
  if (cartTotalCents < minPurchase) {
    const minDollars = (minPurchase / 100).toFixed(2);
    return { valid: false, message: `Minimum purchase of $${minDollars} required` };
  }

  // Calculate discount amount
  let discountAmount = 0;
  const type = promo.type || 'percentage';
  const value = promo.value || 0;

  if (type === 'percentage') {
    discountAmount = Math.round(cartTotalCents * (value / 100));
  } else if (type === 'fixed') {
    discountAmount = Math.min(value, cartTotalCents);
  }

  const displayCode = promo.code || code.toUpperCase();

  return {
    valid: true,
    discountAmount,
    displayCode,
    type,
    value,
    message: `Code "${displayCode}" applied!`,
    promoId: promoDoc.id,
    promoCollection: collectionUsed,
  };
}

/**
 * Increment promo code usage after successful order
 * @param {string} promoId - The promo code document ID (lowercase code)
 * @param {string} promoCollection - 'promoCodes' or 'promoterCodes'
 * @param {string} orderNumber - Order number for audit trail
 */
async function incrementPromoCodeUsage(promoId, promoCollection, orderNumber) {
  if (!promoId || !promoCollection) return;

  try {
    const promoRef = db.collection(promoCollection).doc(promoId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(promoRef);
      if (!snap.exists) {
        logger.warn('Promo code not found for usage increment', { promoId, promoCollection });
        return;
      }
      const data = snap.data() || {};
      const newUses = Number(data.currentUses || 0) + 1;
      tx.update(promoRef, {
        currentUses: newUses,
        lastUsed: admin.firestore.FieldValue.serverTimestamp(),
        lastOrderNumber: orderNumber,
      });
    });
    logger.info('Promo code usage incremented', { promoId, promoCollection, orderNumber });
  } catch (e) {
    logger.warn('Promo code usage increment failed (non-fatal)', {
      promoId,
      promoCollection,
      error: e?.message,
    });
  }
}

/**
 * Validate a promo code
 * POST /validate-promo-code
 * Input: { code, cartTotal }
 * Returns: { valid, discountAmount, displayCode, message }
 */
app.post('/validate-promo-code', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const cartTotalCents = parseInt(cartTotal, 10) || 0;

    const result = await validatePromoCodeInternal(code, cartTotalCents);

    if (!result.valid) {
      return res.json({
        valid: false,
        discountAmount: 0,
        displayCode: null,
        message: result.message,
      });
    }

    logger.info('Promo code validated via endpoint', {
      code: result.promoId,
      collection: result.promoCollection,
      type: result.type,
      value: result.value,
      discountAmount: result.discountAmount,
      cartTotalCents,
    });

    return res.json(result);
  } catch (err) {
    logger.error('Promo code validation error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      valid: false,
      discountAmount: 0,
      displayCode: null,
      message: 'Error validating promo code',
    });
  }
});

// Finalize order: verify payment succeeded, then create tickets (ragers) and/or merchandise orders
// FIX: Now properly handles both event tickets AND merchandise items separately
app.post('/finalize-order', async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe disabled' });

    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const {
      paymentIntentId,
      firebaseId,
      userEmail,
      userName,
      cartItems,
      addressDetails,
      appliedPromoCode,
    } = req.body || {};
    if (!paymentIntentId || !firebaseId) {
      return res.status(400).json({ error: 'paymentIntentId and firebaseId are required' });
    }

    let pi;
    try {
      pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (e) {
      logger.error('Failed to retrieve PaymentIntent', e);
      return res.status(400).json({ error: 'Invalid paymentIntentId' });
    }

    if (!pi || pi.status !== 'succeeded') {
      return res.status(409).json({ error: 'Payment not in succeeded state' });
    }

    if (
      pi.metadata &&
      pi.metadata.firebaseId &&
      String(pi.metadata.firebaseId) !== String(firebaseId)
    ) {
      return res.status(403).json({ error: 'Payment does not belong to this user' });
    }

    // Idempotency guard: ensure we only fulfill once per PaymentIntent
    const fulfillRef = db.collection('fulfillments').doc(pi.id);
    let alreadyFulfilled = false;
    let existingFulfillment = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(fulfillRef);
      if (snap.exists) {
        alreadyFulfilled = true;
        existingFulfillment = snap.data() || null;
        return;
      }
      // Derive a recipient email from request payload or PI metadata as a fallback
      const derivedEmail =
        (userEmail && String(userEmail).trim()) ||
        (pi.receipt_email && String(pi.receipt_email).trim()) ||
        (pi.metadata && String(pi.metadata.email || '').trim()) ||
        '';
      tx.set(fulfillRef, {
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        firebaseId,
        userEmail: derivedEmail,
        amount: pi.amount,
        currency: pi.currency,
      });
    });

    if (alreadyFulfilled) {
      const orderNumber = existingFulfillment?.orderNumber || null;
      const createdTickets = existingFulfillment?.createdTickets || 0;
      const createdMerchOrders = existingFulfillment?.createdMerchOrders || 0;
      const details = existingFulfillment?.details || [];
      return res.json({
        ok: true,
        idempotent: true,
        message: 'Already fulfilled',
        orderNumber,
        createdTickets,
        createdMerchOrders,
        details,
      });
    }

    const items = Array.isArray(cartItems) ? cartItems : [];
    const orderNumber = generateOrderNumber();

    // FIX: Categorize items into events vs merchandise BEFORE processing
    // Reference: MERCH_CHECKOUT_FIXES.md - Issue #1: finalize-order treats all items as events
    const { eventItems, merchandiseItems } = categorizeCartItems(items);

    logger.info('Finalize-order: received and categorized items', {
      totalCount: items.length,
      eventCount: eventItems.length,
      merchandiseCount: merchandiseItems.length,
      orderNumber,
      example: items[0]
        ? {
            productId: items[0].productId,
            quantity: items[0].quantity,
            hasEventDetails: !!items[0].eventDetails,
            isShopify: isShopifyMerchandise(items[0].productId, items[0]),
          }
        : null,
    });

    const created = [];
    const merchOrdersCreated = [];
    const errors = [];
    const crypto = require('crypto');
    const generateTicketToken = () => crypto.randomBytes(16).toString('hex');

    // ============================================================================
    // PROCESS EVENT TICKETS
    // This is the original working flow - only process items identified as events
    // ============================================================================
    for (const item of eventItems) {
      const eventId = String(item?.productId || '').trim();
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      if (!eventId) continue;

      const eventRef = db.collection('events').doc(eventId);
      logger.info('Finalize-order: processing EVENT ticket', { eventId, qty, orderNumber });
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(eventRef);
          if (!snap.exists) {
            // FIX: This should only happen for actual event items now
            // If we get here, it means our categorization might have a false negative
            throw new Error(`Event ${eventId} not found - item may have been miscategorized`);
          }
          const data = snap.data() || {};
          const currentQty = typeof data.quantity === 'number' ? data.quantity : 0;
          const newQty = Math.max(0, currentQty - qty);
          tx.update(eventRef, { quantity: newQty });

          const ragersRef = eventRef.collection('ragers');
          const token = generateTicketToken();
          const rager = {
            active: true,
            email: userEmail || pi.receipt_email || '',
            firebaseId: firebaseId,
            owner: userName || '',
            purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
            orderNumber,
            ticketQuantity: qty,
            paymentIntentId: pi.id,
            ticketToken: token,
            usedCount: 0,
          };
          const ragerDoc = ragersRef.doc();
          tx.set(ragerDoc, rager);
          // Map token → eventId/ragerId for fast lookup during scanning
          const mapRef = db.collection('ticketTokens').doc(token);
          tx.set(mapRef, {
            eventId,
            ragerId: ragerDoc.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          // Update event-user summary totals (userId-first model)
          const summaryRef = db
            .collection('eventUsers')
            .doc(eventId)
            .collection('users')
            .doc(firebaseId);
          tx.set(
            summaryRef,
            {
              totalTickets: admin.firestore.FieldValue.increment(qty),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          created.push({ type: 'event', eventId, ragerId: ragerDoc.id, qty, newQty });
        });
        logger.info('Finalize-order: EVENT ticket created successfully', { eventId, qty });
      } catch (e) {
        // FIX: Log as ERROR not warn for event ticket failures (these are critical)
        logger.error(`Finalize order: FAILED to create event ticket for eventId=${eventId}`, {
          message: e?.message,
          orderNumber,
        });
        errors.push({
          type: 'event',
          productId: eventId,
          error: e?.message || 'Unknown error',
        });
      }
    }

    // ============================================================================
    // PROCESS MERCHANDISE ITEMS
    // FIX: New flow to properly handle Shopify merchandise
    // Reference: MERCH_CHECKOUT_FIXES.md - Phase 1: Create merchandiseOrders collection
    // ============================================================================

    // Collect all merchandise items for a single Shopify order
    const merchItemsForShopify = [];

    for (const item of merchandiseItems) {
      const productId = String(item?.productId || '').trim();
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      if (!productId) continue;

      logger.info('Finalize-order: processing MERCHANDISE item', {
        productId,
        variantId: item.variantId,
        title: item.title,
        qty,
        orderNumber,
      });

      try {
        // Build shipping address object
        const shippingAddr = addressDetails
          ? {
              name: addressDetails.name || userName || '',
              line1: addressDetails.address?.line1 || '',
              line2: addressDetails.address?.line2 || '',
              city: addressDetails.address?.city || '',
              state: addressDetails.address?.state || '',
              postalCode: addressDetails.address?.postal_code || '',
              country: addressDetails.address?.country || 'US',
            }
          : null;

        // Create merchandise order document in dedicated collection
        const merchOrderDoc = {
          // Order reference
          orderNumber,
          paymentIntentId: pi.id,
          firebaseId,

          // Product details
          productId,
          variantId: item.variantId || null,
          title: item.title || item.name || productId,
          quantity: qty,
          price:
            typeof item.price === 'number'
              ? item.price
              : typeof item.price === 'string'
                ? parseFloat(item.price)
                : null,
          productImageSrc: item.productImageSrc || item.imageSrc || null,

          // Variant details
          color: item.color || item.selectedColor || null,
          size: item.size || item.selectedSize || null,

          // Customer info
          customerEmail: userEmail || pi.receipt_email || '',
          customerName: userName || '',

          // Shipping address (critical for physical items)
          shippingAddress: shippingAddr,

          // Status tracking
          status: 'pending_fulfillment',
          fulfillmentStatus: 'unfulfilled',
          shopifyOrderId: null,
          shopifyOrderNumber: null,

          // Timestamps
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Store in merchandiseOrders collection
        const merchRef = db.collection('merchandiseOrders').doc();
        await merchRef.set(merchOrderDoc);

        // Collect for Shopify batch order
        merchItemsForShopify.push({
          firestoreId: merchRef.id,
          productId,
          variantId: item.variantId || null,
          title: item.title || item.name || productId,
          quantity: qty,
          price: merchOrderDoc.price,
        });

        merchOrdersCreated.push({
          type: 'merchandise',
          orderId: merchRef.id,
          productId,
          variantId: item.variantId || null,
          title: item.title,
          qty,
        });

        logger.info('Finalize-order: MERCHANDISE order created successfully', {
          orderId: merchRef.id,
          productId,
          qty,
          orderNumber,
        });
      } catch (e) {
        // FIX: Log merchandise failures as ERRORS (not warnings) - these need attention
        logger.error(
          `Finalize order: FAILED to create merchandise order for productId=${productId}`,
          {
            message: e?.message,
            orderNumber,
            productId,
          },
        );
        errors.push({
          type: 'merchandise',
          productId,
          error: e?.message || 'Unknown error',
        });
      }
    }

    // ============================================================================
    // CREATE PRINTIFY ORDER (if we have merchandise items and Printify is configured)
    // Printify handles print-on-demand fulfillment; Shopify is display-only
    // ============================================================================
    let printifyOrderResult = null;
    if (merchItemsForShopify.length > 0) {
      const printifyConfigured = isPrintifyConfigured();
      logger.info('Finalize-order: Processing merchandise fulfillment', {
        orderNumber,
        itemCount: merchItemsForShopify.length,
        printifyConfigured,
        shopifyConfigured: isShopifyConfigured(), // Legacy, kept for logging
      });

      // Attempt Printify order if configured
      if (printifyConfigured && addressDetails) {
        try {
          // Build line items with Printify product/variant IDs
          // Strategy: Use SKU lookup or fall back to stored mapping
          const printifyLineItems = [];
          const skuLookupErrors = [];

          for (const merchItem of merchItemsForShopify) {
            // Try to find Printify product by SKU if variantId looks like a Shopify GID
            const sku = merchItem.sku || null;
            let printifyProductId = null;
            let printifyVariantId = null;

            // Check if item has Printify IDs stored (from SKU mapping or product sync)
            if (merchItem.printifyProductId && merchItem.printifyVariantId) {
              printifyProductId = merchItem.printifyProductId;
              printifyVariantId = merchItem.printifyVariantId;
            } else if (sku) {
              // Try SKU lookup in Printify
              try {
                const skuResult = await findByVariantSku(sku);
                if (skuResult) {
                  printifyProductId = skuResult.productId;
                  printifyVariantId = skuResult.variantId;
                  logger.info('Finalize-order: Found Printify product by SKU', {
                    sku,
                    printifyProductId,
                    printifyVariantId,
                  });
                }
              } catch (skuErr) {
                logger.warn('Finalize-order: SKU lookup failed', { sku, error: skuErr?.message });
              }
            }

            if (printifyProductId && printifyVariantId) {
              printifyLineItems.push({
                printifyProductId,
                printifyVariantId,
                quantity: merchItem.quantity,
                firestoreId: merchItem.firestoreId,
              });
            } else {
              skuLookupErrors.push({
                productId: merchItem.productId,
                title: merchItem.title,
                reason: 'No Printify mapping found',
              });
            }
          }

          if (printifyLineItems.length > 0) {
            // Build shipping address for Printify
            const printifyShippingAddress = {
              name: addressDetails.name || userName || '',
              email: userEmail || pi.receipt_email || '',
              phone: addressDetails.phone || '',
              line1: addressDetails.address?.line1 || '',
              line2: addressDetails.address?.line2 || '',
              city: addressDetails.address?.city || '',
              state: addressDetails.address?.state || '',
              postalCode: addressDetails.address?.postal_code || '',
              country: addressDetails.address?.country || 'US',
            };

            // Create Printify order
            printifyOrderResult = await createPrintifyOrder({
              externalId: pi.id, // Use PaymentIntent ID for correlation
              lineItems: printifyLineItems,
              shippingAddress: printifyShippingAddress,
              sendToProduction: true, // Auto-send to production
            });

            if (printifyOrderResult && printifyOrderResult.id) {
              // Update all merchandise orders with Printify order info
              const batch = db.batch();
              for (const lineItem of printifyLineItems) {
                const merchDocRef = db.collection('merchandiseOrders').doc(lineItem.firestoreId);
                batch.update(merchDocRef, {
                  printifyOrderId: printifyOrderResult.id,
                  printifyStatus: printifyOrderResult.status || 'pending',
                  fulfillmentProvider: 'printify',
                  status: 'sent_to_printify',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
              await batch.commit();

              logger.info('Finalize-order: Printify order created and linked', {
                orderNumber,
                printifyOrderId: printifyOrderResult.id,
                itemCount: printifyLineItems.length,
                skuLookupErrors: skuLookupErrors.length,
              });
            }
          } else {
            logger.warn('Finalize-order: No items could be mapped to Printify', {
              orderNumber,
              skuLookupErrors,
            });
          }

          // Log items that couldn't be mapped (need manual fulfillment or SKU sync)
          if (skuLookupErrors.length > 0) {
            logger.warn('Finalize-order: Some items lack Printify mapping', {
              orderNumber,
              unmappedCount: skuLookupErrors.length,
              items: skuLookupErrors,
            });
          }
        } catch (printifyError) {
          // Non-fatal: Printify failed but Firestore orders exist for manual fulfillment
          logger.error('Finalize-order: Printify order creation failed', {
            orderNumber,
            error: printifyError?.message,
            stack: printifyError?.stack,
          });
        }
      } else if (!addressDetails) {
        logger.warn('Finalize-order: No shipping address for merchandise', { orderNumber });
      } else {
        logger.info('Finalize-order: Printify not configured, orders saved to Firestore only', {
          orderNumber,
          itemCount: merchItemsForShopify.length,
        });
      }

      // Legacy: Attempt Shopify order if configured (fallback/parallel)
      // This is kept for potential future use but Shopify Admin is currently stubbed
      if (isShopifyConfigured()) {
        try {
          const shopifyResult = await createShopifyOrder({
            items: merchItemsForShopify,
            email: userEmail || pi.receipt_email || '',
            orderNumber: orderNumber,
            customerName: userName || '',
            shippingAddress: addressDetails
              ? {
                  name: addressDetails.name || userName || '',
                  line1: addressDetails.address?.line1 || '',
                  line2: addressDetails.address?.line2 || '',
                  city: addressDetails.address?.city || '',
                  state: addressDetails.address?.state || '',
                  postalCode: addressDetails.address?.postal_code || '',
                  country: addressDetails.address?.country || 'US',
                }
              : null,
          });

          if (shopifyResult && shopifyResult.success) {
            const batch = db.batch();
            for (const merchItem of merchItemsForShopify) {
              const merchDocRef = db.collection('merchandiseOrders').doc(merchItem.firestoreId);
              batch.update(merchDocRef, {
                shopifyOrderId: shopifyResult.shopifyOrderId,
                shopifyOrderNumber: shopifyResult.shopifyOrderNumber,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
            await batch.commit();
          }
        } catch (shopifyError) {
          logger.warn('Finalize-order: Shopify fallback failed (non-fatal)', {
            error: shopifyError?.message,
          });
        }
      }
    }

    // FIX: Check if we had critical failures
    // If ALL items failed, return an error to the client
    const totalItemsProcessed = created.length + merchOrdersCreated.length;
    const totalItemsExpected = eventItems.length + merchandiseItems.length;

    if (totalItemsExpected > 0 && totalItemsProcessed === 0) {
      logger.error('Finalize-order: ALL items failed to process', {
        orderNumber,
        errors,
        eventCount: eventItems.length,
        merchandiseCount: merchandiseItems.length,
      });
      // Update fulfillment status to failed
      try {
        await fulfillRef.set(
          {
            status: 'failed',
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            errors,
            orderNumber,
          },
          { merge: true },
        );
      } catch (_) {}
      return res.status(500).json({
        ok: false,
        error: 'Failed to process any items in the order',
        orderNumber,
        errors,
      });
    }

    // Build purchase payloads (server-side mirror of client SaveToFirestore)
    const amountTotal = typeof pi.amount === 'number' ? pi.amount : 0;
    const amountStr = (amountTotal / 100).toFixed(2);

    // FIX: Add itemType to each item for better tracking
    // Reference: MERCH_CHECKOUT_FIXES.md - Phase 2: Purchase records now indicate item types
    const sanitizedItems = items.map((i) => ({
      productId: i.productId,
      title: i.title || i.name || i.productId,
      price:
        typeof i.price === 'number'
          ? i.price
          : typeof i.price === 'string'
            ? parseFloat(i.price)
            : null,
      quantity: Math.max(1, parseInt(i.quantity || 1, 10)),
      productImageSrc: i.productImageSrc || i.imageSrc || null,
      color: i.color || i.selectedColor || null,
      size: i.size || i.selectedSize || null,
      eventDetails: i.eventDetails || null,
      // FIX: Add item type for tracking
      itemType: isShopifyMerchandise(i.productId, i) ? 'merchandise' : 'event',
      variantId: i.variantId || null,
    }));

    // FIX: Calculate item type flags for the order
    const hasEventItems = eventItems.length > 0;
    const hasMerchandiseItems = merchandiseItems.length > 0;
    const itemTypes = [];
    if (hasEventItems) itemTypes.push('event');
    if (hasMerchandiseItems) itemTypes.push('merchandise');

    const purchaseDoc = {
      addressDetails: addressDetails || null,
      customerEmail: userEmail || pi.receipt_email || (pi.metadata && pi.metadata.email) || null,
      customerId: firebaseId,
      customerName: userName || (pi.metadata && pi.metadata.name) || null,
      itemCount: sanitizedItems.length,
      items: sanitizedItems,
      orderDate: admin.firestore.FieldValue.serverTimestamp(),
      orderNumber,
      paymentIntentId: pi.id,
      status: 'completed',
      totalAmount: amountStr,
      currency: pi.currency || 'usd',
      discountAmount:
        appliedPromoCode && appliedPromoCode.discountValue ? appliedPromoCode.discountValue : 0,
      promoCodeUsed: appliedPromoCode && appliedPromoCode.id ? appliedPromoCode.id : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // FIX: Add item type tracking for easier filtering/reporting
      itemTypes,
      hasEventItems,
      hasMerchandiseItems,
      eventItemCount: eventItems.length,
      merchandiseItemCount: merchandiseItems.length,
      // Fulfillment tracking
      printifyOrderId: printifyOrderResult?.id || null,
      fulfillmentProvider: printifyOrderResult?.id
        ? 'printify'
        : hasMerchandiseItems
          ? 'manual'
          : null,
      // Stripe payment details for reference
      stripePaymentMethod: pi.payment_method_types?.[0] || null,
      stripeLast4: pi.charges?.data?.[0]?.payment_method_details?.card?.last4 || null,
    };

    // Write purchases in both collections
    try {
      const purchaseRef = db.collection('purchases').doc(orderNumber);
      await purchaseRef.set(purchaseDoc, { merge: true });

      const userPurchaseRef = db
        .collection('customers')
        .doc(firebaseId)
        .collection('purchases')
        .doc(orderNumber);
      await userPurchaseRef.set(
        Object.assign({}, purchaseDoc, {
          // Legacy compatibility fields used by OrderHistory
          dateTime: admin.firestore.FieldValue.serverTimestamp(),
          name: purchaseDoc.customerName,
          email: purchaseDoc.customerEmail,
          stripeId: pi.id,
          cartItems: sanitizedItems,
          total: amountStr,
        }),
        { merge: true },
      );
    } catch (e) {
      logger.warn('Failed to write purchase documents', e);
    }

    // If promo code applied, update its usage counters (best-effort)
    // Support both client-provided appliedPromoCode and PI metadata (for server-side validation)
    const promoId =
      (appliedPromoCode && appliedPromoCode.id) || (pi.metadata && pi.metadata.promoCode) || null;
    const promoCollection =
      (appliedPromoCode && appliedPromoCode.collection) ||
      (pi.metadata && pi.metadata.promoCollection) ||
      'promoCodes'; // Default to new collection

    if (promoId) {
      await incrementPromoCodeUsage(promoId, promoCollection, orderNumber);
    }

    try {
      await fulfillRef.set(
        {
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdTickets: created.length,
          // FIX: Include merchandise order info in fulfillment
          createdMerchOrders: merchOrdersCreated.length,
          details: created,
          merchandiseDetails: merchOrdersCreated,
          orderNumber,
          // FIX: Track item types in fulfillment
          itemTypes,
          hasEventItems,
          hasMerchandiseItems,
          // FIX: Include any partial failures
          errors: errors.length > 0 ? errors : null,
          partialSuccess: errors.length > 0 && totalItemsProcessed > 0,
          // Printify fulfillment tracking
          printifyOrderId: printifyOrderResult?.id || null,
          printifyStatus: printifyOrderResult?.status || null,
          fulfillmentProvider: printifyOrderResult?.id
            ? 'printify'
            : hasMerchandiseItems
              ? 'manual'
              : null,
          // backfill summary fields for triggers
          email: (userEmail && String(userEmail).trim()) || pi.receipt_email || '',
          items: items.map((i) => ({
            title: i.title || i.productId,
            productId: i.productId,
            quantity: Math.max(1, parseInt(i.quantity || 1, 10)),
            itemType: isShopifyMerchandise(i.productId, i) ? 'merchandise' : 'event',
          })),
        },
        { merge: true },
      );
    } catch (e) {
      logger.warn('Failed to update fulfillments record', e);
    }

    // FIX: Enhanced logging with merchandise info
    logger.info('Finalize-order: completed', {
      orderNumber,
      createdTickets: created.length,
      createdMerchOrders: merchOrdersCreated.length,
      printifyOrderId: printifyOrderResult?.id || null,
      errors: errors.length,
      itemTypes,
    });

    // FIX: Return comprehensive response including merchandise orders
    return res.json({
      ok: true,
      orderNumber,
      createdTickets: created.length,
      createdMerchOrders: merchOrdersCreated.length,
      details: created,
      merchandiseDetails: merchOrdersCreated,
      itemTypes,
      printifyOrderId: printifyOrderResult?.id || null,
      // Include partial failure info if some items failed
      partialFailure: errors.length > 0 ? { count: errors.length, errors } : null,
    });
  } catch (err) {
    logger.error('finalize-order error', err);
    res.status(500).json({ error: 'Failed to finalize order' });
  }
});

// Test utility: create a completed fulfillment to trigger email
app.post('/test-send-purchase-email', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { email, piId, items } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    const id = piId && String(piId).trim() ? String(piId).trim() : `test-${Date.now()}`;
    const payloadItems =
      Array.isArray(items) && items.length ? items : [{ title: 'Test Ticket', quantity: 1 }];

    const fulfillRef = db.collection('fulfillments').doc(id);
    const cleanedItems = payloadItems.map((i) => {
      const base = {
        title: i.title || i.name || 'Item',
        quantity: Math.max(1, parseInt(i.quantity || 1, 10)),
      };
      if (i.productId) base.productId = i.productId;
      return base;
    });

    await fulfillRef.set(
      {
        status: 'completed',
        email,
        items: cleanedItems,
        orderNumber: `ORDER-TEST-${Date.now()}`,
        amount: 500,
        currency: 'usd',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    logger.info('Test fulfillment created for email trigger', { id, email });
    return res.json({ ok: true, id });
  } catch (err) {
    logger.error('test-send-purchase-email error', err);
    return res.status(500).json({ error: 'Failed to create test fulfillment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TICKET TRANSFER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview a transfer without claiming it
 * Used by the claim page to show ticket details before claiming
 */
app.get('/transfer-preview', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const token = req.query.t;
    if (!token) {
      return res.status(400).json({ error: 'Missing token parameter' });
    }

    const crypto = require('crypto');
    const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
    const claimTokenHash = hashToken(token);

    // Find transfer by token hash
    const transfersQuery = await db
      .collection('ticketTransfers')
      .where('claimTokenHash', '==', claimTokenHash)
      .limit(1)
      .get();

    if (transfersQuery.empty) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const transferDoc = transfersQuery.docs[0];
    const transferData = transferDoc.data();

    // Check if already claimed
    if (transferData.status === 'claimed') {
      return res.status(404).json({ error: 'Transfer has already been claimed' });
    }

    // Check expiration
    const expiresAt = transferData.expiresAt?.toDate
      ? transferData.expiresAt.toDate()
      : new Date(transferData.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(410).json({ error: 'Transfer link has expired' });
    }

    // Return preview data (don't expose sensitive fields)
    return res.json({
      eventName: transferData.eventName,
      eventDate: transferData.eventDate,
      ticketQuantity: transferData.ticketQuantity || 1,
      fromName: transferData.fromName || null,
      toEmail: transferData.toEmail,
      expiresAt: transferData.expiresAt,
    });
  } catch (err) {
    logger.error('transfer-preview error', { error: String(err) });
    return res.status(500).json({ error: 'Failed to get transfer preview' });
  }
});

/**
 * Transfer a ticket to another user via email or username
 * Creates a pending transfer with a secure claim token
 */
app.post('/transfer-ticket', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const {
      ragerId,
      eventId,
      recipientEmail,
      recipientUsername,
      senderUserId,
      senderEmail,
      senderName,
    } = req.body || {};

    // Validate required fields - need either email OR username
    if (!ragerId || !eventId || !senderUserId) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: ragerId, eventId, senderUserId' });
    }

    if (!recipientEmail && !recipientUsername) {
      return res
        .status(400)
        .json({ error: 'Must provide either recipientEmail or recipientUsername' });
    }

    // Variables to hold resolved recipient info
    let resolvedEmail = recipientEmail?.toLowerCase();
    let resolvedUsername = recipientUsername?.toLowerCase()?.replace(/^@/, ''); // Strip @ prefix
    let resolvedUserId = null;
    let resolvedDisplayName = null;

    // If username provided, resolve it to uid and email
    if (recipientUsername) {
      const usernameDoc = await db.collection('usernames').doc(resolvedUsername).get();
      if (!usernameDoc.exists) {
        return res.status(404).json({ error: `Username @${resolvedUsername} not found` });
      }
      const { uid } = usernameDoc.data();
      resolvedUserId = uid;

      // Fetch profile/customer for email
      const [profileSnap, customerSnap] = await Promise.all([
        db.collection('profiles').doc(uid).get(),
        db.collection('customers').doc(uid).get(),
      ]);

      const profileData = profileSnap.data() || {};
      const customerData = customerSnap.data() || {};

      resolvedEmail = customerData.email || profileData.email;
      resolvedDisplayName = profileData.displayName || resolvedUsername;

      if (!resolvedEmail) {
        return res
          .status(400)
          .json({ error: `User @${resolvedUsername} does not have an email on file` });
      }
    }

    // Validate email format (for both direct email and resolved from username)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resolvedEmail)) {
      return res.status(400).json({ error: 'Invalid recipient email format' });
    }

    // Cannot transfer to self (check both email and uid)
    if (senderEmail && resolvedEmail === senderEmail.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot transfer ticket to yourself' });
    }
    if (resolvedUserId && resolvedUserId === senderUserId) {
      return res.status(400).json({ error: 'Cannot transfer ticket to yourself' });
    }

    // Rate limit: 10 transfers per hour per user
    const rateLimitKey = `transfer:${senderUserId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 3600);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ error: 'Transfer rate limit exceeded. Try again later.' });
    }

    const crypto = require('crypto');
    const generateClaimToken = () => crypto.randomBytes(24).toString('hex');
    const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

    // Atomic transaction
    const result = await db.runTransaction(async (t) => {
      // 1. Fetch the rager (ticket)
      const ragerRef = db.collection('events').doc(eventId).collection('ragers').doc(ragerId);
      const ragerSnap = await t.get(ragerRef);

      if (!ragerSnap.exists) {
        throw new Error('Ticket not found');
      }

      const ragerData = ragerSnap.data();

      // 2. Verify ownership
      if (ragerData.firebaseId !== senderUserId) {
        throw new Error('You do not own this ticket');
      }

      // 3. Verify ticket is active and not already transferred
      if (ragerData.active === false) {
        throw new Error('Ticket is not active');
      }
      if (ragerData.transferredTo) {
        throw new Error('Ticket has already been transferred');
      }

      // 4. Verify ticket hasn't been used
      const usedCount = ragerData.usedCount || 0;
      if (usedCount > 0) {
        throw new Error('Cannot transfer a ticket that has been used');
      }

      // 5. Fetch event to verify it hasn't passed
      const eventRef = db.collection('events').doc(eventId);
      const eventSnap = await t.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found');
      }
      const eventData = eventSnap.data();
      const eventDate = eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date);
      if (eventDate < new Date()) {
        throw new Error('Cannot transfer tickets for past events');
      }

      // 6. If we haven't resolved user from username, check by email
      let recipientUserId = resolvedUserId;
      if (!recipientUserId) {
        const customersQuery = await db
          .collection('customers')
          .where('email', '==', resolvedEmail)
          .limit(1)
          .get();
        if (!customersQuery.empty) {
          recipientUserId = customersQuery.docs[0].id;
        }
      }

      // 7. Generate claim token
      const claimToken = generateClaimToken();
      const claimTokenHash = hashToken(claimToken);

      // 8. Create transfer doc
      const transferRef = db.collection('ticketTransfers').doc();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      t.set(transferRef, {
        fromUserId: senderUserId,
        fromEmail: senderEmail || null,
        fromName: senderName || null,
        toUserId: recipientUserId,
        toEmail: resolvedEmail,
        toUsername: resolvedUsername || null,
        toDisplayName: resolvedDisplayName || null,
        eventId,
        eventName: eventData.name || eventData.title || 'Event',
        eventDate: eventData.date || null,
        ragerId,
        ticketQuantity: ragerData.ticketQuantity || 1,
        status: 'pending',
        claimTokenHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      // 9. Mark original rager as pending transfer (but still active until claimed)
      t.update(ragerRef, {
        pendingTransferTo: resolvedUsername ? `@${resolvedUsername}` : resolvedEmail,
        pendingTransferId: transferRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        transferId: transferRef.id,
        claimToken,
        eventName: eventData.name || eventData.title || 'Event',
        eventDate,
        ticketQuantity: ragerData.ticketQuantity || 1,
        recipientUserId,
        recipientUsername: resolvedUsername || null,
        recipientDisplayName: resolvedDisplayName || null,
        recipientEmail: resolvedEmail,
      };
    });

    // 10. Send claim email via SES
    try {
      process.env.AWS_ACCESS_KEY_ID = AWS_ACCESS_KEY_ID.value();
      process.env.AWS_SECRET_ACCESS_KEY = AWS_SECRET_ACCESS_KEY.value();
      process.env.AWS_SES_REGION = AWS_SES_REGION.value() || 'us-east-1';

      const claimUrl = `https://ragestate.com/claim-ticket?t=${result.claimToken}`;
      const eventDateStr = result.eventDate?.toDate
        ? result.eventDate.toDate().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : '';

      await sendEmail({
        to: result.recipientEmail,
        from: 'RAGESTATE <support@ragestate.com>',
        replyTo: 'support@ragestate.com',
        subject: `🎫 ${senderName || 'Someone'} sent you a ticket!`,
        text: `${senderName || 'A RAGESTATE user'} sent you a ticket for ${result.eventName}${eventDateStr ? ` on ${eventDateStr}` : ''}!\n\nClaim your ticket: ${claimUrl}\n\nThis link expires in 72 hours.`,
        html: `
          <div style="background:#f6f6f6;padding:24px 0">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
              <div style="padding:16px 24px;background:#000;color:#fff;text-align:center">
                <img src="https://firebasestorage.googleapis.com/v0/b/ragestate-app.appspot.com/o/RSLogo2.png?alt=media&token=d13ebc08-9d8d-4367-99ec-ace3627132d2" alt="RAGESTATE" width="120" style="display:inline-block;border:0;outline:none;text-decoration:none;height:auto" />
              </div>
              <div style="height:3px;background:#E12D39"></div>
              <div style="padding:24px">
                <h2 style="margin:0 0 16px;font-size:22px;color:#111;text-align:center">🎫 You've received a ticket!</h2>
                <p style="margin:0 0 12px;color:#111;font-size:16px;line-height:24px;text-align:center">
                  <b>${senderName || 'A RAGESTATE user'}</b> sent you a ticket for:
                </p>
                <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                  <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#111">${result.eventName}</p>
                  ${eventDateStr ? `<p style="margin:0;font-size:14px;color:#666">${eventDateStr}</p>` : ''}
                  <p style="margin:8px 0 0;font-size:14px;color:#666">${result.ticketQuantity} ticket${result.ticketQuantity > 1 ? 's' : ''}</p>
                </div>
                <div style="text-align:center;margin:24px 0">
                  <a href="${claimUrl}" style="display:inline-block;background:#E12D39;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:bold">Claim Your Ticket</a>
                </div>
                <p style="margin:16px 0 0;color:#6b7280;font-size:12px;line-height:18px;text-align:center">
                  This link expires in 72 hours. If you didn't expect this ticket, you can ignore this email.
                </p>
              </div>
              <div style="padding:16px 24px;border-top:1px solid #eee;color:#6b7280;font-size:12px;line-height:18px;text-align:center">
                <p style="margin:0">RAGESTATE — Your ticket to the next level</p>
              </div>
            </div>
          </div>
        `,
        region: process.env.AWS_SES_REGION,
      });

      // Update transfer with email sent status
      await db.collection('ticketTransfers').doc(result.transferId).update({
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (emailErr) {
      logger.error('Failed to send transfer claim email', {
        error: String(emailErr),
        transferId: result.transferId,
      });
      // Don't fail the transfer - email can be resent
    }

    // Recipient display: prefer @username, fallback to email
    const recipientDisplay = result.recipientUsername
      ? `@${result.recipientUsername}`
      : result.recipientEmail;

    // Send in-app notification to sender (transfer initiated)
    await createTransferNotification({
      uid: senderUserId,
      type: 'ticket_transfer_sent',
      title: 'Ticket Transfer Sent',
      body: `Your ticket for ${result.eventName} was sent to ${recipientDisplay}`,
      data: {
        eventId,
        eventName: result.eventName,
        recipientEmail: result.recipientEmail,
        recipientUsername: result.recipientUsername,
        transferId: result.transferId,
      },
      link: '/account?tab=tickets',
    });

    // If recipient has an account, notify them too
    if (result.recipientUserId) {
      await createTransferNotification({
        uid: result.recipientUserId,
        type: 'ticket_transfer_received',
        title: '🎫 You received a ticket!',
        body: `${senderName || 'Someone'} sent you a ticket for ${result.eventName}`,
        data: {
          eventId,
          eventName: result.eventName,
          fromUserId: senderUserId,
          fromName: senderName || null,
          transferId: result.transferId,
        },
        link: '/account?tab=tickets',
      });
    }

    logger.info('Ticket transfer initiated', {
      transferId: result.transferId,
      eventId,
      ragerId,
      fromUserId: senderUserId,
      toEmail: result.recipientEmail,
      toUsername: result.recipientUsername || null,
    });

    return res.json({
      ok: true,
      transferId: result.transferId,
      recipientHasAccount: !!result.recipientUserId,
      recipientUsername: result.recipientUsername || null,
      recipientDisplayName: result.recipientDisplayName || null,
    });
  } catch (err) {
    logger.error('transfer-ticket error', { error: String(err) });
    const message = err.message || 'Failed to transfer ticket';
    return res.status(400).json({ error: message });
  }
});

/**
 * Cancel a pending ticket transfer (sender only, or admin override)
 * Restores the original ticket to active state
 */
app.post('/cancel-transfer', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { transferId, senderUserId, isAdmin } = req.body || {};

    if (!transferId) {
      return res.status(400).json({ error: 'Missing required field: transferId' });
    }

    // Non-admin requests require senderUserId
    if (!isAdmin && !senderUserId) {
      return res.status(400).json({ error: 'Missing required field: senderUserId' });
    }

    // Atomic transaction to cancel transfer
    const result = await db.runTransaction(async (t) => {
      // 1. Fetch the transfer
      const transferRef = db.collection('ticketTransfers').doc(transferId);
      const transferSnap = await t.get(transferRef);

      if (!transferSnap.exists) {
        throw new Error('Transfer not found');
      }

      const transferData = transferSnap.data();

      // 2. Verify sender owns this transfer (skip if admin)
      if (!isAdmin && transferData.fromUserId !== senderUserId) {
        throw new Error('You cannot cancel this transfer');
      }

      // 3. Verify transfer is still pending
      if (transferData.status !== 'pending') {
        throw new Error(
          transferData.status === 'claimed'
            ? 'Transfer has already been claimed'
            : `Transfer is ${transferData.status}`,
        );
      }

      // 4. Restore original rager
      const ragerRef = db
        .collection('events')
        .doc(transferData.eventId)
        .collection('ragers')
        .doc(transferData.ragerId);
      const ragerSnap = await t.get(ragerRef);

      if (ragerSnap.exists) {
        t.update(ragerRef, {
          pendingTransferTo: admin.firestore.FieldValue.delete(),
          pendingTransferId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 5. Update transfer status
      const updateData = {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (isAdmin) {
        updateData.cancelledByAdmin = true;
      }
      t.update(transferRef, updateData);

      return {
        eventId: transferData.eventId,
        eventName: transferData.eventName,
        toEmail: transferData.toEmail,
        toUsername: transferData.toUsername,
        recipientUserId: transferData.toUserId,
        senderUserId: transferData.fromUserId,
      };
    });

    // Notify recipient if they have an account (transfer cancelled)
    if (result.recipientUserId) {
      await createTransferNotification({
        uid: result.recipientUserId,
        type: 'ticket_transfer_cancelled',
        title: 'Transfer Cancelled',
        body: `The ticket transfer for ${result.eventName} was cancelled`,
        data: {
          eventId: result.eventId,
          eventName: result.eventName,
          transferId,
        },
        link: '/account?tab=tickets',
      });
    }

    // Notify sender if admin cancelled (so they know their ticket is restored)
    if (isAdmin && result.senderUserId) {
      await createTransferNotification({
        uid: result.senderUserId,
        type: 'ticket_transfer_cancelled',
        title: 'Transfer Cancelled by Support',
        body: `Your ticket transfer for ${result.eventName} was cancelled and your ticket has been restored`,
        data: {
          eventId: result.eventId,
          eventName: result.eventName,
          transferId,
        },
        link: '/account?tab=tickets',
      });
    }

    logger.info('Ticket transfer cancelled', {
      transferId,
      eventId: result.eventId,
      fromUserId: result.senderUserId,
      isAdmin: !!isAdmin,
    });

    return res.json({ ok: true, message: 'Transfer cancelled successfully' });
  } catch (err) {
    logger.error('cancel-transfer error', { error: String(err) });
    const message = err.message || 'Failed to cancel transfer';
    return res.status(400).json({ error: message });
  }
});

/**
 * Claim a transferred ticket using the claim token
 */
app.post('/claim-ticket', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { claimToken, claimerUserId, claimerEmail, claimerName } = req.body || {};

    if (!claimToken || !claimerUserId) {
      return res.status(400).json({ error: 'Missing required fields: claimToken, claimerUserId' });
    }

    const crypto = require('crypto');
    const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
    const claimTokenHash = hashToken(claimToken);

    // Find transfer by token hash
    const transfersQuery = await db
      .collection('ticketTransfers')
      .where('claimTokenHash', '==', claimTokenHash)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (transfersQuery.empty) {
      return res.status(404).json({ error: 'Transfer not found or already claimed' });
    }

    const transferDoc = transfersQuery.docs[0];
    const transferData = transferDoc.data();

    // Check expiration
    const expiresAt = transferData.expiresAt?.toDate
      ? transferData.expiresAt.toDate()
      : new Date(transferData.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(410).json({ error: 'Transfer link has expired' });
    }

    // Verify claimer matches recipient (by uid or email)
    const claimerEmailLower = (claimerEmail || '').toLowerCase();
    if (transferData.toUserId && transferData.toUserId !== claimerUserId) {
      // If transfer was to a specific user, must be that user
      if (transferData.toEmail !== claimerEmailLower) {
        return res.status(403).json({ error: 'This ticket was sent to someone else' });
      }
    } else if (transferData.toEmail !== claimerEmailLower) {
      // Otherwise check email match
      return res.status(403).json({ error: 'This ticket was sent to a different email address' });
    }

    const generateTicketToken = () => crypto.randomBytes(16).toString('hex');

    // Atomic transaction to claim ticket
    const result = await db.runTransaction(async (t) => {
      // Re-fetch transfer in transaction
      const transferRef = db.collection('ticketTransfers').doc(transferDoc.id);
      const transferSnap = await t.get(transferRef);
      const transfer = transferSnap.data();

      if (transfer.status !== 'pending') {
        throw new Error('Transfer is no longer pending');
      }

      // Fetch original rager
      const originalRagerRef = db
        .collection('events')
        .doc(transfer.eventId)
        .collection('ragers')
        .doc(transfer.ragerId);
      const originalRagerSnap = await t.get(originalRagerRef);

      if (!originalRagerSnap.exists) {
        throw new Error('Original ticket not found');
      }

      const originalRager = originalRagerSnap.data();

      // Create new rager for recipient
      const newRagerRef = db.collection('events').doc(transfer.eventId).collection('ragers').doc();
      const newTicketToken = generateTicketToken();

      t.set(newRagerRef, {
        firebaseId: claimerUserId,
        email: claimerEmailLower,
        name: claimerName || originalRager.name || '',
        ticketQuantity: originalRager.ticketQuantity || 1,
        usedCount: 0,
        active: true,
        ticketToken: newTicketToken,
        previousOwner: transfer.fromUserId,
        claimedFromTransfer: transferDoc.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create ticketToken lookup
      const tokenRef = db.collection('ticketTokens').doc(newTicketToken);
      t.set(tokenRef, {
        eventId: transfer.eventId,
        ragerId: newRagerRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Deactivate original rager
      t.update(originalRagerRef, {
        active: false,
        transferredTo: claimerUserId,
        transferredAt: admin.firestore.FieldValue.serverTimestamp(),
        pendingTransferTo: admin.firestore.FieldValue.delete(),
        pendingTransferId: admin.firestore.FieldValue.delete(),
      });

      // Invalidate old ticketToken lookup if exists
      if (originalRager.ticketToken) {
        const oldTokenRef = db.collection('ticketTokens').doc(originalRager.ticketToken);
        t.delete(oldTokenRef);
      }

      // Update transfer status
      t.update(transferRef, {
        status: 'claimed',
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedByUserId: claimerUserId,
        newRagerId: newRagerRef.id,
      });

      return {
        newRagerId: newRagerRef.id,
        eventId: transfer.eventId,
        eventName: transfer.eventName,
        ticketQuantity: originalRager.ticketQuantity || 1,
        fromUserId: transfer.fromUserId,
        fromName: transfer.fromName,
      };
    });

    // Send confirmation email to original sender (best effort)
    try {
      if (transferData.fromEmail) {
        process.env.AWS_ACCESS_KEY_ID = AWS_ACCESS_KEY_ID.value();
        process.env.AWS_SECRET_ACCESS_KEY = AWS_SECRET_ACCESS_KEY.value();
        process.env.AWS_SES_REGION = AWS_SES_REGION.value() || 'us-east-1';

        await sendEmail({
          to: transferData.fromEmail,
          from: 'RAGESTATE <support@ragestate.com>',
          replyTo: 'support@ragestate.com',
          subject: `✅ Your ticket transfer was claimed`,
          text: `${claimerName || claimerEmail || 'The recipient'} has claimed the ticket you sent for ${result.eventName}.\n\nView your tickets: https://ragestate.com/account`,
          html: `
            <div style="background:#f6f6f6;padding:24px 0">
              <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                <div style="padding:16px 24px;background:#000;color:#fff;text-align:center">
                  <img src="https://firebasestorage.googleapis.com/v0/b/ragestate-app.appspot.com/o/RSLogo2.png?alt=media&token=d13ebc08-9d8d-4367-99ec-ace3627132d2" alt="RAGESTATE" width="120" style="display:inline-block;border:0;outline:none;text-decoration:none;height:auto" />
                </div>
                <div style="height:3px;background:#E12D39"></div>
                <div style="padding:24px">
                  <h2 style="margin:0 0 16px;font-size:18px;color:#111">✅ Ticket Transfer Complete</h2>
                  <p style="margin:0 0 12px;color:#111;font-size:14px;line-height:20px">
                    <b>${claimerName || claimerEmail || 'The recipient'}</b> has claimed the ticket you sent for <b>${result.eventName}</b>.
                  </p>
                  <div style="margin:16px 0">
                    <a href="https://ragestate.com/account" style="display:inline-block;background:#E12D39;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;font-size:14px">View My Tickets</a>
                  </div>
                </div>
              </div>
            </div>
          `,
          region: process.env.AWS_SES_REGION,
        });
      }
    } catch (emailErr) {
      logger.warn('Failed to send claim confirmation email', { error: String(emailErr) });
    }

    // Send in-app notifications for the claim
    // Notify the claimer
    await createTransferNotification({
      uid: claimerUserId,
      type: 'ticket_transfer_claimed',
      title: '🎫 Ticket Claimed!',
      body: `You've claimed a ticket for ${result.eventName}`,
      data: {
        eventId: result.eventId,
        eventName: result.eventName,
        ragerId: result.newRagerId,
        fromUserId: result.fromUserId,
      },
      link: '/account?tab=tickets',
    });

    // Notify the original sender
    if (result.fromUserId) {
      await createTransferNotification({
        uid: result.fromUserId,
        type: 'ticket_transfer_claimed',
        title: '✅ Transfer Complete',
        body: `${claimerName || claimerEmail || 'The recipient'} claimed your ticket for ${result.eventName}`,
        data: {
          eventId: result.eventId,
          eventName: result.eventName,
          claimerUserId,
          claimerName: claimerName || null,
        },
        link: '/account?tab=tickets',
      });
    }

    logger.info('Ticket transfer claimed', {
      transferId: transferDoc.id,
      newRagerId: result.newRagerId,
      eventId: result.eventId,
      claimerUserId,
    });

    return res.json({
      ok: true,
      ragerId: result.newRagerId,
      eventId: result.eventId,
      eventName: result.eventName,
      ticketQuantity: result.ticketQuantity,
    });
  } catch (err) {
    logger.error('claim-ticket error', { error: String(err) });
    const message = err.message || 'Failed to claim ticket';
    return res.status(400).json({ error: message });
  }
});

// Admin utility: manually create a ticket + purchase for a user and event
app.post('/manual-create-ticket', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const {
      uid,
      eventId: rawEventId,
      eventName,
      email,
      name,
      qty,
      priceCents,
      title,
      createFulfillment,
      paymentIntentId,
      orderNumber: providedOrderNumber,
      currency,
    } = req.body || {};

    if (!uid) return res.status(400).json({ error: 'uid required' });

    const quantity = Math.max(1, parseInt(qty || 1, 10));
    const amountCents = Math.max(0, parseInt(priceCents || 0, 10));
    const amountStr = (amountCents / 100).toFixed(2);
    const orderNumber = providedOrderNumber || generateOrderNumber();
    const token = require('crypto').randomBytes(16).toString('hex');
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const cur = (currency || 'usd').toLowerCase();

    // Resolve eventId if not provided
    let eventId = (rawEventId && String(rawEventId).trim()) || '';
    if (!eventId && eventName) {
      const snap = await db
        .collection('events')
        .where('name', '==', String(eventName))
        .limit(2)
        .get();
      if (snap.empty) return res.status(404).json({ error: 'event not found by name' });
      if (snap.size > 1)
        return res.status(409).json({ error: 'multiple events match name; pass eventId' });
      eventId = snap.docs[0].id;
    }
    if (!eventId) return res.status(400).json({ error: 'eventId or eventName required' });

    const eventRef = db.collection('events').doc(eventId);
    const ragersCol = eventRef.collection('ragers');
    const ragerDoc = ragersCol.doc();

    // Resolve email/name from customers/{uid} if missing
    let resolvedEmail = (email && String(email)) || '';
    let resolvedName = (name && String(name)) || '';
    if (!resolvedEmail || !resolvedName) {
      try {
        const cust = await db.collection('customers').doc(uid).get();
        const c = cust.exists ? cust.data() || {} : {};
        if (!resolvedEmail) resolvedEmail = c.email || c.customerEmail || '';
        if (!resolvedName) resolvedName = c.name || c.customerName || '';
      } catch (_e) {}
    }

    // Ensure event exists and do atomic writes
    try {
      await db.runTransaction(async (tx) => {
        const evt = await tx.get(eventRef);
        if (!evt.exists) throw new Error('Event not found');
        const data = evt.data() || {};
        const currentQty = typeof data.quantity === 'number' ? data.quantity : 0;
        const newQty = Math.max(0, currentQty - quantity);
        tx.update(eventRef, { quantity: newQty });

        const rager = {
          active: true,
          email: resolvedEmail || '',
          firebaseId: uid,
          owner: resolvedName || '',
          purchaseDate: nowTs,
          orderNumber,
          ticketQuantity: quantity,
          paymentIntentId: paymentIntentId || `pi_manual_${Date.now()}`,
          ticketToken: token,
          usedCount: 0,
        };
        tx.set(ragerDoc, rager);
        tx.set(db.collection('ticketTokens').doc(token), {
          eventId,
          ragerId: ragerDoc.id,
          createdAt: nowTs,
        });
        // Update event-user summary totals (userId-first model)
        const summaryRef = db.collection('eventUsers').doc(eventId).collection('users').doc(uid);
        tx.set(
          summaryRef,
          {
            totalTickets: admin.firestore.FieldValue.increment(quantity),
            lastUpdated: nowTs,
          },
          { merge: true },
        );
      });
    } catch (e) {
      logger.error('manual-create-ticket transaction failed', { message: e?.message });
      return res.status(500).json({ error: 'transaction failed', message: e?.message });
    }

    const purchaseDoc = {
      addressDetails: null,
      customerEmail: resolvedEmail || null,
      customerId: uid,
      customerName: resolvedName || null,
      itemCount: 1,
      items: [
        {
          productId: eventId,
          title: title || eventId,
          price: amountCents / 100,
          quantity,
          productImageSrc: null,
          color: null,
          size: null,
          eventDetails: null,
        },
      ],
      orderDate: nowTs,
      orderNumber,
      paymentIntentId: paymentIntentId || `pi_manual_${Date.now()}`,
      status: 'completed',
      totalAmount: amountStr,
      currency: cur,
      discountAmount: 0,
      promoCodeUsed: null,
      createdAt: nowTs,
    };

    try {
      await db.collection('purchases').doc(orderNumber).set(purchaseDoc, { merge: true });
      await db
        .collection('customers')
        .doc(uid)
        .collection('purchases')
        .doc(orderNumber)
        .set(
          Object.assign({}, purchaseDoc, {
            dateTime: nowTs,
            name: purchaseDoc.customerName,
            email: purchaseDoc.customerEmail,
            stripeId: purchaseDoc.paymentIntentId,
            cartItems: purchaseDoc.items,
            total: amountStr,
          }),
          { merge: true },
        );
    } catch (e) {
      logger.warn('manual-create-ticket: purchase writes failed', { message: e?.message });
    }

    if (createFulfillment) {
      try {
        await db
          .collection('fulfillments')
          .doc(purchaseDoc.paymentIntentId)
          .set(
            {
              status: 'completed',
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdTickets: 1,
              details: [{ eventId, ragerId: ragerDoc.id, qty: quantity, orderNumber }],
              orderNumber,
              email: resolvedEmail || '',
              items: [{ title: title || eventId, productId: eventId, quantity }],
              amount: amountCents,
              currency: cur,
            },
            { merge: true },
          );
      } catch (e) {
        logger.warn('manual-create-ticket: fulfillment write failed (non-fatal)', {
          message: e?.message,
        });
      }
    }

    return res.json({ ok: true, orderNumber, eventId, qty: quantity, email: resolvedEmail });
  } catch (err) {
    logger.error('manual-create-ticket error', err);
    return res.status(500).json({ error: 'Failed' });
  }
});

// Scan ticket: atomically consume one use for a rager identified by ticketToken
app.post('/scan-ticket', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { token, userId, scannerId, eventId: expectedEventId } = req.body || {};

    let ragerRef;
    let parentEventId = '';

    if (token && typeof token === 'string') {
      // Fast lookup via token mapping
      let eventIdFromMap = '';
      let ragerIdFromMap = '';
      try {
        const mapSnap = await db.collection('ticketTokens').doc(token).get();
        if (!mapSnap.exists) {
          try {
            logger.info('scan-ticket: token mapping not found', {
              tokenPrefix: typeof token === 'string' ? token.slice(0, 8) : '',
              tokenLength: typeof token === 'string' ? token.length : 0,
            });
          } catch (_e) {}
          return res
            .status(404)
            .json({ error: 'Ticket not found', message: 'No mapping for token' });
        }
        const m = mapSnap.data() || {};
        eventIdFromMap = String(m.eventId || '');
        ragerIdFromMap = String(m.ragerId || '');
        if (!eventIdFromMap || !ragerIdFromMap) {
          try {
            logger.warn('scan-ticket: mapping incomplete', {
              eventId: eventIdFromMap,
              ragerId: ragerIdFromMap,
            });
          } catch (_e) {}
          return res.status(404).json({
            error: 'Ticket mapping incomplete',
            message: 'Mapping missing eventId or ragerId',
          });
        }
      } catch (e) {
        logger.error('scan-ticket map lookup error', { message: e?.message, code: e?.code });
        return res.status(500).json({ error: 'Lookup failed', message: e?.message, code: e?.code });
      }

      ragerRef = db
        .collection('events')
        .doc(eventIdFromMap)
        .collection('ragers')
        .doc(ragerIdFromMap);
      parentEventId = eventIdFromMap;

      if (expectedEventId && expectedEventId !== parentEventId) {
        try {
          await incrementEventMetrics(expectedEventId, { scanDenials: 1 });
        } catch (_e) {}
        return res.status(409).json({ error: 'Wrong event for ticket' });
      }
    } else if (userId && typeof userId === 'string') {
      // Scan by firebaseId requires explicit eventId to avoid collection group indexes
      if (!expectedEventId || typeof expectedEventId !== 'string') {
        return res.status(400).json({
          error: 'eventId required',
          message: 'Provide eventId when scanning by userId',
        });
      }

      parentEventId = expectedEventId;
      try {
        const ragersRef = db.collection('events').doc(parentEventId).collection('ragers');
        const qs = await ragersRef.where('firebaseId', '==', userId).get();
        if (qs.empty) {
          try {
            await incrementEventMetrics(parentEventId, { scanDenials: 1 });
          } catch (_e) {}
          return res.status(404).json({
            error: 'Ticket not found',
            message: 'No rager found for user at event',
          });
        }
        // Deterministic selection: choose doc with greatest remaining; tiebreaker earliest purchaseDate then lexicographic id
        const enriched = qs.docs.map((d) => {
          const v = d.data() || {};
          const qty = Math.max(1, parseInt(v.ticketQuantity || 1, 10));
          const used = Math.max(0, parseInt(v.usedCount || 0, 10));
          const remaining = Math.max(0, qty - used);
          return {
            doc: d,
            remaining,
            purchaseDate: v.purchaseDate && v.purchaseDate.toMillis ? v.purchaseDate.toMillis() : 0,
          };
        });
        const remainingTotal = enriched.reduce((acc, e) => acc + e.remaining, 0);
        if (remainingTotal <= 0) {
          const first = enriched[0];
          try {
            await incrementEventMetrics(parentEventId, { scanDenials: 1 });
          } catch (_e) {}
          return res
            .status(409)
            .json({ error: 'Ticket already used', remaining: 0, remainingTotal: 0 });
        }
        enriched.sort((a, b) => {
          if (b.remaining !== a.remaining) return b.remaining - a.remaining;
          if (a.purchaseDate !== b.purchaseDate) return a.purchaseDate - b.purchaseDate;
          return a.doc.id.localeCompare(b.doc.id);
        });
        ragerRef = enriched[0].doc.ref;
        // Stash for later response
        req.__remainingTotalBefore = remainingTotal;
      } catch (e) {
        logger.error('scan-ticket query by userId failed', { message: e?.message, code: e?.code });
        return res.status(500).json({ error: 'Lookup failed', message: e?.message, code: e?.code });
      }
    } else {
      return res.status(400).json({
        error: 'input required',
        message: 'Provide either token or userId in JSON body',
      });
    }

    let result;
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ragerRef);
      if (!fresh.exists) throw new Error('Ticket missing');
      const data = fresh.data() || {};
      const quantity = Math.max(1, parseInt(data.ticketQuantity || 1, 10));
      const usedCount = Math.max(0, parseInt(data.usedCount || 0, 10));
      const uidForSummary = data.firebaseId || userId || '';
      const active = data.active !== false && usedCount < quantity;
      if (!active) {
        result = { status: 409, body: { error: 'Ticket already used', remaining: 0 } };
        return;
      }
      const nextUsed = usedCount + 1;
      const nextActive = nextUsed < quantity;
      const update = {
        usedCount: nextUsed,
        active: nextActive,
        lastScanAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (scannerId && typeof scannerId === 'string') {
        update.lastScannedBy = scannerId;
      }
      tx.update(ragerRef, update);
      // Update event-user summary if available (no reads; atomic increment)
      const eventIdForSummary = parentEventId;
      if (eventIdForSummary && uidForSummary) {
        const summaryRef = db
          .collection('eventUsers')
          .doc(eventIdForSummary)
          .collection('users')
          .doc(uidForSummary);
        tx.set(
          summaryRef,
          {
            usedCount: admin.firestore.FieldValue.increment(1),
            lastScanAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      result = {
        status: 200,
        body: {
          ok: true,
          eventId: parentEventId,
          ragerId: ragerRef.id,
          remaining: Math.max(0, quantity - nextUsed),
          remainingTotal:
            typeof req.__remainingTotalBefore === 'number'
              ? Math.max(0, req.__remainingTotalBefore - 1)
              : undefined,
          status: nextActive ? 'active' : 'inactive',
        },
      };
    });

    if (!result) {
      return res.status(500).json({ error: 'Unknown scan error' });
    }
    try {
      if (result.status === 200) {
        await incrementEventMetrics(parentEventId, { scansAccepted: 1 });
      } else if (parentEventId) {
        await incrementEventMetrics(parentEventId, { scanDenials: 1 });
      }
    } catch (_e) {}
    return res.status(result.status).json(result.body);
  } catch (err) {
    logger.error('scan-ticket error', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res
      .status(500)
      .json({ error: 'Failed to scan ticket', message: err?.message, code: err?.code });
  }
});

// Preview tickets for a user at an event (no mutation)
app.post('/scan-ticket/preview', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { userId, eventId } = req.body || {};
    if (!userId || !eventId) {
      return res.status(400).json({ error: 'userId and eventId required' });
    }

    const ragersRef = db.collection('events').doc(eventId).collection('ragers');
    const qs = await ragersRef.where('firebaseId', '==', userId).get();
    if (qs.empty) {
      return res.json({ ok: true, eventId, userId, remainingTotal: 0, items: [], next: null });
    }

    const items = qs.docs.map((d) => {
      const v = d.data() || {};
      const qty = Math.max(1, parseInt(v.ticketQuantity || 1, 10));
      const used = Math.max(0, parseInt(v.usedCount || 0, 10));
      const remaining = Math.max(0, qty - used);
      const ts = v.purchaseDate && v.purchaseDate.toMillis ? v.purchaseDate.toMillis() : 0;
      return {
        ragerId: d.id,
        remaining,
        ticketQuantity: qty,
        usedCount: used,
        active: v.active !== false && remaining > 0,
        purchaseDate: ts || null,
      };
    });

    const remainingTotal = items.reduce((acc, i) => acc + i.remaining, 0);
    const sorted = items.slice().sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      if ((a.purchaseDate || 0) !== (b.purchaseDate || 0))
        return (a.purchaseDate || 0) - (b.purchaseDate || 0);
      return a.ragerId.localeCompare(b.ragerId);
    });
    const next = sorted.find((i) => i.active) || null;

    try {
      await incrementEventMetrics(eventId, {
        previewRemainingSum: remainingTotal,
        previewCount: 1,
      });
    } catch (_e) {}

    return res.json({ ok: true, eventId, userId, remainingTotal, items, next });
  } catch (err) {
    logger.error('scan-ticket/preview error', { message: err?.message, code: err?.code });
    return res.status(500).json({ error: 'Failed to preview tickets', message: err?.message });
  }
});

// Admin: backfill ticketToken/usedCount for an event's ragers and ensure token mapping
app.post('/backfill-ticket-tokens', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { eventId, dryRun } = req.body || {};
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'eventId required' });
    }

    const eventRef = db.collection('events').doc(eventId);
    const ragersRef = eventRef.collection('ragers');
    const snap = await ragersRef.get();
    if (snap.empty) {
      return res.json({ ok: true, eventId, processed: 0, updated: 0 });
    }

    const crypto = require('crypto');
    const gen = () => crypto.randomBytes(16).toString('hex');

    let processed = 0;
    let updated = 0;
    let mappingsCreated = 0;
    const samples = [];
    let batch = db.batch();
    let batchCount = 0;

    snap.docs.forEach((doc) => {
      processed += 1;
      const data = doc.data() || {};
      const updates = {};
      if (!data.ticketToken || typeof data.ticketToken !== 'string') {
        updates.ticketToken = gen();
      }
      if (typeof data.usedCount !== 'number') {
        updates.usedCount = 0;
      }
      // If active is missing, derive from usedCount/ticketQuantity; else leave as-is
      if (typeof data.active !== 'boolean') {
        const qty = Math.max(1, parseInt(data.ticketQuantity || 1, 10));
        const used = Math.max(0, parseInt(data.usedCount || 0, 10));
        updates.active = used < qty;
      }

      const finalToken = updates.ticketToken || data.ticketToken;
      const eventId = doc.ref.parent.parent.id;
      const needsMap = !!finalToken;

      if (Object.keys(updates).length > 0) {
        updated += 1;
        if (samples.length < 5) {
          samples.push({
            ragerId: doc.id,
            updates: Object.assign({}, updates, {
              ticketToken: finalToken,
            }),
          });
        }
        if (!dryRun) {
          batch.update(doc.ref, updates);
          batchCount += 1;
          if (batchCount >= 400) {
            // Commit and reset batch to avoid limits
            batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }

      // Ensure token mapping exists
      if (needsMap && !dryRun) {
        const mapRef = db.collection('ticketTokens').doc(finalToken);
        batch.set(
          mapRef,
          {
            eventId,
            ragerId: doc.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        mappingsCreated += 1;
        batchCount += 1;
        if (batchCount >= 400) {
          batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    });

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    return res.json({
      ok: true,
      eventId,
      processed,
      updated,
      mappingsCreated,
      dryRun: !!dryRun,
      samples,
    });
  } catch (err) {
    logger.error('backfill-ticket-tokens error', err);
    return res.status(500).json({ error: 'Failed to backfill' });
  }
});

// Admin: register Printify webhooks for order status updates
// Call once after deploy to set up webhook listeners
app.post('/register-printify-webhooks', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!isPrintifyConfigured()) {
      return res.status(503).json({ error: 'Printify not configured' });
    }

    const { baseUrl, secret } = req.body || {};
    // Default to production URL if not provided
    const webhookBaseUrl =
      baseUrl || 'https://us-central1-ragestate-app.cloudfunctions.net/printifyWebhook';
    const webhookSecret = secret || process.env.PRINTIFY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).json({
        error: 'Webhook secret required',
        hint: 'Set PRINTIFY_WEBHOOK_SECRET or pass secret in body',
      });
    }

    // Topics to register
    const topics = ['order:shipment:created', 'order:shipment:delivered', 'order:updated'];

    // Check existing webhooks to avoid duplicates
    const existing = await getPrintifyWebhooks();
    const existingTopics = new Set((existing || []).map((w) => w.topic));

    const results = [];
    for (const topic of topics) {
      if (existingTopics.has(topic)) {
        results.push({ topic, status: 'already_registered' });
        continue;
      }

      try {
        const webhook = await createPrintifyWebhook({
          topic,
          url: webhookBaseUrl,
          secret: webhookSecret,
        });
        results.push({ topic, status: 'registered', id: webhook.id });
      } catch (err) {
        results.push({ topic, status: 'failed', error: err.message });
      }
    }

    logger.info('Printify webhooks registration', { results });
    return res.json({ ok: true, webhookUrl: webhookBaseUrl, results });
  } catch (err) {
    logger.error('register-printify-webhooks error', err);
    return res.status(500).json({ error: 'Failed to register webhooks', message: err?.message });
  }
});

// Admin: list registered Printify webhooks
app.get('/printify-webhooks', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!isPrintifyConfigured()) {
      return res.status(503).json({ error: 'Printify not configured' });
    }

    const webhooks = await getPrintifyWebhooks();
    return res.json({ ok: true, webhooks: webhooks || [] });
  } catch (err) {
    logger.error('get-printify-webhooks error', err);
    return res.status(500).json({ error: 'Failed to get webhooks', message: err?.message });
  }
});

// Admin: reconcile eventUsers summaries for a specific event from ragers
app.post('/reconcile-event-users', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { eventId, dryRun } = req.body || {};
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'eventId required' });
    }

    // Gather per-user aggregates from ragers
    const ragersRef = db.collection('events').doc(eventId).collection('ragers');
    const snap = await ragersRef.get();
    if (snap.empty) {
      return res.json({ ok: true, eventId, processedUsers: 0, updatedUsers: 0, dryRun: !!dryRun });
    }

    const perUser = new Map();
    snap.docs.forEach((d) => {
      const v = d.data() || {};
      const uid = String(v.firebaseId || '').trim();
      if (!uid) return;
      const qty = Math.max(1, parseInt(v.ticketQuantity || 1, 10));
      const used = Math.max(0, parseInt(v.usedCount || 0, 10));
      const lastScanAt = v.lastScanAt || null;
      if (!perUser.has(uid)) {
        perUser.set(uid, {
          totalTickets: 0,
          usedCount: 0,
          lastScanAt: lastScanAt,
        });
      }
      const agg = perUser.get(uid);
      agg.totalTickets += qty;
      agg.usedCount += used;
      if (
        lastScanAt &&
        lastScanAt.toMillis &&
        (!agg.lastScanAt ||
          (agg.lastScanAt.toMillis && lastScanAt.toMillis() > agg.lastScanAt.toMillis()))
      ) {
        agg.lastScanAt = lastScanAt;
      }
    });

    const users = Array.from(perUser.keys());
    let processedUsers = users.length;
    let updatedUsers = 0;
    const samples = [];

    let batch = db.batch();
    let batchCount = 0;

    // For each user, compare with existing summary and write if different
    for (const uid of users) {
      const target = perUser.get(uid);
      const summaryRef = db.collection('eventUsers').doc(eventId).collection('users').doc(uid);
      let prevTotal = null;
      let prevUsed = null;
      try {
        const s = await summaryRef.get();
        if (s.exists) {
          const sd = s.data() || {};
          prevTotal = typeof sd.totalTickets === 'number' ? sd.totalTickets : null;
          prevUsed = typeof sd.usedCount === 'number' ? sd.usedCount : null;
        }
      } catch (_e) {}

      const needsUpdate = prevTotal !== target.totalTickets || prevUsed !== target.usedCount;
      if (needsUpdate) {
        updatedUsers += 1;
        if (samples.length < 10) {
          samples.push({
            uid,
            prev: { totalTickets: prevTotal, usedCount: prevUsed },
            next: { totalTickets: target.totalTickets, usedCount: target.usedCount },
          });
        }
        if (!dryRun) {
          const payload = {
            totalTickets: target.totalTickets,
            usedCount: Math.min(target.totalTickets, target.usedCount),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (target.lastScanAt) payload.lastScanAt = target.lastScanAt;
          batch.set(summaryRef, payload, { merge: true });
          batchCount += 1;
          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    // Write an audit record for non-dry runs
    if (!dryRun) {
      try {
        const runId = `run-${Date.now()}`;
        await db.collection('reconciliations').doc(eventId).collection('runs').doc(runId).set(
          {
            eventId,
            processedUsers,
            updatedUsers,
            samples,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        logger.warn('reconcile-event-users: failed to write audit record (non-fatal)', {
          message: e?.message,
        });
      }
    }

    logger.info('reconcile-event-users completed', { eventId, processedUsers, updatedUsers });
    return res.json({ ok: true, eventId, processedUsers, updatedUsers, dryRun: !!dryRun, samples });
  } catch (err) {
    logger.error('reconcile-event-users error', err);
    return res.status(500).json({ error: 'Failed to reconcile', message: err?.message });
  }
});

function generateOrderNumber() {
  const prefix = 'ORDER';
  const d = new Date();
  const datePart = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: SEND EMAIL CAMPAIGN
// ─────────────────────────────────────────────────────────────────────────────
app.post('/send-campaign', async (req, res) => {
  try {
    // Verify proxy key (admin-only endpoint)
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { subject, text, html, recipients } = req.body || {};

    // Validate inputs
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ error: 'subject is required' });
    }
    if (!text && !html) {
      return res.status(400).json({ error: 'text or html content is required' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validRecipients = recipients.filter((r) => typeof r === 'string' && emailRegex.test(r));
    if (validRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses provided' });
    }

    // Rate limit: max 1000 recipients per request
    if (validRecipients.length > 1000) {
      return res.status(400).json({ error: 'Max 1000 recipients per request' });
    }

    logger.info('Sending campaign', {
      subject,
      recipientCount: validRecipients.length,
    });

    // Send via SES bulk email
    const results = await sendBulkEmail({
      recipients: validRecipients,
      from: 'RAGESTATE <orders@ragestate.com>',
      replyTo: 'support@ragestate.com',
      subject,
      text,
      html,
    });

    const messageIds = results.map((r) => r.messageId).filter(Boolean);

    logger.info('Campaign sent successfully', {
      subject,
      recipientCount: validRecipients.length,
      batches: results.length,
    });

    return res.json({
      ok: true,
      sent: validRecipients.length,
      batches: results.length,
      messageIds,
    });
  } catch (err) {
    logger.error('send-campaign error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to send campaign', message: err?.message });
  }
});

// Admin: manually trigger daily analytics aggregation
app.post('/run-daily-aggregation', async (req, res) => {
  try {
    const expectedProxyKey = PROXY_KEY.value() || process.env.PROXY_KEY;
    if (expectedProxyKey) {
      const provided = req.get('x-proxy-key');
      if (!provided || provided !== expectedProxyKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const { date } = req.body || {};

    // Validate date format if provided
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          error: 'Invalid date format',
          message: 'Date must be in YYYY-MM-DD format',
        });
      }
      // Validate it's a real date
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          error: 'Invalid date',
          message: 'Date is not a valid calendar date',
        });
      }
    }

    logger.info('Manual daily aggregation triggered', { date: date || 'yesterday' });

    const result = await runDailyAggregation(date || null);

    if (!result.success) {
      return res.status(500).json({
        ok: false,
        error: result.error,
        date: result.date,
      });
    }

    return res.json({
      ok: true,
      date: result.date,
      metrics: result.metrics,
      totals: result.totals,
    });
  } catch (err) {
    logger.error('run-daily-aggregation error', { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to run aggregation', message: err?.message });
  }
});

exports.stripePayment = onRequest(
  {
    secrets: [
      STRIPE_SECRET,
      PROXY_KEY,
      SHOPIFY_ADMIN_ACCESS_TOKEN,
      SHOPIFY_SHOP_NAME,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_SES_REGION,
      PRINTIFY_API_TOKEN,
      PRINTIFY_SHOP_ID,
      PRINTIFY_WEBHOOK_SECRET,
    ],
    invoker: 'public',
  },
  app,
);

// Callable function to create a Stripe customer for the authenticated, verified user
// Rate limited: 3 calls per 5 minutes per user
exports.createStripeCustomer = onCall(
  { enforceAppCheck: true, secrets: [STRIPE_SECRET] },
  async (request) => {
    if (!request.app) {
      throw new HttpsError('failed-precondition', 'App Check required');
    }
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;

    // Rate limit check
    const rateLimitResult = await checkRateLimit('CREATE_CUSTOMER', uid);
    if (!rateLimitResult.allowed) {
      logger.warn('createStripeCustomer rate limited', { uid });
      throw new HttpsError('resource-exhausted', rateLimitResult.message);
    }

    const stripe = getStripe();
    if (!stripe) {
      throw new HttpsError(
        'unavailable',
        'Stripe is not configured. Set the STRIPE_SECRET secret.',
      );
    }

    const email = request.auth.token.email || undefined;
    const emailVerified = request.auth.token.email_verified === true;
    if (!emailVerified) {
      throw new HttpsError('permission-denied', 'Email verification required');
    }

    try {
      const custRef = db.collection('customers').doc(uid);
      const existing = await custRef.get();
      if (existing.exists && existing.data() && existing.data().stripeCustomerId) {
        return { id: existing.data().stripeCustomerId, ok: true, reused: true };
      }

      const name = request.data && request.data.name ? request.data.name : undefined;
      const customer = await stripe.customers.create({ email, name, metadata: { uid } });

      await Promise.all([
        custRef.set(
          { stripeCustomerId: customer.id, lastUpdated: new Date().toISOString() },
          { merge: true },
        ),
        // Best-effort RTDB write; ignore if RTDB is not enabled
        (async () => {
          try {
            await admin.database().ref(`users/${uid}/stripeCustomerId`).set(customer.id);
          } catch (e) {
            logger.warn('RTDB write failed (non-fatal)', e);
          }
        })(),
      ]);

      return { id: customer.id, ok: true };
    } catch (err) {
      logger.error('createStripeCustomer failed', err);
      throw new HttpsError('internal', 'Failed to create Stripe customer');
    }
  },
);

// Scheduled daily reconcile to keep eventUsers summaries fresh
exports.reconcileEventUsersDaily = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'America/Los_Angeles' },
  async () => {
    try {
      const evSnap = await db.collection('events').limit(50).get();
      if (evSnap.empty) return;
      for (const ev of evSnap.docs) {
        const eventId = ev.id;
        try {
          const ragersRef = db.collection('events').doc(eventId).collection('ragers');
          const snap = await ragersRef.get();
          if (snap.empty) continue;

          const perUser = new Map();
          snap.docs.forEach((d) => {
            const v = d.data() || {};
            const uid = String(v.firebaseId || '').trim();
            if (!uid) return;
            const qty = Math.max(1, parseInt(v.ticketQuantity || 1, 10));
            const used = Math.max(0, parseInt(v.usedCount || 0, 10));
            const lastScanAt = v.lastScanAt || null;
            if (!perUser.has(uid)) {
              perUser.set(uid, { totalTickets: 0, usedCount: 0, lastScanAt });
            }
            const agg = perUser.get(uid);
            agg.totalTickets += qty;
            agg.usedCount += used;
            if (
              lastScanAt &&
              lastScanAt.toMillis &&
              (!agg.lastScanAt ||
                (agg.lastScanAt.toMillis && lastScanAt.toMillis() > agg.lastScanAt.toMillis()))
            ) {
              agg.lastScanAt = lastScanAt;
            }
          });

          let batch = db.batch();
          let count = 0;
          for (const [uid, target] of perUser.entries()) {
            const summaryRef = db
              .collection('eventUsers')
              .doc(eventId)
              .collection('users')
              .doc(uid);
            const s = await summaryRef.get();
            let prevTotal = null;
            let prevUsed = null;
            if (s.exists) {
              const d = s.data() || {};
              prevTotal = typeof d.totalTickets === 'number' ? d.totalTickets : null;
              prevUsed = typeof d.usedCount === 'number' ? d.usedCount : null;
            }
            if (prevTotal !== target.totalTickets || prevUsed !== target.usedCount) {
              batch.set(
                summaryRef,
                {
                  totalTickets: target.totalTickets,
                  usedCount: target.usedCount,
                  lastScanAt: target.lastScanAt || admin.firestore.FieldValue.delete(),
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
              count += 1;
              if (count >= 400) {
                await batch.commit();
                batch = db.batch();
                count = 0;
              }
            }
          }
          if (count > 0) await batch.commit();

          try {
            await db
              .collection('reconciliations')
              .doc(eventId)
              .collection('runs')
              .doc(`auto-${Date.now()}`)
              .set(
                {
                  eventId,
                  processedUsers: perUser.size,
                  updatedUsers: admin.firestore.FieldValue.increment(0),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  automated: true,
                },
                { merge: true },
              );
          } catch (_e) {}
        } catch (e) {
          try {
            logger.warn('scheduled reconcile failed for event', { eventId, message: e?.message });
          } catch (_e) {}
        }
      }
    } catch (err) {
      try {
        logger.error('reconcileEventUsersDaily error', { message: err?.message });
      } catch (_e) {}
    }
  },
);
