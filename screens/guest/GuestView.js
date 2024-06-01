import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

export default function GuestView({ navigation, setAuthenticated }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the GuestView</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally
  },
  text: {
    color: "#FFF",
  },
});
