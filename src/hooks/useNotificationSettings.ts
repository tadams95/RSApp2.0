import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";
import {
  DEFAULT_SETTINGS,
  getNotificationSettings,
  NotificationSettings,
  updateNotificationSettings,
} from "../services/notificationSettingsService";
import { useAuth } from "./AuthContext";

interface UseNotificationSettingsReturn {
  settings: NotificationSettings;
  isLoading: boolean;
  error: Error | null;
  updateSetting: <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing notification settings
 * - Fetches settings on mount
 * - Provides optimistic updates
 * - Handles error states
 */
export function useNotificationSettings(): UseNotificationSettingsReturn {
  const { authenticated } = useAuth();
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!authenticated || !currentUser?.uid) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const fetchedSettings = await getNotificationSettings(currentUser.uid);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error("Error fetching notification settings:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(
    async <K extends keyof NotificationSettings>(
      key: K,
      value: NotificationSettings[K]
    ) => {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) return;

      // Prevent disabling transfer notifications
      if (key === "transferNotifications" && value === false) {
        return;
      }

      // Optimistic update
      const previousSettings = settings;
      setSettings((prev) => ({ ...prev, [key]: value }));

      try {
        await updateNotificationSettings(currentUser.uid, { [key]: value });
      } catch (err) {
        // Rollback on error
        console.error("Error updating notification setting:", err);
        setSettings(previousSettings);
        throw err;
      }
    },
    [settings]
  );

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    refetch: fetchSettings,
  };
}

export default useNotificationSettings;
