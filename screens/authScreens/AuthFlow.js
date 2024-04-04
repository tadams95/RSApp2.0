import React from "react";

import { StatusBar } from "expo-status-bar";
import { createStackNavigator } from "@react-navigation/stack";

import WelcomeScreen from "./WelcomeScreen";
import LoginScreen from "./LoginScreen";
import CreateAccountScreen from "./CreateAccountScreen";

const AuthStack = createStackNavigator();

const AuthFlow = ({ setAuthenticated }) => {
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
            <LoginScreen {...props} setAuthenticated={setAuthenticated} />
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
      </AuthStack.Navigator>
    </>
  );
};

export default AuthFlow;
