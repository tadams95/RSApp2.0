// firebase.js

import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDcHCRWrYonzJa_Pyfwzbfp-r3bxz2bUX8",
  authDomain: "ragestate-app.firebaseapp.com",
  databaseURL: "https://ragestate-app-default-rtdb.firebaseio.com/",
  projectId: "ragestate-app",
  storageBucket: "ragestate-app.appspot.com",
  messagingSenderId: "930832370585",
  appId: "1:930832370585:web:fc703a0dd37d550a1fa108",
  measurementId: "G-5YQ5FWXH85",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firebase Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

// Export the initialized app, auth, db, and storage
export { app, auth, db, storage };
