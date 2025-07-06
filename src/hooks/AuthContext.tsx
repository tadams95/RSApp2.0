import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useDispatch } from "react-redux";

import { usePostHog } from "../analytics/PostHogProvider";
import { setLocalId, setUserEmail } from "../store/redux/userSlice";

// Import the Firebase auth instance
import { auth as firebaseAuth } from "../firebase/firebase";
import { getUserData, loginUser } from "../utils/auth";

// Define the context type
type AuthContextType = {
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  setAuthenticated: () => {},
  isLoading: true,
  signOut: async () => {},
});

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const segments = useSegments();
  const router = useRouter();
  const { identify, track, reset } = usePostHog();

  // Sign out function
  const signOut = async (): Promise<void> => {
    try {
      await firebaseAuth.signOut();
      await AsyncStorage.removeItem("stayLoggedIn");

      // Track sign out event with user context before resetting
      await track("user_signed_out", {
        session_duration: "unknown", // Could be enhanced with session tracking
        logout_method: "manual",
      });

      // Reset PostHog user context for privacy compliance
      await reset();

      setAuthenticated(false);
    } catch (error) {
      console.error("Error signing out:", error);
      // Still reset PostHog context even if sign out fails
      await reset();
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    // Check if user has selected "stay logged in" option
    const checkStayLoggedIn = async () => {
      try {
        const [stayLoggedInValue, savedEmail, savedPassword] =
          await Promise.all([
            AsyncStorage.getItem("stayLoggedIn"),
            AsyncStorage.getItem("email"),
            AsyncStorage.getItem("password"),
          ]);

        if (stayLoggedInValue && JSON.parse(stayLoggedInValue)) {
          if (savedEmail && savedPassword) {
            try {
              await loginUser(savedEmail, savedPassword, dispatch);
              setAuthenticated(true);
            } catch (error) {
              console.error("Error during auto login:", error);
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error retrieving stayLoggedIn state:", error);
        setIsLoading(false);
      }
    };

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        dispatch(setLocalId(user.uid));
        dispatch(setUserEmail(user.email || ""));

        try {
          // Get comprehensive user data for enhanced analytics
          const userData = await getUserData(user.uid);

          // Extract email domain for analytics (privacy-compliant)
          const emailDomain = user.email ? user.email.split("@")[1] : "unknown";

          // Prepare user properties for PostHog identification
          const userProperties = {
            email: user.email || "",
            userId: user.uid,
            email_domain: emailDomain,
            platform: Platform.OS,
            user_type: userData?.isAdmin ? "admin" : "user",
            signup_date:
              userData?.createdAt || user.metadata.creationTime || "",
            last_login_date:
              userData?.lastLogin || user.metadata.lastSignInTime || "",
            has_profile_picture: !!userData?.profilePicture,
            verification_status: user.emailVerified ? "verified" : "unverified",
          };

          // Identify user with PostHog with comprehensive properties
          await identify(user.uid, userProperties);

          // Track authentication event with enhanced context
          await track("user_authenticated", {
            auth_method: "firebase",
            email_domain: emailDomain,
            user_type: userData?.isAdmin ? "admin" : "user",
            verification_status: user.emailVerified ? "verified" : "unverified",
            has_complete_profile: !!(userData?.firstName && userData?.lastName),
          });
        } catch (error) {
          console.error("Error fetching user data for analytics:", error);

          // Fall back to basic identification if user data fetch fails
          const basicProperties = {
            email: user.email || "",
            userId: user.uid,
            email_domain: user.email ? user.email.split("@")[1] : "unknown",
            platform: Platform.OS,
            user_type: "user", // Default to user if we can't determine admin status
            verification_status: user.emailVerified ? "verified" : "unverified",
          };

          await identify(user.uid, basicProperties);
          await track("user_authenticated", {
            auth_method: "firebase",
            fallback_identification: true,
          });
        }

        setAuthenticated(true);
        setIsLoading(false);
      } else {
        // Firebase auth state is null - this could be due to:
        // - Initial app load (handled by checkStayLoggedIn)
        // - Token expiry, user deletion, or other auth state changes
        // For security, set authenticated to false first, then check for auto-login

        // Track user becoming unauthenticated (but only if we were previously authenticated)
        if (authenticated) {
          await track("user_session_ended", {
            reason: "auth_state_change",
            auto_logout: true,
          });
          // Reset PostHog user context when user becomes unauthenticated
          await reset();
        }

        setAuthenticated(false);
        checkStayLoggedIn();
      }
    });

    return () => unsubscribe();
  }, [dispatch, authenticated, identify, track, reset]);

  // Track anonymous users vs authenticated users with PostHog's automatic anonymous ID
  useEffect(() => {
    const setUserAnalyticsProperties = async () => {
      try {
        if (!authenticated && !isLoading) {
          // User is in guest/anonymous mode
          // PostHog automatically assigns anonymous IDs, we just need to set user properties
          await track("anonymous_user_session", {
            user_status: "anonymous",
            platform: Platform.OS,
            session_type: "guest",
          });

          // Set user properties for anonymous users (no personal data)
          await identify("", {
            user_type: "anonymous",
            authentication_status: "guest",
            platform: Platform.OS,
          });
        } else if (authenticated) {
          // User properties are already set in the auth state change handler above
          // This ensures we have the latest user type status
          await track("authenticated_user_session", {
            user_status: "authenticated",
            platform: Platform.OS,
            session_type: "authenticated",
          });
        }
      } catch (error) {
        console.error("Error setting user analytics properties:", error);
      }
    };

    // Only run when authentication state is stable (not loading)
    if (!isLoading) {
      setUserAnalyticsProperties();
    }
  }, [authenticated, isLoading, track, identify]);

  // Handle routing based on authentication state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inGuestGroup = segments[0] === "(guest)";

    if (authenticated && inAuthGroup) {
      // Redirect to app home if user is authenticated but on auth screens
      router.replace("/(app)/home");
    } else if (!authenticated && !inAuthGroup && !inGuestGroup) {
      // Redirect to login if user is not authenticated and not in guest mode
      router.replace("/(auth)/");
    }
  }, [authenticated, segments, isLoading, router]);

  return (
    <AuthContext.Provider
      value={{ authenticated, setAuthenticated, isLoading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
