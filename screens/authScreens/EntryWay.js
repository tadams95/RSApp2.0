import React from "react";

import { StatusBar } from "expo-status-bar";
import { createStackNavigator } from "@react-navigation/stack";

import WelcomeScreen from "./WelcomeScreen";
import LoginScreen2 from "./LoginScreen2";
import CreateAccountScreen from "./CreateAccountScreen";
import GuestView from "../guest/GuestView";

const AuthStack = createStackNavigator();

const EntryWay = ({ setAuthenticated }) => {
  return (
    <>
      <StatusBar style="light" />
      <AuthStack.Navigator>
        <AuthStack.Screen name="WelcomeScreen" options={{ headerShown: false }}>
          {(props) => (
            <WelcomeScreen {...props} setAuthenticated={setAuthenticated} />
          )}
        </AuthStack.Screen>
        <AuthStack.Screen
          name="LoginScreen"
          options={{
            headerShown: false,
            cardStyle: { backgroundColor: "#000" },
          }}
        >
          {(props) => (
            <LoginScreen2 {...props} setAuthenticated={setAuthenticated} />
          )}
        </AuthStack.Screen>

        <AuthStack.Screen
          name="CreateAccountScreen"
          options={({ route }) => ({
            headerShown: false,
            cardStyle: { backgroundColor: "#000" },
            setAuthenticated: route.params?.setAuthenticated,
          })}
        >
          {(props) => (
            <CreateAccountScreen
              {...props}
              setAuthenticated={setAuthenticated}
            />
          )}
        </AuthStack.Screen>
        <AuthStack.Screen
          name="GuestView"
          options={({ route }) => ({
            headerShown: false,
            cardStyle: { backgroundColor: "#000" },
            setAuthenticated: route.params?.setAuthenticated,
          })}
        >
          {(props) => (
            <GuestView {...props} setAuthenticated={setAuthenticated} />
          )}
        </AuthStack.Screen>
      </AuthStack.Navigator>
    </>
  );
};
export default EntryWay;
