import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Theme } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { navigateToGuestEvent } from "../../../utils/navigation";

// Import our enhanced components and hooks
import NetInfo from "@react-native-community/netinfo"; // For network status checking
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProgressiveImage } from "../../../components/ui";
import { useEventsWithHelpers } from "../../../hooks/useEvents";
import { EventData } from "../../../utils/eventDataHandler";
import { PROGRESSIVE_PLACEHOLDERS } from "../../../utils/imageCacheConfig";
import { logError } from "../../../utils/logError";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Create animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(
  Animated.FlatList<EventData>
);

const GuestEvent: React.FC = () => {
  // Use React Query for events data
  const { events, isLoading, error, refetch, hasEvents, isEmpty, hasError } =
    useEventsWithHelpers();
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [isOffline, setIsOffline] = useState(false);
  const flatListRef = useRef<Animated.FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrollEnabled, setIsScrollEnabled] = useState<boolean>(true);

  // Scroll depth tracking state
  const [scrollDepth, setScrollDepth] = useState(0);
  const [maxScrollDepth, setMaxScrollDepth] = useState(0);
  const [viewStartTime] = useState(Date.now());

  // Track screen view for guest users
  useScreenTracking("Guest Events Screen", {
    user_type: "guest",
    event_count: events.length,
    is_loading: isLoading,
    has_events: hasEvents || false,
    is_empty: isEmpty || false,
    has_error: hasError || false,
    is_offline: isOffline,
  });

  // Track event list viewed with comprehensive analytics for guest users
  useEffect(() => {
    if (!isLoading && events.length > 0) {
      posthog.capture("event_list_viewed", {
        user_type: "guest",
        event_count: events.length,
        list_type: "all_events",
        screen_context: "guest_events_index",
        has_offline_events: isOffline,
        events_loaded_successfully: !hasError,
        events_with_images: events.filter((event) => !!event.imgURL).length,
        upcoming_events: events.filter((event) => {
          if (!event.dateTime || !(event.dateTime instanceof Timestamp))
            return false;
          return event.dateTime.toDate() > new Date();
        }).length,
        past_events: events.filter((event) => {
          if (!event.dateTime || !(event.dateTime instanceof Timestamp))
            return false;
          return event.dateTime.toDate() <= new Date();
        }).length,
        view_start_time: viewStartTime,
      });
    }
  }, [events, isLoading, hasError, isOffline, posthog, viewStartTime]);

  const handleEventPress = (event: EventData): void => {
    // Track event selection from list for guest users
    posthog.capture("event_selected_from_list", {
      event_id: event.id || event.name,
      event_name: event.name,
      event_location: event.location,
      event_price: event.price,
      user_type: "guest",
      list_position: events.findIndex(
        (e) => e.id === event.id || e.name === event.name
      ),
      total_events_in_list: events.length,
      scroll_depth_percentage: scrollDepth,
      time_on_list: Date.now() - viewStartTime,
      selection_method: "event_card_tap",
    });

    // Navigate using our utility function - pass only the ID (matches Shop pattern)
    const eventId = event.id || event.name;
    navigateToGuestEvent(eventId);
  };

  // Scroll depth tracking handler
  const handleScrollDepthTracking = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollDepth = Math.round(
      (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100
    );

    setScrollDepth(currentScrollDepth);
    setMaxScrollDepth((prev) => Math.max(prev, currentScrollDepth));
  }, []);

  // Track scroll engagement when user leaves the screen
  useEffect(() => {
    return () => {
      if (maxScrollDepth > 0) {
        posthog.capture("event_list_scroll_engagement", {
          user_type: "guest",
          max_scroll_depth_percentage: maxScrollDepth,
          final_scroll_depth_percentage: scrollDepth,
          time_spent_viewing: Date.now() - viewStartTime,
          events_count: events.length,
          scroll_engagement_level:
            maxScrollDepth > 75
              ? "high"
              : maxScrollDepth > 25
              ? "medium"
              : "low",
        });
      }
    };
  }, [maxScrollDepth, scrollDepth, viewStartTime, events.length, posthog]);

  const handlePressIn = useCallback((): void => {
    setIsScrollEnabled(false);
  }, []);

  const handlePressOut = useCallback((): void => {
    // Short delay to ensure the press is registered before re-enabling scroll
    setTimeout(() => setIsScrollEnabled(true), 200);
  }, []);

  const renderEventItem = ({
    item,
    index,
  }: {
    item: EventData;
    index: number;
  }) => {
    const eventId = `${item.name || "unnamed"}-${index}`;
    const [localImageError, setLocalImageError] = useState<boolean>(false);
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

    // Safely format date with fallback
    let formattedDate = "Date TBD";
    try {
      if (item.dateTime && item.dateTime instanceof Timestamp) {
        formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");
      }
    } catch (error) {
      console.warn(`Error formatting date for ${item.name}:`, error);
    }

    // Format price safely
    const priceDisplay =
      typeof item.price === "number"
        ? `$${item.price.toFixed(2)}`
        : typeof item.price === "string"
        ? `$${item.price}`
        : "Price TBD";

    const handleImageLoadSuccess = () => {
      setIsImageLoading(false);
    };

    const handleImageLoadError = (error: Error) => {
      logError(error, "EventListItem.imageLoading", {
        eventId: item.id || eventId,
        eventName: item.name,
      });
      setLocalImageError(true);
      setIsImageLoading(false);
    };

    return (
      <View
        style={styles.eventSlide}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${
          item.name || "Event"
        }, Date: ${formattedDate}, Price: ${priceDisplay}`}
      >
        <ProgressiveImage
          source={
            typeof item.imgURL === "string" && item.imgURL.trim() !== ""
              ? { uri: item.imgURL }
              : require("../../../assets/BlurHero_2.png")
          }
          lowResSource={PROGRESSIVE_PLACEHOLDERS.EVENT}
          fallbackSource={require("../../../assets/BlurHero_2.png")}
          style={styles.eventImage}
          onHighResLoad={handleImageLoadSuccess}
          onLoadError={handleImageLoadError}
          cacheType="EVENT"
          cacheId={`guest-event-list-${item.id || index}`}
          accessibilityLabel={`Image for event ${item.name || "Unnamed event"}`}
        />

        {isImageLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.textPrimary} />
          </View>
        )}

        {/* Gradient overlay at the bottom for better text visibility */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
          style={styles.gradient}
        />

        <View style={styles.eventContent}>
          <Text style={styles.eventName} accessibilityRole="header">
            {item.name || "Unnamed Event"}
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons
                name="cash-outline"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.detailText}>{priceDisplay}</Text>
            </View>

            {item.location && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.detailText}>{item.location}</Text>
              </View>
            )}
          </View>

          <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleEventPress(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`View details for ${item.name} event`}
            >
              <Text style={styles.viewButtonText}>VIEW EVENT</Text>
            </TouchableOpacity>
          </TouchableWithoutFeedback>
        </View>
      </View>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <View
        style={styles.loaderContainer}
        accessibilityLabel="Loading events"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

  // Show network offline state
  if (isOffline) {
    return (
      <View style={styles.emptyContainer} accessibilityLabel="Network error">
        <Ionicons name="cloud-offline" size={70} color={theme.colors.danger} />
        <Text style={styles.emptyTitle}>You're Offline</Text>
        <Text style={styles.emptySubtitle}>
          Please check your connection and try again
        </Text>
        {events.length > 0 && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              NetInfo.fetch().then((state) => setIsOffline(!state.isConnected))
            }
          >
            <Text style={styles.retryButtonText}>
              Show Cached Events ({events.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show error state with retry option
  if (hasError && isEmpty) {
    return (
      <View
        style={styles.emptyContainer}
        accessibilityLabel="Error loading events"
      >
        <Ionicons
          name="alert-circle-outline"
          size={70}
          color={theme.colors.danger}
        />
        <Text style={styles.emptyTitle}>Couldn't Load Events</Text>
        <Text style={styles.emptySubtitle}>
          {error?.message || "Please try again"}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show empty state when no events
  if (isEmpty) {
    return (
      <View
        style={styles.emptyContainer}
        accessibilityLabel="No events available"
      >
        <Ionicons
          name="calendar-outline"
          size={70}
          color={theme.colors.textTertiary}
        />
        <Text style={styles.emptyTitle}>No Events Available</Text>
        <Text style={styles.emptySubtitle}>
          Check back soon for upcoming events
        </Text>
      </View>
    );
  }

  // If there are events but also errors, show a non-intrusive error banner
  const showErrorBanner = hasError && hasEvents;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Events",
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        <AnimatedFlatList
          ref={flatListRef}
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled
          scrollEnabled={isScrollEnabled} // Control scroll with our state
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: handleScrollDepthTracking,
            }
          )}
          onScrollEndDrag={handleScrollDepthTracking}
          accessibilityLabel="Events list"
        />

        {/* Scroll indicator dots */}
        {events.length > 1 && (
          <View style={styles.paginationWrapper}>
            {events.map((_, index) => {
              const inputRange = [
                (index - 1) * SCREEN_HEIGHT,
                index * SCREEN_HEIGHT,
                (index + 1) * SCREEN_HEIGHT,
              ];

              const dotScale = scrollY.interpolate({
                inputRange,
                outputRange: [0.8, 1.4, 0.8],
                extrapolate: "clamp",
              });

              const opacity = scrollY.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: "clamp",
              });

              return (
                <Animated.View
                  key={`dot-${index}`}
                  style={[
                    styles.paginationDot,
                    {
                      transform: [{ scale: dotScale }],
                      opacity,
                    },
                  ]}
                  accessibilityLabel={`Event page indicator ${index + 1} of ${
                    events.length
                  }`}
                />
              );
            })}
          </View>
        )}
      </View>
    </>
  );
};

const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgRoot,
  },
  retryButton: {
    backgroundColor: theme.colors.bgElev2,
    borderWidth: 1,
    borderColor: theme.colors.textPrimary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryButtonText: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  errorBanner: {
    position: "absolute" as const,
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    padding: 10,
    zIndex: 1000,
  },
  errorBannerText: {
    fontFamily,
    color: theme.colors.textPrimary,
    textAlign: "center" as const,
    fontSize: 14,
  },
  loaderText: {
    color: theme.colors.textPrimary,
    marginTop: 12,
    fontFamily,
    fontSize: 16,
  },
  eventSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: "relative" as const,
  },
  eventImage: {
    width: "100%" as const,
    height: "100%" as const,
    position: "absolute" as const,
  },
  loadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  gradient: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%" as const,
  },
  eventContent: {
    position: "absolute" as const,
    bottom: Platform.OS === "ios" ? 165 : 95,
    left: 0,
    right: 0,
    padding: 20,
  },
  eventName: {
    fontFamily,
    fontWeight: "700" as const,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  detailsContainer: {
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 6,
  },
  detailText: {
    fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginLeft: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1.5,
    borderColor: theme.colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "flex-start" as const,
  },
  viewButtonText: {
    fontFamily,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  headerContainer: {
    position: "absolute" as const,
    top: Platform.OS === "ios" ? 50 : 30,
    zIndex: 10,
    width: "100%" as const,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 20,
  },
  emptyTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily,
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: "center" as const,
  },
  paginationWrapper: {
    position: "absolute" as const,
    right: 15,
    top: "50%" as const,
    transform: [{ translateY: -50 }],
    alignItems: "center" as const,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textPrimary,
    marginVertical: 3,
  },
});

export default GuestEvent;
