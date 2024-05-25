import { StyleSheet, Text, View, Platform, Dimensions } from "react-native";
import { useSelector } from "react-redux";

import QRCode from "react-native-qrcode-svg";
import MyEvents from "../events/MyEvents";

export default function QRCodeModal() {
  let logo = require("../../assets/RSLogoRounded.png");
  // Access the localId from the Redux store
  const localId = useSelector((state) => state.user.localId);

  const size = Dimensions.get("window").width * 0.45;

  return (
    <View style={styles.QRCodeContainer}>
      <Text style={styles.headline}>Show code to enter RAGESTATE events</Text>
      <View style={styles.QRBackground}>
        <QRCode value={localId} size={size} logo={logo} logoSize={50} />
      </View>
      <MyEvents />
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  QRCodeContainer: {
    paddingTop: 20,
    alignItems: "center",
  },
  QRBackground: {
    backgroundColor: "white",
    padding: 5,
    borderWidth: 1,
    borderRadius: 8,
  },
  headline: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 15,
    color: "white",
    fontWeight: "500",
  },
});
