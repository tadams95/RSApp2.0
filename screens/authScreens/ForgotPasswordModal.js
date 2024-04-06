import {
  Modal,
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Platform,
} from "react-native";

import { GlobalStyles } from "../../constants/styles";
import { useState } from "react";

import { forgotPassword } from "../../util/auth";

function ForgotPasswordModal({ visible, onClose }) {
  const [email, setEmail] = useState("");
  

  function cancelReset() {
    setEmail("");
    onClose(false); // Close the modal by updating the parent component state
  }

  async function confirmReset() {
    // Assuming forgotPassword returns a boolean indicating success
    const success = await forgotPassword(email);

    if (success) {
      onClose(false); // Close the modal on successful reset
    }
  }

  return (
    <Modal animationType="none" transparent={true} visible={visible}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>RESET YOUR PASSWORD BELOW</Text>
          <View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              secureTextEntry={false}
              onChangeText={(text) => setEmail(text)}
              value={email}
            />
          </View>
          <View style={styles.modalButtonsContainer}>
            <Pressable
              style={[styles.modalButton, styles.cancelButton]}
              onPress={cancelReset}
            >
              <Text style={styles.modalButtonText2}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.confirmButton]}
              onPress={confirmReset}
            >
              <Text style={styles.modalButtonText}>Confirm</Text>
            </Pressable>
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
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16,
  },

  buttonsContainer: {
    flexDirection: "row",
    marginTop: 8,
  },

  button: {
    // backgroundColor: GlobalStyles.colors.grey2,
    borderWidth: 2,
    padding: 8,
    borderRadius: 8,
    marginRight: 25,
  },

  buttonText: {
    fontFamily,
    fontSize: 12,
  },

  clearButton: {
    alignItems: "center",
    marginLeft: 15,
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 1)",
  },

  modalContent: {
    backgroundColor: "black",
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },

  modalText: {
    fontFamily,
    fontSize: 18,
    marginBottom: 15,
    textAlign: "center",
    color: "white",
  },

  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: "48%",
    alignItems: "center",
  },

  cancelButton: {
    backgroundColor: "white",
  },

  confirmButton: {
    backgroundColor: "black",
    borderWidth: 1,
    borderColor: "white",
  },

  modalButtonText: {
    fontFamily,
    color: "white",
  },
  modalButtonText2: {
    fontFamily,
    color: "black",
  },
  input: {
    backgroundColor: "#F6F6F6",
    padding: 5,
    marginBottom: 10,
    borderRadius: 5,
    fontFamily,
    width: Dimensions.get("window").width * 0.85,
    fontSize: 18,
  },
});
