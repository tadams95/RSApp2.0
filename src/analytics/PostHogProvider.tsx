import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { getLocales } from "expo-localization";
import {
  PostHogProvider as PostHogBaseProvider,
  usePostHog as usePostHogBase,
} from "posthog-react-native";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { AppState, Platform } from "react-native";

// Configuration interface
interface PostHogConfig {
  apiKey: string;
  host?: string;
  enableDebug?: boolean;
  captureAppLifecycleEvents?: boolean;
  captureScreenViews?: boolean;
  enableSessionRecording?: boolean;
}

// Analytics event properties - PostHog compatible (no undefined values)
interface AnalyticsProperties {
  [key: string]: string | number | boolean | null;
}

// User identification properties - PostHog compatible (no undefined values)
interface UserProperties {
  email?: string;
  userId?: string;
  name?: string;
  plan?: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Enhanced context interface that extends PostHog functionality
interface EnhancedPostHogContextType {
  // Core tracking methods
  track: (event: string, properties?: AnalyticsProperties) => Promise<void>;
  identify: (userId: string, userProperties?: UserProperties) => Promise<void>;
  capture: (event: string, properties?: AnalyticsProperties) => Promise<void>;
  screen: (
    screenName: string,
    properties?: AnalyticsProperties
  ) => Promise<void>;

  // User management
  reset: () => Promise<void>;
  alias: (alias: string) => Promise<void>;

  // Feature flags (for future use)
  isFeatureEnabled: (flag: string) => boolean;

  // Utility methods
  flush: () => Promise<void>;
  isInitialized: boolean;

  // Enhanced methods
  trackWithContext: (
    event: string,
    properties?: AnalyticsProperties
  ) => Promise<void>;
  setUserContext: (userProperties: UserProperties) => Promise<void>;
}

// Environment configuration
const getPostHogConfig = (): PostHogConfig => {
  const isDevelopment = __DEV__;

  // Using your actual PostHog API key
  const config: PostHogConfig = {
    apiKey: "phc_n3ZNMlJsdU3Hmu8kGALUrIDobcNEcgMxfzhUhXLtsMB",
    host: "https://us.i.posthog.com",
    enableDebug: isDevelopment,
    captureAppLifecycleEvents: true,
    captureScreenViews: false, // We'll handle screen tracking manually for more control
    enableSessionRecording: !isDevelopment, // Only in production
  };

  return config;
};

// Create enhanced context
const EnhancedPostHogContext = createContext<EnhancedPostHogContextType | null>(
  null
);

// Storage keys for offline events
const OFFLINE_EVENTS_KEY = "posthog_offline_events";

// Utility function to filter out undefined values for PostHog compatibility
const sanitizeProperties = (
  properties?: Record<string, any>
): Record<string, any> | undefined => {
  if (!properties) return undefined;

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

// Offline event structure
interface OfflineEvent {
  event: string;
  properties?: AnalyticsProperties;
  timestamp: number;
  type: "track" | "identify" | "screen";
  userId?: string;
  userProperties?: UserProperties;
}

// Enhanced provider component
interface EnhancedPostHogProviderProps {
  children: ReactNode;
  config?: Partial<PostHogConfig>;
}

// Inner provider that wraps the PostHog provider with enhanced functionality
const EnhancedPostHogInnerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const postHog = usePostHogBase();
  const isInitialized = useRef(false);
  const offlineEventsRef = useRef<OfflineEvent[]>([]);
  const isOnlineRef = useRef(true);
  const sessionStartTime = useRef<number>(Date.now());
  const lastActiveTime = useRef<number>(Date.now());

  useEffect(() => {
    initializeEnhancements();
    setupNetworkListener();
    setupAppStateTracking();

    return () => {
      // Cleanup
      if (postHog) {
        postHog.flush();
      }
    };
  }, [postHog]);

  const setupAppStateTracking = () => {
    const handleAppStateChange = (nextAppState: string) => {
      const currentTime = Date.now();

      if (nextAppState === "active") {
        // App came to foreground
        const timeAwayMs = currentTime - lastActiveTime.current;
        const wasAwayLong = timeAwayMs > 30000; // 30 seconds threshold

        // Track app opened event
        track("app_opened", {
          session_start_time: sessionStartTime.current,
          time_away_ms: wasAwayLong ? timeAwayMs : null,
          returning_from_background: wasAwayLong,
        });

        lastActiveTime.current = currentTime;
      } else if (nextAppState === "background") {
        // App went to background
        const sessionDurationMs = currentTime - sessionStartTime.current;

        // Track app backgrounded event
        track("app_backgrounded", {
          session_duration_ms: sessionDurationMs,
          session_start_time: sessionStartTime.current,
        });

        lastActiveTime.current = currentTime;
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    // Track initial app open
    track("app_opened", {
      session_start_time: sessionStartTime.current,
      initial_launch: true,
    });

    return () => subscription?.remove();
  };

  const initializeEnhancements = async () => {
    try {
      if (!postHog) {
        console.warn("PostHog not available");
        return;
      }

      // Set device context
      await setDeviceContext();

      // Load and send offline events
      await processOfflineEvents();

      isInitialized.current = true;
      console.log("PostHog enhancements initialized successfully");
    } catch (error) {
      console.error("PostHog enhancement initialization failed:", error);
    }
  };

  const setDeviceContext = async () => {
    try {
      const locales = getLocales();
      const deviceInfo = {
        app_version: Application.nativeApplicationVersion,
        app_build: Application.nativeBuildVersion,
        app_bundle_id: Application.applicationId,
        device_type: Device.deviceType,
        device_name: Device.deviceName,
        device_model: Device.modelName,
        device_os: Platform.OS,
        device_os_version: Device.osVersion,
        locale: locales[0]?.languageTag || "unknown",
        timezone: locales[0]?.regionCode || "unknown",
        platform: "expo",
      };

      // Set super properties that will be included with every event
      if (postHog?.register) {
        postHog.register(deviceInfo);
      }
    } catch (error) {
      console.error("Failed to set device context:", error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !isOnlineRef.current;
      isOnlineRef.current = state.isConnected ?? false;

      // If we just came back online, process offline events
      if (wasOffline && isOnlineRef.current) {
        processOfflineEvents();
      }
    });

    return unsubscribe;
  };

  const storeOfflineEvent = async (event: OfflineEvent) => {
    try {
      offlineEventsRef.current.push(event);
      await AsyncStorage.setItem(
        OFFLINE_EVENTS_KEY,
        JSON.stringify(offlineEventsRef.current)
      );
    } catch (error) {
      console.error("Failed to store offline event:", error);
    }
  };

  const processOfflineEvents = async () => {
    try {
      // Load stored events
      const storedEvents = await AsyncStorage.getItem(OFFLINE_EVENTS_KEY);
      if (storedEvents) {
        offlineEventsRef.current = JSON.parse(storedEvents);
      }

      // Send events if online and PostHog is available
      if (
        isOnlineRef.current &&
        postHog &&
        offlineEventsRef.current.length > 0
      ) {
        for (const event of offlineEventsRef.current) {
          try {
            switch (event.type) {
              case "track":
                await postHog.capture(
                  event.event,
                  sanitizeProperties(event.properties)
                );
                break;
              case "identify":
                if (event.userId) {
                  postHog.identify(
                    event.userId,
                    sanitizeProperties(event.userProperties)
                  );
                }
                break;
              case "screen":
                await postHog.screen(
                  event.event,
                  sanitizeProperties(event.properties)
                );
                break;
            }
          } catch (error) {
            console.error("Failed to send offline event:", error);
          }
        }

        // Clear processed events
        offlineEventsRef.current = [];
        await AsyncStorage.removeItem(OFFLINE_EVENTS_KEY);
        console.log("Processed offline events successfully");
      }
    } catch (error) {
      console.error("Failed to process offline events:", error);
    }
  };

  // Core analytics methods
  const track = async (
    event: string,
    properties?: AnalyticsProperties
  ): Promise<void> => {
    try {
      const eventData: OfflineEvent = {
        event,
        properties: {
          ...properties,
          timestamp: Date.now(),
          platform: "expo",
        },
        timestamp: Date.now(),
        type: "track",
      };

      if (isOnlineRef.current && postHog) {
        await postHog.capture(event, sanitizeProperties(eventData.properties));
      } else {
        await storeOfflineEvent(eventData);
      }
    } catch (error) {
      console.error("Analytics track error:", error);
    }
  };

  const identify = async (
    userId: string,
    userProperties?: UserProperties
  ): Promise<void> => {
    try {
      const eventData: OfflineEvent = {
        event: "identify",
        userId,
        userProperties: {
          ...userProperties,
          last_seen: new Date().toISOString(),
        },
        timestamp: Date.now(),
        type: "identify",
      };

      if (isOnlineRef.current && postHog) {
        postHog.identify(userId, sanitizeProperties(eventData.userProperties));
      } else {
        await storeOfflineEvent(eventData);
      }
    } catch (error) {
      console.error("Analytics identify error:", error);
    }
  };

  const capture = async (
    event: string,
    properties?: AnalyticsProperties
  ): Promise<void> => {
    // Alias for track method to match PostHog terminology
    return track(event, properties);
  };

  const screen = async (
    screenName: string,
    properties?: AnalyticsProperties
  ): Promise<void> => {
    try {
      const eventData: OfflineEvent = {
        event: screenName,
        properties: {
          ...properties,
          screen_name: screenName,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        type: "screen",
      };

      if (isOnlineRef.current && postHog) {
        await postHog.screen(
          screenName,
          sanitizeProperties(eventData.properties)
        );
      } else {
        await storeOfflineEvent(eventData);
      }
    } catch (error) {
      console.error("Analytics screen error:", error);
    }
  };

  const reset = async (): Promise<void> => {
    try {
      if (postHog) {
        postHog.reset();
      }
      // Clear offline events for the current user
      offlineEventsRef.current = [];
      await AsyncStorage.removeItem(OFFLINE_EVENTS_KEY);
    } catch (error) {
      console.error("Analytics reset error:", error);
    }
  };

  const alias = async (aliasId: string): Promise<void> => {
    try {
      if (postHog?.alias) {
        postHog.alias(aliasId);
      }
    } catch (error) {
      console.error("Analytics alias error:", error);
    }
  };

  const isFeatureEnabled = (flag: string): boolean => {
    try {
      if (postHog?.isFeatureEnabled) {
        return postHog.isFeatureEnabled(flag) ?? false;
      }
      return false;
    } catch (error) {
      console.error("Feature flag check error:", error);
      return false;
    }
  };

  const flush = async (): Promise<void> => {
    try {
      if (postHog?.flush) {
        await postHog.flush();
      }
    } catch (error) {
      console.error("Analytics flush error:", error);
    }
  };

  // Enhanced methods
  const trackWithContext = async (
    event: string,
    properties?: AnalyticsProperties
  ): Promise<void> => {
    const contextualProperties = {
      ...properties,
      app_version: Application.nativeApplicationVersion,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };

    return track(event, contextualProperties);
  };

  const setUserContext = async (
    userProperties: UserProperties
  ): Promise<void> => {
    try {
      if (postHog && userProperties) {
        // Set person properties using $set in a capture event
        const sanitizedProperties = sanitizeProperties(userProperties);
        if (sanitizedProperties) {
          postHog.capture("$set", { $set: sanitizedProperties });
        }
      }
    } catch (error) {
      console.error("Set user context error:", error);
    }
  };

  const value: EnhancedPostHogContextType = {
    track,
    identify,
    capture,
    screen,
    reset,
    alias,
    isFeatureEnabled,
    flush,
    isInitialized: isInitialized.current,
    trackWithContext,
    setUserContext,
  };

  return (
    <EnhancedPostHogContext.Provider value={value}>
      {children}
    </EnhancedPostHogContext.Provider>
  );
};

// Main enhanced provider component
export const PostHogProvider: React.FC<EnhancedPostHogProviderProps> = ({
  children,
  config: customConfig,
}) => {
  const config = { ...getPostHogConfig(), ...customConfig };

  // Validate API key
  if (!config.apiKey || config.apiKey.includes("PLACEHOLDER")) {
    console.warn(
      "PostHog: Invalid API key detected. Analytics will be disabled."
    );
    // Return children without analytics in development
    if (__DEV__) {
      return <>{children}</>;
    }
    return null;
  }

  const options = {
    host: config.host,
    enableDebug: config.enableDebug,
    captureAppLifecycleEvents: config.captureAppLifecycleEvents,
    captureScreenViews: config.captureScreenViews,
    enableSessionReplay: config.enableSessionRecording,
    // Disable autocapture to prevent getCurrentRoute errors with Expo Router
    autocapture: false,
  };

  return (
    <PostHogBaseProvider apiKey={config.apiKey} options={options}>
      <EnhancedPostHogInnerProvider>{children}</EnhancedPostHogInnerProvider>
    </PostHogBaseProvider>
  );
};

// Custom hook for using enhanced PostHog analytics
export const usePostHog = (): EnhancedPostHogContextType => {
  const context = useContext(EnhancedPostHogContext);

  if (!context) {
    throw new Error("usePostHog must be used within a PostHogProvider");
  }

  return context;
};

// Convenience hook for screen tracking
export const useScreenTracking = (
  screenName: string,
  properties?: AnalyticsProperties
) => {
  const { screen } = usePostHog();

  useEffect(() => {
    screen(screenName, properties);
  }, [screenName, screen]);
};

// Export types for external use
export type { AnalyticsProperties, PostHogConfig, UserProperties };
