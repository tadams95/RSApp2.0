import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../../../constants/styles";
import { runCartRecoveryTests } from "../utils/testCartRecovery";

/**
 * Development test component to trigger cart recovery test scenarios
 * Only use during development and testing - remove before production
 */
const CartRecoveryTester: React.FC = () => {
  // Only show this component in development mode
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.testButton}
        onPress={() => runCartRecoveryTests()}
      >
        <Text style={styles.buttonText}>Test Cart Recovery</Text>
      </TouchableOpacity>
      <Text style={styles.devNote}>DEV ONLY: Recovery Testing Tool</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: "#333",
    borderRadius: 8,
    margin: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.red4,
    borderStyle: "dashed",
  },
  testButton: {
    backgroundColor: GlobalStyles.colors.red4,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginBottom: 5,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  devNote: {
    color: "#999",
    fontSize: 10,
    fontStyle: "italic",
  },
});

export default CartRecoveryTester;
