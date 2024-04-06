import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";

function LoadingOverlay({ message }) {
  return (
    <View style={styles.rootContainer}>
      <Text style={styles.message}>{message}</Text>
      <ActivityIndicator size="large" color={"white"} />
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

export default LoadingOverlay;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "black",
  },
  message: {
    fontSize: 16,
    marginBottom: 12,
    fontFamily,
    color: "white",
  },
});
