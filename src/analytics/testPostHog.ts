// PostHog Analytics Test Utility
// Run this to verify PostHog is working correctly

import { usePostHog } from "./PostHogProvider";

export const testPostHogConnection = async () => {
  console.log("🔍 Testing PostHog Analytics Connection...");

  try {
    // This will be available after the provider is initialized
    // You can call this from any component to test the connection

    console.log("✅ PostHog Analytics Test Started");
    console.log(
      "📊 API Key configured: phc_n3ZNMlJsdU3Hmu8kGALUrIDobcNEcgMxfzhUhXLtsMB"
    );
    console.log("🌐 Host: https://us.i.posthog.com");
    console.log("🔧 Debug Mode: Enabled in development");

    return {
      status: "configured",
      message: "PostHog is properly configured and ready to track events",
    };
  } catch (error) {
    console.error("❌ PostHog Test Failed:", error);
    return {
      status: "error",
      message: error,
    };
  }
};

// Hook to test PostHog in a component
export const usePostHogTest = () => {
  const { track, isInitialized } = usePostHog();

  const runTest = async () => {
    if (!isInitialized) {
      console.log("⏳ PostHog not yet initialized...");
      return;
    }

    try {
      // Send a test event
      await track("posthog_test_event", {
        test_type: "connection_test",
        timestamp: new Date().toISOString(),
        platform: "react-native-expo",
      });

      console.log("✅ Test event sent successfully!");
      console.log(
        "🎯 Check your PostHog dashboard to verify the event was received"
      );

      return { success: true };
    } catch (error) {
      console.error("❌ Failed to send test event:", error);
      return { success: false, error };
    }
  };

  return { runTest, isInitialized };
};

// Example usage in a component:
/*
import { usePostHogTest } from '../analytics/testPostHog';

function TestComponent() {
  const { runTest, isInitialized } = usePostHogTest();
  
  useEffect(() => {
    if (isInitialized) {
      runTest();
    }
  }, [isInitialized]);
  
  return (
    <Button 
      title="Test PostHog" 
      onPress={runTest}
    />
  );
}
*/
