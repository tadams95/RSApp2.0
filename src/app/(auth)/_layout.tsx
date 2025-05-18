import { Stack } from "expo-router";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useAuth } from "../../hooks/AuthContext";

export default function AuthLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay message="Authenticating..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "#000" },
      }}
    />
  );
}
