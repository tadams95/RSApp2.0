import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Button, Surface, Text } from "react-native-paper";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A reusable error message component for displaying errors inline
 */
export const ErrorMessage = ({
  message,
  onRetry,
  compact = false,
  style,
  testID,
}: ErrorMessageProps) => {
  const containerStyles = [
    styles.container,
    compact ? styles.compactContainer : null,
    style,
  ];

  return (
    <Surface style={containerStyles} testID={testID || "error-message"}>
      <View style={styles.contentContainer}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={compact ? 16 : 24}
          color="#FF6B6B"
          style={styles.icon}
        />
        <Text
          variant={compact ? "bodyMedium" : "bodyLarge"}
          style={styles.message}
        >
          {message}
        </Text>
      </View>

      {onRetry && (
        <Button
          mode="text"
          compact={compact}
          onPress={onRetry}
          style={styles.retryButton}
        >
          Retry
        </Button>
      )}
    </Surface>
  );
};

interface ErrorScreenProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showHomeButton?: boolean;
}

/**
 * A full-screen error component for critical failures
 */
export const ErrorScreen = ({
  title = "Something went wrong",
  message,
  onRetry,
  onGoHome,
  showHomeButton = true,
}: ErrorScreenProps) => {
  return (
    <View style={styles.screenContainer}>
      <MaterialCommunityIcons name="alert-circle" size={64} color="#FF6B6B" />

      <Text variant="headlineMedium" style={styles.screenTitle}>
        {title}
      </Text>

      <Text variant="bodyLarge" style={styles.screenMessage}>
        {message}
      </Text>

      <View style={styles.buttonContainer}>
        {onRetry && (
          <Button
            mode="contained"
            onPress={onRetry}
            style={styles.screenButton}
          >
            Try Again
          </Button>
        )}

        {showHomeButton && onGoHome && (
          <Button
            mode="outlined"
            onPress={onGoHome}
            style={styles.screenButton}
          >
            Go Home
          </Button>
        )}
      </View>
    </View>
  );
};

interface NetworkErrorProps {
  onRetry: () => void;
  message?: string;
}

/**
 * A specialized error component for network connectivity issues
 */
export const NetworkError = ({
  onRetry,
  message = "Network connection issue. Please check your internet connection.",
}: NetworkErrorProps) => {
  return (
    <View style={styles.networkErrorContainer}>
      <MaterialCommunityIcons name="wifi-off" size={48} color="#FF6B6B" />
      <Text variant="headlineSmall" style={styles.networkErrorTitle}>
        No Connection
      </Text>
      <Text variant="bodyMedium" style={styles.networkErrorMessage}>
        {message}
      </Text>
      <Button
        mode="contained"
        onPress={onRetry}
        style={styles.networkRetryButton}
      >
        Retry Connection
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B6B",
  },
  compactContainer: {
    padding: 8,
    marginVertical: 4,
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flexShrink: 1,
    color: "#FF6B6B",
  },
  retryButton: {
    marginLeft: 8,
  },

  // Full screen error styles
  screenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  screenTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: "#FFF",
    textAlign: "center",
  },
  screenMessage: {
    marginBottom: 24,
    color: "#CCC",
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  screenButton: {
    marginHorizontal: 8,
    minWidth: 120,
  },

  // Network error styles
  networkErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  networkErrorTitle: {
    marginTop: 16,
    color: "#FFF",
  },
  networkErrorMessage: {
    marginTop: 8,
    marginBottom: 24,
    color: "#CCC",
    textAlign: "center",
  },
  networkRetryButton: {
    marginTop: 8,
  },
});

export default {
  ErrorMessage,
  ErrorScreen,
  NetworkError,
};
