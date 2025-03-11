import React, { useEffect, useRef } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Platform,
  Dimensions,
  Animated,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleJoinUs = () => {
    navigation.navigate("CreateAccountScreen");
  };

  const handleLogin = () => {
    navigation.navigate("LoginScreen");
  };

  const handleGuest = () => {
    navigation.navigate("GuestTabsScreen");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      <Animated.View
        style={[
          styles.contentContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Image
          style={styles.image}
          source={require("../../assets/RSLogo2025.png")}
          resizeMode="contain"
        />

        <View style={styles.actionContainer}>
          <Text style={styles.headline}>Welcome to RageState</Text>
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              onPress={handleJoinUs}
              style={[styles.actionButton, styles.primaryButton]}
            >
              <Text style={styles.buttonText}>Join Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.buttonText}>Log In</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            onPress={handleGuest}
            style={styles.guestButton}
          >
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Text style={styles.versionText}>Version 2.45</Text>
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    height: windowHeight * 0.20,
    width: windowWidth * 0.7,
    maxWidth: 300,
    marginBottom: windowHeight * 0.05,
  },
  headline: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "white",
    marginBottom: 32,
  },
  actionContainer: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
    marginTop: windowHeight * 0.05,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: "#222",
    borderColor: "#fff",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: "#555",
  },
  buttonText: {
    fontFamily,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  guestButton: {
    padding: 10,
    marginTop: 10,
  },
  guestText: {
    color: "#aaa",
    fontSize: 14,
    fontFamily,
    textDecorationLine: "underline",
  },
  versionText: {
    color: "#555",
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 16,
  },
});
