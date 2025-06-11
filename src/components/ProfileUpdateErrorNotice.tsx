import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";

interface ProfileUpdateErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  secondaryAction?: {
    text: string;
    onPress: () => void;
  };
  style?: any;
}

/**
 * Specialized error component for profile update errors
 * Includes support for a secondary action (like "Check Connection")
 */
export const ProfileUpdateErrorNotice: React.FC<
  ProfileUpdateErrorNoticeProps
> = ({ message, onRetry, secondaryAction, style }) => {
  return (
    <Surface style={[styles.container, style]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="alert-circle" size={24} color="#FF6B6B" />
        <Text variant="titleMedium" style={styles.title}>
          Profile Update Issue
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

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

export default ProfileUpdateErrorNotice;
