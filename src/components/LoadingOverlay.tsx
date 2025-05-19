import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoadingOverlayProps {
  message?: string;
}

function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <View
      style={styles.container}
      accessibilityLabel="Loading indicator"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size="large" color="#ff3b30" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

export default LoadingOverlay;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  message: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
  },
});
