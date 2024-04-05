import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import "react-native-gesture-handler";

import { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider } from "react-redux";
import { store } from "./store/redux/store";

import LoginScreen2 from "./screens/authScreens/LoginScreen2";
import WelcomeScreen from "./screens/authScreens/WelcomeScreen";
import CreateAccountScreen from "./screens/authScreens/CreateAccountScreen";
import EntryWay from "./screens/authScreens/EntryWay";

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
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <Provider store={store}>
          {!authenticated ? (
            <EntryWay setAuthenticated={setAuthenticated} />
          ) : (
            <Text style={{ paddingTop: 200 }}>
              If this works then we continue.
            </Text>
          )}
        </Provider>
      </View>
    </NavigationContainer>
  );
}
