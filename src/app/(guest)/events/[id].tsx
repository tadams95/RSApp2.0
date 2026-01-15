import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { Stack, useLocalSearchParams } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProgressiveImage } from "../../../components/ui";
import { Theme } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  useEvent,
  useEventAttendingCountWithHelpers,
} from "../../../hooks/useEvents";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { PROGRESSIVE_PLACEHOLDERS } from "../../../utils/imageCacheConfig";
import { logError } from "../../../utils/logError";
import { goBack, navigateToAuth } from "../../../utils/navigation";

const GuestEventView: React.FC = () => {
  // Get route parameters from Expo Router
  const params = useLocalSearchParams<{ id: string }>();
  const posthog = usePostHog();
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();

  // Fetch event data fresh using the hook (matches Shop pattern)
  const eventId = params.id;
  const {
    data: eventData,
    isLoading: eventLoading,
    error: eventError,
  } = useEvent(eventId);

  // Use React Query for attending count
  const { attendingCount, isLoading: attendingLoading } =
    useEventAttendingCountWithHelpers(eventData?.name || "");

  // Format date from Timestamp for display
  const formattedDateTime =
    eventData?.dateTime instanceof Timestamp
      ? format(eventData.dateTime.toDate(), "MMM dd, yyyy hh:mm a")
      : "Date TBD";

  // Get image URL directly - it's already a full HTTPS URL from Firestore
  const imageUrl =
    typeof eventData?.imgURL === "string" && eventData.imgURL.trim() !== ""
      ? eventData.imgURL
      : null;

  // Track screen view for analytics
  useScreenTracking("Guest Event Detail", {
    eventId: eventId || null,
    eventName: eventData?.name || null,
    eventLocation: eventData?.location || null,
    eventPrice: eventData?.price || null,
    userType: "guest",
    attendingCount: attendingCount,
    isLoading: eventLoading,
    hasImage: !!imageUrl,
  });

  // Track detailed event_viewed analytics for guest users
  useEffect(() => {
    if (eventData && !eventLoading) {
      posthog.capture("event_viewed", {
        event_id: eventId || null,
        event_name: eventData.name || "Unknown Event",
        event_date: formattedDateTime,
        event_location: eventData.location || "Unknown Location",
        event_price: eventData.price || 0,
        event_description_length: eventData.description
          ? eventData.description.length
          : 0,
        has_event_description: !!eventData.description,
        has_event_image: !!imageUrl,
        attending_count: attendingCount,
        user_type: "guest",
        viewing_context: "detail_screen",
        event_date_from_now_days:
          eventData.dateTime instanceof Timestamp
            ? Math.ceil(
                (eventData.dateTime.toDate().getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        screen_load_time: Date.now(),
      });
    }
  }, [
    eventData,
    eventLoading,
    attendingCount,
    eventId,
    posthog,
    formattedDateTime,
    imageUrl,
  ]);

  const handleGuestCheckout = (): void => {
    // Track guest checkout attempt
    posthog.capture("guest_event_checkout_attempt", {
      event_id: eventId || null,
      event_name: eventData?.name || null,
      event_location: eventData?.location || null,
      event_price: eventData?.price || 0,
      user_type: "guest",
      conversion_trigger: "event_detail_checkout",
    });

    navigateToAuth();
  };

  const handleBackPress = (): void => {
    goBack();
  };

  const handleOpenMaps = (): void => {
    if (!eventData?.location) return;

    // Track location button tap for guest users
    posthog.capture("event_location_tapped", {
      event_id: eventId,
      event_name: eventData.name,
      event_location: eventData.location,
      user_type: "guest",
      platform: Platform.OS,
      interaction_type: "location_button",
    });

    const address = eventData.location;
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
      event_id: eventId,
      event_name: eventData?.name || "Unknown Event",
      user_type: "guest",
      image_load_success: true,
      has_fallback_used: false,
    });
  };

  const handleImageLoadError = (error: Error): void => {
    // Log image loading error
    logError(error, "GuestEventView.imageLoading", {
      eventId: eventId,
      eventName: eventData?.name,
    });
  };

  // Show loading state
  if (eventLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        <Text style={styles.loaderText}>Loading event...</Text>
      </View>
    );
  }

  // Show error state for missing event data
  if (!eventData || eventError) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.loaderText}>Event not found</Text>
        <TouchableOpacity style={styles.actionButton} onPress={handleBackPress}>
          <Text style={styles.actionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      <Stack.Screen
        options={{
          title: eventData.name || "Event Details",
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
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          <ProgressiveImage
            source={
              imageUrl
                ? { uri: imageUrl }
                : require("../../../assets/BlurHero_2.png")
            }
            lowResSource={PROGRESSIVE_PLACEHOLDERS.EVENT}
            style={styles.eventImage}
            onHighResLoad={handleImageLoadSuccess}
            onLoadError={handleImageLoadError}
            fallbackSource={require("../../../assets/BlurHero_2.png")}
            cacheType="EVENT"
            cacheId={`guest-event-${eventId}`}
            contentFit="cover"
            accessibilityLabel={`Image for ${eventData.name} event`}
          />
        </View>

        {/* Event Info Section */}
        <View style={styles.eventInfoContainer}>
          {/* Title and Price */}
          <View style={styles.titlePriceContainer}>
            <Text style={styles.title} accessibilityRole="header">
              {eventData.name}
            </Text>
            <Text style={styles.price}>${eventData.price}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <View style={styles.detailsContainer}>
              <View
                style={styles.detailRow}
                accessibilityLabel={`Date and time: ${formattedDateTime}`}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.textPrimary}
                  style={styles.icon}
                />
                <Text style={styles.detailText}>{formattedDateTime}</Text>
              </View>

              <TouchableOpacity
                onPress={handleOpenMaps}
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Location: ${eventData.location}. Tap to open maps`}
                accessibilityRole="button"
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={theme.colors.textPrimary}
                  style={styles.icon}
                />
                <Text style={styles.locationText}>{eventData.location}</Text>
              </TouchableOpacity>

              <View
                style={styles.detailRow}
                accessibilityLabel={`${
                  attendingLoading
                    ? "Loading attendance count"
                    : `${attendingCount} people attending`
                }`}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={theme.colors.textPrimary}
                  style={styles.icon}
                />
                <Text style={styles.detailText}>
                  {attendingLoading
                    ? "Loading..."
                    : `${attendingCount} attending`}
                </Text>
              </View>

              {eventData.description && (
                <View
                  style={[styles.detailRow, { borderBottomWidth: 0 }]}
                  accessibilityLabel={`Description: ${eventData.description}`}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={theme.colors.textPrimary}
                    style={styles.icon}
                  />
                  <Text style={styles.detailText}>{eventData.description}</Text>
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

const createStyles = (theme: Theme) => ({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  loaderText: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    position: "absolute" as const,
    top: Platform.OS === "ios" ? 50 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    height: windowWidth * 1.1,
    position: "relative" as const,
    backgroundColor: theme.colors.bgElev1,
  },
  loadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 10,
  },
  eventImage: {
    width: "100%" as const,
    height: "100%" as const,
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
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
    fontSize: 24,
    marginBottom: 8,
  },
  price: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontSize: 18,
    opacity: 0.9,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "600" as const,
    marginBottom: 12,
  },
  detailsContainer: {
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 8,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  icon: {
    marginRight: 12,
  },
  detailText: {
    fontFamily,
    color: theme.colors.textPrimary,
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
    backgroundColor: theme.colors.bgElev2,
    borderWidth: 1,
    borderColor: theme.colors.textPrimary,
    borderRadius: 8,
    marginTop: 16,
    padding: 16,
    alignItems: "center" as const,
  },
  actionButtonText: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontWeight: "600" as const,
    fontSize: 16,
  },
  imageRetryButton: {
    position: "absolute" as const,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    bottom: 20,
    alignSelf: "center" as const,
  },
  imageRetryText: {
    fontFamily,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  disclaimerText: {
    fontFamily,
    color: theme.colors.textSecondary,
    textAlign: "center" as const,
    fontSize: 12,
    marginHorizontal: 10,
    marginTop: 16,
  },
});

export default GuestEventView;
