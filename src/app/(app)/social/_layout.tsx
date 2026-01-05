import { Stack } from "expo-router";

export default function SocialLayout() {
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
        name="index"
        options={{
          title: "Feed",
          headerShown: false, // Hide header since we have custom tabs
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
