import {
  Modal,
  Text,
  View,
  StyleSheet,
  Image,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ScrollView
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
      <View style={styles.root}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            <Text style={styles.headline}>EVENT ADMIN VIEW</Text>
            
            <View style={styles.eventInfoCard}>
              <Image source={{ uri: event.imgURL }} style={styles.eventImage} />
              
              <View style={styles.infoSection}>
                <Text style={styles.label}>Event</Text>
                <Text style={styles.text}>{event.name}</Text>
                
                <Text style={styles.label}>Date</Text>
                <Text style={styles.text}>
                  {event.dateTime.toDate().toLocaleDateString()}
                </Text>
              </View>
            </View>

            {/* Scanner section */}
            <Pressable
              style={styles.actionButton}
              onPress={() => setShowScanner(!showScanner)}
            >
              <Text style={styles.buttonText}>
                {showScanner ? "HIDE SCANNER" : "SHOW SCANNER"}
              </Text>
            </Pressable>

            {/* Render the barcode scanner if showScanner is true */}
            {showScanner && hasPermission && (
              <View style={styles.scannerContainer}>
                <CameraView
                  onBarcodeScanned={handleBarCodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr", "pdf417"],
                  }}
                  style={styles.scanner}
                />
              </View>
            )}

            <Pressable style={styles.actionButton} onPress={toggleModal}>
              <Text style={styles.buttonText}>CLOSE</Text>
            </Pressable>
          </View>
          
          <Text style={styles.footerText}>THANKS FOR RAGING WITH US</Text>
        </ScrollView>
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
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  headline: {
    fontFamily,
    paddingTop: 50,
    paddingBottom: 30,
    textAlign: "center",
    alignSelf: "center",
    fontSize: 24,
    color: "white",
    fontWeight: "700",
  },
  eventInfoCard: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#555",
    overflow: "hidden",
    marginBottom: 20,
  },
  eventImage: {
    height: Dimensions.get("window").width * 0.5,
    width: "100%",
    resizeMode: "cover",
  },
  infoSection: {
    padding: 16,
  },
  label: {
    fontFamily,
    color: "#aaa",
    marginTop: 10,
    marginBottom: 5,
    fontWeight: "500",
    fontSize: 14,
    textTransform: "uppercase",
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
    fontFamily,
    color: "white",
    fontWeight: "500",
  },
  scannerContainer: {
    width: "100%",
    height: Dimensions.get("window").width * 0.7,
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#555",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  scanner: {
    width: "100%",
    height: "100%",
  },
  actionButton: {
    marginVertical: 16,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "70%",
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#555",
    backgroundColor: "#222",
  },
  buttonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
  },
  confirmed: {
    backgroundColor: `rgba(100, 200, 100, 0.2)`,
    borderColor: `rgba(100, 200, 100, 0.5)`,
  },
  invalid: {
    backgroundColor: `rgba(255, 0, 0, 0.2)`,
    borderColor: `rgba(255, 0, 0, 0.5)`,
  },
  footerText: {
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    padding: 16,
    color: "#aaa",
    fontWeight: "500",
    marginTop: 20,
  },
});
