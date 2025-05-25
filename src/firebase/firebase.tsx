// src/firebase/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Use standard auth initialization without persistence
// Rename auth to firebaseAuth to avoid conflicting with the auth component needed by Expo Router
const firebaseAuth = getAuth(app);

// Initialize Firebase Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

// Export the initialized app, auth (as firebaseAuth), db, and storage
export { app, firebaseAuth as auth, db, storage };
