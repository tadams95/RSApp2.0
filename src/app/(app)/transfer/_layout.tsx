import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import React from "react";
import { TouchableOpacity } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

export default function TransferLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.bgRoot,
        },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 16 }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="claim"
        options={{
          title: "Claim Ticket",
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="pending"
        options={{
          title: "Pending Transfers",
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
