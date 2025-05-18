import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function GuestLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "black", // Set background color of the tab bar
          borderTopColor: "#333",
        },
        headerStyle: {
          backgroundColor: "black", // Set background color of the header
        },
        headerTintColor: "white",
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "gray",
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="shop/index"
        options={{
          title: "Guest Shop",
          headerTitle: "RAGESTATE SHOP",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shopping" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="events/index"
        options={{
          title: "Guest Events",
          headerTitle: "RAGESTATE EVENTS",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="calendar" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Sign In",
          headerTitle: "RAGESTATE",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="login" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
