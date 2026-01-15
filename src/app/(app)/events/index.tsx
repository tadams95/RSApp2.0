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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProgressiveImage } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isOffline, setIsOffline] = useState(false);
  const flatListRef = useRef<FlatList<EventData>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

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
      // Match Shop pattern: pass only the ID, let detail page fetch fresh data
      router.push(`/(app)/events/${eventId}`);
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
          <ProgressiveImage
            source={
              typeof item.imgURL === "string" && item.imgURL.trim() !== ""
                ? { uri: item.imgURL }
                : require("../../../assets/BlurHero_2.png")
            }
            style={styles.eventImage}
            lowResSource={require("../../../assets/BlurHero_2.png")}
            onHighResLoad={() => handleImageLoad(eventId)}
            onLoadError={() => handleImageError(eventId)}
            fallbackSource={require("../../../assets/BlurHero_2.png")}
            contentFit="cover"
            cacheType="EVENT"
            cacheId={eventId}
          />

          {!isImageLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator
                size="large"
                color={theme.colors.textPrimary}
              />
            </View>
          )}

          {/* Gradient overlay for better text visibility */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.85)"]}
            locations={[0, 0.5, 1]}
            style={styles.gradient}
          />

          {/* Price tag */}
          <View style={[styles.priceTag, { top: insets.top + 20 }]}>
            <Text style={styles.priceText}>
              ${typeof item.price === "number" ? item.price.toFixed(2) : "0.00"}
            </Text>
          </View>

          <View style={styles.eventContent}>
            <View style={styles.eventCard}>
              <Text style={styles.eventName}>
                {item.name || "Unnamed Event"}
              </Text>

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.colors.textPrimary}
                    />
                  </View>
                  <Text style={styles.detailText}>{formattedDate}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={theme.colors.textPrimary}
                    />
                  </View>
                  <Text style={styles.detailText} numberOfLines={2}>
                    {item.location || "Location TBA"}
                  </Text>
                </View>

                {remainingTickets > 0 ? (
                  <View style={styles.detailRow}>
                    <View style={[styles.iconContainer, styles.successIconBg]}>
                      <Ionicons
                        name="ticket-outline"
                        size={16}
                        color={theme.colors.success}
                      />
                    </View>
                    <Text style={[styles.detailText, styles.successText]}>
                      Tickets available
                    </Text>
                  </View>
                ) : (
                  <View style={styles.detailRow}>
                    <View style={[styles.iconContainer, styles.dangerIconBg]}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={16}
                        color={theme.colors.danger}
                      />
                    </View>
                    <Text style={[styles.detailText, styles.dangerText]}>
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
                activeOpacity={0.8}
              >
                <Text style={styles.viewButtonText}>
                  {remainingTickets > 0 ? "VIEW EVENT" : "SOLD OUT"}
                </Text>
              </TouchableOpacity>
            </View>
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
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

  // Show network offline state
  if (isOffline) {
    return (
      <View style={styles.emptyContainer}>
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
      <View style={styles.emptyContainer}>
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
      <View style={styles.emptyContainer}>
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

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.bgRoot,
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
      position: "relative",
    },
    eventImage: {
      width: "100%",
      height: "100%",
      position: "absolute",
      resizeMode: "cover",
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
      color: theme.colors.textPrimary,
      fontSize: 16,
    },
    eventContent: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 165 : 95,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
    },
    eventCard: {
      backgroundColor: "rgba(20, 20, 20, 0.85)",
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
      // Subtle shadow for depth
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    eventName: {
      fontFamily,
      fontWeight: "700",
      fontSize: 22,
      color: theme.colors.textPrimary,
      marginBottom: 14,
      letterSpacing: 0.3,
    },
    detailsContainer: {
      marginBottom: 16,
      gap: 10,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconContainer: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    successIconBg: {
      backgroundColor: "rgba(76, 175, 80, 0.15)",
    },
    dangerIconBg: {
      backgroundColor: "rgba(244, 67, 54, 0.15)",
    },
    detailText: {
      fontFamily,
      fontSize: 15,
      color: theme.colors.textPrimary,
      flexShrink: 1,
      opacity: 0.95,
    },
    successText: {
      color: theme.colors.success,
      fontWeight: "600",
    },
    dangerText: {
      color: theme.colors.danger,
      fontWeight: "600",
    },
    viewButton: {
      backgroundColor: theme.colors.accent || "rgba(255, 255, 255, 0.15)",
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 10,
      alignSelf: "flex-start",
    },
    disabledButton: {
      backgroundColor: "rgba(80, 80, 80, 0.6)",
    },
    viewButtonText: {
      fontFamily,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      fontSize: 14,
      letterSpacing: 0.5,
    },
    emptyContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyTitle: {
      fontFamily,
      fontSize: 22,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginTop: 16,
    },
    emptySubtitle: {
      fontFamily,
      fontSize: 16,
      color: theme.colors.textSecondary,
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
      backgroundColor: theme.colors.textPrimary,
      marginVertical: 3,
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
      fontWeight: "600",
    },
    errorBanner: {
      position: "absolute",
      top: Platform.OS === "ios" ? 50 : 30,
      left: 0,
      right: 0,
      backgroundColor: `${theme.colors.danger}E6`, // 90% opacity
      padding: 10,
      zIndex: 1000,
    },
    errorBannerText: {
      fontFamily,
      color: theme.colors.textPrimary,
      textAlign: "center",
      fontSize: 14,
    },
  } as const);
