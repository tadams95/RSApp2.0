import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Surface, Text } from "react-native-paper";

interface ProfileUpdateErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  secondaryAction?: {
    text: string;
    onPress: () => void;
  };
  style?: any;
  validationErrors?: Record<string, string>; // For field-specific validation errors
  errorCode?: string; // Optional error code for more specialized handling
  serverError?: boolean; // Flag to indicate if this was a server-side validation error
}

/**
 * Enhanced error component for profile update errors
 * Now with improved support for displaying field-specific validation errors
 * Categorized by field type with better visual separation and guidance
 */
export const ProfileUpdateErrorNotice: React.FC<
  ProfileUpdateErrorNoticeProps
> = ({
  message,
  onRetry,
  secondaryAction,
  style,
  validationErrors,
  errorCode,
  serverError,
}) => {
  // Check if we have field-specific validation errors to display
  const hasValidationErrors =
    validationErrors && Object.keys(validationErrors).length > 0;

  // Group validation errors by category for better organization
  const groupedErrors = React.useMemo(() => {
    if (!validationErrors) return {};

    const groups: Record<string, Record<string, string>> = {
      contact: {}, // Email, phone
      personal: {}, // Name fields
      other: {}, // Everything else
    };

    Object.entries(validationErrors).forEach(([field, errorMsg]) => {
      if (
        field === "email" ||
        field === "phoneNumber" ||
        field.includes("phone")
      ) {
        groups.contact[field] = errorMsg;
      } else if (
        field === "firstName" ||
        field === "lastName" ||
        field === "displayName" ||
        field.includes("name")
      ) {
        groups.personal[field] = errorMsg;
      } else {
        groups.other[field] = errorMsg;
      }
    });

    return groups;
  }, [validationErrors]);

  // Helper to format field names for display
  const formatFieldName = (field: string): string => {
    // Handle special cases
    if (field === "phoneNumber") return "Phone";
    if (field === "displayName") return "Full Name";

    // Convert camelCase to Title Case (firstName -> First Name)
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <Surface style={[styles.container, style]}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={serverError ? "server-remove" : "alert-circle"}
          size={24}
          color="#FF6B6B"
        />
        <Text variant="titleMedium" style={styles.title}>
          {hasValidationErrors ? "Validation Error" : "Profile Update Issue"}
          {serverError ? " (Server)" : ""}
        </Text>
      </View>

      <Text style={styles.message}>{message}</Text>

      {/* Display field-specific validation errors if present */}
      {hasValidationErrors && (
        <View style={styles.validationErrorsContainer}>
          {/* Personal information errors */}
          {Object.keys(groupedErrors.personal).length > 0 && (
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>
                Personal Information Issues:
              </Text>
              {Object.entries(groupedErrors.personal).map(
                ([field, errorMessage]) => (
                  <View key={field} style={styles.validationError}>
                    <MaterialCommunityIcons
                      name="account-alert"
                      size={16}
                      color="#FF6B6B"
                    />
                    <Text style={styles.validationErrorText}>
                      <Text style={styles.fieldName}>
                        {formatFieldName(field)}:
                      </Text>{" "}
                      {errorMessage}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* Contact information errors */}
          {Object.keys(groupedErrors.contact).length > 0 && (
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>
                Contact Information Issues:
              </Text>
              {Object.entries(groupedErrors.contact).map(
                ([field, errorMessage]) => (
                  <View key={field} style={styles.validationError}>
                    <MaterialCommunityIcons
                      name={
                        field.includes("email") ? "email-alert" : "phone-alert"
                      }
                      size={16}
                      color="#FF6B6B"
                    />
                    <Text style={styles.validationErrorText}>
                      <Text style={styles.fieldName}>
                        {formatFieldName(field)}:
                      </Text>{" "}
                      {errorMessage}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* Other errors */}
          {Object.keys(groupedErrors.other).length > 0 && (
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>Other Issues:</Text>
              {Object.entries(groupedErrors.other).map(
                ([field, errorMessage]) => (
                  <View key={field} style={styles.validationError}>
                    <MaterialCommunityIcons
                      name="alert"
                      size={16}
                      color="#FF6B6B"
                    />
                    <Text style={styles.validationErrorText}>
                      <Text style={styles.fieldName}>
                        {formatFieldName(field)}:
                      </Text>{" "}
                      {errorMessage}
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          <Divider style={styles.divider} />

          <Text style={styles.validationHelp}>
            {serverError
              ? "The server rejected your changes. Please correct these issues and try again."
              : "Please correct these issues before saving your profile."}
          </Text>
        </View>
      )}

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
            {hasValidationErrors ? "Dismiss" : "Try Again"}
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
  validationErrorsContainer: {
    backgroundColor: "rgba(255, 107, 107, 0.05)",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  errorSection: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#FF6B6B",
    marginBottom: 4,
    fontSize: 13,
  },
  validationError: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingLeft: 8,
  },
  validationErrorText: {
    color: "#FF6B6B",
    marginLeft: 4,
    fontSize: 13,
  },
  fieldName: {
    fontWeight: "bold",
  },
  divider: {
    backgroundColor: "rgba(255, 107, 107, 0.3)",
    marginVertical: 8,
  },
  validationHelp: {
    color: "#FF6B6B",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
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
