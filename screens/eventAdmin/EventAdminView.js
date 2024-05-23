import {
  Modal,
  Text,
  View,
  StyleSheet,
  Image,
  Pressable,
  Alert,
  Platform,
} from "react-native";

import React, { useState, useEffect } from "react";

import { db } from "../../firebase/firebase";

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

import { CameraView, Camera } from "expo-camera";

export default function EventAdminView({ visible, event, toggleModal }) {
  const [scanningAllowed, setScanningAllowed] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);

  const toggleScannerVisibility = () => {
    setShowScanner(!showScanner);
  }; // Request barcode scanner permission

  // Function to request permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      console.error("Error requesting camera permissions:", error);
      // Handle errors
    }
  };

  // Request barcode scanner permission based on visibility and event
  useEffect(() => {
    if (visible && event) {
      requestPermissions();
    }
  }, [visible, event]);

  // Request camera permission on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  // Check if the event is available and visible
  if (!visible || !event) {
    return null; // Don't render anything if the event or visibility is not set
  }

  const handleBarCodeScanned = async ({ data }) => {
    try {
      // Check if scanning is allowed
      if (!scanningAllowed) {
        return; // Stop scanning if not allowed
      }

      // Disable further scanning
      setScanningAllowed(false);

      // Query the Firestore database to check if the scanned firebaseId exists in any document
      const ragersRef = collection(db, `events/${event.name}/ragers`);
      const q = query(ragersRef, where("firebaseId", "==", data));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        let hasActiveTickets = false;

        // Iterate through all documents that match the query
        for (const docSnapshot of querySnapshot.docs) {
          const ragerDoc = docSnapshot.data();

          // Check if the ticket is active
          if (ragerDoc.active) {
            hasActiveTickets = true;
            // Update the active field of the document to false
            await updateDoc(doc(ragersRef, docSnapshot.id), { active: false });
            break; // Break out of the loop after deactivating the first active ticket
          }
        }

        // Provide feedback to the admin user
        if (hasActiveTickets) {
          // At least one ticket is valid
          Alert.alert(
            "SUCCESS",
            "Tickets have been successfully deactivated.",
            [{ text: "OK", onPress: () => setScanningAllowed(true) }]
          );
        } else {
          // No active tickets found
          Alert.alert(
            "INVALID TICKET",
            "This user does not have any active tickets.",
            [{ text: "OK", onPress: () => setScanningAllowed(true) }]
          );
        }
      } else {
        // Provide feedback to the admin user if the ticket is invalid
        Alert.alert(
          "INVALID TICKET",
          "This user does not have a ticket to this event.",
          [{ text: "OK", onPress: () => setScanningAllowed(true) }]
        );
      }
    } catch (error) {
      console.error("Error handling scanned QR code:", error);
      // Handle errors (e.g., display error message to the user)
      alert("An error occurred while processing the QR code.");
    }
  };

  // Render the event details
  return (
    <Modal visible={visible} animationType="none">
      <View style={styles.container}>
        <Text style={styles.heading}>Event Admin View</Text>
        <Image source={{ uri: event.imgURL }} style={styles.eventImage} />
        <Text style={styles.label}>Event</Text>
        <Text style={styles.text}>{event.name}</Text>
        <Text style={styles.label}>Date</Text>
        <Text style={styles.text}>
          {event.dateTime.toDate().toLocaleDateString()}
        </Text>
        {/* Toggle button for showing/hiding the barcode scanner */}
        <Pressable
          style={styles.button}
          onPress={() => setShowScanner(!showScanner)}
        >
          <Text style={styles.buttonText}>
            {showScanner ? "Hide Scanner" : "Show Scanner"}
          </Text>
        </Pressable>

        {/* Render the barcode scanner if showScanner is true */}
        {showScanner && hasPermission && (
          <CameraView
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "pdf417"],
            }}
            style={styles.scanner}
          />
        )}
        {/* Add more event details as needed */}

        <Pressable style={styles.button} onPress={toggleModal}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 20,
  },
  confirmed: {
    backgroundColor: `rgba(100, 200, 100, 0.9)`,
  },
  invalid: {
    backgroundColor: `rgba(255, 0, 0, 0.95)`,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "white",
  },
  text: {
    fontSize: 16,
    marginBottom: 15,
    fontFamily,
    color: "white",
    fontWeight: "500",
  },
  label: {
    fontFamily,
    color: "white",
    marginVertical: 5,
    fontWeight: "500",
  },
  eventImage: {
    height: 200,
    width: "50%",
    alignSelf: "center",
    borderRadius: 8,
  },
  scanner: {
    height: 200,
    width: 200,
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#000",
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "45%",
    alignSelf: "center",
  },
  buttonText: {
    fontFamily,
    color: "white",
    fontWeight: "500",
  },
});
