import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import type { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";

interface SignupErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  secondaryAction?: {
    text: string;
    onPress: () => void;
  };
  style?: any;
  testID?: string;
}

/**
 * Specialized error component for signup form errors
 * Includes support for a secondary action (like "Go to Login")
 */
export const SignupErrorNotice: React.FC<SignupErrorNoticeProps> = ({
  message,
  onRetry,
  secondaryAction,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Surface style={[styles.container, style]} testID={testID}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={24}
          color={theme.colors.danger}
        />
        <Text variant="titleMedium" style={styles.title}>
          Account Creation Issue
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.actionContainer}>
        {secondaryAction && (
          <Button
            mode="outlined"
            onPress={secondaryAction.onPress}
            style={styles.secondaryButton}
            textColor={theme.colors.danger}
          >
            {secondaryAction.text}
          </Button>
        )}

        {onRetry && (
          <Button
            mode="contained"
            onPress={onRetry}
            style={styles.retryButton}
            buttonColor={theme.colors.danger}
          >
            Try Again
          </Button>
        )}
      </View>
    </Surface>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      backgroundColor: `${theme.colors.danger}15`,
      borderRadius: 8,
      padding: 16,
      marginVertical: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.danger,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    title: {
      marginLeft: 8,
      color: theme.colors.danger,
      fontWeight: "bold",
    },
    message: {
      color: theme.colors.danger,
      marginBottom: 12,
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
      borderColor: theme.colors.danger,
    },
  } as const);

export default SignupErrorNotice;
