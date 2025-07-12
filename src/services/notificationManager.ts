import * as Notifications from "expo-notifications";
import { doc, getFirestore, updateDoc } from "firebase/firestore";
import { notificationService } from "./notificationService";

const db = getFirestore();

export interface PushNotificationData {
  type:
    | "cart_abandonment"
    | "event_reminder"
    | "order_status"
    | "general"
    | "event_management"
    | "cart_commerce"
    | "account_security";
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

export interface EventNotificationData {
  eventId: string;
  eventName: string;
  eventDate?: Date;
  eventLocation?: string;
  ticketId?: string;
  recipientName?: string;
  transferFromUser?: string;
}

export interface CommerceNotificationData {
  productId: string;
  productTitle: string;
  productPrice?: number;
  productImage?: string;
  variantId?: string;
  inventoryLevel?: number;
  previousPrice?: number;
  newPrice?: number;
  stockThreshold?: number;
}

export interface AccountSecurityNotificationData {
  userId: string;
  deviceInfo?: {
    deviceName?: string;
    deviceType?: string;
    platform?: string;
    ipAddress?: string;
    location?: string;
  };
  actionType: "login" | "password_reset" | "profile_update" | "security_alert";
  timestamp: Date;
  isSuccessful?: boolean;
  changedFields?: string[];
  securityLevel?: "low" | "medium" | "high";
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

  // ========== EVENT MANAGEMENT NOTIFICATIONS ==========

  /**
   * Send event ticket purchase confirmation
   */
  static async sendEventTicketPurchaseConfirmation(
    eventData: EventNotificationData,
    ticketQuantity: number = 1,
    totalPrice?: number
  ): Promise<string | null> {
    try {
      let bodyText = `Your ticket${ticketQuantity > 1 ? "s" : ""} for ${
        eventData.eventName
      } ${ticketQuantity > 1 ? "have" : "has"} been confirmed!`;

      if (eventData.eventDate) {
        const eventDateStr = eventData.eventDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        bodyText += ` Event: ${eventDateStr}`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title: "🎫 Ticket Confirmed!",
        body: bodyText,
        data: {
          type: "event_management",
          subtype: "ticket_purchase_confirmation",
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          ticketQuantity,
          totalPrice,
          screen: "my-events",
        },
      });

      console.log("Event ticket purchase confirmation sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending event ticket purchase confirmation:", error);
      return null;
    }
  }

  /**
   * Schedule event date/time reminders (24hr and 1hr before)
   */
  static async scheduleEventReminders(
    eventData: EventNotificationData
  ): Promise<{ reminder24h?: string; reminder1h?: string }> {
    const results: { reminder24h?: string; reminder1h?: string } = {};

    if (!eventData.eventDate) {
      console.log("No event date provided, skipping reminder scheduling");
      return results;
    }

    try {
      const eventTime = eventData.eventDate.getTime();
      const now = new Date().getTime();

      // Schedule 24-hour reminder
      const reminder24hTime = new Date(eventTime - 24 * 60 * 60 * 1000);
      if (reminder24hTime.getTime() > now) {
        const notificationId24h =
          await notificationService.scheduleNotification({
            title: `📅 ${eventData.eventName} Tomorrow`,
            body: `Don't forget! Your event is tomorrow. Make sure you're ready to rage!`,
            data: {
              type: "event_management",
              subtype: "24h_reminder",
              eventId: eventData.eventId,
              eventName: eventData.eventName,
              eventLocation: eventData.eventLocation,
              screen: "event-detail",
            },
            trigger: {
              date: reminder24hTime,
            } as Notifications.DateTriggerInput,
          });

        if (notificationId24h) {
          results.reminder24h = notificationId24h;
          console.log("24-hour event reminder scheduled:", notificationId24h);
        }
      }

      // Schedule 1-hour reminder
      const reminder1hTime = new Date(eventTime - 60 * 60 * 1000);
      if (reminder1hTime.getTime() > now) {
        const notificationId1h = await notificationService.scheduleNotification(
          {
            title: `🔥 ${eventData.eventName} in 1 Hour!`,
            body: `Get ready to rage! Your event starts in 1 hour. See you there!`,
            data: {
              type: "event_management",
              subtype: "1h_reminder",
              eventId: eventData.eventId,
              eventName: eventData.eventName,
              eventLocation: eventData.eventLocation,
              screen: "event-detail",
            },
            trigger: {
              date: reminder1hTime,
            } as Notifications.DateTriggerInput,
          }
        );

        if (notificationId1h) {
          results.reminder1h = notificationId1h;
          console.log("1-hour event reminder scheduled:", notificationId1h);
        }
      }

      return results;
    } catch (error) {
      console.error("Error scheduling event reminders:", error);
      return results;
    }
  }

  /**
   * Send ticket transfer confirmation to both sender and recipient
   */
  static async sendTicketTransferConfirmation(
    eventData: EventNotificationData,
    isRecipient: boolean = false
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      if (isRecipient) {
        title = "🎫 You Received a Ticket!";
        body = `${
          eventData.transferFromUser || "Someone"
        } sent you a ticket for ${eventData.eventName}. Check your events!`;
      } else {
        title = "✅ Ticket Transferred";
        body = `Your ticket for ${
          eventData.eventName
        } was successfully transferred to ${
          eventData.recipientName || "the recipient"
        }.`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "event_management",
          subtype: isRecipient ? "ticket_received" : "ticket_sent",
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          ticketId: eventData.ticketId,
          recipientName: eventData.recipientName,
          transferFromUser: eventData.transferFromUser,
          screen: "my-events",
        },
      });

      console.log(
        `Ticket transfer confirmation sent (${
          isRecipient ? "recipient" : "sender"
        }):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending ticket transfer confirmation:", error);
      return null;
    }
  }

  /**
   * Send event check-in notification (when admin scans ticket)
   */
  static async sendEventCheckInNotification(
    eventData: EventNotificationData,
    isValid: boolean = true
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      if (isValid) {
        title = "🎉 Welcome to the Event!";
        body = `You're checked in to ${eventData.eventName}. Have an amazing time!`;
      } else {
        title = "❌ Check-in Issue";
        body = `There was an issue checking you in to ${eventData.eventName}. Please see event staff.`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "event_management",
          subtype: isValid ? "check_in_success" : "check_in_failed",
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          ticketId: eventData.ticketId,
          screen: "my-events",
        },
      });

      console.log(
        `Event check-in notification sent (${isValid ? "success" : "failed"}):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending event check-in notification:", error);
      return null;
    }
  }

  /**
   * Cancel event-related notifications for a specific event
   */
  static async cancelEventNotifications(eventId: string): Promise<void> {
    try {
      const scheduledNotifications =
        await notificationService.getScheduledNotifications();

      // Cancel notifications for this specific event
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.eventId === eventId) {
          await notificationService.cancelNotification(notification.identifier);
        }
      }

      console.log(`Event notifications cancelled for event: ${eventId}`);
    } catch (error) {
      console.error("Error cancelling event notifications:", error);
    }
  }

  /**
   * Send event location/detail update notification
   */
  static async sendEventUpdateNotification(
    eventData: EventNotificationData,
    updateType: "location" | "time" | "details",
    updateMessage: string
  ): Promise<string | null> {
    try {
      const typeEmojis = {
        location: "📍",
        time: "⏰",
        details: "ℹ️",
      };

      const title = `${typeEmojis[updateType]} Event Update: ${eventData.eventName}`;

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body: updateMessage,
        data: {
          type: "event_management",
          subtype: "event_update",
          updateType,
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          screen: "event-detail",
        },
      });

      console.log(
        `Event update notification sent (${updateType}):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending event update notification:", error);
      return null;
    }
  }

  // ========== CART & COMMERCE NOTIFICATIONS ==========

  /**
   * Send low stock alert for products in user's cart
   */
  static async sendLowStockAlert(
    commerceData: CommerceNotificationData,
    stockLevel: number,
    threshold: number = 5
  ): Promise<string | null> {
    try {
      let bodyText = `Hurry! Only ${stockLevel} left of ${commerceData.productTitle}`;

      if (stockLevel <= 1) {
        bodyText = `⚠️ Last one! ${commerceData.productTitle} is almost sold out`;
      } else if (stockLevel <= 3) {
        bodyText = `🔥 Only ${stockLevel} left! ${commerceData.productTitle} is selling fast`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title: "Low Stock Alert",
        body: bodyText,
        data: {
          type: "cart_commerce",
          subtype: "low_stock_alert",
          productId: commerceData.productId,
          productTitle: commerceData.productTitle,
          stockLevel,
          threshold,
          screen: "shop",
          action: "view_product",
        },
      });

      console.log("Low stock alert sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending low stock alert:", error);
      return null;
    }
  }

  /**
   * Send enhanced cart abandonment reminder with product details
   */
  static async sendEnhancedCartAbandonmentReminder(
    cartValue: number,
    itemCount: number,
    topProducts: Array<{ title: string; price: number }>,
    delayInMinutes: number = 60
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      if (itemCount === 1) {
        title = "Complete your purchase";
        body = `${
          topProducts[0]?.title
        } is waiting in your cart ($${cartValue.toFixed(2)})`;
      } else if (itemCount <= 3) {
        title = "Your items are waiting";
        body = `${itemCount} items in your cart including ${
          topProducts[0]?.title
        } ($${cartValue.toFixed(2)})`;
      } else {
        title = `${itemCount} items in your cart`;
        body = `Complete your order ($${cartValue.toFixed(
          2
        )}) - items may sell out!`;
      }

      const notificationId = await notificationService.scheduleNotification({
        title,
        body,
        data: {
          type: "cart_commerce",
          subtype: "enhanced_cart_abandonment",
          cartValue,
          itemCount,
          topProducts: topProducts.slice(0, 3), // Limit to top 3 products
          screen: "cart",
          action: "complete_checkout",
        },
        trigger: {
          seconds: delayInMinutes * 60,
        } as Notifications.TimeIntervalTriggerInput,
      });

      console.log(
        "Enhanced cart abandonment reminder scheduled:",
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error(
        "Error scheduling enhanced cart abandonment reminder:",
        error
      );
      return null;
    }
  }

  /**
   * Send new product launch notification
   */
  static async sendNewProductLaunchNotification(
    commerceData: CommerceNotificationData,
    launchDate?: Date
  ): Promise<string | null> {
    try {
      let bodyText = `${commerceData.productTitle} is now available! Check it out.`;

      if (commerceData.productPrice) {
        bodyText = `🆕 ${
          commerceData.productTitle
        } is now available for $${commerceData.productPrice.toFixed(2)}!`;
      }

      if (launchDate) {
        const launchDateStr = launchDate.toLocaleDateString();
        bodyText += ` Launched ${launchDateStr}`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title: "🎉 New Product Alert",
        body: bodyText,
        data: {
          type: "cart_commerce",
          subtype: "new_product_launch",
          productId: commerceData.productId,
          productTitle: commerceData.productTitle,
          productPrice: commerceData.productPrice,
          launchDate: launchDate?.toISOString(),
          screen: "shop",
          action: "view_new_product",
        },
      });

      console.log("New product launch notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending new product launch notification:", error);
      return null;
    }
  }

  /**
   * Send back in stock notification for previously unavailable items
   */
  static async sendBackInStockNotification(
    commerceData: CommerceNotificationData
  ): Promise<string | null> {
    try {
      const bodyText = `Good news! ${commerceData.productTitle} is back in stock. Get yours now!`;

      const notificationId = await notificationService.sendLocalNotification({
        title: "🔄 Back in Stock!",
        body: bodyText,
        data: {
          type: "cart_commerce",
          subtype: "back_in_stock",
          productId: commerceData.productId,
          productTitle: commerceData.productTitle,
          productPrice: commerceData.productPrice,
          screen: "shop",
          action: "view_restocked_product",
        },
      });

      console.log("Back in stock notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending back in stock notification:", error);
      return null;
    }
  }

  /**
   * Send cart recovery notification with incentive
   */
  static async sendCartRecoveryWithIncentive(
    cartValue: number,
    itemCount: number,
    incentiveText: string = "Free shipping on orders over $50",
    delayInMinutes: number = 120
  ): Promise<string | null> {
    try {
      const title = "Come back and save!";
      const body = `Your cart ($${cartValue.toFixed(
        2
      )}) is waiting. ${incentiveText}`;

      const notificationId = await notificationService.scheduleNotification({
        title,
        body,
        data: {
          type: "cart_commerce",
          subtype: "cart_recovery_incentive",
          cartValue,
          itemCount,
          incentiveText,
          screen: "cart",
          action: "return_to_cart",
        },
        trigger: {
          seconds: delayInMinutes * 60,
        } as Notifications.TimeIntervalTriggerInput,
      });

      console.log("Cart recovery with incentive scheduled:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error scheduling cart recovery with incentive:", error);
      return null;
    }
  }

  /**
   * Cancel all cart and commerce related notifications
   */
  static async cancelCartCommerceNotifications(): Promise<void> {
    try {
      const scheduledNotifications =
        await notificationService.getScheduledNotifications();

      // Cancel notifications with cart_commerce or cart_abandonment type
      for (const notification of scheduledNotifications) {
        const notificationType = notification.content.data?.type;
        if (
          notificationType === "cart_commerce" ||
          notificationType === "cart_abandonment"
        ) {
          await notificationService.cancelNotification(notification.identifier);
          console.log(
            "Cancelled cart/commerce notification:",
            notification.identifier
          );
        }
      }

      console.log("Cart and commerce notifications cancelled");
    } catch (error) {
      console.error("Error cancelling cart and commerce notifications:", error);
    }
  }

  /**
   * Send final cart abandonment notification with urgency
   */
  static async sendFinalCartAbandonmentNotification(
    cartValue: number,
    itemCount: number,
    hoursLeft: number = 24
  ): Promise<string | null> {
    try {
      const title = "⏰ Cart expires soon!";
      const body = `Your ${itemCount} item${
        itemCount > 1 ? "s" : ""
      } ($${cartValue.toFixed(
        2
      )}) expire in ${hoursLeft} hours. Don't miss out!`;

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "cart_commerce",
          subtype: "final_cart_abandonment",
          cartValue,
          itemCount,
          hoursLeft,
          screen: "cart",
          action: "urgent_checkout",
        },
      });

      console.log("Final cart abandonment notification sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error(
        "Error sending final cart abandonment notification:",
        error
      );
      return null;
    }
  }

  // ========== ACCOUNT & SECURITY NOTIFICATIONS ==========

  /**
   * Send login alert for new device or suspicious activity
   */
  static async sendLoginAlert(
    accountData: AccountSecurityNotificationData,
    isNewDevice: boolean = false,
    isSuspiciousActivity: boolean = false
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      if (isSuspiciousActivity) {
        title = "🚨 Suspicious Login Detected";
        body = `Someone tried to access your account from ${
          accountData.deviceInfo?.location || "an unknown location"
        }. If this wasn't you, secure your account immediately.`;
      } else if (isNewDevice) {
        title = "🔐 New Device Login";
        body = `Your account was accessed from a new ${
          accountData.deviceInfo?.deviceType || "device"
        }${
          accountData.deviceInfo?.location
            ? ` in ${accountData.deviceInfo.location}`
            : ""
        }. Was this you?`;
      } else {
        title = "✅ Account Access";
        body = `You successfully logged in from ${
          accountData.deviceInfo?.deviceName || "your device"
        }`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "login_alert",
          actionType: accountData.actionType,
          isNewDevice,
          isSuspiciousActivity,
          securityLevel: isSuspiciousActivity
            ? "high"
            : isNewDevice
            ? "medium"
            : "low",
          timestamp: accountData.timestamp.toISOString(),
          deviceInfo: accountData.deviceInfo,
          screen: "account",
          action: isSuspiciousActivity ? "secure_account" : "view_activity",
        },
      });

      console.log(
        `Login alert sent (${
          isSuspiciousActivity
            ? "suspicious"
            : isNewDevice
            ? "new device"
            : "normal"
        }):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending login alert:", error);
      return null;
    }
  }

  /**
   * Send password reset confirmation notification
   */
  static async sendPasswordResetConfirmation(
    accountData: AccountSecurityNotificationData,
    resetMethod: "email" | "sms" = "email"
  ): Promise<string | null> {
    try {
      const title = "🔑 Password Reset Confirmed";
      const body = `Your password was successfully reset${
        accountData.deviceInfo?.location
          ? ` from ${accountData.deviceInfo.location}`
          : ""
      }. If you didn't request this, contact support immediately.`;

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "password_reset_confirmation",
          actionType: accountData.actionType,
          resetMethod,
          isSuccessful: accountData.isSuccessful ?? true,
          securityLevel: "medium",
          timestamp: accountData.timestamp.toISOString(),
          deviceInfo: accountData.deviceInfo,
          screen: "account",
          action: "view_security_settings",
        },
      });

      console.log("Password reset confirmation sent:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending password reset confirmation:", error);
      return null;
    }
  }

  /**
   * Send profile update confirmation notification
   */
  static async sendProfileUpdateConfirmation(
    accountData: AccountSecurityNotificationData,
    updateType:
      | "basic_info"
      | "contact_info"
      | "security_settings" = "basic_info"
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      const changedFieldsList =
        accountData.changedFields?.join(", ") || "profile information";

      switch (updateType) {
        case "contact_info":
          title = "📧 Contact Info Updated";
          body = `Your ${changedFieldsList} has been updated successfully.`;
          break;
        case "security_settings":
          title = "🔒 Security Settings Updated";
          body = `Your security settings (${changedFieldsList}) have been updated.`;
          break;
        default:
          title = "✏️ Profile Updated";
          body = `Your ${changedFieldsList} has been updated successfully.`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "profile_update_confirmation",
          actionType: accountData.actionType,
          updateType,
          changedFields: accountData.changedFields,
          isSuccessful: accountData.isSuccessful ?? true,
          securityLevel: updateType === "security_settings" ? "medium" : "low",
          timestamp: accountData.timestamp.toISOString(),
          screen: "account",
          action: "view_profile",
        },
      });

      console.log(
        `Profile update confirmation sent (${updateType}):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending profile update confirmation:", error);
      return null;
    }
  }

  /**
   * Send security alert for various account security events
   */
  static async sendSecurityAlert(
    accountData: AccountSecurityNotificationData,
    alertType:
      | "account_locked"
      | "suspicious_activity"
      | "data_breach"
      | "unauthorized_access",
    customMessage?: string
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      switch (alertType) {
        case "account_locked":
          title = "🔒 Account Locked";
          body =
            customMessage ||
            "Your account has been temporarily locked due to security concerns. Contact support to unlock.";
          break;
        case "suspicious_activity":
          title = "⚠️ Suspicious Activity Detected";
          body =
            customMessage ||
            "We detected unusual activity on your account. Please verify your recent actions.";
          break;
        case "data_breach":
          title = "🛡️ Security Notice";
          body =
            customMessage ||
            "We've detected a potential security issue. Please update your password as a precaution.";
          break;
        case "unauthorized_access":
          title = "🚨 Unauthorized Access Attempt";
          body =
            customMessage ||
            "Someone attempted to access your account without authorization. Your account is secure.";
          break;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "security_alert",
          actionType: accountData.actionType,
          alertType,
          securityLevel: "high",
          timestamp: accountData.timestamp.toISOString(),
          deviceInfo: accountData.deviceInfo,
          screen: "account",
          action: "view_security_settings",
        },
      });

      console.log(`Security alert sent (${alertType}):`, notificationId);
      return notificationId;
    } catch (error) {
      console.error("Error sending security alert:", error);
      return null;
    }
  }

  /**
   * Send account verification completion notification
   */
  static async sendAccountVerificationNotification(
    accountData: AccountSecurityNotificationData,
    verificationType: "email" | "phone" | "identity",
    isSuccessful: boolean = true
  ): Promise<string | null> {
    try {
      let title: string;
      let body: string;

      if (isSuccessful) {
        switch (verificationType) {
          case "email":
            title = "✅ Email Verified";
            body =
              "Your email address has been successfully verified. Your account is now fully active.";
            break;
          case "phone":
            title = "✅ Phone Verified";
            body =
              "Your phone number has been successfully verified. You can now receive SMS notifications.";
            break;
          case "identity":
            title = "✅ Identity Verified";
            body =
              "Your identity has been successfully verified. You now have access to all features.";
            break;
        }
      } else {
        title = "❌ Verification Failed";
        body = `${verificationType} verification failed. Please try again or contact support if the issue persists.`;
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "account_verification",
          actionType: accountData.actionType,
          verificationType,
          isSuccessful,
          securityLevel: "medium",
          timestamp: accountData.timestamp.toISOString(),
          screen: "account",
          action: isSuccessful ? "view_profile" : "retry_verification",
        },
      });

      console.log(
        `Account verification notification sent (${verificationType}, ${
          isSuccessful ? "success" : "failed"
        }):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending account verification notification:", error);
      return null;
    }
  }

  /**
   * Send data export/download completion notification
   */
  static async sendDataExportNotification(
    accountData: AccountSecurityNotificationData,
    exportType:
      | "profile_data"
      | "order_history"
      | "analytics_data"
      | "full_export",
    downloadUrl?: string
  ): Promise<string | null> {
    try {
      const title = "📦 Data Export Ready";
      let body = `Your ${exportType.replace(
        "_",
        " "
      )} export is ready for download.`;

      if (downloadUrl) {
        body += " The download link has been sent to your registered email.";
      }

      const notificationId = await notificationService.sendLocalNotification({
        title,
        body,
        data: {
          type: "account_security",
          subtype: "data_export",
          actionType: accountData.actionType,
          exportType,
          downloadUrl,
          isSuccessful: true,
          securityLevel: "medium",
          timestamp: accountData.timestamp.toISOString(),
          screen: "account",
          action: "download_data",
        },
      });

      console.log(
        `Data export notification sent (${exportType}):`,
        notificationId
      );
      return notificationId;
    } catch (error) {
      console.error("Error sending data export notification:", error);
      return null;
    }
  }

  /**
   * Cancel all account and security related notifications
   */
  static async cancelAccountSecurityNotifications(): Promise<void> {
    try {
      const scheduledNotifications =
        await notificationService.getScheduledNotifications();

      // Cancel notifications with account_security type
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === "account_security") {
          await notificationService.cancelNotification(notification.identifier);
          console.log(
            "Cancelled account security notification:",
            notification.identifier
          );
        }
      }

      console.log("Account security notifications cancelled");
    } catch (error) {
      console.error("Error cancelling account security notifications:", error);
    }
  }
}

export { NotificationManager };
