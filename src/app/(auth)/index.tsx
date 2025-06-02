import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function EntryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.backgroundDecoration} />

      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/RSLogo2025.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.buttonsContainer}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>LOG IN</Text>
            </Pressable>
          </Link>

          <Link href="/(auth)/signup" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            </Pressable>
          </Link>

          <Link href="/(guest)/shop" asChild>
            <Pressable style={styles.guestButton}>
              <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  backgroundDecoration: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#0f0f0f",
    opacity: 0.5,
    transform: [{ translateX: 100 }, { translateY: -50 }],
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 2,
    opacity: 0.8,
  },
  buttonsContainer: {
    width: "100%",
    paddingHorizontal: 12,
  },
  button: {
    marginBottom: 16,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "#ff3b30",
    alignItems: "center",
    shadowColor: "#ff3b30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  guestButton: {
    backgroundColor: "transparent",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    marginTop: 8,
  },
  guestButtonText: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
});
