import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// TODO: Update this path when auth utilities are moved to src
import { forgotPassword } from "../../../util/auth";
import LoadingOverlay from "../../components/LoadingOverlay";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  function cancelReset() {
    router.back();
  }

  async function confirmReset() {
    if (!email) {
      setFormError("Please enter your email address");
      return;
    }
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setFormError("");
    try {
      const success = await forgotPassword(email);
      if (success) {
        Alert.alert(
          "Password Reset",
          "If an account exists for this email, a password reset link has been sent."
        );
        router.back();
      } else {
        // General message to avoid disclosing if an email exists or not
        Alert.alert(
          "Request Submitted",
          "If an account exists for this email, you will receive reset instructions shortly."
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to send reset instructions."
      );
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

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrapper, !!formError && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor="#999"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)", // Match modal background if it's a full screen
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#000",
    padding: 24,
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    borderWidth: 1,
    borderColor: "#333",
  },
  headline: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontFamily,
    fontSize: 14,
    color: "#aaa",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
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
    borderColor: "#ff5252", // Red for errors
    borderWidth: 1,
  },
  errorText: {
    color: "#ff5252", // Red for errors
    fontSize: 12,
    marginTop: 4,
    fontFamily,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: "#555",
  },
  confirmButton: {
    backgroundColor: "#222", // Darker button for confirm
    borderColor: "#fff",
  },
  cancelButtonText: {
    fontFamily,
    color: "#ddd",
    fontWeight: "600",
    fontSize: 16,
  },
  confirmButtonText: {
    fontFamily,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
