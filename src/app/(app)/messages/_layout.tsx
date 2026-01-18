import { Stack } from "expo-router";
import { useTheme } from "../../../contexts/ThemeContext";

export default function MessagesLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.bgRoot,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[chatId]" />
    </Stack>
  );
}
