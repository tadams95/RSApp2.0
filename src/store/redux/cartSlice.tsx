import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store"; // Assuming the store is in the same directory

// Import shared types
import { CartItemMetadata } from "../../types/cart";

// Define types for the cart items and state
export interface CartItem {
  productId: string;
  selectedColor: string;
  selectedSize: string;
  selectedQuantity: number;
  // Additional product information
  title?: string;
  image?: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  variantId?: string;
  // Optional event-specific data
  eventDetails?: {
    dateTime: string;
    location: string;
    [key: string]: any;
  };
  // Generic metadata for different product types (events, clothing, etc)
  metadata?: CartItemMetadata;
}

interface CartState {
  items: CartItem[];
  checkoutPrice: number;
}

// Initial state with type
const initialState: CartState = {
  items: [],
  checkoutPrice: 0,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      state.items.push(action.payload);
    },
    removeFromCart: (
      state,
      action: PayloadAction<{
        productId: string;
        selectedColor: string;
        selectedSize: string;
      }>
    ) => {
      const { productId, selectedColor, selectedSize } = action.payload;
      const indexToRemove = state.items.findIndex(
        (item) =>
          item.productId === productId &&
          item.selectedColor === selectedColor &&
          item.selectedSize === selectedSize
      );

      if (indexToRemove !== -1) {
        state.items.splice(indexToRemove, 1);
      }
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; quantity: number }>
    ) => {
      const { productId, quantity } = action.payload;
      const itemToUpdate = state.items.find(
        (item) => item.productId === productId
      );
      if (itemToUpdate) {
        itemToUpdate.selectedQuantity = quantity;
      }
    },
    clearCart: (state) => {
      state.items = [];
    },
    setCheckoutPrice: (state, action: PayloadAction<number>) => {
      state.checkoutPrice = action.payload;
    },
    updateCartItems: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  setCheckoutPrice,
  updateCartItems,
} = cartSlice.actions;

// Typed selectors
export const selectCartItems = (state: RootState): CartItem[] =>
  state.cart.items;
export const selectCheckoutPrice = (state: RootState): number =>
  state.cart.checkoutPrice;

// Memoized selectors for performance optimization
export const selectCartItemCount = createSelector(
  [selectCartItems],
  (items) => items.length
);

export const selectCartIsEmpty = createSelector(
  [selectCartItems],
  (items) => items.length === 0
);

export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
  items.reduce(
    (total, item) => total + item.price.amount * item.selectedQuantity,
    0
  )
);

export default cartSlice.reducer;
