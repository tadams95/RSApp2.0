import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo"; // For network status checking
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageStyle,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";

// Import React Query hooks
import { useEventsWithHelpers } from "../../../hooks/useEvents";

// Import our event data type
import { EventData } from "../../../utils/eventDataHandler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Create animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<EventData>);

export default function EventsScreen() {
  // Use React Query for events data
  const { events, isLoading, error, refetch, hasEvents, isEmpty, hasError } =
    useEventsWithHelpers();
  const posthog = usePostHog();

  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isOffline, setIsOffline] = useState(false);
  const flatListRef = useRef<FlatList<EventData>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Scroll depth tracking state
  const [scrollDepth, setScrollDepth] = useState(0);
  const [maxScrollDepth, setMaxScrollDepth] = useState(0);
  const [viewStartTime] = useState(Date.now());

  // Track screen view
  useScreenTracking("Events Screen", {
    user_type: "authenticated",
    event_count: events.length,
    is_loading: isLoading,
    has_events: hasEvents || false,
    is_empty: isEmpty || false,
    has_error: hasError || false,
    is_offline: isOffline,
  });

  // Track event list viewed with comprehensive analytics
  useEffect(() => {
    if (!isLoading && events.length > 0) {
      posthog.capture("event_list_viewed", {
        user_type: "authenticated",
        event_count: events.length,
        list_type: "all_events",
        screen_context: "events_index",
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

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Scroll depth tracking handler
  const handleScroll = useCallback((event: any) => {
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
          user_type: "authenticated",
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

  const handleEventPress = useCallback((event: EventData) => {
    // Track event selection from list
    posthog.capture("event_selected_from_list", {
      event_id: event.id || event.name,
      event_name: event.name,
      event_location: event.location,
      event_price: event.price,
      user_type: "authenticated",
      list_position: events.findIndex(
        (e) => e.id === event.id || e.name === event.name
      ),
      total_events_in_list: events.length,
      scroll_depth_percentage: scrollDepth,
      time_on_list: Date.now() - viewStartTime,
      selection_method: "event_card_tap",
    });

    // Format date safely with fallback
    let formattedDateTime = "Date TBD";
    try {
      if (event.dateTime && event.dateTime instanceof Timestamp) {
        formattedDateTime = format(
          event.dateTime.toDate(),
          "MMM dd, yyyy hh:mm a"
        );
      }
    } catch (error) {
      console.warn(`Error formatting date for ${event.name}:`, error);
    }

    // Ensure we have a valid ID for navigation
    const eventId = event.id || event.name || `event-${Date.now()}`;

    try {
      router.push({
        pathname: `/(app)/events/${eventId}`,
        params: {
          id: eventId,
          eventData: JSON.stringify({
            ...event,
            dateTime: formattedDateTime,
          }),
        },
      });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert(
        "Navigation Error",
        "Could not open event details. Please try again."
      );
    }
  }, []);

  const handleImageLoad = (eventId: string) => {
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  const handleImageError = (eventId: string) => {
    console.warn(`Failed to load image for event: ${eventId}`);
    // Mark as loaded to remove spinner, will show fallback or placeholder
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  const renderEventItem = useCallback(
    ({ item, index }: { item: EventData; index: number }) => {
      const eventId = `${item.name || "unnamed"}-${index}`;
      const isImageLoaded = loadedImages[eventId];

      // Safely format date with fallback
      let formattedDate = "Date TBD";
      try {
        if (item.dateTime && item.dateTime instanceof Timestamp) {
          formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");
        }
      } catch (error) {
        console.warn(`Error formatting date for ${item.name}:`, error);
      }

      const remainingTickets =
        typeof item.quantity === "number" ? item.quantity : 0;

      return (
        <View style={styles.eventSlide}>
          <Image
            source={
              typeof item.imgURL === "string" && item.imgURL.trim() !== ""
                ? { uri: item.imgURL }
                : require("../../../assets/BlurHero_2.png")
            }
            style={styles.eventImage}
            onLoad={() => handleImageLoad(eventId)}
            onError={() => handleImageError(eventId)}
            defaultSource={require("../../../assets/BlurHero_2.png")}
          />

          {!isImageLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}

          {/* Gradient overlay for better text visibility */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
            style={styles.gradient}
          />

          {/* Price tag */}
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>
              ${typeof item.price === "number" ? item.price.toFixed(2) : "0.00"}
            </Text>
          </View>

          <View style={styles.eventContent}>
            <Text style={styles.eventName}>{item.name || "Unnamed Event"}</Text>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={18} color="white" />
                <Text style={styles.detailText}>{formattedDate}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={18} color="white" />
                <Text style={styles.detailText}>
                  {item.location || "Location TBA"}
                </Text>
              </View>

              {remainingTickets > 0 ? (
                <View style={styles.detailRow}>
                  <Ionicons name="ticket-outline" size={18} color="#4ade80" />
                  <Text style={[styles.detailText, { color: "#4ade80" }]}>
                    Tickets available
                  </Text>
                </View>
              ) : (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#ef4444"
                  />
                  <Text style={[styles.detailText, { color: "#ef4444" }]}>
                    Sold out
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.viewButton,
                remainingTickets <= 0 && styles.disabledButton,
              ]}
              onPress={() => handleEventPress(item)}
              disabled={remainingTickets <= 0}
            >
              <Text style={styles.viewButtonText}>
                {remainingTickets > 0 ? "VIEW EVENT" : "SOLD OUT"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handleEventPress, loadedImages]
  );

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

  // Show network offline state
  if (isOffline) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cloud-offline" size={70} color="#ef4444" />
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
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={70} color="#ef4444" />
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
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={70} color="#555" />
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
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Show error banner if there are events but we also have errors */}
      {showErrorBanner && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => refetch()}>
          <Text style={styles.errorBannerText}>
            {error?.message || "Error loading events"} (Tap to retry)
          </Text>
        </TouchableOpacity>
      )}

      <AnimatedFlatList
        ref={flatListRef}
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item, index) =>
          `${item.id || item.name || "event"}-${index}`
        }
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll,
          }
        )}
        onScrollEndDrag={handleScroll}
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
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

interface Styles {
  container: ViewStyle;
  loaderContainer: ViewStyle;
  loaderText: TextStyle;
  eventSlide: ViewStyle;
  eventImage: ImageStyle;
  loadingOverlay: ViewStyle;
  gradient: ViewStyle;
  priceTag: ViewStyle;
  priceText: TextStyle;
  eventContent: ViewStyle;
  eventName: TextStyle;
  detailsContainer: ViewStyle;
  detailRow: ViewStyle;
  detailText: TextStyle;
  viewButton: ViewStyle;
  disabledButton: ViewStyle;
  viewButtonText: TextStyle;
  emptyContainer: ViewStyle;
  emptyTitle: TextStyle;
  emptySubtitle: TextStyle;
  paginationWrapper: ViewStyle;
  paginationDot: ViewStyle;
  retryButton: ViewStyle;
  retryButtonText: TextStyle;
  errorBanner: ViewStyle;
  errorBannerText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  loaderText: {
    color: "white",
    marginTop: 12,
    fontFamily,
    fontSize: 16,
  },
  eventSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%",
  },
  priceTag: {
    position: "absolute",
    top: Platform.OS === "ios" ? 55 : 35,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 100,
  },
  priceText: {
    fontFamily,
    fontWeight: "700",
    color: "white",
    fontSize: 16,
  },
  eventContent: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 165 : 95, // Standardized to match guest layout for optimal screen utilization
    left: 0,
    right: 0,
    padding: 20,
  },
  eventName: {
    fontFamily,
    fontWeight: "700",
    fontSize: 24,
    color: "white",
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  detailsContainer: {
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    marginLeft: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    flexShrink: 1,
  },
  viewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1.5,
    borderColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  disabledButton: {
    borderColor: "#999",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  viewButtonText: {
    fontFamily,
    fontWeight: "600",
    color: "white",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: "600",
    color: "white",
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily,
    fontSize: 16,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  paginationWrapper: {
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -50 }],
    alignItems: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
    marginVertical: 3,
  },
  retryButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryButtonText: {
    fontFamily,
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    padding: 10,
    zIndex: 1000,
  },
  errorBannerText: {
    fontFamily,
    color: "white",
    textAlign: "center",
    fontSize: 14,
  },
});
