import { View, Text, StyleSheet } from "react-native";
import EventList from "./EventList";

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <EventList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
