import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  collection,
  getDocs,
  where,
  query,
  updateDoc,
  doc,
  getFirestore,
} from "firebase/firestore";

import { getDatabase, ref, get } from "firebase/database";

import { getAuth } from "firebase/auth";

import { CameraView, Camera } from "expo-camera";
import * as Notifications from "expo-notifications";

import { GlobalStyles } from "../../constants/styles";

// Calculate screen width once
const screenWidth = Dimensions.get('window').width;

// Updated card-style component for event tickets with larger vertical size
const EventTicketCard = ({
  eventName,
  imageUrl,
  eventDate,
  toggleTransferModal,
}) => (
  <TouchableOpacity 
    style={styles.cardContainer}
    onPress={toggleTransferModal}
    activeOpacity={0.7}
  >
    <View style={styles.cardContent}>
      <View style={styles.imageSection}>
        <Image style={styles.cardImage} source={{ uri: imageUrl }} />
        {eventDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{eventDate}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.eventTitle} numberOfLines={2}>{eventName}</Text>
        
        <TouchableOpacity 
          style={styles.transferSection}
          onPress={toggleTransferModal}
        >
          <MaterialCommunityIcons name="send" size={20} color="white" />
          <Text style={styles.transferText}>Transfer Ticket</Text>
        </TouchableOpacity>
      </View>
    </View>
  </TouchableOpacity>
);

const MyEvents = () => {
  const [eventsData, setEventsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const firestore = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser.uid;
  const [permission, requestPermission] = useState(null); // Initialize permission state
  const [hasPermission, setHasPermission] = useState(null);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [eventData, setEventData] = useState([]);
  const [scanningAllowed, setScanningAllowed] = useState(true);
  const [scannedData, setScannedData] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [eventNameTransfer, setEventNameTransfer] = useState("");

  const fetchEventsData = useCallback(async () => {
    try {
      if (currentUser) {
        const eventsCollectionRef = collection(firestore, "events");
        const querySnapshot = await getDocs(eventsCollectionRef);

        const eventsDataPromises = querySnapshot.docs.map(async (doc) => {
          const eventData = doc.data();
          const ragersCollectionRef = collection(
            firestore,
            "events",
            doc.id,
            "ragers"
          );

          // Add a where clause to filter tickets where active is true
          const ragersQuerySnapshot = await getDocs(
            query(
              ragersCollectionRef,
              where("firebaseId", "==", currentUser),
              where("active", "==", true)
            )
          );

          const ragersData = ragersQuerySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          return { id: doc.id, eventData, ragersData };
        });

        const eventsData = await Promise.all(eventsDataPromises);
        setEventsData(eventsData);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching events data:", error);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchEventsData();
  }, [currentUser]);

  // Function to request camera permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    } catch (error) {
      console.error("Error requesting camera permissions:", error);
      // Handle errors
    }
  };

  // Request camera permission on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const fetchRecipientData = async (data) => {
    const recipientRef = ref(getDatabase(), `users/${data}`);
    const snapshot = await get(recipientRef);
    if (snapshot.exists()) {
      const recipientData = snapshot.val();
      return {
        firstName: recipientData.firstName,
        lastName: recipientData.lastName,
        email: recipientData.email,
        expoPushToken: recipientData.expoPushToken,
        id: data,
      };
    } else {
      throw new Error("Recipient data not found");
    }
  };

  const transferTicket = async (ticketUrl, recipientData) => {
    await updateDoc(doc(firestore, ticketUrl), {
      active: true,
      email: recipientData.email,
      expoPushToken: recipientData.expoPushToken,
      firebaseId: recipientData.id,
      owner: recipientData.id,
    });
  };

const handleBarCodeScanned = useCallback(
  async ({ type, data }) => {
    // Stop further scanning
    setScanningAllowed(false);
    // Store the scanned data
    setScannedData({ type, data });

    try {
      const recipientData = await fetchRecipientData(data);
      const recipientName = `${recipientData.firstName} ${recipientData.lastName}`;
      const ticketUrl = `/events/${eventNameTransfer}/ragers/${selectedTicketId}`;

      Alert.alert(
        "Confirm Transfer",
        `Do you want to transfer your ticket to ${recipientName}?`,
        [
          {
            text: "Cancel",
            onPress: () => {
              // Reset scanned data and allow scanning again
              setScannedData(null);
              setScanningAllowed(true);
              setTransferModalVisible(false);
            },
            style: "cancel",
          },
          {
            text: "Send",
            onPress: async () => {
              try {
                // Update the database to transfer ownership of the ticket
                await transferTicket(ticketUrl, recipientData);

                // Send push notification to the recipient
                await sendPushNotification(recipientData.expoPushToken);

                // Handle sending ticket
                const message = `You transferred your ticket to ${recipientName}`;
                alert(message);
                fetchEventsData(); // Refresh events data
                setTransferModalVisible(false);
                // Allow scanning again
                setScanningAllowed(true);
              } catch (error) {
                console.error("Error transferring ticket:", error);
                // Handle error
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error("Error fetching recipient data:", error);
      Alert.alert("Error", error.message);
      // Reset scanned data and allow scanning again
      setScannedData(null);
      setScanningAllowed(true);
      setTransferModalVisible(false);
    }
  },
  [currentUser, eventNameTransfer, selectedTicketId, fetchEventsData, sendPushNotification]
);

  const sendPushNotification = async (expoPushToken) => {
    try {
      // Send the push notification with an immediate trigger
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "RAGESTATE",
          body: "You received a new ticket!",
          vibrate: [1000, 500, 2000],
        },
        to: expoPushToken,
        trigger: { seconds: 1 }, // Send immediately
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
      // Handle error
    }
  };

  if (!permission || !hasPermission) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.actionButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>View Ticket(s)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#ffffff"
        style={{ marginVertical: 20 }}
      />
    );
  }

  function toggleTransferModal(eventData, ticketId, eventName) {
    setTransferModalVisible((prev) => !prev);
    setEventData(eventData);
    setSelectedTicketId(ticketId); // Assuming you have state to store the selected ticket ID
    setEventNameTransfer(eventName);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Your events</Text>
      
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#ffffff"
          style={{ marginVertical: 20 }}
        />
      ) : eventsData.length === 0 ? (
        <Text style={styles.noTicketsText}>No tickets found</Text>
      ) : eventsData.some((event) => event.ragersData.length > 0) ? (
        <ScrollView 
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
        >
          {eventsData.map((event) => (
            <View key={event.id} style={styles.cardWrapper}>
              {event.ragersData.map((ticket) => (
                <EventTicketCard
                  key={ticket.id}
                  eventName={event.eventData.name}
                  imageUrl={event.eventData.imgURL}
                  eventDate={event.eventData.date}
                  toggleTransferModal={() =>
                    toggleTransferModal(
                      event.eventData,
                      ticket.id,
                      event.eventData.name
                    )
                  }
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.noTicketsText}>No active tickets</Text>
      )}
      
      <Modal
        animationType="fade"
        transparent={true}
        visible={transferModalVisible}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Transfer Ticket</Text>
            <View style={styles.ticketInfoContainer}>
              <Text style={styles.ticketName}>{eventData.name}</Text>
              <Image
                style={styles.ticketImage}
                source={{ uri: eventData.imgURL }}
              />
              <Text style={styles.ticketQuantity}>Quantity: 1</Text>
            </View>
            <View style={styles.cameraContainer}>
              {scanningAllowed && (
                <CameraView
                  onBarcodeScanned={handleBarCodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr", "pdf417"],
                  }}
                  style={styles.camera}
                />
              )}
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={toggleTransferModal}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Define the modal content height based on the platform
const modalContentHeight = Platform.OS === "ios" ? "60%" : "75%";

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
    width: "100%",
  },
  headline: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    marginVertical: 16,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  noTicketsText: {
    color: "#aaa",
    textAlign: "center",
    fontFamily,
    marginTop: 16,
  },
  
  // Updated card styles for larger vertical size
  cardsContainer: {
    alignItems: 'center', // Center cards horizontally
    paddingVertical: 12,
  },
  cardWrapper: {
    width: '100%',
    alignItems: 'center', // Center the card
  },
  cardContainer: {
    width: screenWidth * 0.9, // 95% of screen width
    backgroundColor: "#1a1a1a",
    marginVertical: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardContent: {
    width: "100%",
  },
  imageSection: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 400, // Increased from 160 to 200
    resizeMode: "cover",
  },
  dateContainer: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dateText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    fontFamily,
  },
  cardDetails: {
    padding: 20, // Increased padding from 16 to 20
    flexDirection: "column", // Changed to column layout for more vertical space
    justifyContent: "space-between",
    gap: 16, // Add gap between title and button
  },
  eventTitle: {
    color: "white",
    fontFamily,
    fontSize: 18, // Increased from 16 to 18
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 24,
  },
  transferSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 12, // Increased from 8 to 12
    paddingHorizontal: 16, // Increased from 12 to 16
    borderRadius: 8,
    justifyContent: "center", // Center the content
    borderWidth: 1,
    borderColor: "#444",
  },
  transferText: {
    color: "white",
    marginLeft: 8,
    fontSize: 14, // Increased from 12 to 14
    fontWeight: "600",
    fontFamily,
  },
  
  // Keep other existing styles...
  innerContainer: {
    marginVertical: 6,
    marginHorizontal: 0,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 1, 
    borderColor: "#333",
    overflow: "hidden",
  },
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: 12,
  },
  tinyLogo: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  text: {
    color: "white",
    fontFamily,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    width: "80%",
    padding: 20,
    alignItems: "center",
    elevation: 5,
    height: modalContentHeight,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#333",
  },
  ticketInfoContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  ticketName: {
    fontFamily,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
    color: "white",
  },
  ticketImage: {
    width: 100,
    height: 100,
    marginBottom: 12,
    borderRadius: 8,
  },
  ticketQuantity: {
    fontFamily,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
    color: "white",
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
  },
  camera: {
    height: 200,
    width: 200,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
  },
  cancelButton: {
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
    marginTop: 16,
  },
  cancelButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
  },
  modalText: {
    fontFamily,
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
    color: "white",
    fontWeight: "700",
  },
  actionButton: {
    margin: 10,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "50%",
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#555",
    backgroundColor: "#222",
  },
  buttonText: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
    fontWeight: "600",
  },
});

export default MyEvents;
