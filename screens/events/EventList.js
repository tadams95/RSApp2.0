import { useEffect, useState } from "react";

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { useNavigation } from "@react-navigation/native";

import { db } from "../../firebase/firebase";

import { collection, getDocs } from "firebase/firestore";

import { format } from "date-fns";

export default function EventList() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);

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

  // Inside the EventList component
  const handleEventPress = (event) => {
    const formattedDateTime = format(
      event.dateTime.toDate(),
      "MMM dd, yyyy hh:mm a"
    );
    navigation.navigate("EventView", {
      eventData: { ...event, dateTime: formattedDateTime },
    });
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        {events.reverse().map((event, index) => (
          <View key={index} style={styles.eventContainer}>
            <Pressable
              onPress={() => handleEventPress(event)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Image source={{ uri: event.imgURL }} style={styles.eventImage} />
              <Text style={styles.title}>{event.name}</Text>
              <Text style={styles.subtitle}>
                {event.dateTime.toDate().toDateString()}
              </Text>
              {/* Add other event details as needed */}
            </Pressable>
          </View>
        ))}
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
    height: 400,
    width: "100%",
    alignSelf: "center",
    borderRadius: 8,
  },
});
