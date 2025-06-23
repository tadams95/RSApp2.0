/**
 * Offline Profile Data Management
 *
 * Provides caching and offline access to user profile data for account screens.
 */

import React from "react";
import { useNetworkStatus } from "./networkStatus";
import { OfflineProfileData, OfflineStorage } from "./offlineStorage";

// Initialize offline storage manager
const offlineStorage = OfflineStorage.getInstance();

/**
 * Interface for profile data that matches the app's user structure
 */
export interface ProfileData {
  localId: string;
  userEmail?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  preferences?: Record<string, any>;
  [key: string]: any;
}

/**
 * Converts app ProfileData to OfflineProfileData format
 */
export const convertToOfflineProfile = (
  profile: ProfileData
): OfflineProfileData => {
  return {
    uid: profile.localId,
    email: profile.userEmail,
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.userName || profile.displayName,
    phoneNumber: profile.phoneNumber,
    profilePicture: profile.profilePicture,
    preferences: profile.preferences,
    lastUpdated: Date.now(),
    cachedAt: Date.now(),
  };
};

/**
 * Converts OfflineProfileData to app ProfileData format
 */
export const convertFromOfflineProfile = (
  offlineProfile: OfflineProfileData
): ProfileData => {
  return {
    localId: offlineProfile.uid,
    userEmail: offlineProfile.email,
    userName: offlineProfile.displayName,
    firstName: offlineProfile.firstName,
    lastName: offlineProfile.lastName,
    displayName: offlineProfile.displayName,
    phoneNumber: offlineProfile.phoneNumber,
    profilePicture: offlineProfile.profilePicture,
    preferences: offlineProfile.preferences,
  };
};

/**
 * Caches user profile data for offline access
 */
export const cacheProfileData = async (profile: ProfileData): Promise<void> => {
  try {
    const offlineProfile = convertToOfflineProfile(profile);
    await offlineStorage.cacheProfileData(offlineProfile);
    // console.log("Profile data cached successfully");
  } catch (error) {
    console.error("Failed to cache profile data:", error);
  }
};

/**
 * Gets cached profile data for offline viewing
 */
export const getCachedProfileData = async (): Promise<ProfileData | null> => {
  try {
    const cachedProfile = await offlineStorage.getCachedProfile();
    if (!cachedProfile) {
      return null;
    }

    return convertFromOfflineProfile(cachedProfile);
  } catch (error) {
    console.error("Failed to get cached profile data:", error);
    return null;
  }
};

/**
 * Clears cached profile data
 */
export const clearCachedProfileData = async (): Promise<void> => {
  try {
    await offlineStorage.clearCachedProfile();
    // console.log("Cached profile data cleared");
  } catch (error) {
    console.error("Failed to clear cached profile data:", error);
  }
};

/**
 * Syncs profile data when connectivity is restored
 */
export const syncProfileData = async (
  onlineProfile: ProfileData
): Promise<void> => {
  try {
    const cachedProfile = await getCachedProfileData();

    if (!cachedProfile) {
      // No cached data, just cache the online profile
      await cacheProfileData(onlineProfile);
      return;
    }

    // Compare timestamps to determine which data is newer
    const onlineTimestamp = Date.now(); // Assume online data is current
    const cachedTimestamp = cachedProfile.lastUpdated || 0;

    if (onlineTimestamp > cachedTimestamp) {
      // Online data is newer, update cache
      await cacheProfileData(onlineProfile);
      // console.log("Profile cache updated with online data");
    } else {
      // Cached data might have offline changes that need to be synced
      // console.log("Cached profile data is newer - may need manual sync");
    }
  } catch (error) {
    console.error("Failed to sync profile data:", error);
  }
};

/**
 * React hook for managing offline profile data
 */
export const useOfflineProfile = (userProfile?: ProfileData | null) => {
  const [cachedProfile, setCachedProfile] = React.useState<ProfileData | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const { isOnline } = useNetworkStatus();

  // Load cached profile on mount
  React.useEffect(() => {
    const loadCachedProfile = async () => {
      try {
        const cached = await getCachedProfileData();
        setCachedProfile(cached);
      } catch (error) {
        console.error("Failed to load cached profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedProfile();
  }, []);

  // Cache profile data when online profile changes
  React.useEffect(() => {
    if (userProfile && isOnline) {
      cacheProfileData(userProfile);
      setCachedProfile(userProfile);
    }
  }, [userProfile, isOnline]);

  // Sync when coming back online
  React.useEffect(() => {
    if (isOnline && userProfile && cachedProfile) {
      syncProfileData(userProfile);
    }
  }, [isOnline, userProfile, cachedProfile]);

  const updateCachedProfile = React.useCallback(
    async (updates: Partial<ProfileData>) => {
      if (!cachedProfile) return;

      const updatedProfile = {
        ...cachedProfile,
        ...updates,
        lastUpdated: Date.now(),
      };

      setCachedProfile(updatedProfile);
      await cacheProfileData(updatedProfile);
    },
    [cachedProfile]
  );

  return {
    // Use online profile if available and online, otherwise use cached
    profile: isOnline && userProfile ? userProfile : cachedProfile,
    cachedProfile,
    isLoading,
    isOffline: !isOnline,
    hasOfflineChanges:
      cachedProfile &&
      userProfile &&
      cachedProfile.lastUpdated &&
      userProfile.lastUpdated &&
      cachedProfile.lastUpdated > userProfile.lastUpdated,
    updateCachedProfile,
    clearCache: clearCachedProfileData,
  };
};

export default {
  cacheProfileData,
  getCachedProfileData,
  clearCachedProfileData,
  syncProfileData,
  useOfflineProfile,
};
