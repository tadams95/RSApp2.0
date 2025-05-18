import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rage State</Text>
      <Text style={styles.subtitle}>
        Live in your world, Rage in ours.
      </Text>

      <View style={styles.linkContainer}>
        <Link href="/(auth)/" style={styles.link}>
          Go to Authentication
        </Link>
        <Link href="/(app)/home" style={styles.link}>
          Go to Home (Requires Auth)
        </Link>
        <Link href="/(guest)/shop" style={styles.link}>
          Browse as Guest
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#ccc",
    marginBottom: 24,
  },
  linkContainer: {
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  link: {
    color: "#ff3b30",
    fontSize: 16,
    marginVertical: 8,
    textDecorationLine: "underline",
  },
});
