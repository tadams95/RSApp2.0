import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import { useState, useEffect} from "react";
import { NavigationContainer } from "@react-navigation/native";

import LoginScreen2 from "./screens/authScreens/LoginScreen2";
import WelcomeScreen from "./screens/authScreens/WelcomeScreen";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);

  // Function to hide SplashScreen after 3 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
    }, 2000);

    return () => clearTimeout(timer); // Cleanup the timer on component unmount
  }, []); // Run only once on component mount

  return (
    <View style={styles.container}>
      <NavigationContainer>
        <StatusBar style="auto" />
        {!authenticated ? (
          <LoginScreen2 setAuthenticated={setAuthenticated} />
        ) : (
          <WelcomeScreen />
        )}
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
