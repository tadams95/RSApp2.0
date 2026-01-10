import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// TODO: Update this path when auth utilities are moved to src
import { usePostHog, useScreenTracking } from "../../analytics/PostHogProvider";
import LoadingOverlay from "../../components/LoadingOverlay";
import PasswordResetErrorNotice from "../../components/PasswordResetErrorNotice";
import { useTheme } from "../../contexts/ThemeContext";
import { usePasswordResetErrorHandler } from "../../hooks/usePasswordResetErrorHandler";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { forgotPassword } from "../../utils/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { track } = usePostHog();

  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Track screen view
  useScreenTracking("Forgot Password Screen", {
    screen_category: "auth",
  });

  // Use the password reset error handler
  const {
    error: resetError,
    hasAttempted,
    handleResetError,
    handleSuccess,
    clearError,
  } = usePasswordResetErrorHandler();

  function cancelReset() {
    router.back();
  }

  async function confirmReset() {
    // Clear any existing errors
    clearError();
    setFormError("");

    // Basic form validation
    if (!email) {
      setFormError("Please enter your email address");
      await track("password_reset_failed", {
        error_type: "validation",
        error_code: "missing_email",
        error_message: "Email address required",
      });
      return;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid email address");
      await track("password_reset_failed", {
        error_type: "validation",
        error_code: "invalid_email",
        error_message: "Invalid email format",
      });
      return;
    }

    // Track password reset attempt
    await track("password_reset_requested", {
      email_domain: email.split("@")[1] || "unknown",
    });

    setIsLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        handleSuccess();
        // Track successful password reset request
        await track("password_reset_success", {
          email_domain: email.split("@")[1] || "unknown",
        });
        // For security, we always show the same message whether the account exists or not
        Alert.alert(
          "Password Reset",
          "If an account exists for this email, you will receive reset instructions shortly."
        );
        router.back();
      } else {
        // Track unsuccessful password reset attempt
        await track("password_reset_failed", {
          error_type: "service",
          error_code: "reset_service_error",
          error_message: result.message || "Request could not be completed",
          email_domain: email.split("@")[1] || "unknown",
        });
        // Handle unsuccessful attempt but don't disclose specific details
        handleResetError(
          new Error(result.message || "Request could not be completed")
        );
      }
    } catch (error: any) {
      // Track password reset error
      await track("password_reset_failed", {
        error_type: "firebase_auth",
        error_code: error.code || "unknown_error",
        error_message: error.message,
        email_domain: email.split("@")[1] || "unknown",
      });
      // Handle specific errors with user-friendly messages
      handleResetError(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingOverlay message="Sending reset instructions..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.modalContent}>
        <Text style={styles.headline}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you instructions to reset your
          password.
        </Text>

        {resetError && (
          <PasswordResetErrorNotice
            message={resetError}
            onRetry={clearError}
            style={styles.errorContainer}
          />
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrapper, !!formError && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(text) => {
                setEmail(text);
                setFormError("");
              }}
              value={email}
            />
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={cancelReset}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={confirmReset}
          >
            <Text style={styles.confirmButtonText}>Reset Password</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgRoot,
    padding: 20,
  },
  errorContainer: {
    marginBottom: 16,
    width: "100%" as const,
  },
  modalContent: {
    backgroundColor: theme.colors.bgRoot,
    padding: 24,
    borderRadius: 12,
    width: "100%" as const,
    maxWidth: 500,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  headline: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: "center" as const,
  },
  subtitle: {
    fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontFamily,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "500" as const,
  },
  inputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: "hidden" as const,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    padding: 12,
    fontSize: 16,
    fontFamily,
  },
  inputError: {
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    fontFamily,
  },
  actionContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: theme.colors.borderStrong,
  },
  confirmButton: {
    backgroundColor: theme.colors.bgElev2,
    borderColor: theme.colors.textPrimary,
  },
  cancelButtonText: {
    fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: "600" as const,
    fontSize: 16,
  },
  confirmButtonText: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontWeight: "600" as const,
    fontSize: 16,
  },
});
