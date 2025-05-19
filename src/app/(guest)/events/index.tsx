import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { navigateToGuestEvent } from "../../../utils/navigation";

// Import Firebase
import { getFirestore } from "firebase/firestore";

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
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<Animated.FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrollEnabled, setIsScrollEnabled] = useState<boolean>(true);

  useEffect(() => {
    const fetchEventData = async (): Promise<void> => {
      try {
        const db = getFirestore();
        const eventCollectionRef = collection(db, "events");
        const eventSnapshot = await getDocs(eventCollectionRef);

        const currentDate = new Date();

        // Filter out past events
        const eventData = eventSnapshot.docs
          .map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as EventData)
          )
          .filter((event) => {
            if (!event.dateTime) return false;
            const eventDateTime = event.dateTime.toDate();
            return eventDateTime >= currentDate;
          })
          .sort((a, b) => {
            // Sort events by date
            return (
              a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime()
            );
          });

        setEvents(eventData);
      } catch (error) {
        console.error("Error fetching event data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, []);

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

  const handleImageLoad = (eventId: string): void => {
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

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
    const eventId = item.name + index;
    const isImageLoaded = loadedImages[eventId];
    const formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");

    return (
      <View
        style={styles.eventSlide}
        accessibilityRole="button"
        accessibilityLabel={`Event: ${item.name}, Date: ${formattedDate}, Price: $${item.price}`}
      >
        <Image
          source={{ uri: item.imgURL }}
          style={styles.eventImage}
          onLoad={() => handleImageLoad(eventId)}
          accessibilityLabel={`Image for event ${item.name}`}
        />

        {!isImageLoaded && (
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
            {item.name}
          </Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={18} color="white" />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={18} color="white" />
              <Text style={styles.detailText}>${item.price}</Text>
            </View>
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
