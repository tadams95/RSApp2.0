/**
 * My Events Screen Route
 *
 * This is a thin wrapper that renders the consolidated MyEvents component.
 * All logic, state management, and UI is in the MyEvents component.
 *
 * @see src/components/modals/MyEvents.tsx - Main component with all functionality
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import MyEvents from "../../../components/modals/MyEvents";

export default function MyEventsScreen() {
  return (
    <View style={styles.container}>
      <MyEvents isStandaloneScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
