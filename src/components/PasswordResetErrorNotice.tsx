import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import type { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";

interface PasswordResetErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  style?: any;
  testID?: string;
}

/**
 * Specialized error component for password reset form errors
 */
export const PasswordResetErrorNotice: React.FC<
  PasswordResetErrorNoticeProps
> = ({ message, onRetry, style, testID }) => {
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
          Password Reset Issue
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.actionContainer}>
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
    },
    retryButton: {
      minWidth: 100,
    },
  } as const);

export default PasswordResetErrorNotice;
