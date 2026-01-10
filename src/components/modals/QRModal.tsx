import React from "react";
import { Dimensions, Platform, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSelector } from "react-redux";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { selectLocalId } from "../../store/redux/userSlice";

// Import the migrated TypeScript version of MyEvents
import MyEvents from "./MyEvents";

// Define props interface (empty for now, but good practice for future additions)
interface QRModalProps {}

const QRModal: React.FC<QRModalProps> = () => {
  // Use type-safe image import
  // Update the path to match the new directory structure
  const logo = require("../../assets/RSLogo2025.png");

  // Theme hooks
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Access the localId from the Redux store using typed selector
  const localId = useSelector(selectLocalId);

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
        <QRCode value={localId || ""} size={size} logo={logo} logoSize={30} />
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
const createStyles = (theme: Theme) =>
  ({
    QRCodeContainer: {
      paddingTop: 20,
      alignItems: "center",
      width: "100%",
    },
    QRBackground: {
      backgroundColor: "white", // Keep white for QR code visibility
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      borderRadius: 8,
      marginVertical: 16,
      shadowColor: theme.colors.textPrimary,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    headline: {
      backgroundColor: theme.colors.bgElev2,
      textAlign: "center",
      fontFamily,
      fontSize: 14,
      marginBottom: 16,
      color: theme.colors.textPrimary,
      fontWeight: "600",
      textTransform: "uppercase",
      padding: 10,
      borderRadius: 8,
      width: "100%",
      overflow: "hidden",
    },
  } as const);

export default QRModal;
