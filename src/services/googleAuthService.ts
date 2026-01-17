import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, rtdb } from "../firebase/firebase";

// Stripe API URL for customer creation
const STRIPE_API_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

// Client IDs from Firebase/Google Cloud Console
// WEB_CLIENT_ID: Get from Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
// IOS_CLIENT_ID: From GoogleService-Info.plist (CLIENT_ID field)
const WEB_CLIENT_ID =
  "930832370585-otq4m0qsvpoci3dsvfjre1eldkaihhso.apps.googleusercontent.com";
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
  stripeCustomerId?: string;
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
    const userId = userCredential.user.uid;

    // Check if user exists in Firestore (to determine if new)
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    const isNewUser = !userDoc.exists();

    let stripeCustomerId: string | undefined;

    // If new user, create full profile matching email signup schema
    if (isNewUser) {
      const googleUser = signInResult.data?.user;
      const timestamp = new Date().toISOString();
      const displayName =
        `${googleUser?.givenName || ""} ${googleUser?.familyName || ""}`.trim() ||
        userCredential.user.displayName ||
        "User";

      // Full user data matching email signup schema from auth.ts
      const userData = {
        // Core identity
        email: userCredential.user.email || "",
        firstName: googleUser?.givenName || "",
        lastName: googleUser?.familyName || "",
        displayName,
        phoneNumber: "", // Google doesn't provide phone
        expoPushToken: "", // Set later when push permission granted

        // Auth & Identification
        userId,
        qrCode: userId,
        provider: "google",

        // Profile
        photoURL: googleUser?.photo || null,
        profilePicture: googleUser?.photo || "",
        bio: "",
        usernameLower: null,
        profileSongUrl: null,

        // Permissions & Status
        isAdmin: false,
        migratedFromRTDB: false,
        isPublic: true,
        verificationStatus: "none",

        // Commerce
        stripeCustomerId: "", // Set after Stripe customer creation

        // Timestamps
        createdAt: timestamp,
        lastLogin: timestamp,
        lastUpdated: timestamp,

        // Social Stats
        stats: {
          eventsAttended: 0,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
        },
      };

      // Profile document data for public profiles collection
      const profileData = {
        displayName,
        photoURL: googleUser?.photo || "",
        bio: "",
        usernameLower: null,
        profilePicture: googleUser?.photo || "",
        profileSongUrl: null,
      };

      // Write to all collections in parallel:
      // - /users (Google auth flow)
      // - /customers (app services expect this)
      // - /profiles (public profile data)
      // - Realtime Database (legacy support)
      await Promise.all([
        setDoc(doc(db, "users", userId), {
          ...userData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, "customers", userId), {
          ...userData,
          migrationDate: "",
        }),
        setDoc(doc(db, "profiles", userId), profileData),
        set(ref(rtdb, `users/${userId}`), userData),
      ]);

      // Create Stripe customer (non-blocking - don't fail auth if Stripe fails)
      try {
        const stripeResponse = await fetch(
          `${STRIPE_API_URL}/create-customer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: userCredential.user.email,
              name: displayName,
              firebaseId: userId,
            }),
          },
        );

        if (stripeResponse.ok) {
          const stripeData = await stripeResponse.json();
          stripeCustomerId = stripeData.customerId;

          // Update all collections with Stripe customer ID
          await Promise.all([
            setDoc(
              doc(db, "users", userId),
              { stripeCustomerId },
              { merge: true },
            ),
            setDoc(
              doc(db, "customers", userId),
              { stripeCustomerId, lastUpdated: new Date().toISOString() },
              { merge: true },
            ),
          ]);
        } else {
          console.warn(
            "Stripe customer creation failed:",
            await stripeResponse.text(),
          );
        }
      } catch (stripeError) {
        // Log but don't block auth flow - Stripe customer can be created later
        console.error("Stripe customer creation error:", stripeError);
      }
    } else {
      // Existing user - update last login timestamp
      const timestamp = new Date().toISOString();
      try {
        await Promise.all([
          setDoc(
            doc(db, "users", userId),
            { lastLogin: timestamp, updatedAt: serverTimestamp() },
            { merge: true },
          ),
          setDoc(
            doc(db, "customers", userId),
            { lastLogin: timestamp, lastUpdated: timestamp },
            { merge: true },
          ),
        ]);
      } catch (updateError) {
        // Non-blocking - don't fail login if timestamp update fails
        console.warn("Failed to update login timestamp:", updateError);
      }
    }

    return { userCredential, isNewUser, stripeCustomerId };
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
