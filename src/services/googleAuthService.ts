import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

// Client IDs from Firebase/Google Cloud Console
const WEB_CLIENT_ID =
  "930832370585-6j2jpma2khl692j5331llh1tai9dmell.apps.googleusercontent.com";
const IOS_CLIENT_ID =
  "930832370585-tvmm4moku77su7v4rp5adp3ql520gi73.apps.googleusercontent.com";

// Track if Google Sign-In has been configured
let isConfigured = false;

/**
 * Configure Google Sign-In (called lazily on first use)
 */
function ensureConfigured() {
  if (!isConfigured) {
    try {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID,
        offlineAccess: true,
      });
      isConfigured = true;
    } catch (error) {
      console.warn("Google Sign-In configuration failed:", error);
      throw new Error("Google Sign-In is not available on this device");
    }
  }
}

export interface GoogleSignInResult {
  userCredential: UserCredential;
  isNewUser: boolean;
}

/**
 * Sign in with Google and return Firebase user credential
 * Also determines if the user is new (for profile setup flow)
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  // Ensure Google Sign-In is configured before use
  ensureConfigured();

  try {
    // Check Play Services availability (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Trigger Google Sign-In flow
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;

    if (!idToken) {
      throw new Error("No ID token returned from Google Sign-In");
    }

    // Create Firebase credential from Google ID token
    const credential = GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase with Google credential
    const userCredential = await signInWithCredential(auth, credential);

    // Check if user exists in Firestore (to determine if new)
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    const isNewUser = !userDoc.exists();

    // If new user, create basic profile from Google account info
    if (isNewUser) {
      const googleUser = signInResult.data?.user;
      await setDoc(userDocRef, {
        email: userCredential.user.email,
        firstName: googleUser?.givenName || "",
        lastName: googleUser?.familyName || "",
        photoURL: googleUser?.photo || null,
        provider: "google",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { userCredential, isNewUser };
  } catch (error: any) {
    // Handle specific Google Sign-In errors
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google Sign-In was cancelled");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Google Sign-In is already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services is not available on this device");
    }
    throw error;
  }
}

/**
 * Sign out from Google (call alongside Firebase sign out)
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    // Silently fail - user might not have signed in with Google
    console.log("Google sign out error (non-critical):", error);
  }
}

/**
 * Check if user is currently signed in with Google
 */
export async function isGoogleSignedIn(): Promise<boolean> {
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    return currentUser !== null;
  } catch {
    return false;
  }
}

/**
 * Get current Google user info (if signed in)
 */
export async function getCurrentGoogleUser() {
  try {
    return await GoogleSignin.getCurrentUser();
  } catch {
    return null;
  }
}
