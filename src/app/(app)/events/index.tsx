import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { db } from "../../../firebase/firebase";

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
  const flatListRef = useRef<FlatList<EventData>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchEventData = useCallback(async () => {
    try {
      const currentDate = new Date();
      const eventCollectionRef = collection(db, "events");
      const q = query(eventCollectionRef, where("dateTime", ">=", currentDate));
      const eventSnapshot = await getDocs(q);

      const eventData = eventSnapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as EventData)
        )
        .sort((a, b) => {
          // Sort events by date
          return a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime();
        });

      setEvents(eventData);
    } catch (error) {
      console.error("Error fetching event data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleEventPress = useCallback((event: EventData) => {
    const formattedDateTime = format(
      event.dateTime.toDate(),
      "MMM dd, yyyy hh:mm a"
    );

    router.push({
      pathname: `/(app)/events/${event.id || event.name}`,
      params: {
        id: event.id || event.name,
        eventData: JSON.stringify({
          ...event,
          dateTime: formattedDateTime,
        }),
      },
    });
  }, []);

  const handleImageLoad = (eventId: string) => {
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  const renderEventItem = useCallback(
    ({ item, index }: { item: EventData; index: number }) => {
      const eventId = `${item.name}-${index}`;
      const isImageLoaded = loadedImages[eventId];
      const formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");
      const remainingTickets = item.quantity || 0;

      return (
        <View style={styles.eventSlide}>
          <Image
            source={{ uri: item.imgURL }}
            style={styles.eventImage}
            onLoad={() => handleImageLoad(eventId)}
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
            <Text style={styles.priceText}>${item.price}</Text>
          </View>

          <View style={styles.eventContent}>
            <Text style={styles.eventName}>{item.name}</Text>

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

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <AnimatedFlatList
        ref={flatListRef}
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item, index) => `${item.id || item.name}-${index}`}
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
});
