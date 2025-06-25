import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";

interface LoginErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  secondaryAction?: {
    text: string;
    onPress: () => void;
  };
  attempts?: number;
  style?: any;
  testID?: string;
}

/**
 * Specialized error component for login form errors
 * Includes support for a secondary action (like "Reset Password")
 */
export const LoginErrorNotice: React.FC<LoginErrorNoticeProps> = ({
  message,
  onRetry,
  secondaryAction,
  attempts = 0,
  style,
  testID,
}) => {
  return (
    <Surface style={[styles.container, style]} testID={testID}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="alert-circle" size={24} color="#FF6B6B" />
        <Text variant="titleMedium" style={styles.title}>
          Login Issue
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

      {attempts > 2 && (
        <Text style={styles.attemptsMessage}>
          Multiple unsuccessful attempts. Please verify your credentials.
        </Text>
      )}

      <View style={styles.actionContainer}>
        {secondaryAction && (
          <Button
            mode="outlined"
            onPress={secondaryAction.onPress}
            style={styles.secondaryButton}
            textColor="#FF6B6B"
          >
            {secondaryAction.text}
          </Button>
        )}

        {onRetry && (
          <Button
            mode="contained"
            onPress={onRetry}
            style={styles.retryButton}
            buttonColor="#FF6B6B"
          >
            Try Again
          </Button>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B6B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    marginLeft: 8,
    color: "#FF6B6B",
    fontWeight: "bold",
  },
  message: {
    color: "#FF6B6B",
    marginBottom: 12,
  },
  attemptsMessage: {
    color: "#FF6B6B",
    marginBottom: 12,
    fontStyle: "italic",
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  retryButton: {
    minWidth: 100,
  },
  secondaryButton: {
    minWidth: 100,
    borderColor: "#FF6B6B",
  },
});

export default LoginErrorNotice;
