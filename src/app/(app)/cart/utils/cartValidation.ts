/**
 * Cart Validation Utilities
 * 
 * This f  // Validate size for clothing items (not event tickets)
  if (!item.eventDetails && (!item.selectedSize || item.selectedSize.trim() === '')) {
    errors.size = "Size selection required";
  }

// Validate color for clothing items that require it
  // Skip validation for items that don't have color options
  if (!item.eventDetails && 
      (!item.selectedColor || item.selectedColor.trim() === '') && 
      typeof item.metadata?.hasColorOptions !== 'undefined' && 
      item.metadata.hasColorOptions) {
    errors.color = "Color selection required";
  }ns functions for validating cart data before checkout
 * and providing field-level error reporting.
 */

import { CartItem } from "../../../../store/redux/cartSlice";

/**
 * Interface for cart validation errors
 */
export interface CartValidationErrors {
  items?: {
    [productId: string]: {
      quantity?: string;
      size?: string;
      color?: string;
      general?: string;
    };
  };
  general?: string;
}

/**
 * Validates a cart item
 * 
 * @param item The cart item to validate
 * @returns Object containing validation errors or empty object if valid
 */
export function validateCartItem(item: CartItem): { [field: string]: string } {
  const errors: { [field: string]: string } = {};

  // Validate product ID
  if (!item.productId) {
    errors.general = "Invalid product";
    return errors;
  }

  // Validate quantity
  if (!item.selectedQuantity || item.selectedQuantity < 1) {
    errors.quantity = "Quantity must be at least 1";
  } else if (item.selectedQuantity > 10) {
    errors.quantity = "Maximum quantity is 10";
  }

  // Validate size for clothing items (not event tickets)
  if (!item.eventDetails && !item.selectedSize) {
    errors.size = "Size selection required";
  }

  // Validate color for clothing items that require it
  // Skip validation for items that don't have color options
  if (!item.eventDetails && item.selectedColor === undefined && typeof item.metadata?.hasColorOptions !== 'undefined' && item.metadata.hasColorOptions) {
    errors.color = "Color selection required";
  }

  // Price validation
  if (!item.price || typeof item.price.amount !== 'number' || item.price.amount <= 0) {
    errors.general = "Invalid price data";
  }

  return errors;
}

/**
 * Validates the entire cart before checkout
 * 
 * @param cartItems Array of cart items to validate
 * @returns Validation result object with errors or empty object if valid
 */
export function validateCart(cartItems: CartItem[]): { 
  isValid: boolean;
  errors: CartValidationErrors;
} {
  // Start with empty errors object
  const errors: CartValidationErrors = {};
  let hasErrors = false;

  // Check if cart is empty
  if (!cartItems || cartItems.length === 0) {
    errors.general = "Your cart is empty";
    return { isValid: false, errors };
  }

  // Check each cart item
  const itemErrors: { [productId: string]: any } = {};
  
  cartItems.forEach(item => {
    const validationResult = validateCartItem(item);
    
    if (Object.keys(validationResult).length > 0) {
      itemErrors[item.productId] = validationResult;
      hasErrors = true;
    }
  });

  if (Object.keys(itemErrors).length > 0) {
    errors.items = itemErrors;
  }

  return {
    isValid: !hasErrors,
    errors,
  };
}

/**
 * Gets a user-friendly error message for cart validation issues
 * 
 * @param errors Cart validation errors object
 * @returns A consumer-friendly error message
 */
export function getCartValidationErrorMessage(errors: CartValidationErrors): string {
  if (errors.general) {
    return errors.general;
  }

  if (!errors.items) {
    return "Please review your cart before checkout";
  }

  const itemErrors = Object.values(errors.items);
  const errorCount = itemErrors.length;

  if (errorCount === 1) {
    // If just one item has issues
    const firstError = itemErrors[0];
    if (firstError.quantity) return firstError.quantity;
    if (firstError.size) return "Please select a size for all items";
    if (firstError.color) return "Please select a color for all items";
    if (firstError.general) return firstError.general;
    return "Please review item details";
  } 
  
  return `Please review ${errorCount} items in your cart`;
}

/**
 * Checks if shipping information is required
 * (Required for physical items, not required for digital/event items)
 * 
 * @param cartItems Array of cart items
 * @returns Boolean indicating if shipping is required
 */
export function isShippingRequired(cartItems: CartItem[]): boolean {
  // If any item doesn't have eventDetails, it's a physical item
  return cartItems.some(item => !item.eventDetails);
}
