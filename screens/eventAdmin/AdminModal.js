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
      <View style={styles.root}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            <Text style={styles.headline}>RAGESTATE ADMIN EVENT MANAGEMENT</Text>

            {events.length === 0 ? (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No events available</Text>
              </View>
            ) : (
              // Render events if there are any
              events.reverse().map((event, index) => (
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
              ))
            )}
            <EventAdminView
              visible={eventAdminViewVisible}
              event={selectedEvent} // Pass the selected event to EventAdminView
              toggleModal={toggleEventAdminViewVisibility}
            />
          </View>
          <Pressable style={styles.actionButton} onPress={toggleModal}>
            <Text style={styles.buttonText}>CLOSE</Text>
          </Pressable>
          
          <Text style={styles.footerText}>THANKS FOR RAGING WITH US</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  eventContainer: {
    width: "100%",
    marginVertical: 10,
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#555",
    overflow: "hidden",
  },
  noEventsContainer: {
    width: "100%",
    marginTop: Dimensions.get("window").height * 0.25,
    borderRadius: 8,
    backgroundColor: "#111",
    padding: 20,
    borderWidth: 1,
    borderColor: "#555",
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontFamily,
    textAlign: "center",
    paddingTop: 8,
    color: "white",
    fontWeight: "600",
    fontSize: 18,
  },
  subtitle: {
    fontFamily,
    textAlign: "center",
    paddingVertical: 4,
    color: "#aaa",
    paddingBottom: 12,
  },
  eventImage: {
    height: Dimensions.get("window").height * 0.25,
    width: "100%",
    alignSelf: "center",
  },
  actionButton: {
    marginVertical: 16,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "50%",
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#555",
    backgroundColor: "#222",
  },
  buttonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
  },
  headline: {
    fontFamily,
    paddingTop: 50,
    paddingBottom: 30,
    textAlign: "center",
    alignSelf: "center",
    fontSize: 24,
    color: "white",
    fontWeight: "700",
  },
  noEventsText: {
    fontFamily,
    textAlign: "center",
    fontSize: 18,
    color: "white",
    fontWeight: "500",
  },
  footerText: {
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    padding: 16,
    color: "#aaa",
    fontWeight: "500",
    marginTop: 20,
  },
});

export default AdminModal;
