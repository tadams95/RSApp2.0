import { Stack } from "expo-router";
import { useTheme } from "../../../contexts/ThemeContext";

export default function NotificationsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.bgRoot,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitle: "Back",
        contentStyle: {
          backgroundColor: theme.colors.bgRoot,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Notifications",
          headerShown: false, // Will add custom header with "Mark all read" action
        }}
      />
      <Stack.Screen
        name="profile/[userId]"
        options={{
          title: "",
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
