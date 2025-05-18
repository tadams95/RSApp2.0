import { Stack } from "expo-router";
import React from "react";

export default function EventLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Events",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="my-events"
        options={{
          headerShown: false,
          title: "My Events",
        }}
      />
    </Stack>
  );
}
