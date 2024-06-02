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

import { collection, getDocs } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

import { GlobalStyles } from "../../constants/styles";

export default function GuestEventView({ navigation, route }) {
  const { eventData } = route.params;
  const [attendingCount, setAttendingCount] = useState(0);

  const handleGuestCheckout = () => {
    navigation.navigate("WelcomeScreen");
  };

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
  return (
    <ScrollView style={{ backgroundColor: "black" }}>
      <View style={styles.container}>
        <Text style={styles.title}>{eventData.name}</Text>
        <Image source={{ uri: eventData.imgURL }} style={styles.eventImage} />

        <View style={styles.eventDetailContainer}>
          <Text style={styles.description}>{eventData.dateTime}</Text>

          <Text style={styles.description}>${eventData.price}</Text>
        </View>
        {/* Add other event details as needed */}
        <View style={{alignItems: "center"}}>
          <Pressable onPress={handleGuestCheckout} style={styles.tabButton}>
            <Text style={styles.buttonText}>
              LOG IN OR SIGN UP TO CHECK OUT
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
    height: windowWidth > 600 ? windowHeight * 0.7 : windowHeight * 0.4,
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
  tabButton: {
    backgroundColor: "#000",
    paddingVertical: windowHeight * 0.01, // Adjust padding dynamically based on window height
    paddingHorizontal: windowWidth * 0.04, // Adjust padding dynamically based on window width
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    width: windowWidth * 0.7,
    marginVertical: windowHeight * 0.025,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "500",
    color: "#FFF",
    fontFamily,
    fontSize: windowWidth * 0.031, // Adjust font size dynamically based on window width
  },
});
