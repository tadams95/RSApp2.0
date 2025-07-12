import { Alert } from "react-native";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationManager } from "../services/notificationManager";
import { notificationService } from "../services/notificationService";

/**
 * Simple test utility to verify notification setup
 * Use this to test notifications in development
 */
export const testNotifications = async () => {
  console.log("🔔 Testing Notification System...");

  try {
    // Test 1: Check permission status
    console.log("1. Checking notification permissions...");
    const permissionStatus = await notificationService.getPermissionStatus();
    console.log("   Permission status:", permissionStatus);

    // Test 2: Request permissions if needed
    if (permissionStatus !== "granted") {
      console.log("2. Requesting notification permissions...");
      const result = await notificationService.requestPermissions();
      console.log("   Permission result:", result);

      if (!result.granted) {
        console.log("❌ Notifications not enabled - stopping test");
        return false;
      }
    } else {
      console.log("2. Permissions already granted ✅");
    }

    // Test 3: Get push token
    console.log("3. Getting Expo push token...");
    const token = await notificationService.getExpoPushToken();
    console.log("   Token:", token);

    // Test 4: Send a test notification
    console.log("4. Sending test notification...");
    const notificationId = await notificationService.sendLocalNotification({
      title: "Notification System Test",
      body: "Your push notifications are working correctly! 🎉",
      data: {
        type: "test",
        timestamp: Date.now(),
      },
    });
    console.log("   Notification sent with ID:", notificationId);

    // Test 5: Schedule a future notification (5 seconds)
    console.log("5. Scheduling test notification for 5 seconds...");
    const scheduledId = await notificationService.scheduleNotification({
      title: "Scheduled Notification Test",
      body: "This notification was scheduled 5 seconds ago!",
      data: {
        type: "test_scheduled",
        timestamp: Date.now(),
      },
      trigger: {
        seconds: 5,
      } as any, // Type assertion to handle the Expo types
    });
    console.log("   Scheduled notification ID:", scheduledId);

    console.log("✅ Notification system test completed successfully!");
    console.log("📱 Check your device for test notifications");

    return true;
  } catch (error) {
    console.error("❌ Notification test failed:", error);
    return false;
  }
};

/**
 * Test cart abandonment notification
 */
export const testCartAbandonmentNotification = async () => {
  console.log("🛒 Testing cart abandonment notification...");

  try {
    const notificationId =
      await NotificationManager.scheduleCartAbandonmentReminder(0.1); // 6 seconds for testing
    console.log("Cart abandonment reminder scheduled:", notificationId);
    return notificationId;
  } catch (error) {
    console.error("Failed to test cart abandonment notification:", error);
    return null;
  }
};

/**
 * Test order confirmation notification
 */
export const testOrderConfirmation = async () => {
  console.log("📦 Testing order confirmation notification...");

  try {
    const notificationId = await NotificationManager.sendOrderConfirmation(
      "TEST_ORDER_123",
      "$29.99"
    );
    console.log("Order confirmation sent:", notificationId);
    return notificationId;
  } catch (error) {
    console.error("Failed to test order confirmation notification:", error);
    return null;
  }
};

/**
 * Test order status notifications
 */
export const testOrderStatusNotifications = async (): Promise<void> => {
  try {
    const testOrderId = `TEST-ORDER-${Date.now()}`;
    const testOrderData = {
      orderId: testOrderId,
      orderTotal: 99.99,
      orderItems: [
        {
          productId: "test-product-1",
          title: "Test Product",
          quantity: 2,
          price: 49.99,
        },
      ],
      customerEmail: "test@example.com",
      paymentMethod: "stripe",
    };

    // Test order confirmation
    await NotificationManager.sendOrderConfirmation(testOrderId, "$99.99");
    console.log("✅ Order confirmation notification sent");

    // Test order processing
    await NotificationManager.sendOrderProcessingNotification(
      testOrderId,
      testOrderData
    );
    console.log("✅ Order processing notification sent");

    // Test shipping notification (delayed)
    setTimeout(async () => {
      await NotificationManager.sendShippingNotification(
        testOrderId,
        "1Z999999999999999999",
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      );
      console.log("✅ Shipping notification sent");
    }, 2000);

    // Test payment failure notification
    setTimeout(async () => {
      await NotificationManager.sendPaymentFailureNotification(
        `FAILED-${testOrderId}`,
        "Your payment method was declined"
      );
      console.log("✅ Payment failure notification sent");
    }, 4000);

    // Test delivery confirmation (delayed)
    setTimeout(async () => {
      await NotificationManager.sendDeliveryConfirmation(
        testOrderId,
        new Date()
      );
      console.log("✅ Delivery confirmation notification sent");
    }, 6000);

    Alert.alert(
      "Order Status Tests Started",
      "Check your notifications over the next few seconds to see all order status notifications in action."
    );
  } catch (error) {
    console.error("Error testing order status notifications:", error);
    Alert.alert("Test Failed", "Could not test order status notifications");
  }
};

/**
 * Test cart abandonment notification with retry functionality
 */
export const testCartAbandonmentWithRetry = async (): Promise<void> => {
  try {
    // Test enhanced cart abandonment reminder
    await NotificationManager.scheduleCartAbandonmentReminderWithRetry(
      75.5, // $75.50 cart value
      3, // 3 items
      1 // 1 minute delay for testing
    );

    Alert.alert(
      "Cart Abandonment Test Scheduled",
      "Enhanced cart abandonment reminder scheduled for 1 minute from now. Check your notifications!"
    );
    console.log("✅ Enhanced cart abandonment reminder scheduled");
  } catch (error) {
    console.error("Error testing cart abandonment with retry:", error);
    Alert.alert("Test Failed", "Could not test cart abandonment notification");
  }
};

/**
 * React hook for testing notifications in components
 */
export const useNotificationTesting = () => {
  const notifications = useNotifications();

  const runTests = async () => {
    console.log("🧪 Running notification tests...");

    // Basic functionality test
    const basicTest = await testNotifications();

    if (basicTest) {
      // Test business-specific notifications
      await testCartAbandonmentNotification();
      await testOrderConfirmation();
      await testOrderStatusNotifications();
    }

    return basicTest;
  };

  return {
    runTests,
    notifications,
  };
};

// Example usage in a component:
/*
import { useNotificationTesting } from '../utils/notificationTesting';

function TestComponent() {
  const { runTests } = useNotificationTesting();
  
  return (
    <Button 
      title="Test Notifications" 
      onPress={runTests}
    />
  );
}
*/
