import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useAuth } from "../../hooks/AuthContext";
import { loginUser } from "../../utils/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setAuthenticated } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();

  async function loginHandler() {
    setIsLoading(true);
    try {
      if (!email || !password) {
        Alert.alert("Invalid input", "Please provide both email and password.");
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

      setAuthenticated(true);
      router.replace("/(app)/home");
    } catch (error) {
      console.log(error);
      Alert.alert(
        "Authentication failed",
        "Please check your credentials or try again later."
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingOverlay message="Logging in..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LOG IN</Text>

      <View style={styles.formContainer}>
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
            style={[styles.checkbox, stayLoggedIn && styles.checkboxChecked]}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 40,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: "#888",
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
    color: "#fff",
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
    backgroundColor: "#ff3b30",
    borderColor: "#ff3b30",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
  },
  checkboxLabel: {
    color: "#888",
    fontSize: 16,
  },
  forgotPassword: {
    color: "#ff3b30",
    textAlign: "right",
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#ff3b30",
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
    marginTop: 40,
  },
  footerText: {
    color: "#888",
    fontSize: 16,
  },
  signupLink: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "bold",
  },
});
