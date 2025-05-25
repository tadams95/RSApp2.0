import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function EntryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/RSLogo2025.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>RAGE STATE</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    paddingTop: 100,
    paddingBottom: 50,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 2,
  },
  buttonsContainer: {
    width: "100%",
  },
  button: {
    backgroundColor: "#ff3b30",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  guestButton: {
    backgroundColor: "transparent",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  guestButtonText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
