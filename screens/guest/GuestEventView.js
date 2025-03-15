import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

export default function GuestEventView({ navigation, route }) {
  const { eventData } = route.params;
  const [attendingCount, setAttendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const fetchAttendingCount = async () => {
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
        setAttendingCount(count);
      } catch (error) {
        console.error("Error fetching attending count:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendingCount();
  }, [eventData]);

  const handleGuestCheckout = () => {
    navigation.navigate("WelcomeScreen");
  };

  const handleBackPress = () => {
    navigation.goBack();
  };
  
  const handleOpenMaps = () => {
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

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

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
          {!imageLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
          <Image
            source={{ uri: eventData.imgURL }}
            style={styles.eventImage}
            onLoad={handleImageLoad}
            resizeMode="cover"
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
                <Ionicons name="calendar-outline" size={20} color="white" style={styles.icon} />
                <Text style={styles.detailText}>{eventData.dateTime}</Text>
              </View>
              
              <TouchableOpacity onPress={handleOpenMaps} style={styles.detailRow}>
                <Ionicons name="location-outline" size={20} color="white" style={styles.icon} />
                <Text style={styles.locationText}>{eventData.location}</Text>
              </TouchableOpacity>
              
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={20} color="white" style={styles.icon} />
                <Text style={styles.detailText}>
                  {isLoading ? "Loading..." : `${attendingCount} attending`}
                </Text>
              </View>
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
            Create an account or log in to purchase this ticket and access more features.
          </Text>
        </View>
      </ScrollView>
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
