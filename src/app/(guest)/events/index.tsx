import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import {
  collection,
  getDocs,
  getFirestore,
  Timestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { navigateToGuestEvent } from "../../../utils/navigation";

// Import our enhanced components and hooks
import NetInfo from "@react-native-community/netinfo"; // For network status checking
import { ProgressiveImage } from "../../../components/ui";
import { extractDatabaseErrorCode } from "../../../utils/databaseErrorHandler";
import {
  getRetryBackoffTime,
  handleEventFetchError,
  sanitizeEventData,
  shouldRetryEventFetch,
} from "../../../utils/eventDataHandler";
import { PROGRESSIVE_PLACEHOLDERS } from "../../../utils/imageCacheConfig";
import { logError } from "../../../utils/logError";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Define types for event data
interface EventData {
  id?: string;
  name: string;
  dateTime: Timestamp;
  price: string | number;
  imgURL: string;
  description?: string;
  location: string;
  capacity?: number;
  [key: string]: any; // For any additional fields in the document
}

// Create animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(
  Animated.FlatList<EventData>
);

const GuestEvent: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const flatListRef = useRef<Animated.FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrollEnabled, setIsScrollEnabled] = useState<boolean>(true);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Function to fetch event data with error handling
  const fetchEventData = useCallback(async (): Promise<void> => {
    try {
      // Clear previous errors
      setErrorMessage(null);

      const db = getFirestore();
      const eventCollectionRef = collection(db, "events");
      const eventSnapshot = await getDocs(eventCollectionRef);

      const currentDate = new Date();

      // Filter out past events with added sanitization and error handling
      const eventData = eventSnapshot.docs
        .map((doc) => {
          // Apply data sanitization to each event
          const rawData = { id: doc.id, ...doc.data() };
          return sanitizeEventData(rawData);
        })
        .filter((event) => {
          try {
            if (!event.dateTime) return false;
            const eventDateTime = event.dateTime.toDate();
            return eventDateTime >= currentDate;
          } catch (error) {
            console.warn("Date filtering error for event:", event.name, error);
            return false; // Skip this event if date can't be processed
          }
        })
        .sort((a, b) => {
          // Sort events by date with error handling
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
        "GuestEvent.fetchEventData",
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
    } finally {
      setIsLoading(false);
    }
  }, [retryAttempts]);

  // Trigger event fetching
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

  const handleEventPress = (event: EventData): void => {
    // Format date for display and navigation
    const formattedDateTime = format(
      event.dateTime.toDate(),
      "MMM dd, yyyy hh:mm a"
    );

    // Navigate using our utility function
    navigateToGuestEvent({
      id: event.id || event.name,
      name: event.name,
      dateTime: formattedDateTime,
      price: event.price.toString(),
      imgURL: event.imgURL,
      description: event.description || "",
      location: event.location || "",
    });
  };

  // Removed handleImageLoad and handleImageError as we now handle image loading
  // with individual state in each renderEventItem render function

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
            <ActivityIndicator size="large" color="white" />
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
              <Ionicons name="calendar-outline" size={18} color="white" />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={18} color="white" />
              <Text style={styles.detailText}>{priceDisplay}</Text>
            </View>

            {item.location && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={18} color="white" />
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
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

  // Show network offline state
  if (isOffline) {
    return (
      <View style={styles.emptyContainer} accessibilityLabel="Network error">
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
      <View
        style={styles.emptyContainer}
        accessibilityLabel="Error loading events"
      >
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
      <View
        style={styles.emptyContainer}
        accessibilityLabel="No events available"
      >
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
            { useNativeDriver: true }
          )}
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

const styles = StyleSheet.create({
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
    height: "70%", // Increased to cover more of the screen
  },
  eventContent: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 165 : 95, // Significantly increased for all devices
    left: 0,
    right: 0,
    padding: 20,
  },
  eventName: {
    fontFamily,
    fontWeight: "700",
    fontSize: 24, // Further reduced for better fit
    color: "white",
    marginBottom: 10, // Further reduced spacing
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  detailsContainer: {
    marginBottom: 14, // Further reduced spacing
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6, // Further reduced spacing
  },
  detailText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    marginLeft: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  viewButtonText: {
    fontFamily,
    fontWeight: "600",
    color: "white",
    fontSize: 14,
  },
  headerContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    zIndex: 10,
    width: "100%",
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
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
});

export default GuestEvent;
