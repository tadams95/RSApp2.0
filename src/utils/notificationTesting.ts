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
