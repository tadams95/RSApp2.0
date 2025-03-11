import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { createUser, loginUser } from "../../util/auth";
import { usePushNotifications } from "../../notifications/PushNotifications";
import { useDispatch } from "react-redux";
import { setStripeCustomerId } from "../../store/redux/userSlice";
import LoadingOverlay from "../../ui/LoadingOverlay";

export default function CreateAccountScreen({ navigation, setAuthenticated }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const dispatch = useDispatch();
  const { registerForPushNotifications } = usePushNotifications();
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const API_URL =
    "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

  useEffect(() => {
    // Handle state updates here if needed
    validateForm();
  }, [firstName, lastName, email, phoneNumber, password, confirmPassword]);

  const validateForm = () => {
    const errors = {};

    // Email validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (email && !emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Password validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (password && !passwordRegex.test(password)) {
      errors.password =
        "Password must have 8+ chars with uppercase, lowercase, number, and special char";
    }

    // Confirm password validation
    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Phone validation (basic)
    const phoneRegex = /^\d{10,}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber.replace(/\D/g, ""))) {
      errors.phoneNumber = "Please enter a valid phone number";
    }

    setFormErrors(errors);

    // Check if form is valid overall
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
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
    navigation.goBack();
  }

  function validatePassword(password) {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(password)) {
      throw new Error(
        "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character."
      );
    }
  }

  function formatPhoneNumber(input) {
    const cleaned = input.replace(/\D/g, "");

    // Format: (XXX) XXX-XXXX
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
      // Perform email validation if needed
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Perform password validation if needed
      validatePassword(password);

      //Register for push notifications after successful credential validation
      const expoPushToken = await registerForPushNotifications();

      const createdUser = await createUser(
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        expoPushToken,
        dispatch
      );

      await loginUser(email, password);

      const stripeCustomerResponse = await fetch(`${API_URL}/create-customer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          name: `${firstName} ${lastName}`,
          firebaseId: createdUser.localId, // Assuming the createdUser object contains the localId
        }),
      });

      if (!stripeCustomerResponse.ok) {
        // Log response status and error message if available
        console.error(
          "Failed to create Stripe customer. Status:",
          stripeCustomerResponse.status
        );
        const errorMessage = await stripeCustomerResponse.text();
        console.error("Error Message:", errorMessage);
        throw new Error("Failed to create Stripe customer");
      }

      const stripeCustomerData = await stripeCustomerResponse.json();

      dispatch(setStripeCustomerId(stripeCustomerData));

      // Reset input fields after successful creation
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setConfirmPassword("");
      setIsAuthenticating(false);
      setAuthenticated(true);
    } catch (error) {
      // Handle errors
      if (error.response && error.response.data && error.response.data.error) {
        const errorMessage = error.response.data.error.message;

        if (errorMessage === "EMAIL_EXISTS") {
          Alert.alert(
            "Email already exists",
            "Please log in or use a different email."
          );
        } else {
          Alert.alert("Error creating user:", error.message);
        }
      } else {
        Alert.alert("Error creating user:", error.message);
      }
      setIsAuthenticating(false);
      // You might want to display an error message to the user
    }
  }

  const renderFormField = (
    label,
    value,
    setter,
    placeholder,
    secureTextEntry = false,
    keyboardType = "default",
    error = null,
    isPasswordField = false,
    showPasswordState = false,
    setShowPasswordState = null
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
          {isPasswordField && (
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
const windowHeight = Dimensions.get("window").height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    marginTop: windowHeight * 0.08,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  image: {
    height: 80,
    width: 120,
    resizeMode: "contain",
    marginBottom: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  headline: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "white",
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputContainer: {
    flex: 1,
    marginBottom: 16,
    paddingHorizontal: 5,
  },
  label: {
    fontFamily,
    color: "white",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
  input: {
    flex: 1,
    color: "white",
    padding: 12,
    fontSize: 16,
    fontFamily,
  },
  inputError: {
    borderColor: "#ff5252",
    borderWidth: 1,
  },
  errorText: {
    color: "#ff5252",
    fontSize: 12,
    marginTop: 4,
    fontFamily,
  },
  eyeIcon: {
    padding: 10,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: "#555",
  },
  createButton: {
    backgroundColor: "#222",
    borderColor: "#fff",
  },
  disabledButton: {
    borderColor: "#555",
    opacity: 0.5,
  },
  cancelButtonText: {
    fontFamily,
    color: "#ddd",
    fontWeight: "600",
    fontSize: 16,
  },
  createButtonText: {
    fontFamily,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  termsText: {
    fontFamily,
    color: "#777",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
