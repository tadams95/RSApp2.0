import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNotifications } from "../../hooks/useNotifications";
import {
  testCartAbandonmentNotification,
  testNotifications,
  testOrderConfirmation,
} from "../../utils/notificationTesting";

/**
 * Development component for testing push notifications
 * Can be temporarily added to any screen for testing
 */
export const NotificationTestPanel: React.FC = () => {
  const {
    requestPermissions,
    permissionStatus,
    expoPushToken,
    isInitialized,
    sendLocalNotification,
  } = useNotifications();

  const handleRequestPermissions = async () => {
    const result = await requestPermissions();
    Alert.alert(
      "Permission Result",
      result.granted
        ? `Granted! Token: ${result.token?.slice(0, 20)}...`
        : `Denied: ${result.error}`
    );
  };

  const handleTestBasicNotification = async () => {
    try {
      await sendLocalNotification({
        title: "Test Notification",
        body: "This is a test from your Rage State app!",
        data: { test: true },
      });
      Alert.alert("Success", "Test notification sent!");
    } catch (error) {
      Alert.alert("Error", `Failed to send notification: ${error}`);
    }
  };

  const handleRunFullTest = async () => {
    const success = await testNotifications();
    Alert.alert(
      "Test Complete",
      success ? "All tests passed! 🎉" : "Some tests failed ❌"
    );
  };

  const handleTestCartAbandonment = async () => {
    const result = await testCartAbandonmentNotification();
    Alert.alert(
      "Cart Test",
      result
        ? "Cart abandonment notification scheduled!"
        : "Failed to schedule notification"
    );
  };

  const handleTestOrderConfirmation = async () => {
    const result = await testOrderConfirmation();
    Alert.alert(
      "Order Test",
      result ? "Order confirmation sent!" : "Failed to send confirmation"
    );
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
          {permissionStatus || "unknown"}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Token:</Text>
        <Text style={styles.statusValue}>
          {expoPushToken ? `${expoPushToken.slice(0, 15)}...` : "none"}
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
        <Text style={styles.sectionTitle}>Business Tests:</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  statusLabel: {
    fontWeight: "bold",
    width: 80,
  },
  statusValue: {
    flex: 1,
    fontSize: 12,
  },
  status: {
    textAlign: "center",
    fontStyle: "italic",
    color: "#666",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  secondaryButton: {
    backgroundColor: "#34C759",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
});

export default NotificationTestPanel;
