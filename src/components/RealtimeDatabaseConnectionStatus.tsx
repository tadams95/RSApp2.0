import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useRealtimeDBConnection } from "../hooks/useRealtimeDBConnection";

/**
 * Example component demonstrating the use of the useRealtimeDBConnection hook
 * Shows connection state and provides a reconnect button
 */
const RealtimeDatabaseConnectionStatus = () => {
  const { isConnected, isConnecting, reconnect } = useRealtimeDBConnection();

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIndicator,
            isConnected ? styles.connected : styles.disconnected,
            isConnecting ? styles.connecting : null,
          ]}
        />
        <Text style={styles.statusText}>
          {isConnecting
            ? "Connecting to database..."
            : isConnected
            ? "Connected to database"
            : "Disconnected from database"}
        </Text>
      </View>

      {!isConnected && !isConnecting && (
        <Button title="Reconnect" onPress={reconnect} disabled={isConnecting} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginVertical: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connected: {
    backgroundColor: "#4CAF50",
  },
  disconnected: {
    backgroundColor: "#F44336",
  },
  connecting: {
    backgroundColor: "#FFC107",
  },
  statusText: {
    fontSize: 16,
  },
});

export default RealtimeDatabaseConnectionStatus;
