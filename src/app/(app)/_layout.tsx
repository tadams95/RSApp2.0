import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import ErrorBoundary from "../../components/ErrorBoundary";
import { GlobalStyles } from "../../constants/styles";
import { useAuth } from "../../hooks/AuthContext";
import { useNotificationBadge } from "../../hooks/useNotificationBadge";

// Named export for app component registration
export function app() {
  return null;
}

export default function AppLayout() {
  const { authenticated, isLoading } = useAuth();
  const unreadCount = useNotificationBadge();

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
        {/* Social routes - hidden, content moved to home tab */}
        <Tabs.Screen
          name="social"
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
    backgroundColor: GlobalStyles.colors.redVivid5,
  },
});
