import { Stack } from "expo-router";
import ErrorBoundary from "../../components/ErrorBoundary";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useAuth } from "../../hooks/AuthContext";

// Register the auth component with expo-router
// Note: The function name MUST match the directory name
export function auth() {
  return null;
}

// Export with capitalized name for backwards compatibility
export { auth as Auth };

export default function AuthLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay message="Authenticating..." />;
  }

  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "#000" },
        }}
      />
    </ErrorBoundary>
  );
}
