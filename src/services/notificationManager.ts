import * as Notifications from "expo-notifications";
import { doc, getFirestore, updateDoc } from "firebase/firestore";
import { notificationService } from "./notificationService";

const db = getFirestore();

export interface PushNotificationData {
  type: "cart_abandonment" | "event_reminder" | "order_status" | "general";
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface OrderStatusNotificationData {
  orderId: string;
  orderTotal: number;
  orderItems: Array<{
    productId: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress?: any;
  paymentMethod?: string;
  customerEmail?: string;
}

/**
 * Firebase integration for push notification tokens
 */
class NotificationManager {
  /**
   * Register a user's push token in Firebase
   */
  static async registerUserToken(userId: string, token: string): Promise<void> {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        expoPushToken: token,
        lastTokenUpdate: new Date().toISOString(),
      });
      console.log("Push token registered for user:", userId);
    } catch (error) {
      console.error("Error registering push token:", error);
      throw error;
    }
  }

  /**
   * Remove a user's push token from Firebase
   */
  static async removeUserToken(userId: string): Promise<void> {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        expoPushToken: null,
        lastTokenUpdate: new Date().toISOString(),
      });
      console.log("Push token removed for user:", userId);
    } catch (error) {
      console.error("Error removing push token:", error);
      throw error;
    }
  }

  /**
   * Schedule a cart abandonment reminder
   */
  static async scheduleCartAbandonmentReminder(
    delayInMinutes: number = 30
  ): Promise<string | null> {
    try {
      const notificationId = await notificationService.scheduleNotification({
        title: "Items waiting in your cart",
        body: "Complete your purchase before items sell out!",
        data: {
          type: "cart_abandonment",
          screen: "cart",
        },
        trigger: {
          seconds: delayInMinutes * 60,
        } as Notifications.TimeIntervalTriggerInput,
      });

      console.log("Cart abandonment reminder scheduled:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error scheduling cart abandonment reminder:", error);
      return null;
    }
  }

  /**
   * Schedule an event reminder
   */
  static async scheduleEventReminder(
    eventId: string,
    eventName: string,
    eventDate: Date,
    reminderMinutes: number = 60
  ): Promise<string | null> {
    try {
      const reminderTime = new Date(
        eventDate.getTime() - reminderMinutes * 60 * 1000
      );

      // Only schedule if reminder time is in the future
      if (reminderTime <= new Date()) {
        console.log("Event reminder time is in the past, skipping");
        return null;
      }

      const notificationId = await notificationService.scheduleNotification({
        title: `${eventName} starts soon!`,
        body: `Your event starts in ${reminderMinutes} minutes`,
        data: {
          type: "event_reminder",
          eventId,
          screen: "event-detail",
        },
        trigger: {
          date: reminderTime,
        } as Notifications.DateTriggerInput,
      });

      console.log("Event reminder scheduled:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error scheduling event reminder:", error);
      return null;
    }
  }

  /**
   * Send an immediate order confirmation notification
   */
  static async sendOrderConfirmation(
    orderId: string,
    orderTotal: string
  ): Promise<string | null> {
    try {
      const notificationId = await notificationService.sendLocalNotification({
        title: "Order Confirmed!",
        body: `Your order for ${orderTotal} has been confirmed`,
        data: {
          type: "order_status",
          orderId,
          screen: "order-details",
        },
      });

      console.log("Order confirmation sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending order confirmation:", error);
      return null;
    }
  }

  /**
   * Send order processing notification
   */
  static async sendOrderProcessingNotification(
    orderId: string,
    orderData: OrderStatusNotificationData
  ): Promise<string | null> {
    try {
      const notificationId = await notificationService.sendLocalNotification({
        title: "Order Processing",
        body: `Your order #${orderId} is being prepared`,
        data: {
          type: "order_status",
          orderId,
          status: "processing",
          screen: "order-details",
        },
      });

      console.log("Order processing notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending order processing notification:", error);
      return null;
    }
  }

  /**
   * Send shipping notification for physical items
   */
  static async sendShippingNotification(
    orderId: string,
    trackingNumber?: string,
    estimatedDelivery?: Date
  ): Promise<string | null> {
    try {
      let bodyText = `Your order #${orderId} has shipped!`;
      if (trackingNumber) {
        bodyText += ` Tracking: ${trackingNumber}`;
      }
      if (estimatedDelivery) {
        const deliveryDate = estimatedDelivery.toLocaleDateString();
        bodyText += ` Est. delivery: ${deliveryDate}`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title: "Order Shipped!",
        body: bodyText,
        data: {
          type: "order_status",
          orderId,
          status: "shipped",
          trackingNumber,
          screen: "order-details",
        },
      });

      console.log("Shipping notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending shipping notification:", error);
      return null;
    }
  }

  /**
   * Send payment failure notification with recovery options
   */
  static async sendPaymentFailureNotification(
    orderId: string,
    failureReason: string = "Payment could not be processed"
  ): Promise<string | null> {
    try {
      const notificationId = await notificationService.sendLocalNotification({
        title: "Payment Issue",
        body: `${failureReason}. Tap to retry your order.`,
        data: {
          type: "order_status",
          orderId,
          status: "payment_failed",
          screen: "cart",
          action: "retry_payment",
        },
      });

      console.log("Payment failure notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending payment failure notification:", error);
      return null;
    }
  }

  /**
   * Schedule a cart abandonment reminder with order context
   */
  static async scheduleCartAbandonmentReminderWithRetry(
    cartValue: number,
    itemCount: number,
    delayInMinutes: number = 30
  ): Promise<string | null> {
    try {
      const notificationId = await notificationService.scheduleNotification({
        title: "Complete your order",
        body: `${itemCount} item${
          itemCount > 1 ? "s" : ""
        } waiting ($${cartValue.toFixed(2)}). Complete your purchase now!`,
        data: {
          type: "cart_abandonment",
          cartValue,
          itemCount,
          screen: "cart",
          action: "complete_order",
        },
        trigger: {
          seconds: delayInMinutes * 60,
        } as Notifications.TimeIntervalTriggerInput,
      });

      console.log(
        "Cart abandonment reminder with retry scheduled:",
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error(
        "Error scheduling cart abandonment reminder with retry:",
        error
      );
      return null;
    }
  }

  /**
   * Send order delivery confirmation
   */
  static async sendDeliveryConfirmation(
    orderId: string,
    deliveryDate?: Date
  ): Promise<string | null> {
    try {
      const deliveryText = deliveryDate
        ? ` on ${deliveryDate.toLocaleDateString()}`
        : "";

      const notificationId = await notificationService.sendLocalNotification({
        title: "Order Delivered!",
        body: `Your order #${orderId} was delivered${deliveryText}. How was your experience?`,
        data: {
          type: "order_status",
          orderId,
          status: "delivered",
          screen: "order-details",
          action: "review_order",
        },
      });

      console.log("Delivery confirmation sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending delivery confirmation:", error);
      return null;
    }
  }

  /**
   * Cancel all cart-related notifications (useful when user completes purchase)
   */
  static async cancelCartNotifications(): Promise<void> {
    try {
      const scheduledNotifications =
        await notificationService.getScheduledNotifications();

      // Cancel notifications with cart_abandonment type
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === "cart_abandonment") {
          await notificationService.cancelNotification(notification.identifier);
        }
      }

      console.log("Cart notifications cancelled");
    } catch (error) {
      console.error("Error cancelling cart notifications:", error);
    }
  }

  /**
   * Initialize notifications for a user after login
   */
  static async initializeForUser(userId: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      // Request permissions
      const permissionResult = await notificationService.requestPermissions();

      if (!permissionResult.granted) {
        return {
          success: false,
          error: permissionResult.error || "Permissions not granted",
        };
      }

      // Register token with Firebase
      if (permissionResult.token) {
        await NotificationManager.registerUserToken(
          userId,
          permissionResult.token
        );
      }

      return {
        success: true,
        token: permissionResult.token,
      };
    } catch (error) {
      console.error("Error initializing notifications for user:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cleanup notifications when user logs out
   */
  static async cleanupForUser(userId: string): Promise<void> {
    try {
      // Remove token from Firebase
      await NotificationManager.removeUserToken(userId);

      // Cancel all scheduled notifications
      await notificationService.cancelAllNotifications();

      console.log("Notifications cleaned up for user:", userId);
    } catch (error) {
      console.error("Error cleaning up notifications for user:", error);
    }
  }
}

export { NotificationManager };
