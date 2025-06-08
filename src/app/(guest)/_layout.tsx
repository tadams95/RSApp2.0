import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import ErrorBoundary from "../../components/ErrorBoundary";

// Named export for guest component registration
export function guest() {
  return null;
}

export default function GuestLayout() {
  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: "black", // Set background color of the tab bar
            borderTopColor: "#333",
          },
          headerStyle: {
            backgroundColor: "black", // Set background color of the header
          },
          headerTintColor: "white", // Changed to white to match the dark theme
          tabBarActiveTintColor: "white",
          tabBarInactiveTintColor: "gray",
          tabBarShowLabel: false,
        }}
        initialRouteName="shop/index" // Set shop as the initial route
      >
        {/* Main tabs we want to show */}
        <Tabs.Screen
          name="shop/index"
          options={{
            title: "Shop",
            headerTitle: "RAGESTATE SHOP",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="shopping" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="events/index"
          options={{
            title: "Events",
            headerTitle: "RAGESTATE EVENTS",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: "Account",
            headerTitle: "RAGESTATE ACCOUNT",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="account" color={color} size={24} />
            ),
          }}
        />

        {/* Dynamic routes that should not appear as tabs */}
        <Tabs.Screen
          name="shop/[id]"
          options={{
            href: null, // This prevents the route from appearing in the tab bar
            headerShown: true, // Still show the header for the product detail page
          }}
        />
        <Tabs.Screen
          name="events/[id]"
          options={{
            href: null, // This prevents the route from appearing in the tab bar
            headerShown: true, // Still show the header for the event detail page
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
