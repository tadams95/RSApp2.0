import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";

/**
 * Empty state component for the notifications feed
 * Displayed when user has no notifications
 */
export function EmptyNotifications() {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="bell-outline"
        size={64}
        color={GlobalStyles.colors.grey5}
      />
      <Text style={styles.title}>No notifications yet</Text>
      <Text style={styles.subtitle}>
        When you get likes, comments, followers, or transfers, they'll show up
        here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: GlobalStyles.colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});

export default EmptyNotifications;
