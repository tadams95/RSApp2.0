import { useState } from "react";
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
} from "react-native";

import { getDatabase, ref as databaseRef, get } from "firebase/database";

import { loginUser } from "../../util/auth";

export default function LoginScreen2({ setAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const forgotHandler = () => {
    setShowForgotPasswordModal(true);
  };
  const cancelHandler = () => {
    navigation.goBack();
  };

  const loginHandler = async () => {
    // Get a reference to the database
    const db = getDatabase();

    setIsAuthenticating(true);

    // Call loginUser function
    const userData = await loginUser(email, password);

    // console.log(userData);
    setAuthenticated(true);
  };

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    marginTop: Dimensions.get("window").height * 0.07,
  },
  headline: {
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: Dimensions.get("window").height * 0.03,
    fontSize: 20,
    marginBottom: 20,
    color: "white",
  },
  subtitle: {
    paddingBottom: 5,
    fontSize: 18,
    color: "white",
  },
  input: {
    backgroundColor: "#F6F6F6",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    width: Dimensions.get("window").width * 0.9,
    fontSize: 18,
  },
  loginContainer: {
    paddingTop: 10,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 25,
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
  },
  image: {
    height: 100,
    width: 100,
    alignSelf: "center",
    marginVertical: Dimensions.get("window").height * 0.05,
  },
});
