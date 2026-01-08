import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";

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
          false: GlobalStyles.colors.grey6,
          true: GlobalStyles.colors.primary,
        }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GlobalStyles.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.border,
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
    color: GlobalStyles.colors.text,
  },
  description: {
    fontSize: 13,
    color: GlobalStyles.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});

export default SettingsToggle;
