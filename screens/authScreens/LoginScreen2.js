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
} from "react-native";

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

  const loginHandler = async () => {
    // Get a reference to the database
    const db = getDatabase();

    if (rememberMe) {
      // Save the login credentials (email and password) securely
      try {
        await AsyncStorage.setItem("email", email);
        await AsyncStorage.setItem("password", password);
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
    <KeyboardAvoidingView style={styles.container}>
      <View style={styles.container}>
        <Image
          style={styles.image}
          source={require("../../assets/RSLogoRounded.png")}
        />
        <ScrollView style={{ flex: 1 }}>
          <Text style={styles.headline}>Welcome back, login below</Text>

          <View style={styles.loginContainer}>
            <Text style={styles.subtitle}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              secureTextEntry={false}
              onChangeText={(text) => setEmail(text)}
              value={email}
            />
            <Text style={styles.subtitle}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              autoCapitalize="none"
              secureTextEntry={true}
              onChangeText={(text) => setPassword(text)}
              value={password}
            />
          </View>

          <CheckBox
            title="Remember Me"
            fontFamily={fontFamily}
            checked={rememberMe}
            center
            iconType="material-community"
            checkedIcon="checkbox-marked"
            uncheckedIcon="checkbox-blank-outline"
            checkedColor="white" // Adjusted color to match the theme
            containerStyle={styles.checkBoxContainer} // Added containerStyle prop
            textStyle={styles.checkBoxText} // Added textStyle prop
            onPress={() => setRememberMe(!rememberMe)}
          />

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <Pressable onPress={cancelHandler} style={styles.tabButton}>
              <Text style={styles.buttonText}>CANCEL</Text>
            </Pressable>

            <Pressable onPress={loginHandler} style={styles.tabButton}>
              <Text style={styles.buttonText}>LOGIN</Text>
            </Pressable>
          </View>
          <View style={styles.tabContainer}>
            <Pressable onPress={forgotHandler} style={styles.tabButton2}>
              <Text style={styles.buttonText}>FORGOT PASSWORD</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    marginTop: Dimensions.get("window").height * 0.07,
  },
  headline: {
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: Dimensions.get("window").height * 0.03,
    fontSize: 20,
    marginBottom: 20,
    color: "white",
    fontFamily,
  },
  subtitle: {
    paddingBottom: 5,
    fontSize: 18,
    color: "white",
    fontFamily,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#F6F6F6",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    width: Dimensions.get("window").width * 0.9,
    fontSize: 18,
    fontFamily,
    fontWeight: "500",
  },
  loginContainer: {
    paddingTop: 10,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 15,
  },
  tabButton: {
    backgroundColor: "#000",
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "30%",
  },
  tabContainer2: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  tabButton2: {
    backgroundColor: "#000",
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "50%",
  },
  buttonText: {
    textAlign: "center",
    color: "white",
    fontFamily,
    fontWeight: "500",
  },
  image: {
    height: 100,
    width: 100,
    alignSelf: "center",
    marginVertical: Dimensions.get("window").height * 0.05,
  },
  checkBoxContainer: {
    backgroundColor: "transparent", // Set background to transparent
    borderWidth: 0, // Remove border
    paddingHorizontal: 0, // Adjust horizontal padding
    marginVertical: 10, // Adjust vertical margin
  },
  checkBoxText: {
    color: "white", // Adjust text color to match the theme
    marginLeft: 10, // Adjust left margin to add space between the checkbox and text
  },
});
