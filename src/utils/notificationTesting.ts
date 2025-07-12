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
 * Test event management notifications
 */
export const testEventManagementNotifications = async () => {
  console.log("🎫 Testing Event Management Notifications...");

  try {
    // Test event data
    const testEventData = {
      eventId: "test-event-123",
      eventName: "RAGESTATE Test Event",
      eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      eventLocation: "Test Venue, Test City",
      ticketId: "ticket-123",
      recipientName: "Test User",
      transferFromUser: "Test Sender",
    };

    console.log("1. Testing ticket purchase confirmation...");
    await NotificationManager.sendEventTicketPurchaseConfirmation(
      testEventData,
      2, // 2 tickets
      50.0 // $50 total
    );

    console.log("2. Testing event reminders scheduling...");
    const reminderResults = await NotificationManager.scheduleEventReminders(
      testEventData
    );
    console.log("   Reminders scheduled:", reminderResults);

    console.log("3. Testing ticket transfer confirmation (sender)...");
    await NotificationManager.sendTicketTransferConfirmation(
      testEventData,
      false
    );

    console.log("4. Testing ticket transfer confirmation (recipient)...");
    await NotificationManager.sendTicketTransferConfirmation(
      testEventData,
      true
    );

    console.log("5. Testing successful check-in notification...");
    await NotificationManager.sendEventCheckInNotification(testEventData, true);

    console.log("6. Testing failed check-in notification...");
    await NotificationManager.sendEventCheckInNotification(
      testEventData,
      false
    );

    console.log("7. Testing event update notification...");
    await NotificationManager.sendEventUpdateNotification(
      testEventData,
      "location",
      "Event location has been updated to the main stage area."
    );

    console.log("✅ Event management notification tests completed!");

    Alert.alert(
      "Event Notifications Test",
      "Event management notifications test completed! Check your notification history for 7 test notifications.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Event management notification test failed:", error);
    Alert.alert(
      "Test Failed",
      `Event management notification test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

/**
 * Test event reminder scheduling with different timing scenarios
 */
export const testEventReminderScheduling = async () => {
  console.log("⏰ Testing Event Reminder Scheduling...");

  try {
    // Test 1: Event in the future (should schedule both reminders)
    console.log(
      "1. Testing event in 3 days (should schedule both reminders)..."
    );
    const futureEvent = {
      eventId: "future-event",
      eventName: "Future Event Test",
      eventDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      eventLocation: "Future Venue",
    };

    const futureResults = await NotificationManager.scheduleEventReminders(
      futureEvent
    );
    console.log("   Future event reminders:", futureResults);

    // Test 2: Event in 12 hours (should only schedule 1-hour reminder)
    console.log(
      "2. Testing event in 12 hours (should only schedule 1h reminder)..."
    );
    const nearEvent = {
      eventId: "near-event",
      eventName: "Near Event Test",
      eventDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
      eventLocation: "Near Venue",
    };

    const nearResults = await NotificationManager.scheduleEventReminders(
      nearEvent
    );
    console.log("   Near event reminders:", nearResults);

    // Test 3: Event in the past (should schedule no reminders)
    console.log(
      "3. Testing event in the past (should schedule no reminders)..."
    );
    const pastEvent = {
      eventId: "past-event",
      eventName: "Past Event Test",
      eventDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      eventLocation: "Past Venue",
    };

    const pastResults = await NotificationManager.scheduleEventReminders(
      pastEvent
    );
    console.log("   Past event reminders:", pastResults);

    console.log("✅ Event reminder scheduling tests completed!");

    Alert.alert(
      "Reminder Scheduling Test",
      "Event reminder scheduling test completed! Check console for details about which reminders were scheduled.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Event reminder scheduling test failed:", error);
    Alert.alert(
      "Test Failed",
      `Event reminder scheduling test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

/**
 * Test cart and commerce notifications
 */
export const testCartCommerceNotifications = async () => {
  console.log("🛒 Testing Cart & Commerce Notifications...");

  try {
    // Sample commerce data for testing
    const testCommerceData = {
      productId: "test-product-123",
      productTitle: "Test Rage State Hoodie",
      productPrice: 59.99,
      productImage: "https://example.com/test-image.jpg",
      variantId: "variant-123",
      inventoryLevel: 3,
    };

    console.log("1. Testing low stock alert...");
    await NotificationManager.sendLowStockAlert(
      testCommerceData,
      3, // Only 3 left
      5 // Threshold of 5
    );

    console.log("2. Testing enhanced cart abandonment reminder...");
    const topProducts = [
      { title: "Rage State Hoodie", price: 59.99 },
      { title: "RS T-Shirt", price: 29.99 },
      { title: "RS Cap", price: 24.99 },
    ];
    await NotificationManager.sendEnhancedCartAbandonmentReminder(
      114.97, // Total cart value
      3, // Item count
      topProducts,
      1 // 1 minute delay for testing
    );

    console.log("3. Testing new product launch notification...");
    await NotificationManager.sendNewProductLaunchNotification(
      {
        ...testCommerceData,
        productTitle: "Limited Edition RS Jacket",
      },
      new Date() // Just launched
    );

    console.log("4. Testing back in stock notification...");
    await NotificationManager.sendBackInStockNotification({
      ...testCommerceData,
      productTitle: "Popular RS Hoodie",
    });

    console.log("5. Testing cart recovery with incentive...");
    await NotificationManager.sendCartRecoveryWithIncentive(
      149.99, // Cart value
      4, // Item count
      "Free shipping on orders over $50 + 10% off!",
      1 // 1 minute delay for testing
    );

    console.log("6. Testing final cart abandonment notification...");
    await NotificationManager.sendFinalCartAbandonmentNotification(
      199.99, // High value cart
      5, // Item count
      24 // 24 hours left
    );

    console.log("✅ Cart & commerce notification tests completed!");

    Alert.alert(
      "Cart & Commerce Test",
      "Cart & commerce notifications test completed! Check your notification history for 6 test notifications including scheduled ones.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Cart & commerce notification test failed:", error);
    Alert.alert(
      "Test Failed",
      `Cart & commerce notification test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

/**
 * Test cart recovery scenarios with different notification types
 */
export const testCartRecoveryScenarios = async () => {
  console.log("🔄 Testing Cart Recovery Scenarios...");

  try {
    console.log("1. Testing low-value cart abandonment (< $50)...");
    await NotificationManager.sendEnhancedCartAbandonmentReminder(
      35.99,
      1,
      [{ title: "RS T-Shirt", price: 35.99 }],
      1 // 1 minute for testing
    );

    console.log("2. Testing medium-value cart abandonment ($50-$100)...");
    await NotificationManager.sendEnhancedCartAbandonmentReminder(
      79.99,
      2,
      [
        { title: "RS Hoodie", price: 59.99 },
        { title: "RS Sticker Pack", price: 19.99 },
      ],
      1 // 1 minute for testing
    );

    console.log("3. Testing high-value cart abandonment (> $100)...");
    await NotificationManager.sendEnhancedCartAbandonmentReminder(
      159.97,
      3,
      [
        { title: "Limited Edition Jacket", price: 89.99 },
        { title: "RS Hoodie", price: 59.99 },
        { title: "RS Cap", price: 9.99 },
      ],
      1 // 1 minute for testing
    );

    console.log("4. Testing cart recovery with different incentives...");
    await NotificationManager.sendCartRecoveryWithIncentive(
      120.0,
      3,
      "Limited time: 15% off everything!",
      1 // 1 minute for testing
    );

    console.log("5. Testing urgent final cart notification...");
    await NotificationManager.sendFinalCartAbandonmentNotification(
      175.5,
      4,
      12 // 12 hours left
    );

    console.log("✅ Cart recovery scenario tests completed!");

    Alert.alert(
      "Cart Recovery Test",
      "Cart recovery scenario tests completed! Check your notifications for 5 different cart recovery scenarios.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Cart recovery scenario test failed:", error);
    Alert.alert(
      "Test Failed",
      `Cart recovery scenario test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

/**
 * Test account and security notifications
 */
export const testAccountSecurityNotifications = async () => {
  console.log("🔐 Testing Account & Security Notifications...");

  try {
    // Sample account data for testing
    const testAccountData = {
      userId: "test-user-123",
      actionType: "login" as const,
      timestamp: new Date(),
      isSuccessful: true,
      deviceInfo: {
        deviceName: "Test Device",
        deviceType: "mobile",
        platform: "test",
        ipAddress: "192.168.1.1",
        location: "San Francisco, CA",
      },
    };

    console.log("1. Testing normal login alert...");
    await NotificationManager.sendLoginAlert(
      testAccountData,
      false, // Not a new device
      false // Not suspicious
    );

    console.log("2. Testing new device login alert...");
    await NotificationManager.sendLoginAlert(
      {
        ...testAccountData,
        deviceInfo: {
          ...testAccountData.deviceInfo,
          deviceName: "Unknown iPhone",
          location: "New York, NY",
        },
      },
      true, // New device
      false // Not suspicious
    );

    console.log("3. Testing suspicious activity alert...");
    await NotificationManager.sendLoginAlert(
      {
        ...testAccountData,
        deviceInfo: {
          ...testAccountData.deviceInfo,
          location: "Unknown Location",
          ipAddress: "10.0.0.1",
        },
      },
      false, // Not necessarily new device
      true // Suspicious activity
    );

    console.log("4. Testing password reset confirmation...");
    await NotificationManager.sendPasswordResetConfirmation(
      {
        ...testAccountData,
        actionType: "password_reset",
      },
      "email"
    );

    console.log("5. Testing profile update confirmation (basic info)...");
    await NotificationManager.sendProfileUpdateConfirmation(
      {
        ...testAccountData,
        actionType: "profile_update",
        changedFields: ["firstName", "lastName"],
      },
      "basic_info"
    );

    console.log("6. Testing profile update confirmation (contact info)...");
    await NotificationManager.sendProfileUpdateConfirmation(
      {
        ...testAccountData,
        actionType: "profile_update",
        changedFields: ["email", "phoneNumber"],
      },
      "contact_info"
    );

    console.log("7. Testing security alert (account locked)...");
    await NotificationManager.sendSecurityAlert(
      {
        ...testAccountData,
        actionType: "security_alert",
        securityLevel: "high",
      },
      "account_locked"
    );

    console.log("8. Testing account verification notification...");
    await NotificationManager.sendAccountVerificationNotification(
      {
        ...testAccountData,
        actionType: "profile_update",
      },
      "email",
      true
    );

    console.log("✅ Account & security notification tests completed!");

    Alert.alert(
      "Account & Security Test",
      "Account & security notifications test completed! Check your notification history for 8 test notifications.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Account & security notification test failed:", error);
    Alert.alert(
      "Test Failed",
      `Account & security notification test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
};

/**
 * Test various security alert scenarios
 */
export const testSecurityAlertScenarios = async () => {
  console.log("🚨 Testing Security Alert Scenarios...");

  try {
    const baseAccountData = {
      userId: "test-user-456",
      actionType: "security_alert" as const,
      timestamp: new Date(),
      securityLevel: "high" as const,
      deviceInfo: {
        platform: "mobile",
        location: "Unknown",
      },
    };

    console.log("1. Testing suspicious activity alert...");
    await NotificationManager.sendSecurityAlert(
      baseAccountData,
      "suspicious_activity",
      "We detected multiple failed login attempts from an unknown location."
    );

    console.log("2. Testing unauthorized access attempt...");
    await NotificationManager.sendSecurityAlert(
      baseAccountData,
      "unauthorized_access",
      "Someone tried to access your account with an incorrect password."
    );

    console.log("3. Testing data breach notification...");
    await NotificationManager.sendSecurityAlert(
      baseAccountData,
      "data_breach",
      "As a precaution, please update your password due to a security incident."
    );

    console.log("4. Testing account verification (email success)...");
    await NotificationManager.sendAccountVerificationNotification(
      {
        ...baseAccountData,
        actionType: "profile_update",
        securityLevel: "medium",
      },
      "email",
      true
    );

    console.log("5. Testing account verification (phone failed)...");
    await NotificationManager.sendAccountVerificationNotification(
      {
        ...baseAccountData,
        actionType: "profile_update",
        securityLevel: "medium",
      },
      "phone",
      false
    );

    console.log("6. Testing data export notification...");
    await NotificationManager.sendDataExportNotification(
      {
        ...baseAccountData,
        actionType: "profile_update",
        securityLevel: "medium",
      },
      "full_export",
      "https://example.com/download/user-data.zip"
    );

    console.log("✅ Security alert scenario tests completed!");

    Alert.alert(
      "Security Alerts Test",
      "Security alert scenario tests completed! Check your notifications for 6 different security scenarios.",
      [{ text: "OK" }]
    );

    return true;
  } catch (error) {
    console.error("❌ Security alert scenario test failed:", error);
    Alert.alert(
      "Test Failed",
      `Security alert scenario test failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
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
      await testEventManagementNotifications();
      await testEventReminderScheduling();
      await testCartCommerceNotifications();
      await testCartRecoveryScenarios();
      await testAccountSecurityNotifications();
      await testSecurityAlertScenarios();
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
