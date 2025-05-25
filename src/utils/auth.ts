import {
  createUserWithEmailAndPassword,
  getIdToken,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
} from "firebase/auth";
import { get, getDatabase, ref, set, update } from "firebase/database";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Dispatch } from "redux";
import { auth as firebaseAuth } from "../firebase/firebase";

import { setLocalId, setUserEmail } from "../store/redux/userSlice";

// Initialize Firestore and Realtime Database
const db = getFirestore();
const rtdb = getDatabase();

// Define types for user data
export interface UserData {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string;
  expoPushToken: string;
  qrCode: string;
  userId: string;
  createdAt: string;
  lastLogin: string;
  lastUpdated: string;
  profilePicture: string;
  stripeCustomerId: string;
  isAdmin: boolean;
  migratedFromRTDB: boolean;
  migrationDate?: string;
  [key: string]: any; // For any additional fields
}

interface CreateUserResult {
  user: User;
  userData: UserData;
}

interface AuthResult {
  success: boolean;
  message?: string;
}

export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  expoPushToken?: string,
  dispatch?: Dispatch
): Promise<CreateUserResult> {
  try {
    const userCredential: UserCredential =    await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    const userId = userCredential.user.uid;
    const timestamp = new Date().toISOString();
    const displayName = `${firstName} ${lastName}`;

    const userData: UserData = {
      email,
      firstName,
      lastName,
      displayName,
      phoneNumber,
      expoPushToken: expoPushToken || "",
      qrCode: userId,
      userId,
      createdAt: timestamp,
      lastLogin: timestamp,
      lastUpdated: timestamp,
      profilePicture: "",
      stripeCustomerId: "",
      isAdmin: false,
      migratedFromRTDB: false,
    };

    // Save to both databases in parallel using Firebase SDK
    await Promise.all([
      // Save to Realtime Database
      set(ref(rtdb, `users/${userId}`), userData),

      // Save to Firestore
      setDoc(doc(db, "customers", userId), {
        ...userData,
        migrationDate: "",
      }),
    ]);

    // Only dispatch if the function is provided
    if (typeof dispatch === "function") {
      dispatch(setLocalId(userId));
      dispatch(setUserEmail(email));
    }

    return {
      user: userCredential.user,
      userData,
    };
  } catch (error: any) {
    const errorMessage = handleAuthError(error);
    throw new Error(errorMessage);
  }
}

export async function loginUser(
  email: string,
  password: string,
  dispatch?: Dispatch
): Promise<User> {
  try {
    const userCredential: UserCredential =    await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );
    const user = userCredential.user;
    const userId = user.uid;
    const timestamp = new Date().toISOString();

    await Promise.all([
      update(ref(rtdb, `users/${userId}`), { lastLogin: timestamp }),
      updateDoc(doc(db, "customers", userId), {
        lastLogin: timestamp,
        lastUpdated: timestamp,
      }),
    ]);

    // Only dispatch if the function is provided
    if (typeof dispatch === "function") {
      dispatch(setLocalId(userId));
      dispatch(setUserEmail(email));
    }

    return user;
  } catch (error: any) {
    const errorMessage = handleAuthError(error);
    throw new Error(errorMessage);
  }
}

export async function forgotPassword(email: string): Promise<AuthResult> {
  try {
    // Using Firebase's built-in password reset functionality
    await sendPasswordResetEmail(firebaseAuth, email);
    return { success: true, message: "Password reset email sent successfully" };
  } catch (error: any) {
    const errorMessage = handleAuthError(error);
    return { success: false, message: errorMessage };
  }
}

export async function logoutUser(dispatch: Dispatch): Promise<AuthResult> {
  try {
    await signOut(firebaseAuth);
    // Clear user data in Redux store
    dispatch(setLocalId(null));
    dispatch(setUserEmail(null));
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    // Try Firestore first
    const firestoreDoc = await getDoc(doc(db, "customers", userId));

    if (firestoreDoc.exists()) {
      return firestoreDoc.data() as UserData;
    }

    // Get current user's token for RTDB
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user");
    }
    const idToken = await getIdToken(currentUser);

    // Fall back to RTDB
    const rtdbSnapshot = await get(ref(rtdb, `users/${userId}`));

    if (rtdbSnapshot.exists()) {
      const rtdbData = rtdbSnapshot.val();
      const timestamp = new Date().toISOString();

      // Prepare and migrate data to Firestore
      const firestoreData: UserData = {
        ...rtdbData,
        displayName:
          rtdbData.firstName && rtdbData.lastName
            ? `${rtdbData.firstName} ${rtdbData.lastName}`
            : "",
        lastUpdated: timestamp,
        migratedFromRTDB: true,
        migrationDate: timestamp,
        isAdmin: rtdbData.isAdmin || false,
        profilePicture: rtdbData.profilePicture || "",
        stripeCustomerId: rtdbData.stripeCustomerId || "",
      };

      // Migrate to Firestore
      await setDoc(doc(db, "customers", userId), firestoreData);

      return firestoreData;
    }

    return null;
  } catch (error: any) {
    console.error("Error fetching user data:", error);
    throw new Error("Failed to retrieve user data");
  }
}

export async function updateUserData(
  userId: string,
  userData: Partial<UserData>
): Promise<AuthResult> {
  try {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user");
    }
    const idToken = await getIdToken(currentUser);
    const timestamp = new Date().toISOString();
    const updatedData = {
      ...userData,
      lastUpdated: timestamp,
    };

    // Update both databases using Firebase SDK
    await Promise.all([
      // Update RTDB
      update(ref(rtdb, `users/${userId}`), updatedData),

      // Update Firestore
      updateDoc(doc(db, "customers", userId), updatedData),
    ]);

    return { success: true };
  } catch (error: any) {
    console.error("Error updating user data:", error);
    return { success: false, message: "Failed to update user data" };
  }
}

export async function updateUserStripeId(
  userId: string,
  stripeCustomerId: string
): Promise<AuthResult> {
  try {
    // Update both databases using Firebase SDK
    await Promise.all([
      // Update RTDB
      update(ref(rtdb, `users/${userId}`), {
        stripeCustomerId,
      }),

      // Update Firestore
      updateDoc(doc(db, "customers", userId), {
        stripeCustomerId,
        lastUpdated: new Date().toISOString(),
      }),
    ]);

    return { success: true };
  } catch (error: any) {
    console.error("Error updating Stripe customer ID:", error);
    throw new Error("Failed to update user with Stripe customer ID");
  }
}

// Helper function to standardize error handling
function handleAuthError(error: any): string {
  console.error("Authentication error:", error);

  if (error.code) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "This email is already in use. Please try logging in.";
      case "auth/invalid-email":
        return "Invalid email format.";
      case "auth/operation-not-allowed":
        return "Password sign-in is disabled for this project.";
      case "auth/weak-password":
        return "Password is too weak. Please use a stronger password.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/user-not-found":
        return "No account found with this email.";
      case "auth/wrong-password":
        return "Incorrect password.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      default:
        return `Authentication error: ${error.message}`;
    }
  }

  return "An unexpected error occurred. Please try again.";
}
