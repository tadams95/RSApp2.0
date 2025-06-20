import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { collection, getDocs, getFirestore } from "firebase/firestore";
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
import EventNotFound from "../../../components/events/EventNotFound";
import ImageWithFallback from "../../../components/ui/ImageWithFallback";
import { useFirebaseImage } from "../../../hooks/useFirebaseImage";
import { addToCart, CartItem } from "../../../store/redux/cartSlice";
import { extractDatabaseErrorCode } from "../../../utils/databaseErrorHandler";
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
  const params = useLocalSearchParams();
  const dispatch = useDispatch();

  // Parse event data from params
  const eventData: EventDetail = params.eventData
    ? JSON.parse(decodeURIComponent(params.eventData as string))
    : null;

  const [attendingCount, setAttendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataNotFound, setDataNotFound] = useState<boolean>(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);

  // Use the Firebase image hook for improved error handling and caching
  const {
    imageSource,
    isLoading: imageIsLoading,
    error: imageError,
    reload: reloadImage,
  } = useFirebaseImage(eventData?.imgURL || null, {
    fallbackImage: require("../../../assets/BlurHero_2.png"),
    cacheExpiry: 3600000, // 1 hour cache
  });

  useEffect(() => {
    const fetchAttendingCount = async () => {
      if (!eventData) {
        // Check if we have a valid event ID parameter but no event data
        if (params.id && !params.eventData) {
          setError(`Event with ID ${params.id} could not be found`);
          setDataNotFound(true);
          setErrorCode("not-found");
        }
        setIsLoading(false);
        return;
      }

      try {
        const firestore = getFirestore();
        const ragersCollectionRef = collection(
          firestore,
          "events",
          eventData.name,
          "ragers"
        );
        const querySnapshot = await getDocs(ragersCollectionRef);
        const count = querySnapshot.size;

        // Reset error states if successful
        setAttendingCount(count);
        setError(null);
        setErrorCode(null);
      } catch (error) {
        // Use our enhanced logging utility
        logError(error, "EventDetailScreen.fetchAttendingCount", {
          eventId: params.id,
          eventName: eventData?.name,
          retryAttempt: retryAttempts,
        });

        // Extract the specific error code using our utility
        const code = extractDatabaseErrorCode(error);
        setErrorCode(code);

        // Provide specific error messages based on the error type
        if (code === "permission-denied") {
          setError("You don't have permission to view this event's details.");
        } else if (code === "not-found") {
          setError(
            `Event "${eventData.name}" could not be found or may have been removed.`
          );
          setDataNotFound(true);
        } else if (
          code === "unavailable" ||
          code === "network-request-failed"
        ) {
          setError(
            "Network error. Please check your connection and try again."
          );
        } else {
          setError("Failed to load event details. Please try again later.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendingCount();
  }, [eventData, params.id, retryAttempts]);

  const handleAddToCart = () => {
    if (!eventData || eventData.quantity <= 0) return;

    const { name, dateTime, location, price, imgURL } = eventData;

    // Create cart item with required fields and event details
    const cartItem: CartItem = {
      productId: name,
      title: name,
      selectedQuantity: 1,
      selectedColor: "", // Required by CartItem interface
      selectedSize: "", // Required by CartItem interface
      image: imgURL,
      price: {
        amount: parseFloat(price.toString()),
        currencyCode: "USD",
      },
      eventDetails: {
        dateTime: dateTime,
        location: location,
      },
    };

    // Add item to cart
    dispatch(addToCart(cartItem));
    setAddToCartConfirmationVisible(true);
  };

  const closeAddToCartConfirmation = () => {
    setAddToCartConfirmationVisible(false);
  };

  const handleOpenMaps = () => {
    if (!eventData) return;

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
    // Image loaded successfully
  };

  const handleImageLoadError = (error: Error) => {
    // Log image loading error
    logError(error, "EventDetailScreen.imageLoading", {
      eventId: params.id,
      eventName: eventData?.name,
    });
  };

  const handleRetryLoad = () => {
    setIsLoading(true);
    setError(null);

    // If we've already tried multiple times and it's a "not-found" error,
    // don't keep retrying the same failed operation
    if (errorCode === "not-found" && retryAttempts > 2) {
      setError("This event doesn't exist or has been removed.");
      setIsLoading(false);
      return;
    }

    // Reload the image if there was an image error
    if (imageError) {
      reloadImage();
    }

    // Increment retry counter to trigger the useEffect
    setRetryAttempts((prev) => prev + 1);
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loaderText}>Loading event...</Text>
      </View>
    );
  }

  // Show error state for missing event data
  if (!eventData || dataNotFound || error) {
    // For network errors, make primary action retry
    if (errorCode === "unavailable" || errorCode === "network-request-failed") {
      return (
        <EventNotFound
          onGoBack={handleBackPress}
          onBrowseEvents={handleRetryLoad}
          errorMessage={
            error ||
            "Connection error. Please check your network and try again."
          }
          primaryButtonText="Retry"
          secondaryButtonText="Go Back"
          errorCode={errorCode}
        />
      );
    }

    // For permission errors
    if (errorCode === "permission-denied") {
      return (
        <EventNotFound
          onGoBack={handleBackPress}
          onBrowseEvents={handleBrowseEvents}
          errorMessage={
            error || "You don't have permission to view this event."
          }
          primaryButtonText="Browse Other Events"
          secondaryButtonText="Go Back"
          errorCode={errorCode}
        />
      );
    }

    // Default case for not found or other errors
    return (
      <EventNotFound
        onGoBack={handleBackPress}
        onBrowseEvents={handleBrowseEvents}
        errorMessage={
          error || "This event couldn't be found or may no longer be available."
        }
        primaryButtonText="Browse Events"
        secondaryButtonText="Go Back"
        errorCode={errorCode}
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
          <ImageWithFallback
            source={imageSource}
            style={styles.eventImage}
            onLoadSuccess={handleImageLoadSuccess}
            onLoadError={handleImageLoadError}
            showLoadingIndicator={false} // We're using our own loading indicator
            fallbackSource={require("../../../assets/BlurHero_2.png")}
            maxRetries={3}
            showErrorMessage={!!imageError}
            showRetryButton={!!imageError}
            errorContext="EventDetail"
            resizeMode="cover"
            accessibilityLabel={`Image for ${eventData.name} event`}
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
            <Text style={styles.title}>{eventData.name}</Text>
            <Text style={styles.price}>${eventData.price}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="white"
                  style={styles.icon}
                />
                <Text style={styles.detailText}>{eventData.dateTime}</Text>
              </View>

              <TouchableOpacity
                onPress={handleOpenMaps}
                style={styles.detailRow}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="white"
                  style={styles.icon}
                />
                <Text style={styles.locationText}>{eventData.location}</Text>
              </TouchableOpacity>

              <View style={styles.detailRow}>
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

const styles = StyleSheet.create({
  rootContainer: {
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
  disabledButton: {
    backgroundColor: "#333",
    borderColor: "#666",
    opacity: 0.7,
  },
  actionButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    width: "80%",
    borderWidth: 1,
    borderColor: "#444",
  },
  modalText: {
    fontFamily,
    fontSize: 18,
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "white",
    minWidth: 120,
    alignItems: "center",
  },
  modalButtonText: {
    fontFamily,
    color: "white",
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
});
