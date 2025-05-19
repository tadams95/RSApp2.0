import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

  const eventName = params.name as string;
  const eventImgURL = params.imgURL as string;
  const eventLocation = params.location as string;
  const eventPrice = params.price as string;
  const eventDateTime = params.dateTime as string;
  const eventDescription = params.description as string;

  const [attendingCount, setAttendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  useEffect(() => {
    const fetchAttendingCount = async (): Promise<void> => {
      try {
        const firestore = getFirestore();
        const ragersCollectionRef = collection(
          firestore,
          "events",
          eventName, // Use the event name from params
          "ragers"
        );
        const querySnapshot = await getDocs(ragersCollectionRef);
        const count = querySnapshot.size;
        setAttendingCount(count);
      } catch (error) {
        console.error("Error fetching attending count:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendingCount();
  }, [eventName]);

  const handleGuestCheckout = (): void => {
    navigateToAuth();
  };

  const handleBackPress = (): void => {
    goBack();
  };

  const handleOpenMaps = (): void => {
    if (!eventLocation) return;

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

  const handleImageLoad = (): void => {
    setImageLoaded(true);
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
          {!imageLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
          <Image
            source={{ uri: eventImgURL }}
            style={styles.eventImage}
            onLoad={handleImageLoad}
            resizeMode="cover"
            accessibilityLabel={`Image for ${eventName} event`}
          />
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
