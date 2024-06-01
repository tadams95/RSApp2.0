import React from "react";

import { StatusBar } from "expo-status-bar";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import WelcomeScreen from "./WelcomeScreen";
import LoginScreen2 from "./LoginScreen2";
import CreateAccountScreen from "./CreateAccountScreen";
import GuestShop from "../guest/GuestShop";
import GuestProductDetail from "../guest/GuestProductDetail";
import GuestEvent from "../guest/GuestEvent";
import GuestEventDetail from "../guest/GuestEventDetail";

const AuthStack = createStackNavigator();
const GuestTabs = createBottomTabNavigator();
const GuestShopStack = createStackNavigator();
const GuestEventStack = createStackNavigator();

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const backButton = (navigation, showBackButton) => {
  return showBackButton ? (
    <MaterialCommunityIcons
      name="arrow-left"
      size={24}
      color="black"
      onPress={() => navigation.goBack()}
    />
  ) : null;
};

const GuestShopStackScreen = () => {
  return (
    <GuestShopStack.Navigator>
      <GuestShopStack.Screen
        name="GuestShop"
        component={GuestShop}
        options={({ navigation }) => ({
          headerLeft: () => backButton(navigation, false),
          headerShown: false,
        })}
      />

      <GuestShopStack.Screen
        name="GuestProductDetail"
        component={GuestProductDetail}
        options={({ navigation, route }) => ({
          headerLeft: () =>
            backButton(navigation, route.name === "GuestProductDetail"),
          headerShown: false,
          headerTitle: "",
        })}
      />
    </GuestShopStack.Navigator>
  );
};

const GuestEventStackScreen = () => {
  return (
    <GuestEventStack.Navigator>
      <GuestEventStack.Screen
        name="GuestEvent"
        component={GuestEvent}
        options={({ navigation }) => ({
          headerLeft: () => backButton(navigation, false),
          headerShown: false,
        })}
      />

      <GuestEventStack.Screen
        name="GuestProductDetail"
        component={GuestEventDetail}
        options={({ navigation, route }) => ({
          headerLeft: () =>
            backButton(navigation, route.name === "GuestEventDetail"),
          headerShown: false,
          headerTitle: "",
        })}
      />
    </GuestEventStack.Navigator>
  );
};

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
          name="GuestTabsScreen"
          options={({ route }) => ({
            headerShown: false,
            cardStyle: { backgroundColor: "#000" },
            setAuthenticated: route.params?.setAuthenticated,
          })}
        >
          {(props) => (
            <GuestTabs.Navigator
              screenOptions={{
                tabBarActiveBackgroundColor: "white",
                tabBarInactiveBackgroundColor: "black",
                headerTitleAlign: "center",
                headerTitleStyle: {
                  fontFamily,
                },
                tabBarStyle: {
                  backgroundColor: "black",
                },
              }}
            >
              <GuestTabs.Screen
                name="Shop"
                component={GuestShopStackScreen}
                options={{
                  headerLeft: ({ navigation }) => backButton(navigation),
                  tabBarIcon: ({ focused }) => (
                    <MaterialCommunityIcons
                      name="shopping"
                      color={focused ? "black" : "white"} // Set color based on tab focus
                      size={20}
                    />
                  ),
                  tabBarLabel: () => null,
                  headerStyle: {
                    backgroundColor: "black", // Set background color of the header
                  },
                  headerTintColor: "white",
                }}
              />
              <GuestTabs.Screen
                name="Events"
                component={GuestEventStackScreen}
                options={{
                  headerLeft: ({ navigation }) => backButton(navigation),
                  tabBarIcon: ({ focused }) => (
                    <MaterialCommunityIcons
                      name="ticket-percent"
                      color={focused ? "black" : "white"} // Set color based on tab focus
                      size={20}
                    />
                  ),
                  tabBarLabel: () => null,
                  headerStyle: {
                    backgroundColor: "black", // Set background color of the header
                  },
                  headerTintColor: "white",
                }}
              />
            </GuestTabs.Navigator>
          )}
        </AuthStack.Screen>
      </AuthStack.Navigator>
    </>
  );
};
export default EntryWay;
