import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  description?: string;
}

/**
 * SettingsSection - A reusable section container for settings screens
 * Provides consistent styling for grouped settings with a title header
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
  description,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    width: "100%",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily,
    color: GlobalStyles.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  description: {
    fontSize: 13,
    fontFamily,
    color: "#999",
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  content: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
});

export default SettingsSection;
