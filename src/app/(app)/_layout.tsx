import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import ErrorBoundary from "../../components/ErrorBoundary";
import { useAuth } from "../../hooks/AuthContext";

// Named export for app component registration
export function app() {
  return null;
}

export default function AppLayout() {
  const { authenticated, isLoading } = useAuth();

  // If not authenticated, redirect to auth flow
  if (!authenticated && !isLoading) {
    return <Redirect href="/(auth)/" />;
  }

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
          headerTintColor: "black", // Set text color of the header text to white (fixed from black for consistency)
          tabBarActiveTintColor: "white",
          tabBarInactiveTintColor: "gray",
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "RAGESTATE",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: "Shop",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="shopping" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: "Events",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cart" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="account" color={color} size={24} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
