import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import LoginScreen2 from "./screens/authScreens/LoginScreen2";

SplashScreen.preventAutoHideAsync();

export default function App() {
  SplashScreen.hideAsync();

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <LoginScreen2 />
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
