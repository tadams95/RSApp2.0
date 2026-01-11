import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import ErrorBoundary from "../../components/ErrorBoundary";
import { useTheme } from "../../contexts/ThemeContext";

// Named export for guest component registration
export function guest() {
  return null;
}

export default function GuestLayout() {
  const { theme } = useTheme();

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: theme.colors.tabBarBackground,
            borderTopColor: theme.colors.borderSubtle,
          },
          headerStyle: {
            backgroundColor: theme.colors.bgRoot,
          },
          headerTintColor: theme.colors.textPrimary,
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarShowLabel: false,
        }}
        initialRouteName="shop/index" // Set shop as the initial route
      >
        {/* Main tabs we want to show */}
        <Tabs.Screen
          name="shop/index"
          options={{
            title: "Shop",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="shopping" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="events/index"
          options={{
            title: "Events",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar" color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: "Account",
            headerShown: false,
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
