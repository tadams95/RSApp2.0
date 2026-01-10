import React from "react";
import { Platform, Text, View } from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

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

const createStyles = (theme: Theme) =>
  ({
    container: {
      marginBottom: 24,
      width: "100%",
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily,
      color: theme.colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    description: {
      fontSize: 13,
      fontFamily,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      paddingHorizontal: 4,
      lineHeight: 18,
    },
    content: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      overflow: "hidden",
    },
  } as const);

export default SettingsSection;
