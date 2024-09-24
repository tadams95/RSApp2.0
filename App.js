import React, { useState, useEffect, useCallback } from "react";
import { Pressable, View, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Provider } from "react-redux";
import { store } from "./store/redux/store";
import { loginUser } from "./util/auth";

import EntryWay from "./screens/authScreens/EntryWay";
import HomeScreen from "./screens/HomeScreen";
import ShopScreen from "./screens/ShopScreen";
import EventsScreen from "./screens/events/EventsScreen";
import EventView from "./screens/events/EventView";
import ProductDetailScreen from "./screens/product/ProductDetailScreen";
import CartScreen from "./screens/CartScreen";
import AccountScreen from "./screens/AccountScreen";

import AsyncStorage from "@react-native-async-storage/async-storage";

const BottomTab = createBottomTabNavigator();
const ShopStack = createStackNavigator();
const EventStack = createStackNavigator();

const ShopStackScreen = React.memo(() => {
  const renderBackButton = useCallback((navigation, isDetailScreen) => {
    return backButton(navigation, isDetailScreen);
  }, []);

  return (
    <ShopStack.Navigator>
      <ShopStack.Screen
        name="ProductListScreen"
        component={ShopScreen}
        options={({ navigation }) => ({
          headerLeft: () => renderBackButton(navigation, false),
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
      <ShopStack.Screen
        name="ProductDetailScreen"
        component={ProductDetailScreen}
        options={({ navigation, route }) => ({
          headerLeft: () =>
            renderBackButton(navigation, route.name === "ProductDetailScreen"),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
    </ShopStack.Navigator>
  );
});

const EventStackScreen = React.memo(() => {
  return (
    <EventStack.Navigator>
      <EventStack.Screen
        name="EventListScreen"
        component={EventsScreen}
        options={({ navigation }) => ({
          headerLeft: () => backButton(navigation, false),
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
      <EventStack.Screen
        name="EventView"
        component={EventView}
        options={({ navigation }) => ({
          headerLeft: () => backButton(navigation, true),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
    </EventStack.Navigator>
  );
});

const backButton = (navigation, showBackButton) => {
  return showBackButton ? (
    <MaterialCommunityIcons
      name="arrow-left"
      size={20}
      color="black"
      onPress={() => navigation.goBack()}
    />
  ) : null;
};

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const fontFamily = Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  });

  const SPLASH_SCREEN_TIMEOUT = 2000; // Timeout duration in milliseconds

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, SPLASH_SCREEN_TIMEOUT);

    return () => clearTimeout(timer); // Cleanup the timer on component unmount
  }, []); // Run only once on component mount

  const checkStayLoggedIn = useCallback(async () => {
    try {
      const [stayLoggedInValue, savedEmail, savedPassword] = await Promise.all([
        AsyncStorage.getItem("stayLoggedIn"),
        AsyncStorage.getItem("email"),
        AsyncStorage.getItem("password"),
      ]);

      if (stayLoggedInValue) {
        setStayLoggedIn(JSON.parse(stayLoggedInValue));

        if (savedEmail && savedPassword) {
          await loginUser(savedEmail, savedPassword);
          setAuthenticated(true); // Automatically authenticate if stayLoggedIn is true
        }
      }
    } catch (error) {
      console.error("Error retrieving stayLoggedIn state:", error);
    }
  }, []);

  useEffect(() => {
    checkStayLoggedIn();
  }, [checkStayLoggedIn]);

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <Provider store={store}>
          {!authenticated ? (
            <EntryWay setAuthenticated={setAuthenticated} />
          ) : (
            <BottomTab.Navigator
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
              <BottomTab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  tabBarIcon: ({ focused }) => (
                    <MaterialCommunityIcons
                      name="home"
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
              <BottomTab.Screen
                name="Shop"
                component={ShopStackScreen}
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("Home")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="home"
                        size={20}
                        color="white"
                      />
                    </Pressable>
                  ),
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
                })}
              />

              <BottomTab.Screen
                name="Events"
                component={EventStackScreen}
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("Home")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="home"
                        size={20}
                        color="white"
                      />
                    </Pressable>
                  ),
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
                })}
              />
              <BottomTab.Screen
                name="Cart"
                component={CartScreen}
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("Home")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="home"
                        size={20}
                        color="white"
                      />
                    </Pressable>
                  ),
                  tabBarIcon: ({ focused }) => (
                    <MaterialCommunityIcons
                      name="cart"
                      color={focused ? "black" : "white"} // Set color based on tab focus
                      size={20}
                    />
                  ),
                  tabBarLabel: () => null,
                  headerStyle: {
                    backgroundColor: "black", // Set background color of the header
                  },
                  headerTintColor: "white",
                })}
              />
              <BottomTab.Screen
                name="Account"
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("Home")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="home"
                        size={20}
                        color="white"
                      />
                    </Pressable>
                  ),
                  tabBarIcon: ({ focused }) => (
                    <MaterialCommunityIcons
                      name="account"
                      color={focused ? "black" : "white"} // Set color based on tab focus
                      size={20}
                    />
                  ),
                  tabBarLabel: () => null,
                  headerStyle: {
                    backgroundColor: "black", // Set background color of the header
                  },
                  headerTintColor: "white",
                })}
              >
                {/* Pass the setAuthenticated function to AccountScreen */}
                {(props) => (
                  <AccountScreen
                    {...props}
                    setAuthenticated={setAuthenticated}
                  />
                )}
              </BottomTab.Screen>
            </BottomTab.Navigator>
          )}
        </Provider>
      </View>
    </NavigationContainer>
  );
}
