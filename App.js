import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import AuthFlow from "./screens/authScreens/AuthFlow";

SplashScreen.preventAutoHideAsync();

export default function App() {

  SplashScreen.hideAsync();

  return (
    <View style={styles.container}>
      <Text>
        We just need to see if this builds and doesn't crash in TestFlight
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
