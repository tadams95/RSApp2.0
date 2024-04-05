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
} from "react-native";

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

  const API_URL =
    "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

  useEffect(() => {
    // Handle state updates here if needed
  }, [firstName, lastName, email, phoneNumber]);

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
        const errorCode = error.response.data.error.code;
        if (errorCode === "EMAIL_EXISTS") {
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

  if (isAuthenticating) {
    return <LoadingOverlay message="Creating Account..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.container}>
        <ScrollView style={{ flex: 1 }}>
          <Text style={styles.headline}>Create your account below</Text>

          <View style={styles.editProfileContainer}>
            <Text style={styles.subtitle}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <Text style={styles.subtitle}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
            />
            <Text style={styles.subtitle}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              autoCapitalize="none"
              secureTextEntry={false}
              onChangeText={setPhoneNumber}
              value={phoneNumber}
              inputMode="numeric"
            />
            <Text style={styles.subtitle}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              secureTextEntry={false}
              onChangeText={setEmail}
              value={email}
            />
            <Text style={styles.subtitle}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              autoCapitalize="none"
              secureTextEntry={true}
              onChangeText={setPassword}
              value={password}
            />
            <Text style={styles.subtitle}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              autoCapitalize="none"
              secureTextEntry={true}
              onChangeText={setConfirmPassword}
              value={confirmPassword}
            />
          </View>

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <Pressable onPress={cancelCreateHandler} style={styles.tabButton}>
              <Text style={styles.secondaryText}>CANCEL</Text>
            </Pressable>

            <Pressable onPress={confirmCreateHandler} style={styles.tabButton}>
              <Text style={styles.secondaryText}>CREATE</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Dimensions.get("window").height * 0.07,
    backgroundColor: "#000",
    alignItems: "center",
  },
  headline: {
    // fontFamily: "ProximaNovaBlack",
    paddingTop: 10,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
  },
  subtitle: {
    // fontFamily: "ProximaNovaBlack",
    paddingBottom: 5,
    fontSize: 18,
    color: "white",
  },
  input: {
    backgroundColor: "#F6F6F6",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    // fontFamily: "ProximaNovaBold",
    width: Dimensions.get("window").width * 0.9,
    fontSize: 18,
  },
  editProfileContainer: {
    paddingTop: 10,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 10,
  },
  tabButton: {
    backgroundColor: "black",
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "30%",
  },
  secondaryText: {
    // fontFamily: "ProximaNovaBlack",
    textAlign: "center",
    color: "white",
  },
});
