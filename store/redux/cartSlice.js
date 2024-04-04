import { createSlice } from "@reduxjs/toolkit";

//redux slice to manage cart state and add items to cart

const cartSlice = createSlice({
  name: "cart",
  initialState: { items: [], checkoutPrice: 0 },
  reducers: {
    addToCart: (state, action) => {
      state.items.push(action.payload);
    },
    removeFromCart: (state, action) => {
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

    updateQuantity: (state, action) => {
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
    setCheckoutPrice: (state, action) => {
      state.checkoutPrice = action.payload;
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, setCheckoutPrice } =
  cartSlice.actions;
export const selectCartItems = (state) => state.cart.items;
export const selectCheckoutPrice = (state) => state.cart.checkoutPrice; // Selector function to extract checkoutPrice
export default cartSlice.reducer;
