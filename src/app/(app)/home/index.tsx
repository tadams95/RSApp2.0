import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { selectUserEmail } from "../../../../store/redux/userSlice";
import { useAuth } from "../../../hooks/AuthContext";

export default function HomeScreen() {
  const { authenticated } = useAuth();
  const userEmail = useSelector(selectUserEmail);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require("../../../../assets/RSLogo2025.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>RAGE STATE</Text>
      </View>

      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome{userEmail ? `, ${userEmail.split("@")[0]}` : ""}!
        </Text>
        <Text style={styles.subtitle}>
          You're now using the new Expo Router migration.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Migration Complete</Text>
        <Text style={styles.infoText}>
          The Rage State app has been successfully migrated to use Expo Router.
          Enjoy improved navigation and a more organized code structure!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 2,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#aaa",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    margin: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ff3b30",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: "#ddd",
    lineHeight: 24,
  },
});
