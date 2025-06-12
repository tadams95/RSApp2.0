import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface EventNotFoundProps {
  onGoBack: () => void;
  onBrowseEvents: () => void;
  errorMessage?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  errorCode?: string | null;
}

/**
 * Component displayed when an event is not found or there is an error loading event data
 */
export const EventNotFound: React.FC<EventNotFoundProps> = ({
  onGoBack,
  onBrowseEvents,
  errorMessage = "We couldn't find this event. It may have been removed or is no longer available.",
  primaryButtonText = "Go Back",
  secondaryButtonText = "Browse Events",
  errorCode = null,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={
            errorCode === "unavailable" ||
            errorCode === "network-request-failed"
              ? "wifi-outline"
              : "calendar-outline"
          }
          size={64}
          color="#666"
        />
        <Ionicons
          name={
            errorCode === "permission-denied"
              ? "lock-closed"
              : errorCode === "unavailable" ||
                errorCode === "network-request-failed"
              ? "cloud-offline"
              : "alert-circle"
          }
          size={32}
          color="#FF6B6B"
          style={styles.alertIcon}
        />
      </View>

      <Text style={styles.title}>
        {errorCode === "unavailable" || errorCode === "network-request-failed"
          ? "Network Error"
          : errorCode === "permission-denied"
          ? "Access Denied"
          : "Event Not Found"}
      </Text>

      <Text style={styles.message}>{errorMessage}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={onGoBack}
          accessibilityRole="button"
          accessibilityLabel={secondaryButtonText}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color="white"
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>{secondaryButtonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onBrowseEvents}
          accessibilityRole="button"
          accessibilityLabel={primaryButtonText}
        >
          <Ionicons
            name={
              errorCode === "unavailable" ||
              errorCode === "network-request-failed"
                ? "refresh"
                : "search"
            }
            size={18}
            color="black"
            style={styles.buttonIcon}
          />
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            {primaryButtonText}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Define font family with proper fallback
const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 24,
  },
  alertIcon: {
    position: "absolute",
    bottom: -5,
    right: -5,
  },
  title: {
    fontFamily,
    fontWeight: "700",
    fontSize: 22,
    color: "white",
    marginBottom: 12,
  },
  message: {
    fontFamily,
    fontSize: 16,
    color: "#CCC",
    textAlign: "center",
    marginBottom: 32,
    maxWidth: 300,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: "#444",
  },
  primaryButton: {
    backgroundColor: "white",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontFamily,
    fontWeight: "600",
    color: "white",
    fontSize: 16,
  },
  primaryButtonText: {
    color: "black",
  },
});

export default EventNotFound;
