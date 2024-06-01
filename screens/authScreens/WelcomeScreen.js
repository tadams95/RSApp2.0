import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";

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

  const handleGuest = () => {
    console.log("Improve GuestView");
     navigation.navigate("GuestView")
  };

  return (
    <View style={styles.container}>
      <View style={styles.headlineSection}>
        <Text style={styles.headline}>Welcome to RAGESTATE</Text>
      </View>

      <View style={[styles.imageSection, styles.imageContainer]}>
        <Image
          style={styles.image}
          source={require("../../assets/RSLogoNew.png")}
        />
      </View>

      {/* Tab Container */}
      <View style={styles.tabContainer}>
        <Pressable onPress={handleJoinUs} style={styles.tabButton}>
          <Text style={styles.buttonText}>JOIN US</Text>
        </Pressable>

        <Pressable onPress={handleLogin} style={styles.tabButton}>
          <Text style={styles.buttonText}>LOG IN</Text>
        </Pressable>
      </View>
      <View style={styles.tabContainer}>
        <Pressable onPress={handleGuest} style={styles.guestText}>
          <Text style={styles.buttonText}>CONTINUE AS GUEST</Text>
        </Pressable>
      </View>
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
  },
  headlineSection: {
    flex: 0.7,
    justifyContent: "center",
    alignItems: "center",
    marginTop: windowHeight * 0.04,
  },
  imageSection: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: windowHeight * 0.06, // Adjust margin dynamically based on window height
  },
  headline: {
    textAlign: "center",
    textTransform: "uppercase",
    fontSize: windowWidth * 0.055, // Adjust font size dynamically based on window width
    marginTop: windowHeight * 0.1, // Adjust margin dynamically based on window height
    color: "#FFF",
    fontFamily,
    fontWeight: "700",
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "500",
    color: "#FFF",
    fontFamily,
    fontSize: windowWidth * 0.031, // Adjust font size dynamically based on window width
  },

  imageContainer: {
    flex: 1,
    marginTop: windowHeight * 0.08, // Adjust margin dynamically based on window height
  },
  image: {
    height: windowHeight * 0.5, // Adjust height dynamically based on window height
    width: windowWidth * 0.5, // Adjust width dynamically based on window width
    alignSelf: "center",
  },
  tabContainer: {
    flex: 0.5,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginBottom: 20,
  },
  tabButton: {
    backgroundColor: "#000",
    paddingVertical: windowHeight * 0.01, // Adjust padding dynamically based on window height
    paddingHorizontal: windowWidth * 0.04, // Adjust padding dynamically based on window width
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    width: "30%",
  },
});
