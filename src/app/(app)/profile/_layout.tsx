import { Stack } from "expo-router";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ProfileLayout() {
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
        name="[userId]"
        options={{
          headerTitle: "",
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
