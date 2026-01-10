import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../../contexts/ThemeContext";

export default function HomeLayout() {
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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="post/[postId]"
        options={{
          title: "Post",
        }}
      />
    </Stack>
  );
}
