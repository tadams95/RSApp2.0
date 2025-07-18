import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { createUser, loginUser, updateUserStripeId } from "../../utils/auth";
import {
  extractFirebaseErrorCode,
  getSignupErrorMessage,
  getSignupFieldError,
} from "../../utils/firebaseErrorHandler";

// import { usePushNotifications } from "../../../../notifications/PushNotifications";
import { useDispatch } from "react-redux";
// Updated import path for userSlice
import { usePostHog, useScreenTracking } from "../../analytics/PostHogProvider";
import LoadingOverlay from "../../components/LoadingOverlay";
import SignupErrorNotice from "../../components/SignupErrorNotice";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { setStripeCustomerId } from "../../store/redux/userSlice";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const dispatch = useDispatch();
  const { track } = usePostHog();

  // Track screen view
  useScreenTracking("Signup Screen", {
    screen_category: "auth",
  });
  // const { registerForPushNotifications } = usePushNotifications(); // TODO: Re-enable when notifications are set up
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [recoveryAction, setRecoveryAction] = useState<{
    text: string;
    onPress: () => void;
  } | null>(null);
  const { getErrorMessage } = useErrorHandler();
  const router = useRouter();

  const API_URL =
    "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment"; // TODO: Move to a config file

  useEffect(() => {
    validateForm();
  }, [firstName, lastName, email, phoneNumber, password, confirmPassword]);

  const validateForm = () => {
    const errors: FormErrors = {};

    // Clear signup error when form is being validated
    setSignupError(null);

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (email && !emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Enhanced password validation with specific guidance
    if (password) {
      const passwordChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[@$!%*?&#]/.test(password),
      };

      if (!Object.values(passwordChecks).every(Boolean)) {
        let message = "Password must have:";
        if (!passwordChecks.length) message += "\n• At least 8 characters";
        if (!passwordChecks.uppercase)
          message += "\n• At least 1 uppercase letter";
        if (!passwordChecks.lowercase)
          message += "\n• At least 1 lowercase letter";
        if (!passwordChecks.number) message += "\n• At least 1 number";
        if (!passwordChecks.special)
          message += "\n• At least 1 special character (@$!%*?&#)";

        errors.password = message;
      }
    }

    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    const phoneRegex = /^\d{10,}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber.replace(/\D/g, ""))) {
      errors.phoneNumber = "Please enter a valid phone number";
    }

    setFormErrors(errors);

    const requiredFields = [
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      confirmPassword,
    ];
    const isValid =
      requiredFields.every((field) => field && field.trim().length > 0) &&
      Object.keys(errors).length === 0;
    setIsFormValid(isValid);
  };

  function cancelCreateHandler() {
    router.back();
  }

  function validatePassword(passwordToValidate: string) {
    const passwordChecks = {
      length: passwordToValidate.length >= 8,
      uppercase: /[A-Z]/.test(passwordToValidate),
      lowercase: /[a-z]/.test(passwordToValidate),
      number: /[0-9]/.test(passwordToValidate),
      special: /[@$!%*?&#]/.test(passwordToValidate),
    };

    if (!Object.values(passwordChecks).every(Boolean)) {
      let message = "Password requirements not met:";
      if (!passwordChecks.length) message += "\n- At least 8 characters";
      if (!passwordChecks.uppercase)
        message += "\n- At least 1 uppercase letter";
      if (!passwordChecks.lowercase)
        message += "\n- At least 1 lowercase letter";
      if (!passwordChecks.number) message += "\n- At least 1 number";
      if (!passwordChecks.special)
        message += "\n- At least 1 special character (@$!%*?&#)";

      throw new Error(message);
    }
  }

  function formatPhoneNumber(input: string) {
    const cleaned = input.replace(/\D/g, "");

    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6,
        10
      )}`;
    }
  }

  async function confirmCreateHandler() {
    try {
      setIsAuthenticating(true);
      setSignupError(null);
      setRecoveryAction(null);

      // Track signup attempt
      await track("sign_up_attempt", {
        method: "email_password",
        has_phone_number: !!phoneNumber,
        email_domain: email.split("@")[1] || "unknown",
      });

      // Form validation
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        await track("sign_up_failed", {
          error_type: "validation",
          error_code: "invalid_email",
          error_message: "Invalid email format",
        });
        throw new Error("Please enter a valid email address");
      }

      try {
        validatePassword(password);
      } catch (passwordError: any) {
        await track("sign_up_failed", {
          error_type: "validation",
          error_code: "weak_password",
          error_message: passwordError.message,
        });
        setFormErrors((prev) => ({
          ...prev,
          password: passwordError.message,
        }));
        throw new Error("Please correct password issues before continuing");
      }

      // const expoPushToken = await registerForPushNotifications(); // TODO: Re-enable
      // const expoPushToken = null; // Placeholder

      const createdUser = await createUser(
        email,
        password,
        firstName,
        lastName,
        phoneNumber
        // expoPushToken
      );

      // Track successful user account creation
      await track("sign_up_success", {
        method: "email_password",
        user_id: createdUser.userData.userId,
        email_domain: email.split("@")[1] || "unknown",
        has_phone_number: !!phoneNumber,
        signup_date: new Date().toISOString(),
      });

      // Handle Stripe customer creation
      let stripeCustomerCreated = false;
      try {
        const stripeCustomerResponse = await fetch(
          `${API_URL}/create-customer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: email,
              name: `${firstName} ${lastName}`,
              firebaseId: createdUser.userData.userId,
            }),
          }
        );

        if (!stripeCustomerResponse.ok) {
          const errorMessage = await stripeCustomerResponse.text();
          console.warn(`Stripe customer creation issue: ${errorMessage}`);
          await track("stripe_customer_creation_failed", {
            user_id: createdUser.userData.userId,
            error_message: errorMessage,
            signup_context: true,
          });
          // Continue with user creation even if Stripe has issues
        } else {
          const stripeCustomerData = await stripeCustomerResponse.json();
          await updateUserStripeId(
            createdUser.userData.userId,
            stripeCustomerData.customerId
          );
          dispatch(setStripeCustomerId(stripeCustomerData.customerId));
          stripeCustomerCreated = true;
          await track("stripe_customer_created", {
            user_id: createdUser.userData.userId,
            customer_id: stripeCustomerData.customerId,
            signup_context: true,
          });
        }
      } catch (stripeError) {
        // Log the stripe error but continue with account creation
        console.error("Stripe customer creation failed:", stripeError);
        await track("stripe_customer_creation_error", {
          user_id: createdUser.userData.userId,
          error_message:
            stripeError instanceof Error
              ? stripeError.message
              : "Unknown Stripe error",
          signup_context: true,
        });
        // We'll set up the Stripe customer later
      }

      await loginUser(email, password); // This should ideally set the auth state for the router

      // Track successful signup flow completion
      await track("sign_up_completed", {
        user_id: createdUser.userData.userId,
        stripe_customer_created: stripeCustomerCreated,
        auto_login_successful: true,
      });

      // Navigate to app or home screen after successful signup and login
      router.replace("/(app)/home"); // Or your desired route
    } catch (error: any) {
      setIsAuthenticating(false);

      // Extract and handle Firebase error code
      const errorCode = extractFirebaseErrorCode(error);

      // Track signup failure with detailed error information
      await track("sign_up_failed", {
        error_type: "firebase_auth",
        error_code: errorCode,
        error_message: error.message,
        email_domain: email.split("@")[1] || "unknown",
        has_phone_number: !!phoneNumber,
      });

      // Get user-friendly error message using our handler
      const errorMessage = getSignupErrorMessage(error);
      setSignupError(errorMessage);

      // Update specific field errors if applicable
      const fieldError = getSignupFieldError(error);
      if (fieldError.field !== "general") {
        setFormErrors((prev) => ({
          ...prev,
          [fieldError.field]: fieldError.message,
        }));
      }

      // Set appropriate recovery action based on error code
      if (errorCode === "auth/email-already-in-use") {
        setRecoveryAction({
          text: "Go to Login",
          onPress: () => router.push("/(auth)/login"),
        });
      } else if (errorCode === "auth/network-request-failed") {
        setRecoveryAction({
          text: "Check Connection",
          onPress: () =>
            setSignupError(
              "Please check your internet connection and try again"
            ),
        });
      } else if (errorCode === "auth/too-many-requests") {
        setRecoveryAction({
          text: "Reset Password",
          onPress: () => router.push("/(auth)/forgotPassword"),
        });
      } else if (errorCode === "auth/weak-password") {
        setRecoveryAction({
          text: "Password Tips",
          onPress: () =>
            Alert.alert(
              "Creating a Strong Password",
              "• Use at least 8 characters\n• Include uppercase and lowercase letters\n• Add numbers and special characters\n• Avoid using common words or personal info",
              [{ text: "OK", style: "default" }]
            ),
        });
      }

      // Log the error for debugging
      console.error("Signup error:", {
        originalError: error,
        errorCode: errorCode,
        userMessage: errorMessage,
      });

      // For specific critical errors, show an alert
      if (errorCode === "auth/account-exists-with-different-credential") {
        Alert.alert(
          "Account Already Exists",
          "An account with this email exists using a different sign-in method. Please try signing in with another method.",
          [
            {
              text: "Go to Login",
              onPress: () => router.push("/(auth)/login"),
            },
            {
              text: "OK",
              style: "cancel",
            },
          ]
        );
      }
    }
  }

  const renderFormField = (
    label: string,
    value: string,
    setter: (text: string) => void,
    placeholder: string,
    secureTextEntry = false,
    keyboardType: any = "default",
    error: string | null = null,
    isPasswordField = false,
    showPasswordState = false,
    setShowPasswordState: ((value: boolean) => void) | null = null
  ) => {
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputWrapper, error && styles.inputError]}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={value}
            onChangeText={(text) => {
              if (keyboardType === "phone-pad") {
                setter(formatPhoneNumber(text));
              } else {
                setter(text);
              }
            }}
            secureTextEntry={secureTextEntry && !showPasswordState}
            keyboardType={keyboardType}
            autoCapitalize={
              keyboardType === "email-address" || secureTextEntry
                ? "none"
                : "words"
            }
          />
          {isPasswordField && setShowPasswordState && (
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPasswordState(!showPasswordState)}
            >
              <Ionicons
                name={showPasswordState ? "eye-off-outline" : "eye-outline"}
                size={24}
                color="#888"
              />
            </TouchableOpacity>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  };

  if (isAuthenticating) {
    return <LoadingOverlay message="Creating Account..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          style={styles.image}
          source={require("../../assets/RSLogo2025.png")}
        />

        <View style={styles.formContainer}>
          <Text style={styles.headline}>Create your account</Text>

          {signupError && (
            <SignupErrorNotice
              message={signupError}
              onRetry={() => setSignupError(null)}
              secondaryAction={recoveryAction || undefined}
              style={styles.errorContainer}
            />
          )}

          <View style={styles.nameRow}>
            {renderFormField(
              "First Name",
              firstName,
              setFirstName,
              "First Name",
              false,
              "default",
              formErrors.firstName
            )}

            {renderFormField(
              "Last Name",
              lastName,
              setLastName,
              "Last Name",
              false,
              "default",
              formErrors.lastName
            )}
          </View>

          {renderFormField(
            "Phone Number",
            phoneNumber,
            setPhoneNumber,
            "(555) 555-5555",
            false,
            "phone-pad",
            formErrors.phoneNumber
          )}

          {renderFormField(
            "Email",
            email,
            setEmail,
            "your.email@example.com",
            false,
            "email-address",
            formErrors.email
          )}

          {renderFormField(
            "Password",
            password,
            setPassword,
            "Create Password",
            true,
            "default",
            formErrors.password,
            true,
            showPassword,
            setShowPassword
          )}

          {renderFormField(
            "Confirm Password",
            confirmPassword,
            setConfirmPassword,
            "Confirm Password",
            true,
            "default",
            formErrors.confirmPassword,
            true,
            showConfirmPassword,
            setShowConfirmPassword
          )}

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={cancelCreateHandler}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.createButton,
                !isFormValid && styles.disabledButton,
              ]}
              onPress={confirmCreateHandler}
              disabled={!isFormValid}
            >
              <Text style={styles.createButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.termsText}>
            By creating an account, you agree to our Terms of Service and
            Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const windowWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Assuming a dark theme
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorContainer: {
    marginBottom: 16,
    width: "100%",
  },
  image: {
    width: windowWidth * 0.5,
    height: windowWidth * 0.5 * (200 / 600), // Adjust aspect ratio based on actual image
    resizeMode: "contain",
    marginBottom: 30,
    marginTop: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#121212", // Slightly lighter than background
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  headline: {
    fontFamily,
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10, // Add gap between name fields
  },
  inputContainer: {
    marginBottom: 15,
    flex: 1, // Ensure name fields take equal width
  },
  label: {
    fontFamily,
    color: "white",
    marginBottom: 5,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#444",
  },
  input: {
    flex: 1,
    color: "white",
    padding: 10,
    fontSize: 16,
    fontFamily,
  },
  inputError: {
    borderColor: "red",
  },
  eyeIcon: {
    padding: 10,
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 5,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#333",
  },
  cancelButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  createButton: {
    backgroundColor: "#fff", // Or your primary color
  },
  createButtonText: {
    fontFamily,
    color: "#000", // Or your primary text color
    fontWeight: "bold",
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#555",
  },
  termsText: {
    fontFamily,
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
