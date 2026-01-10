import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import ErrorBoundary from "../../components/ErrorBoundary";
import { useTheme } from "../../contexts/ThemeContext";
import { auth } from "../../firebase/firebase";
import { useAuth } from "../../hooks/AuthContext";
import { useNotificationBadge } from "../../hooks/useNotificationBadge";
import {
  registerForPushNotifications,
  setupTokenRefreshListener,
} from "../../services/pushNotificationService";

// Named export for app component registration
export function app() {
  return null;
}

export default function AppLayout() {
  const { authenticated, isLoading } = useAuth();
  const unreadCount = useNotificationBadge();
  const { theme } = useTheme();

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (!authenticated) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Register device for push notifications
    registerForPushNotifications(userId).catch((error) => {
      console.warn("Failed to register for push notifications:", error);
    });

    // Listen for token refreshes
    const unsubscribe = setupTokenRefreshListener(userId);

    return () => unsubscribe();
  }, [authenticated]);

  // If not authenticated, redirect to auth flow
  if (!authenticated && !isLoading) {
    return <Redirect href="/(auth)/" />;
  }

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: theme.colors.tabBarBackground,
            borderTopColor: theme.colors.borderSubtle,
          },
          headerShown: false,
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
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
          name="notifications"
          options={{
            tabBarIcon: ({ color }) => (
              <View>
                <MaterialCommunityIcons name="bell" color={color} size={24} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <View style={styles.badgeDot} />
                  </View>
                )}
              </View>
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
        {/* Transfer routes - hidden from tab bar, accessed via deep links */}
        <Tabs.Screen
          name="transfer"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff1f42", // accent color - keep static for badge visibility
  },
});
