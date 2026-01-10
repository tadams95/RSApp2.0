import React from "react";
import { Button, Text, View } from "react-native";
import type { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { useRealtimeDBConnection } from "../hooks/useRealtimeDBConnection";
import { useThemedStyles } from "../hooks/useThemedStyles";

/**
 * Example component demonstrating the use of the useRealtimeDBConnection hook
 * Shows connection state and provides a reconnect button
 */
const RealtimeDatabaseConnectionStatus = () => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isConnected, isConnecting, reconnect } = useRealtimeDBConnection();

  // Get dynamic status color based on connection state
  const statusColor = isConnecting
    ? theme.colors.warning
    : isConnected
    ? theme.colors.success
    : theme.colors.danger;

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View
          style={[styles.statusIndicator, { backgroundColor: statusColor }]}
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

const createStyles = (theme: Theme) =>
  ({
    container: {
      padding: 16,
      backgroundColor: theme.colors.bgElev1,
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
    statusText: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
  } as const);

export default RealtimeDatabaseConnectionStatus;
