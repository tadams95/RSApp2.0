// Example: Adding PostHog Analytics to E-commerce Events
// This file shows how to track key e-commerce events in your app

import { usePostHog } from "../analytics/PostHogProvider";

// Product Tracking
export const useProductAnalytics = () => {
  const { track } = usePostHog();

  const trackProductView = async (product: any) => {
    await track("product_viewed", {
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      price: product.price,
      currency: "USD",
      brand: product.brand,
    });
  };

  const trackProductSearch = async (query: string, results: number) => {
    await track("product_search", {
      search_query: query,
      results_count: results,
    });
  };

  return {
    trackProductView,
    trackProductSearch,
  };
};

// Cart Tracking
export const useCartAnalytics = () => {
  const { track } = usePostHog();

  const trackAddToCart = async (product: any, quantity: number) => {
    await track("cart_item_added", {
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      price: product.price,
      quantity,
      cart_value: product.price * quantity,
    });
  };

  const trackRemoveFromCart = async (product: any, quantity: number) => {
    await track("cart_item_removed", {
      product_id: product.id,
      product_name: product.name,
      quantity,
    });
  };

  const trackCartView = async (cartTotal: number, itemCount: number) => {
    await track("cart_viewed", {
      cart_total: cartTotal,
      item_count: itemCount,
    });
  };

  return {
    trackAddToCart,
    trackRemoveFromCart,
    trackCartView,
  };
};

// Purchase Tracking
export const usePurchaseAnalytics = () => {
  const { track } = usePostHog();

  const trackPurchaseStart = async (cartTotal: number) => {
    await track("checkout_started", {
      cart_total: cartTotal,
    });
  };

  const trackPurchaseComplete = async (order: any) => {
    await track("purchase_completed", {
      order_id: order.id,
      total: order.total,
      currency: "USD",
      payment_method: order.paymentMethod,
      item_count: order.items.length,
    });
  };

  const trackPurchaseFailed = async (error: string, cartTotal: number) => {
    await track("purchase_failed", {
      error_message: error,
      cart_total: cartTotal,
    });
  };

  return {
    trackPurchaseStart,
    trackPurchaseComplete,
    trackPurchaseFailed,
  };
};

// Event Tracking
export const useEventAnalytics = () => {
  const { track } = usePostHog();

  const trackEventView = async (event: any) => {
    await track("event_viewed", {
      event_id: event.id,
      event_name: event.name,
      event_date: event.date,
      event_type: event.type,
      location: event.location,
    });
  };

  const trackEventRegistration = async (event: any) => {
    await track("event_registered", {
      event_id: event.id,
      event_name: event.name,
      event_date: event.date,
      registration_method: "app",
    });
  };

  return {
    trackEventView,
    trackEventRegistration,
  };
};

// Error Tracking
export const useErrorAnalytics = () => {
  const { track } = usePostHog();

  const trackError = async (error: Error, context?: string) => {
    await track("error_occurred", {
      error_message: error.message,
      error_stack: error.stack || null,
      context: context || "unknown",
      timestamp: new Date().toISOString(),
    });
  };

  const trackAPIError = async (
    endpoint: string,
    status: number,
    message: string
  ) => {
    await track("api_error", {
      endpoint,
      status_code: status,
      error_message: message,
    });
  };

  return {
    trackError,
    trackAPIError,
  };
};

// Usage Example in a Component:
/*
import { useProductAnalytics, useScreenTracking } from '../analytics/analyticsHooks';

function ProductDetailScreen({ productId }: { productId: string }) {
  const { trackProductView } = useProductAnalytics();
  
  // Track screen view
  useScreenTracking('Product Detail', {
    product_id: productId,
  });

  useEffect(() => {
    // Track product view when component mounts
    if (product) {
      trackProductView(product);
    }
  }, [product, trackProductView]);

  const handleAddToCart = async () => {
    // ... add to cart logic
    await trackAddToCart(product, quantity);
  };

  return (
    // ... your component JSX
  );
}
*/
