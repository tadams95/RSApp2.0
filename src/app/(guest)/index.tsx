import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useScreenTracking } from "../../analytics/PostHogProvider";
import { navigateToAuth } from "../../utils/navigation";

/**
 * Guest account page that provides authentication options
 * It allows users to sign in or sign up for a full account
 */
const GuestAccountPage: React.FC = () => {
  // Track screen view
  useScreenTracking("Guest Account Screen", {
    user_type: "guest",
  });

  const handleNavigateToAuth = () => {
    navigateToAuth();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "RAGESTATE ACCOUNT",
          headerShown: true,
          headerTintColor: "white",
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

      <View style={styles.accountContainer}>
        <MaterialCommunityIcons name="account-circle" size={80} color="white" />
        <Text style={styles.welcomeText}>Guest Access</Text>

        <Text style={styles.infoText}>
          You're currently browsing as a guest. Create an account to:
        </Text>

        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <MaterialCommunityIcons name="shopping" size={24} color="white" />
            <Text style={styles.benefitText}>Make purchases in the shop</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={24}
              color="white"
            />
            <Text style={styles.benefitText}>Register for events</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons name="heart" size={24} color="white" />
            <Text style={styles.benefitText}>Save favorite items</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons name="history" size={24} color="white" />
            <Text style={styles.benefitText}>Track order history</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
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
  accountContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    fontFamily,
    marginTop: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  infoText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    fontFamily,
    paddingHorizontal: 20,
  },
  benefitsList: {
    width: "100%",
    marginTop: 20,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    backgroundColor: "#222",
    padding: 15,
    borderRadius: 8,
  },
  benefitText: {
    color: "white",
    fontSize: 16,
    fontFamily,
    marginLeft: 15,
  },
  footer: {
    marginTop: "auto",
    paddingVertical: 20,
    width: "100%",
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

export default GuestAccountPage;
