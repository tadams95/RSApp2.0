import { useState, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Alert,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CheckBox } from "@rneui/themed";

import { useDispatch, useSelector } from "react-redux";

import {
  setLocalId,
  setUserEmail,
  setUserName,
  selectUserName,
  setExpoPushToken,
  setStripeCustomerId,
} from "../../store/redux/userSlice";

import { getDatabase, ref as databaseRef, get } from "firebase/database";

import { usePushNotifications } from "../../notifications/PushNotifications";

import { loginUser } from "../../util/auth";

import LoadingOverlay from "../../ui/LoadingOverlay";
import ForgotPasswordModal from "./ForgotPasswordModal";

import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

export default function LoginScreen2({ navigation, setAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const userName = useSelector(selectUserName);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);

  const dispatch = useDispatch();

  const { registerForPushNotifications } = usePushNotifications();

  const forgotHandler = () => {
    setShowForgotPasswordModal(true);
  };

  const cancelHandler = () => {
    navigation.goBack();
  };

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("email");
        const savedPassword = await AsyncStorage.getItem("password");

        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Error loading saved login credentials:", error);
      }
    };

    loadSavedCredentials();
  }, []);

  useEffect(() => {
    // Validate form on input change
    validateForm();
  }, [email, password]);

  const validateForm = () => {
    const errors = {};

    // Email validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (email && !emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Basic password validation
    if (password && password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFormErrors(errors);

    // Check if form is valid overall
    const requiredFields = [email, password];
    const isValid =
      requiredFields.every((field) => field && field.trim().length > 0) &&
      Object.keys(errors).length === 0;
    setIsFormValid(isValid);
  };

  const loginHandler = async () => {
    // Get a reference to the database
    const db = getDatabase();

    if (rememberMe) {
      // Save the login credentials (email and password) securely
      try {
        await AsyncStorage.setItem("email", email);
        await AsyncStorage.setItem("password", password);
        await AsyncStorage.setItem("stayLoggedIn", JSON.stringify(true));
      } catch (error) {
        console.error("Error saving login credentials:", error);
      }
    } else {
      // Clear the saved login credentials if "Remember Me" is not selected
      try {
        await AsyncStorage.removeItem("email");
        await AsyncStorage.removeItem("password");
      } catch (error) {
        console.error("Error removing saved login credentials:", error);
      }
    }

    try {
      setIsAuthenticating(true);

      // Call loginUser function
      const userData = await loginUser(email, password);
      const localId = userData.uid;
      const userEmail = userData.email;
      dispatch(setLocalId(localId));
      dispatch(setUserEmail(userEmail));

      // Register for push notifications after successful login
      const token = await registerForPushNotifications();

      const userRef = databaseRef(db, `users/${localId}`);

      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            // Extract the user's name and profile picture URL from the snapshot data
            const userData = snapshot.val();
            const name = userData.firstName + " " + userData.lastName;

            // Dispatch the setUserName action with the fetched user name
            dispatch(setUserName(name));
          } else {
            // console.log("No data available");
          }
        })
        .catch((error) => {
          console.error("Error fetching user data:", error);
        });

      const stripeCustomerResponse = await fetch(`${API_URL}/create-customer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          name: userName,
          firebaseId: localId,
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

      dispatch(setExpoPushToken(token));

      // Reset form fields and loading state
      setEmail("");
      setPassword("");
      setAuthenticated(true);
      setIsAuthenticating(false);
    } catch (error) {
      console.error("Error during login:", error); // Log the error for debugging purposes

      let errorMessage = "An error occurred while logging in.";
      if (error.code === "auth/invalid-credential") {
        errorMessage =
          "Invalid email or password. Please check your credentials and try again.";
      }

      // Alert the user with the appropriate error message
      Alert.alert("Error", errorMessage);

      // Reset loading state
      setIsAuthenticating(false);
    }
  };

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
            onChangeText={(text) => setter(text)}
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

  if (showForgotPasswordModal) {
    return (
      <ForgotPasswordModal
        visible={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    );
  }

  if (isAuthenticating) {
    return <LoadingOverlay message="Logging you in..." />;
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
          <Text style={styles.headline}>Welcome back</Text>

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
            "Enter Password",
            true,
            "default",
            formErrors.password,
            true,
            showPassword,
            setShowPassword
          )}

          <View style={styles.rememberMeContainer}>
            <CheckBox
              title="Remember Me"
              checked={rememberMe}
              onPress={() => setRememberMe(!rememberMe)}
              iconType="material-community"
              checkedIcon="checkbox-marked"
              uncheckedIcon="checkbox-blank-outline"
              checkedColor="white"
              containerStyle={styles.checkBoxContainer}
              textStyle={styles.checkBoxText}
            />
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={cancelHandler}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.loginButton,
                !isFormValid && styles.disabledButton,
              ]}
              onPress={loginHandler}
              disabled={!isFormValid}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={forgotHandler}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
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
    marginTop: windowHeight * 0.1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    minHeight: "100%",
  },
  image: {
    height: 80,
    width: 120,
    resizeMode: "contain",
    marginBottom: 20,
    marginTop: windowHeight * 0.08,
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
  inputContainer: {
    marginBottom: 16,
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
  rememberMeContainer: {
    marginVertical: 10,
  },
  checkBoxContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  checkBoxText: {
    color: "white",
    fontSize: 14,
    fontWeight: "400",
    fontFamily,
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
  loginButton: {
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
  loginButtonText: {
    fontFamily,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  forgotPasswordButton: {
    alignSelf: "center",
    marginTop: 20,
    padding: 10,
  },
  forgotPasswordText: {
    color: "#aaa",
    fontSize: 14,
    fontFamily,
    textDecorationLine: "underline",
  },
});
