import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Guest index page that serves as an entry point for the guest flow
 * It allows users to choose between exploring the shop or events
 */
const GuestIndex: React.FC = () => {
  const handleNavigateToAuth = () => {
    router.replace("/(auth)/");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "RAGESTATE",
          headerShown: true,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTitleStyle: {
            color: "white",
            fontFamily,
            fontWeight: "700",
          },
        }}
      />

      <Text style={styles.welcomeText}>Browse as Guest</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.option}
          onPress={() => router.navigate("/(guest)/shop/")}
          accessibilityRole="button"
          accessibilityLabel="Browse shop as guest"
        >
          <MaterialCommunityIcons name="shopping" size={40} color="white" />
          <Text style={styles.optionText}>Shop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => router.navigate("/(guest)/events/")}
          accessibilityRole="button"
          accessibilityLabel="Browse events as guest"
        >
          <MaterialCommunityIcons name="calendar" size={40} color="white" />
          <Text style={styles.optionText}>Events</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.noteText}>
          Note: You'll need an account to make purchases or register for events
        </Text>

        <TouchableOpacity
          style={styles.authButton}
          onPress={handleNavigateToAuth}
          accessibilityRole="button"
          accessibilityLabel="Login or create an account"
        >
          <Text style={styles.authButtonText}>LOGIN / SIGN UP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    fontFamily,
    marginTop: 40,
    marginBottom: 40,
    textAlign: "center",
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 40,
  },
  option: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    width: 140,
    height: 140,
    borderRadius: 10,
    padding: 20,
  },
  optionText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 15,
    fontFamily,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  noteText: {
    color: "#999",
    textAlign: "center",
    marginBottom: 30,
    fontFamily,
    fontSize: 14,
  },
  authButton: {
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "white",
    width: "100%",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  authButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    fontFamily,
  },
});

export default GuestIndex;
