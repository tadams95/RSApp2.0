import { createSlice } from "@reduxjs/toolkit";

export const userSlice = createSlice({
  name: "user",
  initialState: {
    localId: null,
    userEmail: null,
    userName: null,
    stripeCustomerId: null,
    expoPushToken: null,
  },
  reducers: {
    setLocalId: (state, action) => {
      state.localId = action.payload;
    },
    setUserEmail: (state, action) => {
      state.userEmail = action.payload;
    },
    setUserName: (state, action) => {
      state.userName = action.payload;
    },
    setStripeCustomerId: (state, action) => {
      state.stripeCustomerId = action.payload;
    },
    setExpoPushToken: (state, action) => {
      state.expoPushToken = action.payload;
    },
  },
});

export const {
  setLocalId,
  setUserEmail,
  setUserName,
  setStripeCustomerId,
  setExpoPushToken,
} = userSlice.actions;

export const selectLocalId = (state) => state.user.localId;
export const selectUserEmail = (state) => state.user.userEmail;
export const selectUserName = (state) => state.user.userName;
export const selectStripeCustomerId = (state) => state.user.stripeCustomerId;
export const selectExpoPushToken = (state) => state.user.expoPushToken;

export default userSlice.reducer;
