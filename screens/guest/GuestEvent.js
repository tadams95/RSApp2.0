import { useEffect, useState } from "react";

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";

import { GlobalStyles } from "../../constants/styles";

import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

import { format } from "date-fns";

export default function GuestEvent({ navigation, setAuthenticated }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      } finally {
        // Once data fetching is complete, set isLoading to false
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, []);

  // Inside the EventList component
  const handleEventPress = (event) => {
    const formattedDateTime = format(
      event.dateTime.toDate(),
      "MMM dd, yyyy hh:mm a"
    );
    navigation.navigate("GuestEventView", {
      eventData: { ...event, dateTime: formattedDateTime },
    });
  };

  return (
    <ScrollView style={{ backgroundColor: "black" }}>
      <View style={styles.container}>
        {/* Conditional rendering based on isLoading state */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <Text style={styles.noEventsText}>No Events At This Time</Text>
          </View>
        ) : (
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
      </View>
    </ScrollView>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  eventContainer: {
    width: "100%",
    marginBottom: 10,
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
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 8,
    alignItems: "center",
    color: "white",
  },
  subtitle: {
    fontFamily,
    fontWeight: "500",
    textAlign: "center",
    alignItems: "center",
    paddingVertical: 4,
    color: "white",
  },
  eventImage: {
    height: Dimensions.get("window").width * 1,
    width: "100%",
    alignSelf: "center",
    borderRadius: 8,
  },
  noEventsText: {
    fontFamily,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 8,
    alignItems: "center",
    color: "white",
    textTransform: "uppercase",
    fontSize: 16,
  },
  noEventsContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: Dimensions.get("window").height * 0.65,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Dimensions.get("window").height * 0.675,
  },
});
