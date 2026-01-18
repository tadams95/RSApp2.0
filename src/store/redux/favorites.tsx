import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";

interface FavoritePayload {
  id: string;
}

interface FavoritesState {
  ids: string[];
}

const initialState: FavoritesState = {
  ids: [],
};

const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {
    addFavorite: (state, action: PayloadAction<FavoritePayload>) => {
      state.ids.push(action.payload.id);
    },
    removeFavorite: (state, action: PayloadAction<FavoritePayload>) => {
      state.ids.splice(state.ids.indexOf(action.payload.id), 1);
    },
  },
});

export const { addFavorite, removeFavorite } = favoritesSlice.actions;

// Typed selector
export const selectFavoriteIds = (state: RootState): string[] =>
  state.favoriteItems.ids;

export default favoritesSlice.reducer;
