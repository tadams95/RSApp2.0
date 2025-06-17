import { getAuth } from "firebase/auth";
import {
  DataSnapshot,
  get,
  getDatabase,
  onValue,
  ref,
  update,
} from "firebase/database";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeDBConnection } from "./useRealtimeDBConnection";

// Import utilities for error handling and retry mechanisms
import { extractDatabaseErrorCode } from "../utils/databaseErrorHandler";

// Define types for profile data
export interface UserProfileData {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  preferences?: Record<string, any>;
  lastUpdated?: number;
  // Add additional profile fields as needed
}

// Interface for sync errors
export interface SyncError {
  code: string;
  message: string;
  timestamp: number;
  retryCount?: number;
}

// Configuration options for the hook
export interface ProfileSyncOptions {
  maxRetries?: number;
  initialBackoffDelay?: number;
  maxBackoffDelay?: number;
  autoRetry?: boolean;
}

const DEFAULT_OPTIONS: ProfileSyncOptions = {
  maxRetries: 3,
  initialBackoffDelay: 1000, // 1 second
  maxBackoffDelay: 30000, // 30 seconds
  autoRetry: true,
};

/**
 * Custom hook for syncing user profile data with Firebase Realtime Database
 * Includes error handling, retry mechanisms, conflict resolution, and validation
 */
export function useProfileSync(options: ProfileSyncOptions = {}) {
  const { maxRetries, initialBackoffDelay, maxBackoffDelay, autoRetry } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<SyncError | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const { isConnected } = useRealtimeDBConnection();
  const auth = getAuth();

  /**
   * Calculate backoff delay for retries using exponential backoff
   */
  const getBackoffDelay = useCallback(
    (attempt: number): number => {
      const delay = Math.min(
        initialBackoffDelay! * Math.pow(2, attempt),
        maxBackoffDelay!
      );
      // Add some randomness to prevent synchronized retries
      return delay + Math.random() * 1000;
    },
    [initialBackoffDelay, maxBackoffDelay]
  );

  /**
   * Get a reference to the user's profile data
   */
  const getUserProfileRef = useCallback(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }
    const db = getDatabase();
    return ref(db, `users/${userId}/profile`);
  }, [auth]);

  /**
   * Handles sync errors with retry capability
   */
  const handleSyncError = useCallback(
    (error: any) => {
      const errorCode = extractDatabaseErrorCode(error);

      // Get the current retry count inside the callback to avoid stale closure issues
      setRetryCount((currentRetryCount) => {
        const nextRetryCount = currentRetryCount + 1;

        const syncError: SyncError = {
          code: errorCode || "unknown-error",
          message:
            error.message ||
            "Unknown error occurred during profile synchronization",
          timestamp: Date.now(),
          retryCount: currentRetryCount,
        };

        setError(syncError);
        console.error("Profile sync error:", syncError);

        // Auto-retry if enabled and under max retries
        if (autoRetry && currentRetryCount < maxRetries!) {
          const delay = getBackoffDelay(currentRetryCount);
          console.log(
            `Retrying profile sync in ${delay}ms (attempt ${nextRetryCount})`
          );

          // Schedule retry
          setTimeout(() => {
            if (isConnected) {
              fetchProfile().catch((e) =>
                console.error(`Retry ${nextRetryCount} failed:`, e)
              );
            }
          }, delay);

          // Return incremented count
          return nextRetryCount;
        }

        // If not retrying, keep the current count
        return currentRetryCount;
      });
    },
    [autoRetry, maxRetries, getBackoffDelay, isConnected]
  );

  /**
   * Fetches the user profile from the database
   */
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!auth.currentUser) {
        throw new Error("User not authenticated");
      }

      const profileRef = getUserProfileRef();
      const snapshot = await get(profileRef);

      processProfileData(snapshot);
      setRetryCount(0); // Reset retry count on successful fetch
      setError(null); // Clear any previous errors
      setLastSyncTime(Date.now());
    } catch (error: any) {
      handleSyncError(error);
    } finally {
      setIsLoading(false);
    }
  }, [auth, getUserProfileRef, handleSyncError]);

  /**
   * Process the profile data from a snapshot
   */
  const processProfileData = useCallback(
    (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProfile({
          uid: auth.currentUser!.uid,
          ...data,
        });
      } else {
        // Create initial profile if none exists
        const initialProfile: UserProfileData = {
          uid: auth.currentUser!.uid,
          displayName: auth.currentUser!.displayName || undefined,
          email: auth.currentUser!.email || undefined,
          photoURL: auth.currentUser!.photoURL || undefined,
          lastUpdated: Date.now(),
        };
        setProfile(initialProfile);

        // Save the initial profile to the database
        // This is done silently without throwing errors if it fails
        const profileRef = getUserProfileRef();
        update(profileRef, initialProfile).catch((err) => {
          console.warn("Failed to initialize profile:", err);
        });
      }
    },
    [auth, getUserProfileRef]
  );

  /**
   * Validates profile data against server rules before sending
   * Helps prevent unnecessary server validation rejections
   * Enhanced to exactly match server-side validation rules
   *
   * @param updates Profile data to validate
   * @returns Object with validation result and errors
   */
  const validateProfileData = useCallback(
    (
      updates: Partial<UserProfileData>
    ): {
      isValid: boolean;
      errors: Record<string, string>;
    } => {
      const errors: Record<string, string> = {};

      // Validate email if present - exact match with server regex pattern
      if (updates.email !== undefined) {
        if (typeof updates.email !== "string") {
          errors.email = "Email must be a text value";
        } else if (updates.email.trim() === "") {
          errors.email = "Email is required";
        } else {
          // Use the exact same regex pattern as in Firebase rules
          const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
          if (!emailPattern.test(updates.email)) {
            errors.email = "Invalid email format. Please check your email.";
          }
        }
      }

      // Extract first and last name from displayName if present
      if (updates.displayName !== undefined) {
        // First validate that it's a string (server requirement)
        if (typeof updates.displayName !== "string") {
          errors.displayName = "Name must be text";
        } else {
          // Then perform additional client-side validations
          const nameParts = updates.displayName.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ");

          // Validate first name
          if (firstName.trim() === "") {
            errors.firstName = "First name is required";
          } else if (firstName.length > 50) {
            errors.firstName = "First name is too long (maximum 50 characters)";
          }

          // Additional character validation (client-side only)
          const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']+$/;
          if (!namePattern.test(updates.displayName)) {
            errors.displayName = "Name contains invalid characters";
          }
        }
      }

      // Validate phone number if present
      if (updates.phoneNumber !== undefined) {
        // First validate that it's a string (server requirement)
        if (typeof updates.phoneNumber !== "string") {
          errors.phoneNumber = "Phone number must be text";
        } else {
          // Additional client-side format validation
          const phonePattern = /^[\d\s\+\-\(\)]+$/;
          if (!phonePattern.test(updates.phoneNumber)) {
            errors.phoneNumber = "Invalid phone number format";
          }

          // Check length - client side validation
          if (updates.phoneNumber.replace(/\D/g, "").length < 7) {
            errors.phoneNumber = "Phone number is too short";
          }
        }
      }

      // Handle preferences if present
      if (updates.preferences && typeof updates.preferences === "object") {
        // Validate any specific preference fields if needed
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    },
    []
  );

  /**
   * Updates the user profile with conflict resolution and validation
   * Uses a version tracking approach to detect conflicts
   */
  const updateProfile = useCallback(
    async (updates: Partial<UserProfileData>): Promise<boolean> => {
      if (!auth.currentUser) {
        throw new Error("User not authenticated");
      }

      if (!isConnected) {
        throw new Error("Cannot update profile while offline");
      }

      // Validate the updates before sending to server
      const validation = validateProfileData(updates);
      if (!validation.isValid) {
        // Create an error that mimics Firebase validation errors
        const validationError = new Error("Client validation failed");
        (validationError as any).code = "data-validation-failed";
        (validationError as any).validationErrors = validation.errors;

        // Add detailed context to the error message
        const fieldErrors = Object.keys(validation.errors);
        if (fieldErrors.length > 0) {
          (
            validationError as any
          ).message = `Validation failed for fields: ${fieldErrors.join(", ")}`;
        }

        handleSyncError(validationError);
        return false;
      }

      try {
        const profileRef = getUserProfileRef();

        // Get the latest profile data to check for conflicts
        const snapshot = await get(profileRef);
        const currentData = snapshot.exists() ? snapshot.val() : null;

        // Simple conflict detection based on lastUpdated timestamp
        if (
          currentData?.lastUpdated &&
          profile?.lastUpdated &&
          currentData.lastUpdated > profile.lastUpdated
        ) {
          // Conflict detected - the server has a newer version than what we have locally
          console.warn("Conflict detected: Server has newer data");

          // Merge strategy: Keep server values for fields not being updated
          const merged = {
            ...currentData,
            ...updates,
            lastUpdated: Date.now(),
          };

          // Ensure merged data has the required uid field
          const completeProfile = {
            uid: auth.currentUser!.uid,
            ...merged,
          };

          await update(profileRef, completeProfile);
          setProfile(completeProfile as UserProfileData);
          setLastSyncTime(Date.now());
          return true;
        } else {
          // No conflict, perform normal update
          const updatedProfile = {
            ...profile,
            ...updates,
            lastUpdated: Date.now(),
          };

          // Make sure we update the full object in the database to maintain consistency
          // Ensure updatedProfile has the required uid field
          const completeProfile = {
            uid: auth.currentUser!.uid,
            ...(profile || {}),
            ...updates,
            lastUpdated: Date.now(),
          };

          await update(profileRef, completeProfile);

          setProfile(completeProfile as UserProfileData);
          setLastSyncTime(Date.now());
          return true;
        }
      } catch (error: any) {
        handleSyncError(error);
        return false;
      }
    },
    [
      auth,
      profile,
      isConnected,
      getUserProfileRef,
      handleSyncError,
      validateProfileData,
    ]
  );

  /**
   * Manual retry function for error recovery
   */
  const retry = useCallback(() => {
    if (!isConnected) {
      console.warn("Cannot retry while offline");
      return;
    }

    setError(null);
    fetchProfile();
  }, [fetchProfile, isConnected]);

  // Set up initial data fetch and subscription
  useEffect(() => {
    if (!auth.currentUser) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Only proceed if connected
    if (!isConnected) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      const profileRef = getUserProfileRef();

      // Subscribe to realtime updates
      unsubscribe = onValue(
        profileRef,
        (snapshot) => {
          processProfileData(snapshot);
          setIsLoading(false);
          setError(null);
          setRetryCount(0);
          setLastSyncTime(Date.now());
        },
        (error) => {
          handleSyncError(error);
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      handleSyncError(error);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    auth,
    isConnected,
    getUserProfileRef,
    processProfileData,
    handleSyncError,
  ]);

  // Attempt to reconnect when connection status changes from offline to online
  useEffect(() => {
    if (isConnected && error) {
      retry();
    }
  }, [isConnected, error, retry]);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    retry,
    lastSyncTime,
    isConnected,
  };
}
