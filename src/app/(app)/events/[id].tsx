import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ImageStyle,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useDispatch } from "react-redux";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import EventNotFound from "../../../components/events/EventNotFound";
import { ProgressiveImage } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import { useEvent, useEventAttendingCount } from "../../../hooks/useEvents";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { addToCart, CartItem } from "../../../store/redux/cartSlice";
import { PROGRESSIVE_PLACEHOLDERS } from "../../../utils/imageCacheConfig";
import logError from "../../../utils/logError";

// Define the styles interface to resolve TypeScript errors
type Styles = {
  rootContainer: ViewStyle;
  loaderContainer: ViewStyle;
  loaderText: TextStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  scrollView: ViewStyle;
  scrollViewContent: ViewStyle;
  imageContainer: ViewStyle;
  loadingOverlay: ViewStyle;
  eventImage: ImageStyle;
  eventInfoContainer: ViewStyle;
  titlePriceContainer: ViewStyle;
  title: TextStyle;
  price: TextStyle;
  sectionContainer: ViewStyle;
  sectionTitle: TextStyle;
  detailsContainer: ViewStyle;
  detailRow: ViewStyle;
  icon: ViewStyle;
  detailText: TextStyle;
  locationText: TextStyle;
  actionButton: ViewStyle;
  disabledButton: ViewStyle;
  actionButtonText: TextStyle;
  modalContainer: ViewStyle;
  modalContent: ViewStyle;
  modalText: TextStyle;
  modalButton: ViewStyle;
  modalButtonText: TextStyle;
  imageRetryButton: ViewStyle;
  imageRetryText: TextStyle;
};

// Define types for event data
interface EventDetail {
  id?: string;
  name: string;
  dateTime: string; // This will already be formatted when passed as params
  location: string;
  price: number;
  imgURL: string;
  quantity: number;
  description?: string;
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch();
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Fetch event data fresh using the hook (matches Shop pattern)
  const eventId = params.id;
  const {
    data: eventData,
    isLoading: eventLoading,
    error: eventError,
  } = useEvent(eventId);
  // Use eventId (document ID like 'harvest-rage') to query ragers subcollection
  const { data: attendingCount = 0 } = useEventAttendingCount(eventId || "");

  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] =
    useState<boolean>(false);

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
  useScreenTracking("Event Detail", {
    eventId: eventId || null,
    eventName: eventData?.name || null,
    eventLocation: eventData?.location || null,
    eventPrice: eventData?.price || null,
    userType: "authenticated",
    attendingCount: attendingCount,
    isLoading: eventLoading,
    hasImage: !!imageUrl,
    hasError: !!eventError,
  });

  // Track detailed event_viewed analytics
  useEffect(() => {
    if (eventData && !eventLoading) {
      posthog.capture("event_viewed", {
        event_id: eventId,
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
        user_type: "authenticated",
        viewing_context: "detail_screen",
        event_quantity_available: eventData.quantity || 0,
        is_event_sold_out: (eventData.quantity || 0) <= 0,
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

  const handleAddToCart = () => {
    if (!eventData || eventData.quantity <= 0) return;

    const { name, location, price, imgURL } = eventData;

    // Create cart item with required fields and event details
    const cartItem: CartItem = {
      productId: name,
      title: name,
      selectedQuantity: 1,
      selectedColor: "", // Required by CartItem interface
      selectedSize: "", // Required by CartItem interface
      image: typeof imgURL === "string" ? imgURL : "",
      price: {
        amount: parseFloat(price.toString()),
        currencyCode: "USD",
      },
      eventDetails: {
        dateTime: formattedDateTime,
        location: location,
      },
    };

    // Add item to cart
    dispatch(addToCart(cartItem));
    setAddToCartConfirmationVisible(true);

    // Track ticket add to cart event
    posthog.capture("ticket_add_to_cart", {
      event_id: eventId,
      event_name: eventData.name,
      event_date: formattedDateTime,
      event_location: eventData.location,
      ticket_type: "general_admission", // Default ticket type
      ticket_price: eventData.price,
      tickets_available: eventData.quantity,
      user_type: "authenticated",
      ticket_quantity: 1,
    });
  };

  const closeAddToCartConfirmation = () => {
    setAddToCartConfirmationVisible(false);
  };

  const handleOpenMaps = () => {
    if (!eventData) return;

    // Track location button tap
    posthog.capture("event_location_tapped", {
      event_id: eventId,
      event_name: eventData.name,
      event_location: eventData.location,
      user_type: "authenticated",
      platform: Platform.OS,
      interaction_type: "location_button",
    });

    const address = eventData.location;
    const encodedAddress = encodeURIComponent(address);

    let url;
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?address=${encodedAddress}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }

    Linking.openURL(url);
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleBrowseEvents = () => {
    router.push("/(app)/events/");
  };

  const handleImageLoadSuccess = () => {
    // Track successful hero image load
    posthog.capture("event_hero_image_loaded", {
      event_id: eventId,
      event_name: eventData?.name || "Unknown Event",
      user_type: "authenticated",
      image_load_success: true,
      has_fallback_used: false,
    });
  };

  const handleImageLoadError = (error: Error) => {
    // Track hero image interaction error
    posthog.capture("event_hero_image_error", {
      event_id: eventId,
      event_name: eventData?.name || "Unknown Event",
      user_type: "authenticated",
      error_type: "image_load_failure",
      error_message: error.message,
    });

    // Log image loading error
    logError(error, "EventDetailScreen.imageLoading", {
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
      <EventNotFound
        onGoBack={handleBackPress}
        onBrowseEvents={handleBrowseEvents}
        errorMessage={
          eventError?.message ||
          "This event couldn't be found or may no longer be available."
        }
        primaryButtonText="Browse Events"
        secondaryButtonText="Go Back"
      />
    );
  }

  return (
    <View style={styles.rootContainer}>
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
            cacheId={`event-${eventId}`}
            contentFit="cover"
            accessibilityLabel={`Image for ${eventData.name} event`}
          />
        </View>

        {/* Event Info Section */}
        <View style={styles.eventInfoContainer}>
          {/* Title and Price */}
          <View style={styles.titlePriceContainer}>
            <Text style={styles.title}>{eventData.name}</Text>
            <Text style={styles.price}>${eventData.price}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                </View>
                <Text style={styles.detailText}>{formattedDateTime}</Text>
              </View>

              <TouchableOpacity
                onPress={handleOpenMaps}
                style={styles.detailRow}
              >
                <View style={styles.iconContainer}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={theme.colors.accent || theme.colors.textPrimary}
                  />
                </View>
                <Text style={styles.locationText}>{eventData.location}</Text>
              </TouchableOpacity>

              <View style={styles.detailRow}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                </View>
                <Text style={styles.detailText}>
                  {`${attendingCount} attending`}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              eventData.quantity <= 0 && styles.disabledButton,
            ]}
            onPress={handleAddToCart}
            disabled={eventData.quantity <= 0}
            accessible={true}
            accessibilityLabel={
              eventData.quantity > 0 ? "Add to cart" : "Sold out"
            }
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>
              {eventData.quantity > 0 ? "ADD TO CART" : "SOLD OUT"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add to Cart Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addToCartConfirmationVisible}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              Event successfully added to cart!
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={closeAddToCartConfirmation}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    rootContainer: {
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
      backgroundColor: theme.colors.bgRoot,
    },
    scrollViewContent: {
      paddingBottom: 40,
    },
    imageContainer: {
      height: windowWidth * 1.1,
      position: "relative",
      backgroundColor: theme.colors.bgElev1,
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
      fontWeight: "600",
      marginBottom: 12,
    },
    detailsContainer: {
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
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    detailText: {
      fontFamily,
      fontSize: 15,
      color: theme.colors.textPrimary,
      flexShrink: 1,
      opacity: 0.95,
    },
    locationText: {
      fontFamily,
      color: theme.colors.accent || "#3b82f6",
      fontSize: 15,
      flexShrink: 1,
    },
    actionButton: {
      backgroundColor: theme.colors.accent || "rgba(255, 255, 255, 0.15)",
      borderRadius: 10,
      marginTop: 16,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    disabledButton: {
      backgroundColor: "rgba(80, 80, 80, 0.6)",
    },
    actionButtonText: {
      fontFamily,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      fontSize: 14,
      letterSpacing: 0.5,
    },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
    },
    modalContent: {
      backgroundColor: theme.colors.bgElev2,
      borderRadius: 10,
      padding: 20,
      alignItems: "center",
      width: "80%",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    modalText: {
      fontFamily,
      fontSize: 18,
      color: theme.colors.textPrimary,
      marginBottom: 20,
      textAlign: "center",
    },
    modalButton: {
      backgroundColor: theme.colors.borderSubtle,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.textPrimary,
      minWidth: 120,
      alignItems: "center",
    },
    modalButtonText: {
      fontFamily,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    imageRetryButton: {
      position: "absolute",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      bottom: 20,
      alignSelf: "center",
    },
    imageRetryText: {
      fontFamily,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
  } as const);
