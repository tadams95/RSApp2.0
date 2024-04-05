import { Image, StyleSheet, Text, View, Pressable } from "react-native";

import { useNavigation } from "@react-navigation/native";

export default function WelcomeScreen() {
  const navigation = useNavigation();

  const handleJoinUs = () => {
    // Navigate to the CreateAccountScreen
    navigation.navigate("CreateAccountScreen");
  };

  const handleLogin = () => {
    // Navigate to the LoginScreen
    navigation.navigate("LoginScreen");
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.headline}>Welcome to RAGESTATE</Text>
      </View>

      <View style={[styles.section, styles.imageContainer]}>
        <Image
          style={styles.image}
          source={require("../../assets/RSLogoNew.png")}
        />
      </View>

      {/* Tab Container */}
      <View style={[styles.section, styles.tabContainer]}>
        <Pressable onPress={handleJoinUs} style={styles.tabButton}>
          <Text style={styles.buttonText}>JOIN US</Text>
        </Pressable>

        <Pressable onPress={handleLogin} style={styles.tabButton}>
          <Text style={styles.buttonText}>LOG IN</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    
  },
  section: {
    flex: 1,
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally
  },
  headline: {
    textAlign: "center",
    textTransform: "uppercase",
    fontSize: 25,
    marginTop: 50,
    color: "#FFF",
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "bold",
    color: "#FFF",
  },
  imageContainer: {
    flex: 1,
    marginTop: 25,
  },
  image: {
    height: 375,
    width: 375,
    alignSelf: "center",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 50,
  },
  tabButton: {
    backgroundColor: "#000",
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    width: "30%",
  },
});
