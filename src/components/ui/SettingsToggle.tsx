import React from "react";
import { Switch, Text, View } from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface SettingsToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * Reusable toggle component for settings screens
 * - Label with optional description
 * - Disabled state with reduced opacity
 * - Consistent styling with app theme
 */
export function SettingsToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingsToggleProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: theme.colors.bgElev2,
          true: theme.colors.accent,
        }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.bgElev1,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.borderSubtle,
    },
    disabled: {
      opacity: 0.5,
    },
    textContainer: {
      flex: 1,
      marginRight: 12,
    },
    label: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
  } as const);

export default SettingsToggle;
