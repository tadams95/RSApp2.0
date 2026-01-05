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
            backgroundColor: "black",
            borderTopColor: "#333",
          },
          headerShown: false,
          tabBarActiveTintColor: "white",
          tabBarInactiveTintColor: "gray",
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="shopping" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="newspaper"
                color={color}
                size={24}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="account" color={color} size={24} />
            ),
          }}
        />
        {/* Cart - hidden from tab bar, accessed via Shop header icon */}
        <Tabs.Screen
          name="cart"
          options={{
            href: null,
          }}
        />
        {/* Profile routes - hidden from tab bar, accessed via navigation */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
