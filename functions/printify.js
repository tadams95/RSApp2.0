/* eslint-disable */
/**
 * Printify API Service
 *
 * This module handles Printify API integration for print-on-demand fulfillment.
 * Creates orders in Printify when merchandise is purchased through RAGESTATE.
 *
 * Reference: docs/Phase-2-Checklist.md - Section 4: Printify Fulfillment Integration
 *
 * Architecture:
 * - Products displayed via Shopify Storefront API (read-only)
 * - Fulfillment handled by Printify (this module)
 * - Customer payments via Stripe → You pay Printify separately (stored payment method)
 *
 * Required Environment Variables (via Firebase Secrets):
 * - PRINTIFY_API_TOKEN: Personal Access Token from Printify dashboard
 * - PRINTIFY_SHOP_ID: Shop ID from /v1/shops.json (3482930 for Rage State)
 *
 * Setup:
 *   firebase functions:secrets:set PRINTIFY_API_TOKEN
 *   firebase functions:secrets:set PRINTIFY_SHOP_ID
 *
 * @module functions/printify
 */

'use strict';

const logger = require('firebase-functions/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PRINTIFY_BASE_URL = 'https://api.printify.com/v1';

/**
 * Get Printify API configuration.
 * Returns null if credentials are not configured.
 */
function getPrintifyConfig() {
  const apiToken = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!apiToken || !shopId) {
    return null;
  }

  return {
    apiToken,
    shopId,
    baseUrl: PRINTIFY_BASE_URL,
  };
}

/**
 * Check if Printify API is configured and available.
 * @returns {boolean}
 */
function isPrintifyConfigured() {
  return getPrintifyConfig() !== null;
}

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * Make authenticated request to Printify API.
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - API response
 */
async function printifyFetch(endpoint, options = {}) {
  const config = getPrintifyConfig();
  if (!config) {
    throw new Error('Printify API not configured');
  }

  const url = `${config.baseUrl}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Printify API error', {
      status: response.status,
      endpoint,
      error: errorBody,
    });
    throw new Error(`Printify API error: ${response.status} - ${errorBody}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ============================================================================
// SHOP OPERATIONS
// ============================================================================

/**
 * Get list of connected shops.
 * @returns {Promise<Array>} - List of shops
 */
async function getShops() {
  return printifyFetch('/shops.json');
}

/**
 * Get current shop details.
 * @returns {Promise<Object>} - Shop details
 */
async function getCurrentShop() {
  const config = getPrintifyConfig();
  if (!config) return null;
  return printifyFetch(`/shops/${config.shopId}.json`);
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

/**
 * Get all products in the shop.
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 100)
 * @returns {Promise<Object>} - Paginated product list
 */
async function getProducts(page = 1, limit = 100) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');
  return printifyFetch(`/shops/${config.shopId}/products.json?page=${page}&limit=${limit}`);
}

/**
 * Get a specific product by ID.
 * @param {string} productId - Printify product ID
 * @returns {Promise<Object>} - Product details with variants
 */
async function getProduct(productId) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');
  return printifyFetch(`/shops/${config.shopId}/products/${productId}.json`);
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

/**
 * Format shipping address for Printify API.
 * @param {Object} address - Internal address format (from checkout)
 * @returns {Object} - Printify-formatted address
 */
function formatShippingAddress(address) {
  if (!address) return null;

  // Handle various input formats
  const nameParts = (address.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    first_name: firstName,
    last_name: lastName,
    email: address.email || '',
    phone: address.phone || '',
    country: address.country || 'US',
    region: address.state || address.province || address.region || '',
    address1: address.line1 || address.address1 || '',
    address2: address.line2 || address.address2 || '',
    city: address.city || '',
    zip: address.postalCode || address.zip || '',
  };
}

/**
 * Create an order in Printify.
 *
 * @param {Object} orderData - Order data
 * @param {string} orderData.externalId - Your order ID (e.g., paymentIntentId)
 * @param {Array} orderData.lineItems - Array of { printifyProductId, printifyVariantId, quantity }
 * @param {Object} orderData.shippingAddress - Customer shipping address
 * @param {boolean} orderData.sendToProduction - Auto-send to production (default: true)
 * @returns {Promise<Object>} - Created order
 *
 * @example
 * const order = await createOrder({
 *   externalId: 'pi_abc123',
 *   lineItems: [
 *     { printifyProductId: '123abc', printifyVariantId: 17887, quantity: 1 }
 *   ],
 *   shippingAddress: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     line1: '123 Main St',
 *     city: 'Los Angeles',
 *     state: 'CA',
 *     postalCode: '90001',
 *     country: 'US'
 *   }
 * });
 */
async function createOrder(orderData) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  const { externalId, lineItems, shippingAddress, sendToProduction = true } = orderData;

  if (!lineItems || lineItems.length === 0) {
    throw new Error('No line items provided');
  }

  if (!shippingAddress) {
    throw new Error('Shipping address required');
  }

  // Format line items for Printify
  const formattedItems = lineItems.map((item) => ({
    product_id: item.printifyProductId,
    variant_id: item.printifyVariantId,
    quantity: item.quantity,
  }));

  const orderPayload = {
    external_id: externalId,
    line_items: formattedItems,
    shipping_method: 1, // Standard shipping (1 = cheapest)
    send_shipping_notification: true,
    address_to: formatShippingAddress(shippingAddress),
  };

  logger.info('Creating Printify order', {
    externalId,
    itemCount: formattedItems.length,
  });

  const order = await printifyFetch(`/shops/${config.shopId}/orders.json`, {
    method: 'POST',
    body: JSON.stringify(orderPayload),
  });

  // Optionally send to production immediately
  if (sendToProduction && order?.id) {
    try {
      await sendOrderToProduction(order.id);
      logger.info('Order sent to production', { orderId: order.id });
    } catch (err) {
      // Log but don't fail - order exists, can be sent to production manually
      logger.warn('Failed to auto-send to production', { orderId: order.id, error: err.message });
    }
  }

  return order;
}

/**
 * Send an existing order to production.
 * @param {string} orderId - Printify order ID
 * @returns {Promise<Object>} - Updated order
 */
async function sendOrderToProduction(orderId) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  return printifyFetch(`/shops/${config.shopId}/orders/${orderId}/send_to_production.json`, {
    method: 'POST',
  });
}

/**
 * Get order details by ID.
 * @param {string} orderId - Printify order ID
 * @returns {Promise<Object>} - Order details
 */
async function getOrder(orderId) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');
  return printifyFetch(`/shops/${config.shopId}/orders/${orderId}.json`);
}

/**
 * Get orders with optional filters.
 * @param {Object} options - Filter options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status
 * @returns {Promise<Object>} - Paginated order list
 */
async function getOrders({ page = 1, limit = 100, status } = {}) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  let url = `/shops/${config.shopId}/orders.json?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }

  return printifyFetch(url);
}

/**
 * Calculate shipping cost for an order.
 * @param {Object} params - Shipping calculation params
 * @param {Array} params.lineItems - Items in the order
 * @param {Object} params.addressTo - Shipping destination
 * @returns {Promise<Object>} - Shipping options with costs
 */
async function calculateShipping({ lineItems, addressTo }) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  const payload = {
    line_items: lineItems.map((item) => ({
      product_id: item.printifyProductId,
      variant_id: item.printifyVariantId,
      quantity: item.quantity,
    })),
    address_to: formatShippingAddress(addressTo),
  };

  return printifyFetch(`/shops/${config.shopId}/orders/shipping.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// WEBHOOK OPERATIONS
// ============================================================================

/**
 * List registered webhooks for the shop.
 * @returns {Promise<Array>} - List of webhooks
 */
async function getWebhooks() {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');
  return printifyFetch(`/shops/${config.shopId}/webhooks.json`);
}

/**
 * Register a webhook.
 * @param {Object} webhook - Webhook configuration
 * @param {string} webhook.topic - Event topic (e.g., 'order:shipment:created')
 * @param {string} webhook.url - Callback URL
 * @param {string} webhook.secret - Webhook secret for signature validation
 * @returns {Promise<Object>} - Created webhook
 */
async function createWebhook({ topic, url, secret }) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  return printifyFetch(`/shops/${config.shopId}/webhooks.json`, {
    method: 'POST',
    body: JSON.stringify({ topic, url, secret }),
  });
}

/**
 * Delete a webhook.
 * @param {string} webhookId - Webhook ID to delete
 * @returns {Promise<void>}
 */
async function deleteWebhook(webhookId) {
  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  return printifyFetch(`/shops/${config.shopId}/webhooks/${webhookId}.json`, {
    method: 'DELETE',
  });
}

/**
 * Validate webhook signature.
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Pfy-Signature header value
 * @param {string} secret - Webhook secret
 * @returns {boolean} - True if valid
 */
function validateWebhookSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

// ============================================================================
// SKU MAPPING HELPERS
// ============================================================================

/**
 * Find Printify product and variant by SKU.
 * Searches all products in the shop for a matching variant SKU.
 *
 * @param {string} sku - The SKU to search for
 * @returns {Promise<Object|null>} - { productId, variantId } or null if not found
 */
async function findByVariantSku(sku) {
  if (!sku) return null;

  const config = getPrintifyConfig();
  if (!config) throw new Error('Printify not configured');

  // Fetch all products (paginated)
  let page = 1;
  const limit = 100;

  while (true) {
    const response = await getProducts(page, limit);
    const products = response.data || response;

    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variant.sku === sku) {
          return {
            productId: product.id,
            variantId: variant.id,
            product,
            variant,
          };
        }
      }
    }

    // Check if there are more pages
    if (!products.length || products.length < limit) {
      break;
    }
    page++;
  }

  return null;
}

/**
 * Build a SKU mapping for all products.
 * Useful for syncing/caching SKU → Printify ID mappings.
 *
 * @returns {Promise<Map>} - Map of SKU → { productId, variantId }
 */
async function buildSkuMap() {
  const skuMap = new Map();

  let page = 1;
  const limit = 100;

  while (true) {
    const response = await getProducts(page, limit);
    const products = response.data || response;

    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variant.sku) {
          skuMap.set(variant.sku, {
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variantTitle: variant.title,
          });
        }
      }
    }

    if (!products.length || products.length < limit) {
      break;
    }
    page++;
  }

  logger.info('Built Printify SKU map', { count: skuMap.size });
  return skuMap;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  getPrintifyConfig,
  isPrintifyConfigured,

  // API client
  printifyFetch,

  // Shop operations
  getShops,
  getCurrentShop,

  // Product operations
  getProducts,
  getProduct,

  // Order operations
  createOrder,
  sendOrderToProduction,
  getOrder,
  getOrders,
  calculateShipping,
  formatShippingAddress,

  // Webhook operations
  getWebhooks,
  createWebhook,
  deleteWebhook,
  validateWebhookSignature,

  // SKU mapping
  findByVariantSku,
  buildSkuMap,
};
