import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setLocalId, setUserEmail } from "../store/redux/userSlice";

// Import the Firebase auth instance
import { auth as firebaseAuth } from "../firebase/firebase";
import { loginUser } from "../utils/auth";

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

  // Sign out function
  const signOut = async (): Promise<void> => {
    try {
      await firebaseAuth.signOut();
      await AsyncStorage.removeItem("stayLoggedIn");
      setAuthenticated(false);
    } catch (error) {
      console.error("Error signing out:", error);
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        dispatch(setLocalId(user.uid));
        dispatch(setUserEmail(user.email || ""));
        setAuthenticated(true);
        setIsLoading(false);
      } else {
        // Firebase auth state is null - this could be due to:
        // - Initial app load (handled by checkStayLoggedIn)
        // - Token expiry, user deletion, or other auth state changes
        // For security, set authenticated to false first, then check for auto-login
        setAuthenticated(false);
        checkStayLoggedIn();
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

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
