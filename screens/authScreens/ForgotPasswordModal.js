import {
  Modal,
  Text,
  View,
  StyleSheet,
  TextInput,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useState } from "react";
import { forgotPassword } from "../../util/auth";

function ForgotPasswordModal({ visible, onClose }) {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");

  function cancelReset() {
    setEmail("");
    onClose(false);
  }

  async function confirmReset() {
    if (!email) {
      setFormError("Please enter your email address");
      return;
    }
    // Email validation regex
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    const success = await forgotPassword(email);
    if (success) {
      onClose(false);
    }
  }

  return (
    <Modal animationType="fade" transparent={true} visible={visible}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.headline}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you instructions to reset
            your password.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrapper, formError && styles.inputError]}>
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
            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}
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
    </Modal>
  );
}

export default ForgotPasswordModal;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
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
    borderColor: "#ff5252",
    borderWidth: 1,
  },
  errorText: {
    color: "#ff5252",
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
    backgroundColor: "#222",
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
