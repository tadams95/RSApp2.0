import React, { useCallback } from "react";

import { StatusBar } from "expo-status-bar";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import WelcomeScreen from "./WelcomeScreen";
import LoginScreen2 from "./LoginScreen2";
import CreateAccountScreen from "./CreateAccountScreen";
import GuestShop from "../guest/GuestShop";
import GuestProductDetail from "../guest/GuestProductDetail";
import GuestEvent from "../guest/GuestEvent";
import GuestEventView from "../guest/GuestEventView";

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
      size={20}
      color="black"
      onPress={() => navigation.goBack()}
    />
  ) : null;
};

const GuestShopStackScreen = React.memo(() => {
  const renderBackButton = useCallback((navigation, showBackButton) => {
    return backButton(navigation, showBackButton);
  }, []);

  return (
    <GuestShopStack.Navigator>
      <GuestShopStack.Screen
        name="GuestShop"
        component={GuestShop}
        options={({ navigation }) => ({
          headerLeft: () => renderBackButton(navigation, false),
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
        initialParams={{ screenName: "GuestShop" }}
      />
      <GuestShopStack.Screen
        name="GuestProductDetail"
        component={GuestProductDetail}
        options={({ navigation, route }) => ({
          headerLeft: () =>
            renderBackButton(navigation, route.name === "GuestProductDetail"),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
        initialParams={{ screenName: "GuestProductDetail" }}
      />
    </GuestShopStack.Navigator>
  );
});

const GuestEventStackScreen = () => {
  return (
    <GuestEventStack.Navigator>
      <GuestEventStack.Screen
        name="GuestEvent"
        component={GuestEvent}
        options={({ navigation }) => ({
          headerLeft: () => backButton(navigation, false),
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        })}
      />

      <GuestEventStack.Screen
        name="GuestEventView"
        component={GuestEventView}
        options={({ navigation, route }) => ({
          headerLeft: () =>
            backButton(navigation, route.name === "GuestEventView"),
          headerShown: false,
          headerTitle: "",
          gestureEnabled: true,
          gestureDirection: "horizontal",
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
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("WelcomeScreen")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="account-arrow-left"
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

              <GuestTabs.Screen
                name="Events"
                component={GuestEventStackScreen}
                options={({ navigation }) => ({
                  headerLeft: () => (
                    <Pressable
                      onPress={() => navigation.navigate("WelcomeScreen")}
                      style={{ paddingLeft: 20 }}
                    >
                      <MaterialCommunityIcons
                        name="account-arrow-left"
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
            </GuestTabs.Navigator>
          )}
        </AuthStack.Screen>
      </AuthStack.Navigator>
    </>
  );
};
export default EntryWay;
