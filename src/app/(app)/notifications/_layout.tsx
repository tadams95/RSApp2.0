import { Stack } from "expo-router";
import { GlobalStyles } from "../../../constants/styles";

export default function NotificationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: GlobalStyles.colors.background,
        },
        headerTintColor: GlobalStyles.colors.text,
        headerBackTitle: "Back",
        contentStyle: {
          backgroundColor: GlobalStyles.colors.background,
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
    </Stack>
  );
}
