import { useState, useEffect } from "react";
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

const ShopStackScreen = () => {
  return (
    <ShopStack.Navigator>
      <ShopStack.Screen
        name="ProductListScreen"
        component={ShopScreen}
        options={({ navigation, route }) => ({
          headerLeft: () => backButton(navigation, false),
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
            backButton(navigation, route.name === "ProductDetailScreen"),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
    </ShopStack.Navigator>
  );
};
const EventStackScreen = () => {
  return (
    <EventStack.Navigator>
      <EventStack.Screen
        name="EventListScreen"
        component={EventsScreen}
        options={({ navigation, route }) => ({
          headerLeft: () => backButton(navigation, false),
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
      <EventStack.Screen
        name="EventView"
        component={EventView}
        options={({ navigation, route }) => ({
          headerLeft: () => backButton(navigation),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />
    </EventStack.Navigator>
  );
};

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

  // Function to hide SplashScreen after 3 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
    }, 2000);

    return () => clearTimeout(timer); // Cleanup the timer on component unmount
  }, []); // Run only once on component mount

  // Function to check stayLoggedIn state
  useEffect(() => {
    const checkStayLoggedIn = async () => {
      try {
        const [stayLoggedInValue, savedEmail, savedPassword] =
          await Promise.all([
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
    };



    checkStayLoggedIn();
  }, []);

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
