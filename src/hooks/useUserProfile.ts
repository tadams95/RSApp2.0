import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import { useSelector } from "react-redux";
import { queryKeys, queryOptions } from "../config/reactQuery";
import { selectLocalId } from "../store/redux/userSlice";
import { UserData, getUserData, updateUserData } from "../utils/auth";
import { retryWithBackoff } from "../utils/cart/networkErrorDetection";

/**
 * React Query hook for fetching user profile data
 * Uses the existing getUserData function from auth.ts
 */
export function useUserProfile() {
  const userId = useSelector(selectLocalId);

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async (): Promise<UserData | null> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }
      return await getUserData(userId);
    },
    enabled: !!userId,
    ...queryOptions.user,
  });
}

/**
 * React Query hook for updating user profile data
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const userId = useSelector(selectLocalId);

  return useMutation({
    mutationFn: async (userData: Partial<UserData>) => {
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const result = await updateUserData(userId, userData);
      if (!result.success) {
        throw new Error(result.message || "Failed to update profile");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch user profile data
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}

/**
 * Hook that provides user profile data with helpful loading and error states
 * Similar to the pattern used in useProducts and useEvents
 */
export function useUserProfileWithHelpers() {
  const { data: profile, isLoading, error, refetch } = useUserProfile();

  return {
    profile,
    isLoading,
    error,
    refetch,
    hasProfile: !!profile,
    isEmpty: !isLoading && !profile,
    hasError: !!error,
  };
}

/**
 * React Query hook for fetching user profile data directly from Firestore
 * This is a more lightweight version for components that only need basic profile data
 */
export function useFirestoreUserProfile(userId?: string) {
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async (): Promise<UserData | null> => {
      if (!userId) {
        return null;
      }

      try {
        const db = getFirestore();
        const userDocRef = doc(db, "customers", userId);
        const docSnapshot = await getDoc(userDocRef);

        if (docSnapshot.exists()) {
          return docSnapshot.data() as UserData;
        }

        return null;
      } catch (error) {
        console.error("Error fetching user profile:", error);
        throw error;
      }
    },
    enabled: !!userId,
    ...queryOptions.user,
  });
}

/**
 * Hook for Firestore user profile with helpers
 */
export function useFirestoreUserProfileWithHelpers(userId?: string) {
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useFirestoreUserProfile(userId);

  return {
    profile,
    isLoading,
    error,
    refetch,
    hasProfile: !!profile,
    isEmpty: !isLoading && !profile,
    hasError: !!error,
  };
}

/**
 * React Query mutation for updating user profile directly in Firestore
 * This is useful for quick updates that don't need the full auth.ts logic
 */
export function useUpdateFirestoreUserProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: Partial<UserData>) => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const db = getFirestore();
      const userDocRef = doc(db, "customers", userId);

      // Update with retry logic
      await retryWithBackoff(async () => {
        await updateDoc(userDocRef, {
          ...userData,
          lastUpdated: new Date().toISOString(),
        });
      });
    },
    onSuccess: () => {
      // Invalidate and refetch user profile data
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}
