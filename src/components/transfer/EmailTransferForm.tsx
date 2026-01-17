import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

// ============================================
// Types
// ============================================

export interface EmailTransferFormProps {
  /** Ticket ID being transferred */
  ticketId: string;
  /** Event ID for the ticket */
  eventId: string;
  /** Event name for display */
  eventName: string;
  /** Callback when email is submitted for transfer */
  onSubmit: (email: string) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Hide internal header when parent component provides one */
  hideHeader?: boolean;
  /** Whether the form is in a loading/submitting state */
  isLoading?: boolean;
}

// ============================================
// Constants
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================
// Email Validation Utility
// ============================================

/**
 * Validate email format
 * @param email - The email string to validate
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ============================================
// EmailTransferForm Component
// ============================================

export default function EmailTransferForm({
  ticketId,
  eventId,
  eventName,
  onSubmit,
  onCancel,
  hideHeader = false,
  isLoading = false,
}: EmailTransferFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Validate email and set error state
   */
  const validateEmail = (value: string): boolean => {
    const trimmedEmail = value.trim();

    if (!trimmedEmail) {
      setError("Email address is required");
      return false;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Handle email input change with real-time validation
   */
  const handleEmailChange = (text: string) => {
    setEmail(text);

    // Only validate after user has interacted
    if (isTouched) {
      validateEmail(text);
    }
  };

  /**
   * Handle input blur - trigger validation
   */
  const handleBlur = () => {
    setIsTouched(true);
    if (email.trim()) {
      validateEmail(email);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    setIsTouched(true);
    Keyboard.dismiss();

    if (!validateEmail(email)) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Track analytics
    posthog?.capture("transfer_email_submitted", {
      event_id: eventId,
      ticket_id: ticketId,
      method: "email",
    });

    onSubmit(trimmedEmail);
  };

  /**
   * Handle clear input
   */
  const handleClear = () => {
    setEmail("");
    setError(null);
    setIsTouched(false);
    inputRef.current?.focus();
  };

  const isValid = email.trim().length > 0 && isValidEmail(email);
  const showError = isTouched && error;

  return (
    <View style={styles.container}>
      {/* Header - hidden when parent provides one */}
      {!hideHeader && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Transfer by Email</Text>
          <View style={styles.backButton} />
        </View>
      )}

      {/* Info Notice */}
      <View style={styles.infoContainer}>
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={theme.colors.accent}
        />
        <Text style={styles.infoText}>
          The recipient will receive an email with a link to claim the ticket.
        </Text>
      </View>

      {/* Email Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Recipient's Email</Text>
        <View
          style={[styles.inputWrapper, showError && styles.inputWrapperError]}
        >
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color={showError ? theme.colors.danger : theme.colors.textTertiary}
            style={styles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleBlur}
            placeholder="email@example.com"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            editable={!isLoading}
          />
          {email.length > 0 && !isLoading && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear email"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.colors.textTertiary}
              />
            </TouchableOpacity>
          )}
          {isLoading && (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={styles.loadingIndicator}
            />
          )}
        </View>

        {/* Error Message */}
        {showError && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={theme.colors.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Valid Indicator */}
        {isValid && !showError && isTouched && (
          <View style={styles.validContainer}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={14}
              color={theme.colors.success}
            />
            <Text style={styles.validText}>Valid email format</Text>
          </View>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!isValid || isLoading) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!isValid || isLoading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Send transfer"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <MaterialCommunityIcons name="send" size={18} color="#fff" />
            <Text style={styles.submitButtonText}>Send Transfer</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        disabled={isLoading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Cancel transfer"
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (theme: Theme) => ({
  container: {
    width: "100%" as const,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 16,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
  },
  infoContainer: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: theme.colors.accentMuted,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.accent,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputWrapperError: {
    borderColor: theme.colors.danger,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 14,
  },
  clearButton: {
    padding: 4,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 6,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
  },
  validContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 6,
    gap: 4,
  },
  validText: {
    fontSize: 12,
    color: theme.colors.success,
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#fff",
  },
  cancelButton: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: theme.colors.textPrimary,
  },
});
