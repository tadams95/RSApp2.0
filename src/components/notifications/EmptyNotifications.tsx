import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

/**
 * Empty state component for the notifications feed
 * Displayed when user has no notifications
 */
export function EmptyNotifications() {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="bell-outline"
        size={64}
        color={theme.colors.textTertiary}
      />
      <Text style={styles.title}>No notifications yet</Text>
      <Text style={styles.subtitle}>
        When you get likes, comments, followers, or transfers, they'll show up
        here
      </Text>
    </View>
  );
}

const createStyles = (theme: import("../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
  } as const);

export default EmptyNotifications;
