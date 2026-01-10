import React from "react";
import { Platform, Text, TextInput, TextInputProps, View } from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface ProfileFormInputProps extends TextInputProps {
  label: string;
  error?: string;
  onChangeText: (text: string) => void;
  testID?: string;
}

// Define font family with proper type
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined

/**
 * A reusable input component for profile forms with built-in error handling
 */
const ProfileFormInput: React.FC<ProfileFormInputProps> = ({
  label,
  error,
  onChangeText,
  testID,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.inputContainer} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={theme.colors.textTertiary}
        onChangeText={onChangeText}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    inputContainer: {
      marginBottom: 8,
      width: "100%",
    },
    label: {
      fontFamily,
      paddingBottom: 5,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontWeight: "500",
    },
    input: {
      backgroundColor: theme.colors.bgElev2,
      padding: 14,
      marginBottom: 6,
      borderRadius: 8,
      fontFamily,
      width: "100%",
      fontSize: 16,
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 12,
      marginBottom: 8,
      marginTop: -2,
      fontFamily,
    },
  } as const);

export default ProfileFormInput;
