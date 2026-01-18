import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";

interface UserState {
  localId: string | null;
  userEmail: string | null;
  userName: string | null;
  stripeCustomerId: string | null;
  expoPushToken: string | null;
  unreadChatCount: number;
}

const initialState: UserState = {
  localId: null,
  userEmail: null,
  userName: null,
  stripeCustomerId: null,
  expoPushToken: null,
  unreadChatCount: 0,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setLocalId: (state, action: PayloadAction<string | null>) => {
      state.localId = action.payload;
    },
    setUserEmail: (state, action: PayloadAction<string | null>) => {
      state.userEmail = action.payload;
    },
    setUserName: (state, action: PayloadAction<string | null>) => {
      state.userName = action.payload;
    },
    setStripeCustomerId: (state, action: PayloadAction<string | null>) => {
      state.stripeCustomerId = action.payload;
    },
    setExpoPushToken: (state, action: PayloadAction<string | null>) => {
      state.expoPushToken = action.payload;
    },
    setUnreadChatCount: (state, action: PayloadAction<number>) => {
      state.unreadChatCount = action.payload;
    },
  },
});

export const {
  setLocalId,
  setUserEmail,
  setUserName,
  setStripeCustomerId,
  setExpoPushToken,
  setUnreadChatCount,
} = userSlice.actions;

// Typed selectors
export const selectLocalId = (state: RootState): string | null =>
  state.user.localId;
export const selectUserEmail = (state: RootState): string | null =>
  state.user.userEmail;
export const selectUserName = (state: RootState): string | null =>
  state.user.userName;
export const selectStripeCustomerId = (state: RootState): string | null =>
  state.user.stripeCustomerId;
export const selectExpoPushToken = (state: RootState): string | null =>
  state.user.expoPushToken;
export const selectUnreadChatCount = (state: RootState): number =>
  state.user.unreadChatCount;

// Memoized selectors for performance optimization
export const selectIsAuthenticated = createSelector(
  [selectLocalId],
  (localId) => localId !== null
);

export const selectUserDisplayInfo = createSelector(
  [selectUserName, selectUserEmail],
  (userName, userEmail) => ({
    displayName: userName || userEmail || "User",
    userName,
    userEmail,
  })
);

export default userSlice.reducer;
