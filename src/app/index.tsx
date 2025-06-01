import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../constants/styles";
import { useAuth } from "../hooks/AuthContext";

export default function Index() {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to home page automatically
  useEffect(() => {
    if (!isLoading && authenticated) {
      router.replace("/(app)/home");
    }
  }, [authenticated, isLoading, router]);

  // If still loading or authenticated, render minimal content that will be replaced
  if (isLoading || authenticated) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require("../assets/BlurHero_2.png")}
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)", "#000"]}
          style={styles.gradient}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/RSLogo2025.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>RAGE STATE</Text>
            <Text style={styles.subtitle}>Live in your world, Rage in ours.</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => router.push("/(auth)/")}
            >
              <Text style={styles.buttonText}>GET STARTED</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => router.push("/(guest)/shop")}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                BROWSE AS GUEST
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 RAGE STATE</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  gradient: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 100,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: GlobalStyles.colors.grey2,
    textAlign: "center",
    fontStyle: "italic",
  },
  buttonContainer: {
    alignItems: "center",
    padding: 20,
    width: "100%",
  },
  button: {
    width: width * 0.8,
    maxWidth: 400,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  primaryButton: {
    backgroundColor: GlobalStyles.colors.redVivid5,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  secondaryButtonText: {
    color: GlobalStyles.colors.grey1,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  footerText: {
    color: GlobalStyles.colors.grey5,
    fontSize: 14,
  },
});
