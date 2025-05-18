import React from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSelector } from "react-redux";

// Import MyEvents from legacy path until it's migrated
// We'll use dynamic import with React.lazy when we integrate this component
const MyEvents = React.lazy(() => import("../../../screens/events/MyEvents"));

// Define types for our Redux state
interface RootState {
  user: {
    localId: string;
  };
}

// Define props interface (empty for now, but good practice for future additions)
interface QRModalProps {}

const QRModal: React.FC<QRModalProps> = () => {
  // Use type-safe image import
  // Update the path to match the new directory structure
  const logo = require("../../../assets/RSLogo2025.png");

  // Access the localId from the Redux store with proper typing
  const localId = useSelector((state: RootState) => state.user.localId);

  // Type the dimensions
  const size: number = Dimensions.get("window").width * 0.45;

  return (
    <View style={styles.QRCodeContainer} accessibilityLabel="QR Code section">
      <Text
        style={styles.headline}
        accessibilityRole="header"
        accessibilityLabel="QR Code instructions"
      >
        Show code to enter RAGESTATE events
      </Text>
      <View style={styles.QRBackground} accessibilityLabel="QR Code display">
        <QRCode value={localId} size={size} logo={logo} logoSize={30} />
      </View>
      <MyEvents />
    </View>
  );
};

// Define font family with proper type
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined cases

// Type the styles properly
const styles = StyleSheet.create({
  QRCodeContainer: {
    paddingTop: 20,
    alignItems: "center",
    width: "100%",
  },
  QRBackground: {
    backgroundColor: "white",
    padding: 12,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    marginVertical: 16,
    shadowColor: "#fff",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headline: {
    backgroundColor: "#222",
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    marginBottom: 16,
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
    padding: 10,
    borderRadius: 8,
    width: "100%",
    overflow: "hidden",
  },
});

export default QRModal;
