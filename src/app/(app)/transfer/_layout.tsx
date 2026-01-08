import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import React from "react";
import { TouchableOpacity } from "react-native";

export default function TransferLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#000",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 16 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
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
