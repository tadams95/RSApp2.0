import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store"; // Assuming the store is in the same directory

// Define types for the cart items and state
export interface CartItem {
  productId: string;
  selectedColor: string;
  selectedSize: string;
  selectedQuantity: number;
  // Additional product information
  title?: string;
  image?: string;
  price?: string;
  currencyCode?: string;
  variantId?: string;
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
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  setCheckoutPrice,
} = cartSlice.actions;

// Typed selectors
export const selectCartItems = (state: RootState): CartItem[] =>
  state.cart.items;
export const selectCheckoutPrice = (state: RootState): number =>
  state.cart.checkoutPrice;

export default cartSlice.reducer;
