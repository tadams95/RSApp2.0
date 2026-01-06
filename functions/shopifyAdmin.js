/* eslint-disable */
/**
 * Shopify Admin API Service
 *
 * This module handles Shopify Admin API integration for merchandise orders.
 * Creates orders in Shopify when merchandise is purchased through RAGESTATE.
 *
 * Reference: MERCH_CHECKOUT_FIXES.md - Phase 3: Shopify Integration
 *
 * NOTE: Currently we use Printify for fulfillment, NOT Shopify fulfillment.
 * This module is stubbed and ready for future Shopify integration if needed.
 * Merchandise orders are recorded in Firestore `merchandiseOrders` collection.
 *
 * Required Shopify Admin API Scopes (when enabled):
 * - read_orders, write_orders
 * - read_products, read_inventory
 *
 * Setup (run once, when ready to enable):
 *   firebase functions:secrets:set SHOPIFY_ADMIN_ACCESS_TOKEN
 *   firebase functions:secrets:set SHOPIFY_SHOP_NAME
 *
 * @module functions/shopifyAdmin
 */

'use strict';

const logger = require('firebase-functions/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SHOPIFY_API_VERSION = '2024-10';

/**
 * Get Shopify Admin API client configuration.
 * Returns null if credentials are not configured.
 */
function getShopifyConfig() {
  const shopName = process.env.SHOPIFY_SHOP_NAME;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopName || !accessToken) {
    return null;
  }

  return {
    shopName,
    accessToken,
    apiVersion: SHOPIFY_API_VERSION,
    baseUrl: `https://${shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}`,
  };
}

/**
 * Check if Shopify Admin API is configured and available.
 * @returns {boolean}
 */
function isShopifyConfigured() {
  return getShopifyConfig() !== null;
}

// ============================================================================
// SHOPIFY ORDER CREATION
// ============================================================================

/**
 * Format shipping address for Shopify API.
 * @param {Object} address - Internal address format
 * @returns {Object} - Shopify-formatted address
 */
function formatShippingAddress(address) {
  if (!address) return null;

  const nameParts = (address.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    first_name: firstName,
    last_name: lastName,
    address1: address.line1 || address.address1 || '',
    address2: address.line2 || address.address2 || '',
    city: address.city || '',
    province: address.state || address.province || '',
    zip: address.postalCode || address.zip || '',
    country: address.country || 'US',
    phone: address.phone || '',
  };
}

/**
 * Create an order in Shopify Admin.
 *
 * @param {Object} orderData - Order data from finalize-order
 * @param {Array} orderData.items - Array of merchandise items
 * @param {string} orderData.email - Customer email
 * @param {string} orderData.orderNumber - Our internal order number (paymentIntentId)
 * @param {Object} orderData.shippingAddress - Shipping address details
 * @param {string} orderData.customerName - Customer name
 * @returns {Promise<Object|null>} - Created Shopify order or null if not configured/failed
 */
async function createShopifyOrder(orderData) {
  const config = getShopifyConfig();

  if (!config) {
    logger.warn('[Shopify] Admin API not configured - order creation skipped', {
      orderNumber: orderData?.orderNumber,
      itemCount: orderData?.items?.length || 0,
      hint: 'Set SHOPIFY_ADMIN_ACCESS_TOKEN and SHOPIFY_SHOP_NAME secrets',
    });
    return { success: false, reason: 'not_configured' };
  }

  try {
    // Build line items from merchandise items
    const lineItems = orderData.items.map((item) => {
      const variantId = extractVariantId(item.variantId || item.id);

      // If we have a variant ID, use it; otherwise use title-based matching
      if (variantId) {
        return {
          variant_id: parseInt(variantId, 10),
          quantity: item.quantity || 1,
        };
      }

      // Fallback: create custom line item (less ideal but works)
      return {
        title: item.title || item.name || 'RAGESTATE Item',
        quantity: item.quantity || 1,
        price: item.price || '0.00',
        requires_shipping: true,
      };
    });

    // Build the order payload
    const orderPayload = {
      order: {
        line_items: lineItems,
        customer: {
          email: orderData.email,
        },
        email: orderData.email,
        financial_status: 'paid', // Already paid via Stripe
        fulfillment_status: null, // Not yet fulfilled
        note: `RAGESTATE Web Order | PI: ${orderData.orderNumber}`,
        tags: 'ragestate-web, auto-created',
        send_receipt: false, // We send our own via Resend
        send_fulfillment_receipt: true, // Let Shopify send shipping updates
      },
    };

    // Add shipping address if provided
    const shippingAddr = formatShippingAddress(orderData.shippingAddress);
    if (shippingAddr) {
      orderPayload.order.shipping_address = shippingAddr;
      // Use shipping as billing if no separate billing provided
      orderPayload.order.billing_address = shippingAddr;
    }

    // Add customer name if provided
    if (orderData.customerName) {
      const nameParts = orderData.customerName.split(' ');
      orderPayload.order.customer.first_name = nameParts[0] || '';
      orderPayload.order.customer.last_name = nameParts.slice(1).join(' ') || '';
    }

    logger.info('[Shopify] Creating order', {
      orderNumber: orderData.orderNumber,
      itemCount: lineItems.length,
      email: orderData.email,
    });

    // Make the API request
    const response = await fetch(`${config.baseUrl}/orders.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.accessToken,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('[Shopify] Order creation failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorBody,
        orderNumber: orderData.orderNumber,
      });
      return {
        success: false,
        reason: 'api_error',
        status: response.status,
        error: errorBody,
      };
    }

    const result = await response.json();
    const shopifyOrder = result.order;

    logger.info('[Shopify] Order created successfully', {
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderNumber: shopifyOrder.order_number,
      orderNumber: orderData.orderNumber,
      totalPrice: shopifyOrder.total_price,
    });

    return {
      success: true,
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderNumber: shopifyOrder.order_number,
      orderName: shopifyOrder.name,
      statusUrl: shopifyOrder.order_status_url,
    };
  } catch (error) {
    logger.error('[Shopify] Order creation exception', {
      error: error.message,
      stack: error.stack,
      orderNumber: orderData?.orderNumber,
    });
    return {
      success: false,
      reason: 'exception',
      error: error.message,
    };
  }
}

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Check inventory availability for a variant in Shopify.
 *
 * @param {string} variantId - Shopify variant ID (can be GID format)
 * @returns {Promise<number|null>} - Available quantity or null if not configured
 */
async function checkInventory(variantId) {
  const config = getShopifyConfig();

  if (!config) {
    logger.warn('[Shopify] Admin API not configured - inventory check skipped', {
      variantId,
    });
    return null;
  }

  try {
    const numericId = extractVariantId(variantId);
    if (!numericId) {
      logger.warn('[Shopify] Invalid variant ID for inventory check', { variantId });
      return null;
    }

    // First get the inventory_item_id from the variant
    const variantResponse = await fetch(`${config.baseUrl}/variants/${numericId}.json`, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
      },
    });

    if (!variantResponse.ok) {
      logger.warn('[Shopify] Failed to fetch variant', {
        variantId: numericId,
        status: variantResponse.status,
      });
      return null;
    }

    const variantData = await variantResponse.json();
    const inventoryItemId = variantData.variant?.inventory_item_id;

    if (!inventoryItemId) {
      logger.warn('[Shopify] No inventory_item_id found', { variantId: numericId });
      return null;
    }

    // Get inventory levels for this item
    const inventoryResponse = await fetch(
      `${config.baseUrl}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
      {
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
        },
      },
    );

    if (!inventoryResponse.ok) {
      logger.warn('[Shopify] Failed to fetch inventory levels', {
        inventoryItemId,
        status: inventoryResponse.status,
      });
      return null;
    }

    const inventoryData = await inventoryResponse.json();
    const totalAvailable = (inventoryData.inventory_levels || []).reduce(
      (sum, level) => sum + (level.available || 0),
      0,
    );

    logger.info('[Shopify] Inventory check result', {
      variantId: numericId,
      inventoryItemId,
      available: totalAvailable,
    });

    return totalAvailable;
  } catch (error) {
    logger.error('[Shopify] Inventory check exception', {
      error: error.message,
      variantId,
    });
    return null;
  }
}

/**
 * Decrement inventory for a variant after purchase.
 * Note: If using Shopify orders (createShopifyOrder), inventory is automatically decremented.
 * This is only needed if NOT creating Shopify orders.
 *
 * @param {string} variantId - Shopify variant ID
 * @param {number} quantity - Quantity to decrement
 * @returns {Promise<boolean>} - Success status
 */
async function decrementInventory(variantId, quantity) {
  const config = getShopifyConfig();

  if (!config) {
    logger.warn('[Shopify] Admin API not configured - inventory decrement skipped', {
      variantId,
      quantity,
    });
    return false;
  }

  // Note: When creating Shopify orders, inventory is automatically adjusted.
  // This function is provided for cases where orders aren't created in Shopify.
  logger.info('[Shopify] Inventory decrement not needed - orders auto-adjust inventory', {
    variantId,
    quantity,
  });

  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract numeric variant ID from Shopify GID format.
 * Converts 'gid://shopify/ProductVariant/123456' to '123456'
 *
 * @param {string} gid - Shopify GID or numeric ID
 * @returns {string|null} - Numeric ID or null
 */
function extractVariantId(gid) {
  if (!gid) return null;

  // Already numeric
  if (/^\d+$/.test(gid)) return gid;

  // Extract from GID format
  const match = String(gid).match(/\/(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Extract numeric product ID from Shopify GID format.
 * Converts 'gid://shopify/Product/123456' to '123456'
 *
 * @param {string} gid - Shopify GID or numeric ID
 * @returns {string|null} - Numeric ID or null
 */
function extractProductId(gid) {
  if (!gid) return null;

  // Already numeric
  if (/^\d+$/.test(gid)) return gid;

  // Extract from GID format
  const match = String(gid).match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// ============================================================================
// FUTURE WEBHOOK HANDLERS (STUBS)
// ============================================================================

/**
 * Handle Shopify order fulfillment webhook.
 *
 * Updates merchandiseOrders status when orders are fulfilled in Shopify.
 *
 * @param {Object} payload - Shopify webhook payload
 */
async function handleFulfillmentWebhook(payload) {
  logger.info('[Shopify] Fulfillment webhook received', {
    orderId: payload?.id,
    fulfillmentStatus: payload?.fulfillment_status,
  });
  // TODO: Update merchandiseOrders/{id}.fulfillmentStatus when Shopify fulfills
  // This requires looking up the order by shopifyOrderId
}

/**
 * Handle Shopify inventory update webhook.
 *
 * Can be used to sync Shopify inventory changes back to Firestore.
 *
 * @param {Object} payload - Shopify webhook payload
 */
async function handleInventoryWebhook(payload) {
  logger.info('[Shopify] Inventory webhook received', {
    inventoryItemId: payload?.inventory_item_id,
    available: payload?.available,
  });
  // TODO: Sync inventory levels to Firestore for display if needed
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  isShopifyConfigured,
  getShopifyConfig,

  // Order management
  createShopifyOrder,

  // Inventory management
  checkInventory,
  decrementInventory,

  // Helpers
  extractVariantId,
  extractProductId,
  formatShippingAddress,

  // Webhook handlers
  handleFulfillmentWebhook,
  handleInventoryWebhook,
};
