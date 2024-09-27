import { useEffect, useState, useCallback } from "react";

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
import { useNavigation } from "@react-navigation/native";

import { db } from "../../firebase/firebase";

import { collection, getDocs, query, where } from "firebase/firestore";

import { format } from "date-fns";

export default function EventList() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEventData = useCallback(async () => {
    try {
      const currentDate = new Date();
      const eventCollectionRef = collection(db, "events");
      const q = query(eventCollectionRef, where("dateTime", ">=", currentDate));
      const eventSnapshot = await getDocs(q);

      const eventData = eventSnapshot.docs.map((doc) => doc.data());

      setEvents(eventData);
    } catch (error) {
      console.error("Error fetching event data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleEventPress = useCallback(
    (event) => {
      const formattedDateTime = format(
        event.dateTime.toDate(),
        "MMM dd, yyyy hh:mm a"
      );
      navigation.navigate("EventView", {
        eventData: { ...event, dateTime: formattedDateTime },
      });
    },
    [navigation]
  );

  return (
    <ScrollView style={styles.scrollView}>
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
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "black",
  },
  scrollView: {
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Dimensions.get("window").height * 0.33,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Dimensions.get("window").height * 0.34,
  },
});
