import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  Modal,
  Dimensions,
} from "react-native";

import { addToCart } from "../../store/redux/cartSlice";
import { useDispatch } from "react-redux";

import { collection, getDocs } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

import { GlobalStyles } from "../../constants/styles";

export default function EventView({ route }) {
  // Extract event data from the route prop
  const { eventData } = route.params;

  const [attendingCount, setAttendingCount] = useState(0);

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
        const count = querySnapshot.size; // Get the number of documents
        setAttendingCount(count);
      } catch (error) {
        console.error("Error fetching attending count:", error);
      }
    };

    fetchAttendingCount();
  }, [eventData]);

  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] =
    useState(false);

  const dispatch = useDispatch();

  const handleAddToCart = () => {
    if (eventData && eventData.quantity > 0) {
      const { name, dateTime, location, price, imgURL } = eventData;

      const cartItem = {
        productId: name,
        title: name,
        images: [{ src: imgURL }],
        selectedQuantity: 1,
        price: { amount: price, currencyCode: "USD" },
        eventDetails: {
          dateTime: dateTime,
          location: location,
        },
      };

      // Dispatch the addToCart action with the cart item
      dispatch(addToCart(cartItem));
      setAddToCartConfirmationVisible(true);
    }
  };

  const closeAddToCartConfirmation = () => {
    setAddToCartConfirmationVisible(false);
  };

  const handleOpenMaps = () => {
    const address = eventData.location; // Replace this with the actual address from your database
    const encodedAddress = encodeURIComponent(address);

    let url;
    if (Platform.OS === "ios") {
      url = `http://maps.apple.com/?address=${encodedAddress}`; // For iOS
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`; // For Android
    }

    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>{eventData.name}</Text>
        <Image source={{ uri: eventData.imgURL }} style={styles.eventImage} />

        <View style={styles.eventDetailContainer}>
          <Text style={styles.description}>{eventData.dateTime}</Text>
          <Pressable onPress={handleOpenMaps}>
            <Text style={styles.locationText}>{eventData.location}</Text>
          </Pressable>
          <Text style={styles.description}>${eventData.price}</Text>
        </View>
        {/* Add other event details as needed */}

        <View>
          <Text style={styles.description}>Attending: {attendingCount}</Text>
        </View>

        <View style={styles.addToCartContainer}>
          <Pressable
            style={[
              styles.dropdownButton,
              eventData.quantity > 0
                ? styles.addToCartButton
                : styles.soldOutButton,
            ]}
            onPress={() => handleAddToCart()}
            disabled={eventData.quantity <= 0}
          >
            <Text style={styles.buttonText}>
              {eventData.quantity > 0 ? "Add to Cart" : "Sold Out!!!"}
            </Text>
          </Pressable>

          {/* Add to Cart Confirmation Modal */}
          {/* Modal content */}
          <Modal
            animationType="none"
            transparent={true}
            visible={addToCartConfirmationVisible}
          >
            <View style={styles.modalContainer2}>
              <View style={styles.modalContent2}>
                <Text style={styles.modalText2}>
                  Event successfully added to cart!
                </Text>
                <Pressable
                  style={[styles.modalButton2, styles.confirmButton]}
                  onPress={closeAddToCartConfirmation}
                >
                  <Text style={styles.modalButtonText2}>OK</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
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
  container: {
    backgroundColor: "black",
    flex: 1,
    padding: 20,
  },
  eventDetailContainer: {
    borderWidth: 2,
    borderRadius: 10,
    marginTop: 15,
    paddingBottom: 15,
    borderColor: "white",
  },
  eventImage: {
    height: windowWidth > 600 ? windowHeight * 0.7 : windowHeight * 0.6,
    width: "auto",
    borderRadius: 8,
    marginBottom: 5,
  },
  title: {
    fontFamily,
    fontWeight: "700",
    textAlign: "center",
    color: "white",
    paddingVertical: 5,
    fontSize: 20,
    marginBottom: 20,
    borderWidth: 2,
    padding: 10,
    borderRadius: 10,
    borderColor: "white",
  },
  description: {
    fontFamily,
    fontWeight: "500",
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
    color: "white",
  },
  locationText: {
    fontFamily,
    fontWeight: "500",
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
    color: "#0967d2",
  },
  addToCartContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  dropdownButton: {
    borderWidth: 2,
    borderColor: "#FFF",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
  },
  modalContainer2: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    margin: -100,
  },
  modalContent2: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalText2: {
    fontFamily,
    fontSize: 18,
    marginBottom: 20,
  },
  modalButton2: {
    padding: 10,
    borderRadius: 5,
    width: "70%",
    alignItems: "center",
    marginVertical: 10,
  },
  confirmButton: {
    backgroundColor: GlobalStyles.colors.grey9,
  },

  buttonText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    textAlign: "center",
  },
  modalButtonText2: {
    fontFamily,
    fontSize: 16,
    color: "white",
  },
});
