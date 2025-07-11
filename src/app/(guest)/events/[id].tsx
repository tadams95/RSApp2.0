import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProgressiveImage } from "../../../components/ui";
import { useEventAttendingCountWithHelpers } from "../../../hooks/useEvents";
import { useFirebaseImage } from "../../../hooks/useFirebaseImage";
import { PROGRESSIVE_PLACEHOLDERS } from "../../../utils/imageCacheConfig";
import { logError } from "../../../utils/logError";
import { goBack, navigateToAuth } from "../../../utils/navigation";

// Define interfaces for the component props and parameters
interface EventDetailParams {
  id: string;
  name: string;
  dateTime: string;
  price: string;
  imgURL: string;
  description?: string;
  location: string;
}

const GuestEventView: React.FC = () => {
  // Get route parameters from Expo Router
  const params = useLocalSearchParams<Record<string, string>>();
  const posthog = usePostHog();

  const eventName = params.name as string;
  const eventImgURL = params.imgURL as string;
  const eventLocation = params.location as string;
  const eventPrice = params.price as string;
  const eventDateTime = params.dateTime as string;
  const eventDescription = params.description as string;

  // Use React Query for attending count
  const { attendingCount, isLoading, error, refetch } =
    useEventAttendingCountWithHelpers(eventName);

  // Use the Firebase image hook for improved error handling and caching
  const {
    imageSource,
    isLoading: imageIsLoading,
    error: imageError,
    reload: reloadImage,
  } = useFirebaseImage(eventImgURL || null, {
    fallbackImage: require("../../../assets/BlurHero_2.png"),
    cacheExpiry: 3600000, // 1 hour cache
  });

  // Track screen view for analytics
  useScreenTracking("Guest Event Detail", {
    eventId: params.id,
    eventName: eventName,
    eventLocation: eventLocation,
    eventPrice: eventPrice,
    userType: "guest",
    attendingCount: attendingCount,
    isLoading: isLoading,
    hasImage: !!eventImgURL,
  });

  // Track detailed event_viewed analytics for guest users
  useEffect(() => {
    if (eventName && !isLoading) {
      posthog.capture("event_viewed", {
        event_id: params.id,
        event_name: eventName || "Unknown Event",
        event_date: eventDateTime || null,
        event_location: eventLocation || "Unknown Location",
        event_price: parseFloat(eventPrice) || 0,
        event_description_length: eventDescription
          ? eventDescription.length
          : 0,
        has_event_description: !!eventDescription,
        has_event_image: !!eventImgURL,
        attending_count: attendingCount,
        user_type: "guest",
        viewing_context: "detail_screen",
        event_date_from_now_days: eventDateTime
          ? Math.ceil(
              (new Date(eventDateTime).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
        screen_load_time: Date.now(),
      });
    }
  }, [
    eventName,
    isLoading,
    attendingCount,
    params.id,
    posthog,
    eventDateTime,
    eventLocation,
    eventPrice,
    eventDescription,
    eventImgURL,
  ]);

  const handleGuestCheckout = (): void => {
    // Track guest checkout attempt
    posthog.capture("guest_event_checkout_attempt", {
      event_id: params.id,
      event_name: eventName,
      event_location: eventLocation,
      event_price: parseFloat(eventPrice) || 0,
      user_type: "guest",
      conversion_trigger: "event_detail_checkout",
    });

    navigateToAuth();
  };

  const handleBackPress = (): void => {
    goBack();
  };

  const handleOpenMaps = (): void => {
    if (!eventLocation) return;

    // Track location button tap for guest users
    posthog.capture("event_location_tapped", {
      event_id: params.id,
      event_name: eventName,
      event_location: eventLocation,
      user_type: "guest",
      platform: Platform.OS,
      interaction_type: "location_button",
    });

    const address = eventLocation;
    const encodedAddress = encodeURIComponent(address);

    let url: string;
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?address=${encodedAddress}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }

    Linking.openURL(url);
  };

  const handleImageLoadSuccess = (): void => {
    // Track successful hero image load for guest users
    posthog.capture("event_hero_image_loaded", {
      event_id: params.id,
      event_name: eventName || "Unknown Event",
      user_type: "guest",
      image_load_success: true,
      has_fallback_used: false,
    });
  };

  const handleImageLoadError = (error: Error): void => {
    // Log image loading error
    logError(error, "GuestEventView.imageLoading", {
      eventId: params.id,
      eventName: eventName,
    });
  };

  return (
    <View style={styles.rootContainer}>
      <Stack.Screen
        options={{
          title: eventName || "Event Details",
          headerShown: false,
        }}
      />
      <StatusBar barStyle="light-content" />

      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          accessible={true}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          {imageIsLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
          <ProgressiveImage
            source={imageSource}
            lowResSource={PROGRESSIVE_PLACEHOLDERS.EVENT}
            style={styles.eventImage}
            onHighResLoad={handleImageLoadSuccess}
            onLoadError={handleImageLoadError}
            fallbackSource={require("../../../assets/BlurHero_2.png")}
            cacheType="EVENT"
            cacheId={`guest-event-${params.id}`}
            resizeMode="cover"
            accessibilityLabel={`Image for ${eventName} event`}
          />

          {imageError && (
            <TouchableOpacity
              style={styles.imageRetryButton}
              onPress={reloadImage}
              accessibilityLabel="Retry loading image"
              accessibilityRole="button"
            >
              <Text style={styles.imageRetryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Event Info Section */}
        <View style={styles.eventInfoContainer}>
          {/* Title and Price */}
          <View style={styles.titlePriceContainer}>
            <Text style={styles.title} accessibilityRole="header">
              {eventName}
            </Text>
            <Text style={styles.price}>${eventPrice}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <View style={styles.detailsContainer}>
              <View
                style={styles.detailRow}
                accessibilityLabel={`Date and time: ${eventDateTime}`}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="white"
                  style={styles.icon}
                />
                <Text style={styles.detailText}>{eventDateTime}</Text>
              </View>

              <TouchableOpacity
                onPress={handleOpenMaps}
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Location: ${eventLocation}. Tap to open maps`}
                accessibilityRole="button"
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="white"
                  style={styles.icon}
                />
                <Text style={styles.locationText}>{eventLocation}</Text>
              </TouchableOpacity>

              <View
                style={styles.detailRow}
                accessibilityLabel={`${
                  isLoading
                    ? "Loading attendance count"
                    : `${attendingCount} people attending`
                }`}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color="white"
                  style={styles.icon}
                />
                <Text style={styles.detailText}>
                  {isLoading ? "Loading..." : `${attendingCount} attending`}
                </Text>
              </View>

              {eventDescription && (
                <View
                  style={[styles.detailRow, { borderBottomWidth: 0 }]}
                  accessibilityLabel={`Description: ${eventDescription}`}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="white"
                    style={styles.icon}
                  />
                  <Text style={styles.detailText}>{eventDescription}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGuestCheckout}
            accessible={true}
            accessibilityLabel="Log in or sign up to check out"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>
              LOG IN OR SIGN UP TO CHECK OUT
            </Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimerText}>
            Create an account or log in to purchase this ticket and access more
            features.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "black",
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    height: windowWidth * 1.1,
    position: "relative",
    backgroundColor: "#111",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 10,
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  eventInfoContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  titlePriceContainer: {
    marginBottom: 20,
  },
  title: {
    fontFamily,
    fontWeight: "700",
    color: "white",
    fontSize: 24,
    marginBottom: 8,
  },
  price: {
    fontFamily,
    color: "white",
    fontSize: 18,
    opacity: 0.9,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily,
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  detailsContainer: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  icon: {
    marginRight: 12,
  },
  detailText: {
    fontFamily,
    color: "white",
    fontSize: 16,
    flex: 1,
  },
  locationText: {
    fontFamily,
    color: "#3b82f6",
    fontSize: 16,
    flex: 1,
  },
  actionButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    marginTop: 16,
    padding: 16,
    alignItems: "center",
  },
  actionButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  imageRetryButton: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#444",
    bottom: 20,
    alignSelf: "center",
  },
  imageRetryText: {
    fontFamily,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  disclaimerText: {
    fontFamily,
    color: "#999",
    textAlign: "center",
    fontSize: 12,
    marginHorizontal: 10,
    marginTop: 16,
  },
});

export default GuestEventView;
