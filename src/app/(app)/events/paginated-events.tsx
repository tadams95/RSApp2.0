import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useScreenTracking } from "../../../analytics/PostHogProvider";
import PaginatedList from "../../../components/ui/PaginatedList";
import { EventData } from "../../../utils/eventDataHandler";

// Default font family for styling consistency
const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

/**
 * PaginatedEventsScreen component displaying events with robust pagination
 * and error handling for cursor errors, out-of-bounds requests, and network issues
 */
export default function PaginatedEventsScreen() {
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  // Track screen view for analytics
  useScreenTracking("Paginated Events", {
    userType: "authenticated",
    screenType: "pagination",
    loadedImagesCount: Object.keys(loadedImages).length,
  });

  // Handle image load events
  const handleImageLoad = (eventId: string) => {
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  // Navigate to event details
  const handleEventPress = (event: EventData) => {
    try {
      // Format date safely with fallback
      let formattedDateTime = "Date TBD";
      if (event.dateTime && event.dateTime instanceof Timestamp) {
        formattedDateTime = format(
          event.dateTime.toDate(),
          "MMM dd, yyyy hh:mm a"
        );
      }

      // Navigate to event details
      router.push({
        pathname: "/(app)/events/[id]",
        params: {
          id: event.id,
          eventData: encodeURIComponent(JSON.stringify(event)),
        },
      });
    } catch (error) {
      console.error(`Error navigating to event ${event?.name}:`, error);
    }
  };

  // Render individual event card
  const renderEventCard = ({
    item,
    index,
  }: {
    item: EventData;
    index: number;
  }) => {
    // Format date safely with fallback
    let formattedDate = "Date TBD";
    try {
      if (item.dateTime && item.dateTime instanceof Timestamp) {
        formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");
      }
    } catch (error) {
      console.warn(`Error formatting date for ${item.name}:`, error);
    }

    const eventId = `${item.id}-${index}`;
    const isImageLoaded = loadedImages[eventId];
    const remainingTickets =
      typeof item.quantity === "number" ? item.quantity : 0;

    // Calculate price display
    const priceDisplay =
      typeof item.price === "number"
        ? `$${item.price.toFixed(2)}`
        : typeof item.price === "string"
        ? `$${item.price}`
        : "Price TBD";

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.9}
        disabled={remainingTickets <= 0}
        accessible={true}
        accessibilityLabel={`${item.name}, ${formattedDate}, ${priceDisplay}`}
      >
        <View style={styles.cardImageContainer}>
          {!isImageLoaded && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <Ionicons name="image-outline" size={36} color="#666" />
              </View>
            </View>
          )}

          <Image
            source={
              item.imgURL && typeof item.imgURL === "string"
                ? { uri: item.imgURL }
                : require("../../../assets/BlurHero_2.png")
            }
            style={styles.cardImage}
            resizeMode="cover"
            onLoad={() => handleImageLoad(eventId)}
          />

          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{priceDisplay}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.eventName} numberOfLines={2}>
            {item.name}
          </Text>

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
      </TouchableOpacity>
    );
  };

  // Filter for events that haven't happened yet
  const currentDate = new Date();
  const futureEventsFilter: [string, any, any][] = [
    ["dateTime", ">=", currentDate],
  ];

  // Create a type that extends EventData with required id field
  type EventDataWithId = EventData & { id: string };

  return (
    <View style={styles.container}>
      <PaginatedList<EventDataWithId>
        collectionPath="events"
        renderItem={renderEventCard as any}
        pageSize={5}
        orderByField="dateTime"
        orderDirection="asc"
        whereConditions={futureEventsFilter}
        persistKey="future-events"
        emptyText="No upcoming events found"
        errorText="Error loading events. Please try again."
        loadingText="Loading events..."
        refreshable={true}
        showPaginationControls={true}
        headerComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Upcoming Events</Text>
            <Text style={styles.headerSubtitle}>
              Browse and discover events happening near you
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Component styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    paddingVertical: 16,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily,
    fontSize: 16,
    color: "#999",
    marginBottom: 10,
  },
  eventCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  cardImageContainer: {
    height: 180,
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    padding: 16,
  },
  eventName: {
    fontFamily,
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginBottom: 12,
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontFamily,
    fontSize: 14,
    color: "white",
    marginLeft: 8,
  },
  priceTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  priceText: {
    fontFamily,
    fontWeight: "700",
    color: "white",
    fontSize: 16,
  },
  viewButton: {
    backgroundColor: "#333",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
  },
  viewButtonText: {
    fontFamily,
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  disabledButton: {
    backgroundColor: "#222",
    borderColor: "#444",
  },
});
