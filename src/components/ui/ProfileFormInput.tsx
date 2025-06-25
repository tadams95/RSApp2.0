import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

interface ProfileFormInputProps extends TextInputProps {
  label: string;
  error?: string;
  onChangeText: (text: string) => void;
  testID?: string;
}

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
  return (
    <View style={styles.inputContainer} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#666"
        onChangeText={onChangeText}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// Define font family with proper type
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 8,
    width: "100%",
  },
  label: {
    fontFamily,
    paddingBottom: 5,
    fontSize: 16,
    color: "white",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#222",
    padding: 14,
    marginBottom: 6,
    borderRadius: 8,
    fontFamily,
    width: "100%",
    fontSize: 16,
    color: "white",
    borderWidth: 1,
    borderColor: "#555",
  },
  inputError: {
    borderColor: "#FF6B6B",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginBottom: 8,
    marginTop: -2,
    fontFamily,
  },
});

export default ProfileFormInput;
