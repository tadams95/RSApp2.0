import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNotifications } from "../../hooks/useNotifications";
import {
  testAccountSecurityNotifications,
  testCartAbandonmentNotification,
  testCartAbandonmentWithRetry,
  testCartCommerceNotifications,
  testCartRecoveryScenarios,
  testEventManagementNotifications,
  testEventReminderScheduling,
  testNotifications,
  testOrderConfirmation,
  testOrderStatusNotifications,
  testSecurityAlertScenarios,
} from "../../utils/notificationTesting";

const NotificationTestPanel: React.FC = () => {
  const {
    permissionStatus,
    expoPushToken,
    isInitialized,
    requestPermissions,
    sendLocalNotification,
  } = useNotifications();

  const handleRequestPermissions = async () => {
    const result = await requestPermissions();
    Alert.alert(
      "Permission Request",
      result.granted
        ? "Notification permissions granted!"
        : "Permission denied or error occurred"
    );
  };

  const handleTestBasicNotification = async () => {
    const result = await sendLocalNotification({
      title: "Test Notification",
      body: "This is a test notification from the debug panel!",
    });
    Alert.alert(
      "Basic Test",
      result ? "Test notification sent!" : "Failed to send notification"
    );
  };

  const handleRunFullTest = async () => {
    try {
      await testNotifications();
      Alert.alert(
        "Full Test",
        "Comprehensive notification test completed! Check console for details."
      );
    } catch (error) {
      Alert.alert("Test Failed", "Could not complete notification test");
    }
  };

  const handleTestCartAbandonment = async () => {
    try {
      await testCartAbandonmentNotification();
      Alert.alert("Cart Test", "Cart abandonment notification scheduled!");
    } catch (error) {
      Alert.alert(
        "Test Failed",
        "Could not test cart abandonment notification"
      );
    }
  };

  const handleTestOrderConfirmation = async () => {
    try {
      await testOrderConfirmation();
      Alert.alert("Order Test", "Order confirmation notification sent!");
    } catch (error) {
      Alert.alert("Test Failed", "Could not test order confirmation");
    }
  };

  const handleTestOrderStatus = async () => {
    try {
      await testOrderStatusNotifications();
      Alert.alert(
        "Order Status Test",
        "Order status notifications scheduled! Check your notifications over the next few seconds."
      );
    } catch (error) {
      Alert.alert(
        "Order Status Test Failed",
        "Failed to schedule order status notifications"
      );
    }
  };

  const handleTestCartAbandonmentWithRetry = async () => {
    try {
      await testCartAbandonmentWithRetry();
      Alert.alert(
        "Cart Abandonment Retry Test",
        "Enhanced cart abandonment notification scheduled!"
      );
    } catch (error) {
      Alert.alert(
        "Cart Abandonment Test Failed",
        "Failed to schedule cart abandonment notification with retry"
      );
    }
  };

  const handleTestEventManagement = async () => {
    try {
      await testEventManagementNotifications();
      Alert.alert(
        "Event Management Test",
        "Event management notifications test completed! Check your notifications."
      );
    } catch (error) {
      Alert.alert(
        "Event Management Test Failed",
        "Failed to test event management notifications"
      );
    }
  };

  const handleTestEventReminders = async () => {
    try {
      await testEventReminderScheduling();
      Alert.alert(
        "Event Reminders Test",
        "Event reminder scheduling test completed! Check console for details."
      );
    } catch (error) {
      Alert.alert(
        "Event Reminders Test Failed",
        "Failed to test event reminder scheduling"
      );
    }
  };

  const handleTestCartCommerce = async () => {
    try {
      await testCartCommerceNotifications();
      Alert.alert(
        "Cart & Commerce Test",
        "Cart & commerce notifications test completed! Check your notifications."
      );
    } catch (error) {
      Alert.alert(
        "Cart & Commerce Test Failed",
        "Failed to test cart & commerce notifications"
      );
    }
  };

  const handleTestCartRecovery = async () => {
    try {
      await testCartRecoveryScenarios();
      Alert.alert(
        "Cart Recovery Test",
        "Cart recovery scenarios test completed! Check your notifications."
      );
    } catch (error) {
      Alert.alert(
        "Cart Recovery Test Failed",
        "Failed to test cart recovery scenarios"
      );
    }
  };

  const handleTestAccountSecurity = async () => {
    try {
      await testAccountSecurityNotifications();
      Alert.alert(
        "Account & Security Test",
        "Account & security notifications test completed! Check your notifications."
      );
    } catch (error) {
      Alert.alert(
        "Account & Security Test Failed",
        "Failed to test account & security notifications"
      );
    }
  };

  const handleTestSecurityAlerts = async () => {
    try {
      await testSecurityAlertScenarios();
      Alert.alert(
        "Security Alerts Test",
        "Security alert scenarios test completed! Check your notifications."
      );
    } catch (error) {
      Alert.alert(
        "Security Alerts Test Failed",
        "Failed to test security alert scenarios"
      );
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Initializing notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Notification Testing</Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Permission:</Text>
        <Text
          style={[
            styles.statusValue,
            { color: permissionStatus === "granted" ? "green" : "red" },
          ]}
        >
          {permissionStatus || "Unknown"}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Token:</Text>
        <Text style={styles.statusValue}>
          {expoPushToken ? `${expoPushToken.substring(0, 20)}...` : "No token"}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleRequestPermissions}
      >
        <Text style={styles.buttonText}>Request Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleTestBasicNotification}
      >
        <Text style={styles.buttonText}>Send Test Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleRunFullTest}>
        <Text style={styles.buttonText}>Run Full Test Suite</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Management Notifications:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestEventManagement}
        >
          <Text style={styles.buttonText}>Test Event Management Flow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestEventReminders}
        >
          <Text style={styles.buttonText}>Test Event Reminder Scheduling</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cart & Commerce Notifications:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartCommerce}
        >
          <Text style={styles.buttonText}>Test Cart & Commerce Flow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartRecovery}
        >
          <Text style={styles.buttonText}>Test Cart Recovery Scenarios</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Account & Security Notifications:
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestAccountSecurity}
        >
          <Text style={styles.buttonText}>Test Account & Security Flow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestSecurityAlerts}
        >
          <Text style={styles.buttonText}>Test Security Alert Scenarios</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Status Notifications:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestOrderStatus}
        >
          <Text style={styles.buttonText}>Test Order Status Flow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartAbandonmentWithRetry}
        >
          <Text style={styles.buttonText}>
            Test Cart Abandonment with Retry
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legacy Tests:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartAbandonment}
        >
          <Text style={styles.buttonText}>Test Cart Abandonment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestOrderConfirmation}
        >
          <Text style={styles.buttonText}>Test Order Confirmation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cart & Commerce Tests:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartCommerce}
        >
          <Text style={styles.buttonText}>
            Test Cart & Commerce Notifications
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestCartRecovery}
        >
          <Text style={styles.buttonText}>Test Cart Recovery Scenarios</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account & Security Tests:</Text>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestAccountSecurity}
        >
          <Text style={styles.buttonText}>
            Test Account & Security Notifications
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleTestSecurityAlerts}
        >
          <Text style={styles.buttonText}>Test Security Alert Scenarios</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusLabel: {
    fontWeight: "600",
    color: "#333",
  },
  statusValue: {
    color: "#666",
    flex: 1,
    textAlign: "right",
    fontSize: 12,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 6,
    marginVertical: 5,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#6c757d",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  section: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  status: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
});

export default NotificationTestPanel;
