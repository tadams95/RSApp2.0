import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./cartSlice";
import userReducer from "./userSlice";
import favoritesReducer from "./favorites";

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    favoriteItems: favoritesReducer,
    user: userReducer,
  },
});
