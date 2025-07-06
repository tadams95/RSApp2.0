import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
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
import { GlobalStyles } from "../../constants/styles";
import { useAuth } from "../../hooks/AuthContext";
import { useLoginErrorHandler } from "../../hooks/useLoginErrorHandler";
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
                placeholderTextColor="#666"
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
                placeholderTextColor="#666"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "center",
  },
  contentContainer: {
    alignSelf: "center",
    width: width > MAX_FORM_WIDTH ? MAX_FORM_WIDTH : width * 0.9,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 32,
    textAlign: "center",
    letterSpacing: 1,
  },
  formContainer: {
    width: "100%",
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 22,
  },
  label: {
    color: GlobalStyles.colors.grey3,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#444",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: GlobalStyles.colors.red7,
    borderColor: GlobalStyles.colors.red7,
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
  },
  checkboxLabel: {
    color: "#888",
  },
  errorContainer: {
    marginBottom: 16,
    width: "100%",
    fontSize: 16,
  },
  forgotPassword: {
    color: GlobalStyles.colors.red7,
    textAlign: "right",
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: GlobalStyles.colors.red7,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#888",
    fontSize: 16,
  },
  signupLink: {
    color: GlobalStyles.colors.red7,
    fontSize: 16,
    fontWeight: "bold",
  },
});
