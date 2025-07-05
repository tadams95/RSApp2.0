// src/firebase/firebase.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError, initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { formatApiErrorMessage } from "../hooks/useErrorHandler";

// Import getReactNativePersistence dynamically to avoid TypeScript errors
// @ts-ignore - Firebase getReactNativePersistence is available but not in types
import { getReactNativePersistence } from "firebase/auth";

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

// Initialize Firebase with error handling
let app: any;
let firebaseAuth: any;
let db: any;
let storage: any;
let analytics: any;

try {
  // Initialize Firebase app
  app = initializeApp(firebaseConfig);

  // Initialize Firebase Auth with AsyncStorage persistence
  try {
    // Initialize with React Native AsyncStorage persistence
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (authError) {
    console.error("Error initializing Firebase Auth:", authError);
    // Fallback initialization without persistence (same as before)
    firebaseAuth = initializeAuth(app);
  }

  // Initialize Firebase Firestore
  try {
    db = getFirestore(app);
  } catch (dbError) {
    console.error("Error initializing Firestore:", dbError);
    throw new Error(
      "Failed to initialize Firestore database. Please check your connection and try again."
    );
  }

  // Initialize Firebase Storage
  try {
    storage = getStorage(app);
  } catch (storageError) {
    console.error("Error initializing Storage:", storageError);
    throw new Error(
      "Failed to initialize Firebase storage. Some media functionality may be limited."
    );
  }

  // Initialize Firebase Analytics
  try {
    analytics = getAnalytics(app);
  } catch (analyticsError) {
    console.error("Error initializing Analytics:", analyticsError);
    // Analytics is optional, so we don't throw an error
    analytics = null;
  }
} catch (error) {
  console.error("Fatal error initializing Firebase:", error);

  // Format more user-friendly error messages
  let errorMessage = "Failed to initialize the app. ";

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "app/duplicate-app":
        errorMessage += "Application already initialized.";
        break;
      case "app/invalid-credential":
        errorMessage += "Invalid app credentials.";
        break;
      case "app/invalid-app-name":
        errorMessage += "Invalid app configuration.";
        break;
      default:
        errorMessage += formatApiErrorMessage(error);
    }
  } else {
    errorMessage +=
      "Please check your internet connection and restart the app.";
  }

  // Re-throw with better error message
  throw new Error(errorMessage);
}

// Export the initialized app, auth (as firebaseAuth), db, storage, and analytics
export { app, firebaseAuth as auth, db, storage, analytics };
