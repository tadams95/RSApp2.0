import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#000",
        },
        headerTintColor: "#fff",
        headerBackTitle: "Back",
        contentStyle: {
          backgroundColor: "#000",
        },
      }}
    >
      <Stack.Screen
        name="[userId]"
        options={{
          title: "Profile",
        }}
      />
    </Stack>
  );
}
