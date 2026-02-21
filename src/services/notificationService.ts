import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationData = Record<string, unknown>;

export interface NotificationRequest {
  title: string;
  body: string;
  data?: NotificationData;
  sound?: boolean;
  badge?: number;
}

export interface ScheduledNotificationRequest extends NotificationRequest {
  trigger: Notifications.NotificationTriggerInput;
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationPermissionStatus: Notifications.PermissionStatus | null =
    null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request notification permissions from the user
   */
  public async requestPermissions(): Promise<{
    granted: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        return {
          granted: false,
          error: "Push notifications require a physical device",
        };
      }

      // Check current permission status
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.notificationPermissionStatus = finalStatus;

      if (finalStatus !== "granted") {
        return {
          granted: false,
          error: "Permission not granted for push notifications",
        };
      }

      // Get push token
      const token = await this.getExpoPushToken();

      return {
        granted: true,
        token,
      };
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return {
        granted: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get the Expo push token for this device
   */
  public async getExpoPushToken(): Promise<string> {
    try {
      if (this.expoPushToken) {
        return this.expoPushToken;
      }

      // Ensure we're on a physical device
      if (!Device.isDevice) {
        throw new Error("Must use physical device for push notifications");
      }

      // Get the project ID for push notifications
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("Project ID not found in app configuration");
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.expoPushToken = token.data;
      return token.data;
    } catch (error) {
      console.error("Error getting Expo push token:", error);
      throw error;
    }
  }

  /**
   * Check current notification permission status
   */
  public async getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    if (this.notificationPermissionStatus) {
      return this.notificationPermissionStatus;
    }

    const { status } = await Notifications.getPermissionsAsync();
    this.notificationPermissionStatus = status;
    return status;
  }

  /**
   * Send a local notification immediately
   */
  public async sendLocalNotification(
    notification: NotificationRequest
  ): Promise<string | null> {
    try {
      const permissionStatus = await this.getPermissionStatus();

      if (permissionStatus !== "granted") {
        // Silently skip notification if permissions not granted
        // This is expected behavior - user may have denied permissions
        console.log("Notification skipped: permissions not granted");
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound !== false, // Default to true
          ...(notification.badge !== undefined && {
            badge: notification.badge,
          }),
        },
        trigger: null, // Send immediately
      });

      return notificationId;
    } catch (error) {
      console.error("Error sending local notification:", error);
      return null;
    }
  }

  /**
   * Schedule a notification for later
   */
  public async scheduleNotification(
    notification: ScheduledNotificationRequest
  ): Promise<string | null> {
    try {
      const permissionStatus = await this.getPermissionStatus();

      if (permissionStatus !== "granted") {
        // Silently skip notification if permissions not granted
        console.log("Scheduled notification skipped: permissions not granted");
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound !== false,
          ...(notification.badge !== undefined && {
            badge: notification.badge,
          }),
        },
        trigger: notification.trigger,
      });

      return notificationId;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error("Error canceling notification:", error);
      throw error;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  public async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Error canceling all notifications:", error);
      throw error;
    }
  }

  /**
   * Get all scheduled notifications
   */
  public async getScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
  > {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Error getting scheduled notifications:", error);
      throw error;
    }
  }

  /**
   * Set up notification listeners
   */
  public setupNotificationListeners(handlers: {
    onNotificationReceived?: (notification: Notifications.Notification) => void;
    onNotificationResponse?: (
      response: Notifications.NotificationResponse
    ) => void;
  }): () => void {
    const subscriptions: Array<() => void> = [];

    // Listen for notifications received while app is in foreground
    if (handlers.onNotificationReceived) {
      const receivedSubscription =
        Notifications.addNotificationReceivedListener(
          handlers.onNotificationReceived
        );
      subscriptions.push(() => receivedSubscription.remove());
    }

    // Listen for user interactions with notifications
    if (handlers.onNotificationResponse) {
      const responseSubscription =
        Notifications.addNotificationResponseReceivedListener(
          handlers.onNotificationResponse
        );
      subscriptions.push(() => responseSubscription.remove());
    }

    // Return cleanup function
    return () => {
      subscriptions.forEach((cleanup) => cleanup());
    };
  }

  /**
   * Clear notification badge
   */
  public async clearBadge(): Promise<void> {
    try {
      if (Platform.OS === "ios") {
        await Notifications.setBadgeCountAsync(0);
      }
    } catch (error) {
      console.error("Error clearing notification badge:", error);
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
