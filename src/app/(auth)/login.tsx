import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";

import { usePostHog, useScreenTracking } from "../../analytics/PostHogProvider";
import LoadingOverlay from "../../components/LoadingOverlay";
import LoginErrorNotice from "../../components/LoginErrorNotice";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../hooks/AuthContext";
import { useLoginErrorHandler } from "../../hooks/useLoginErrorHandler";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { loginUser } from "../../utils/auth";
import { extractFirebaseErrorCode } from "../../utils/firebaseErrorHandler";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuthenticated } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const { track } = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Track screen view
  useScreenTracking("Login Screen", {
    screen_category: "auth",
  });

  // Use the login error handler
  const {
    error: loginError,
    failedAttempts,
    recoveryAction,
    handleLoginError,
    clearErrors,
    resetFailedAttempts,
  } = useLoginErrorHandler();

  async function loginHandler() {
    setIsLoading(true);
    clearErrors();

    // Track login attempt
    await track("login_attempt", {
      method: "email_password",
      stay_logged_in: stayLoggedIn,
    });

    try {
      if (!email || !password) {
        await track("login_failed", {
          error_type: "validation",
          error_message: "Missing email or password",
        });
        handleLoginError(new Error("Please provide both email and password."));
        setIsLoading(false);
        return;
      }

      await loginUser(email.trim(), password, dispatch);

      // Save login preferences if "Stay logged in" is selected
      if (stayLoggedIn) {
        await Promise.all([
          AsyncStorage.setItem("stayLoggedIn", JSON.stringify(stayLoggedIn)),
          AsyncStorage.setItem("email", email.trim()),
          AsyncStorage.setItem("password", password),
        ]);
      } else {
        // Clear any previous storage if not staying logged in
        await Promise.all([
          AsyncStorage.removeItem("stayLoggedIn"),
          AsyncStorage.removeItem("email"),
          AsyncStorage.removeItem("password"),
        ]);
      }

      // Reset failed attempts counter on successful login
      resetFailedAttempts();

      // Track successful login
      await track("login_successful", {
        method: "email_password",
        stay_logged_in: stayLoggedIn,
        email_domain: email.split("@")[1] || "unknown",
        failed_attempts_before_success: failedAttempts,
      });

      setAuthenticated(true);
      router.replace("/(app)/home");
    } catch (error: any) {
      // Extract Firebase error code for detailed tracking
      const errorCode = extractFirebaseErrorCode(error);

      // Track failed login with detailed error information
      await track("login_failed", {
        error_type: "firebase_auth",
        error_code: errorCode,
        error_message: error.message || "Unknown error",
        email_domain: email.split("@")[1] || "unknown",
        failed_attempts: failedAttempts + 1,
        stay_logged_in_attempted: stayLoggedIn,
      });

      handleLoginError(error);
    } finally {
      setIsLoading(false);
    }
  }

  // Google Sign-In handler
  async function handleGoogleSignIn() {
    setIsLoading(true);
    clearErrors();

    await track("login_attempt", {
      method: "google",
    });

    try {
      // Dynamic import to avoid crashing in Expo Go
      const { signInWithGoogle } = await import(
        "../../services/googleAuthService"
      );
      const { userCredential, isNewUser } = await signInWithGoogle();

      await track("login_successful", {
        method: "google",
        is_new_user: isNewUser,
        email_domain: userCredential.user.email?.split("@")[1] || "unknown",
      });

      // Redirect new users to complete their profile
      if (isNewUser) {
        router.replace({
          pathname: "/(auth)/complete-profile",
          params: {
            firstName: userCredential.user.displayName?.split(" ")[0] || "",
            lastName:
              userCredential.user.displayName?.split(" ").slice(1).join(" ") ||
              "",
          },
        });
      } else {
        setAuthenticated(true);
        router.replace("/(app)/home");
      }
    } catch (error: any) {
      // Check if Google Sign-In is not available (running in Expo Go)
      if (
        error.message?.includes("RNGoogleSignin") ||
        error.message?.includes("native binary") ||
        error.message?.includes("not available")
      ) {
        Alert.alert(
          "Google Sign-In Not Available",
          "Google Sign-In requires a development build. Please use email/password login, or run the app with 'npx expo run:android' or 'npx expo run:ios'.",
          [{ text: "OK" }]
        );
        setIsLoading(false);
        return;
      }

      // Don't show error for user cancellation
      if (
        error.message?.includes("cancelled") ||
        error.message?.includes("canceled")
      ) {
        await track("login_cancelled", {
          method: "google",
        });
        setIsLoading(false);
        return;
      }

      await track("login_failed", {
        error_type: "google_auth",
        error_message: error.message || "Unknown error",
      });

      handleLoginError(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingOverlay message="Logging in..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>LOG IN</Text>

          <View style={styles.formContainer}>
            {loginError && (
              <LoginErrorNotice
                message={loginError}
                onRetry={clearErrors}
                secondaryAction={recoveryAction || undefined}
                attempts={failedAttempts}
                style={styles.errorContainer}
              />
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={theme.colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={() => setStayLoggedIn(!stayLoggedIn)}
              style={styles.checkboxContainer}
            >
              <View
                style={[
                  styles.checkbox,
                  stayLoggedIn && styles.checkboxChecked,
                ]}
              >
                {stayLoggedIn && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Stay logged in</Text>
            </TouchableOpacity>

            <Link href="/(auth)/forgot" style={styles.forgotPassword}>
              Forgot Password?
            </Link>

            <Pressable style={styles.button} onPress={loginHandler}>
              <Text style={styles.buttonText}>LOG IN</Text>
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
              <Image
                source={{
                  uri: "https://developers.google.com/identity/images/g-logo.png",
                }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup" style={styles.signupLink}>
              Sign Up
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const MAX_FORM_WIDTH = 400;

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "center" as const,
  },
  contentContainer: {
    alignSelf: "center" as const,
    width: width > MAX_FORM_WIDTH ? MAX_FORM_WIDTH : width * 0.9,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: theme.colors.textPrimary,
    marginBottom: 32,
    textAlign: "center" as const,
    letterSpacing: 1,
  },
  formContainer: {
    width: "100%" as const,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 12,
    padding: 24,
    ...theme.shadows.card,
  },
  inputContainer: {
    marginBottom: 22,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  checkboxContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    marginRight: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkmark: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  checkboxLabel: {
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    marginBottom: 16,
    width: "100%" as const,
    fontSize: 16,
  },
  forgotPassword: {
    color: theme.colors.accent,
    textAlign: "right" as const,
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center" as const,
    marginBottom: 16,
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold" as const,
    letterSpacing: 1,
  },
  dividerContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
  },
  dividerText: {
    color: theme.colors.textTertiary,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center" as const,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  footer: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    marginTop: 24,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  signupLink: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "bold" as const,
  },
});
