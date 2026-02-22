import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import {
  NotificationRequest,
  notificationService,
  ScheduledNotificationRequest,
} from "../services/notificationService";
import {
  selectExpoPushToken,
  selectLocalId,
  setExpoPushToken,
} from "../store/redux/userSlice";
import { updateUserData } from "../utils/auth";
import {
  NotificationRouteData,
  routeFromNotificationData,
} from "../utils/deepLinkRouter";
import { useAuth } from "./AuthContext";

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
  error?: string;
}

export interface UseNotificationsReturn {
  // Permission management
  requestPermissions: () => Promise<NotificationPermissionResult>;
  permissionStatus: Notifications.PermissionStatus | null;

  // Token management
  expoPushToken: string | null;
  refreshToken: () => Promise<string | null>;

  // Local notifications
  sendLocalNotification: (notification: NotificationRequest) => Promise<string>;
  scheduleNotification: (
    notification: ScheduledNotificationRequest
  ) => Promise<string>;
  cancelNotification: (notificationId: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;

  // Utility
  clearBadge: () => Promise<void>;
  isInitialized: boolean;
}

export const useNotifications = (): UseNotificationsReturn => {
  const dispatch = useDispatch();
  const { authenticated } = useAuth();
  const expoPushToken = useSelector(selectExpoPushToken);
  const userId = useSelector(selectLocalId);

  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize notifications when component mounts
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Get current permission status
        const status = await notificationService.getPermissionStatus();
        setPermissionStatus(status);

        // If permissions are granted, get/refresh token
        if (status === "granted") {
          await refreshToken();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
        setIsInitialized(true);
      }
    };

    initializeNotifications();
  }, []);

  // Set up notification listeners
  useEffect(() => {
    const cleanup = notificationService.setupNotificationListeners({
      onNotificationReceived: (notification) => {
        console.log("Notification received:", notification);
        // Handle foreground notification display
      },
      onNotificationResponse: (response) => {
        console.log("Notification response:", response);
        // Handle notification tap/interaction
        handleNotificationResponse(response);
      },
    });

    return cleanup;
  }, []);

  // Handle app state changes for badge clearing
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // Clear badge when app becomes active
        notificationService.clearBadge();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  // Request notification permissions
  const requestPermissions =
    useCallback(async (): Promise<NotificationPermissionResult> => {
      try {
        const result = await notificationService.requestPermissions();
        setPermissionStatus(
          result.granted
            ? ("granted" as Notifications.PermissionStatus)
            : ("denied" as Notifications.PermissionStatus)
        );

        if (result.granted && result.token) {
          // Store token in Redux
          dispatch(setExpoPushToken(result.token));

          // Update user data in Firebase if user is authenticated
          if (authenticated && userId && typeof userId === "string") {
            try {
              await updateUserData(userId, { expoPushToken: result.token });
            } catch (error) {
              console.error("Failed to update user with push token:", error);
              // Don't throw - token is still valid locally
            }
          }
        }

        return result;
      } catch (error) {
        console.error("Error requesting notification permissions:", error);
        return {
          granted: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    }, [dispatch, authenticated, userId]);

  // Refresh expo push token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await notificationService.getExpoPushToken();

      // Update Redux store
      dispatch(setExpoPushToken(token));

      // Update Firebase if user is authenticated
      if (authenticated && userId && typeof userId === "string") {
        try {
          await updateUserData(userId, { expoPushToken: token });
        } catch (error) {
          console.error(
            "Failed to update user with refreshed push token:",
            error
          );
        }
      }

      return token;
    } catch (error) {
      console.error("Error refreshing push token:", error);
      return null;
    }
  }, [dispatch, authenticated, userId]);

  // Handle notification responses (when user taps notification)
  const handleNotificationResponse = (
    response: Notifications.NotificationResponse,
  ) => {
    const data = response.notification.request.content.data;
    if (data) {
      routeFromNotificationData(data as NotificationRouteData);
    }
  };

  // Local notification methods
  const sendLocalNotification = useCallback(
    async (notification: NotificationRequest): Promise<string> => {
      return await notificationService.sendLocalNotification(notification);
    },
    []
  );

  const scheduleNotification = useCallback(
    async (notification: ScheduledNotificationRequest): Promise<string> => {
      return await notificationService.scheduleNotification(notification);
    },
    []
  );

  const cancelNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      return await notificationService.cancelNotification(notificationId);
    },
    []
  );

  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    return await notificationService.cancelAllNotifications();
  }, []);

  const clearBadge = useCallback(async (): Promise<void> => {
    return await notificationService.clearBadge();
  }, []);

  return {
    // Permission management
    requestPermissions,
    permissionStatus,

    // Token management
    expoPushToken: (expoPushToken as string) || null,
    refreshToken,

    // Local notifications
    sendLocalNotification,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,

    // Utility
    clearBadge,
    isInitialized,
  };
};
