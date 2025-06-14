import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo"; // For network status checking
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
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

// Import from firebase

// Import our error handling utilities
import { extractDatabaseErrorCode } from "../../../utils/databaseErrorHandler";
import {
  getRetryBackoffTime,
  handleEventFetchError,
  sanitizeEventData,
  shouldRetryEventFetch,
} from "../../../utils/eventDataHandler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Define our types
interface EventData {
  id?: string;
  name: string;
  dateTime: Timestamp;
  location: string;
  price: number;
  imgURL: string;
  quantity: number;
  description?: string;
  attendingCount?: number;
}

// Create animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<EventData>);

export default function EventsScreen() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const flatListRef = useRef<FlatList<EventData>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const fetchEventData = useCallback(async () => {
    try {
      // Clear previous errors
      setErrorMessage(null);

      // Use getFirestore instead of imported db to avoid type issues
      const firestore = getFirestore();
      const currentDate = new Date();
      const eventCollectionRef = collection(firestore, "events");
      const q = query(eventCollectionRef, where("dateTime", ">=", currentDate));
      const eventSnapshot = await getDocs(q);

      const eventData = eventSnapshot.docs
        .map((doc) => {
          // Apply data sanitization to each event
          const rawData = { id: doc.id, ...doc.data() };
          return sanitizeEventData(rawData);
        })
        .sort((a, b) => {
          // Sort events by date - with fallback for invalid dates
          try {
            return (
              a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime()
            );
          } catch (error) {
            console.warn("Date sorting error, using current time as fallback");
            return 0; // Default to equality if dates can't be compared
          }
        });

      // Reset retry attempts on success
      setRetryAttempts(0);
      setEvents(eventData);
    } catch (error) {
      // Get the specific error code
      const errorCode = extractDatabaseErrorCode(error);

      // Log detailed error info
      const userMessage = handleEventFetchError(
        error,
        "EventsScreen.fetchEventData",
        {
          retryAttempt: retryAttempts,
        }
      );

      setErrorMessage(userMessage);

      // Check if retry is appropriate
      if (shouldRetryEventFetch(errorCode, retryAttempts)) {
        const backoffTime = getRetryBackoffTime(retryAttempts);

        console.log(
          `Retrying event fetch in ${backoffTime}ms (attempt ${
            retryAttempts + 1
          })`
        );

        // Schedule retry
        setTimeout(() => {
          setRetryAttempts((prev) => prev + 1);
        }, backoffTime);
      }

      // Keep existing events if any, don't clear them on error
      // This allows showing stale data if available
    } finally {
      setIsLoading(false);
    }
  }, [retryAttempts]);

  useEffect(() => {
    fetchEventData();

    // Also fetch when coming back online
    const handleOnlineStatus = () => {
      if (!isOffline && events.length === 0) {
        setIsLoading(true);
        fetchEventData();
      }
    };

    // Listen for offline/online transitions
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && isOffline) {
        handleOnlineStatus();
      }
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, [fetchEventData, isOffline, events.length]);

  const handleEventPress = useCallback((event: EventData) => {
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
  if (errorMessage && events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={70} color="#ef4444" />
        <Text style={styles.emptyTitle}>Couldn't Load Events</Text>
        <Text style={styles.emptySubtitle}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsLoading(true);
            setRetryAttempts(0);
            fetchEventData();
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show empty state when no events
  if (events.length === 0) {
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
  const showErrorBanner = errorMessage && events.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Show error banner if there are events but we also have errors */}
      {showErrorBanner && (
        <TouchableOpacity
          style={styles.errorBanner}
          onPress={() => {
            setIsLoading(true);
            setRetryAttempts(0);
            fetchEventData();
          }}
        >
          <Text style={styles.errorBannerText}>
            {errorMessage} (Tap to retry)
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
          { useNativeDriver: true }
        )}
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
    bottom: Platform.OS === "ios" ? 150 : 80,
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
