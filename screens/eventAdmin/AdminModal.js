import React, { useEffect, useState } from "react";
import {
  Modal,
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Dimensions,
} from "react-native";

import { db } from "../../firebase/firebase";

import { collection, getDocs } from "firebase/firestore";
import { GlobalStyles } from "../../constants/styles";

import EventAdminView from "./EventAdminView";

const AdminModal = ({ visible, toggleModal }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventAdminViewVisible, setEventAdminViewVisible] = useState(false);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const eventCollectionRef = collection(db, "events");
        const eventSnapshot = await getDocs(eventCollectionRef);

        const currentDate = new Date();

        // Filter out past events
        const eventData = eventSnapshot.docs
          .map((doc) => doc.data())
          .filter((event) => {
            const eventDateTime = event.dateTime.toDate();
            return eventDateTime >= currentDate;
          });

        setEvents(eventData);
      } catch (error) {
        console.error("Error fetching event data:", error);
      }
    };

    fetchEventData();
  }, []);

  // const { firstName, isAdmin, lastName, qrCode } = admin;

  const handleEventPress = (event) => {
    setSelectedEvent(event); // Set the selected event when an event is pressed
    setEventAdminViewVisible(true); // Show the EventAdminView
  };

  const toggleEventAdminViewVisibility = () => {
    setEventAdminViewVisible(!eventAdminViewVisible); // Toggle the visibility of EventAdminView
  };

  return (
    <Modal visible={visible} animationType="none">
      <ScrollView style={{ backgroundColor: "black" }}>
        <View style={styles.container}>
          <Text style={styles.headline}>RAGESTATE ADMIN EVENT MANAGEMENT</Text>

          {events.reverse().map((event, index) => (
            <View key={index} style={styles.eventContainer}>
              <Pressable
                onPress={() => handleEventPress(event)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Image
                  source={{ uri: event.imgURL }}
                  style={styles.eventImage}
                />
                <Text style={styles.title}>{event.name}</Text>
                <Text style={styles.subtitle}>
                  {event.dateTime.toDate().toDateString()}
                </Text>
                {/* Add other event details as needed */}
              </Pressable>
            </View>
          ))}
          <EventAdminView
            visible={eventAdminViewVisible}
            event={selectedEvent} // Pass the selected event to EventAdminView
            toggleModal={toggleEventAdminViewVisibility}
          />
        </View>
        <Pressable style={styles.modalButton} onPress={toggleModal}>
          <Text style={styles.buttonText}>CLOSE ADMIN</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
    padding: 25,
    backgroundColor: "black",
  },
  eventContainer: {
    width: "100%",
    marginVertical: 10,
    borderRadius: 8,
    backgroundColor: "#000",
    elevation: 3,
    shadowColor: GlobalStyles.colors.neutral6,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
  },
  pressed: {
    opacity: 0.5,
  },
  title: {
    fontFamily,
    textAlign: "center",
    paddingTop: 8,
    alignItems: "center",
    color: "white",
    fontWeight: "500",
  },
  subtitle: {
    fontFamily,
    textAlign: "center",
    alignItems: "center",
    paddingVertical: 4,
    color: "white",
  },
  eventImage: {
    height: Dimensions.get("window").height * 0.45,
    width: "100%",
    alignSelf: "center",
    borderRadius: 8,
  },
  modalButton: {
    borderWidth: 2,
    borderColor: "#FFF",
    padding: 10,
    marginBottom: 50,
    borderRadius: 10,
    width: "45%",
    alignSelf: "center",
  },
  buttonText: {
    fontFamily,
    fontSize: 18,
    textAlign: "center",
    color: "white",
    fontWeight: "500",
  },
  headline: {
    fontFamily,
    paddingTop: 50,
    paddingBottom: 10,
    textAlign: "center",
    textTransform: "uppercase",
    alignSelf: "center",
    fontSize: 25,
    color: "white",
    fontWeight: "700",
  },
});

export default AdminModal;
