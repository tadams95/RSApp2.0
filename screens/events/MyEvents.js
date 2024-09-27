import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
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

const EventListItem = ({
  eventName,
  imageUrl,
  eventDate,
  toggleTransferModal,
}) => (
  <View style={styles.innerContainer}>
    <Pressable style={styles.itemContainer}>
      <Image style={styles.tinyLogo} source={{ uri: imageUrl }} />
      <Text style={styles.text}>{eventName}</Text>
      <Text style={styles.text}>{eventDate}</Text>

      <MaterialCommunityIcons
        name="send"
        size={20}
        color="white"
        onPress={toggleTransferModal}
      />
    </Pressable>
  </View>
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
        {/* <Text style={styles.permissionText}>
        View Your Tickets
        </Text> */}

        <Pressable style={styles.dropdownButton} onPress={requestPermission}>
          <Text style={styles.permissionText2}>View Ticket(s)</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#000000"
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
      <Text style={styles.headline}>Your event ticket(s)</Text>
      {eventsData.length === 0 ? (
        <Text>No tickets</Text>
      ) : eventsData.some((event) => event.ragersData.length > 0) ? (
        eventsData.map((event) => (
          <View style={{ flex: 1 }} key={event.id}>
            {event.ragersData.map((ticket) => (
              <EventListItem
                key={ticket.id}
                eventName={event.eventData.name}
                imageUrl={event.eventData.imgURL}
                quantity={ticket.quantity}
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
        ))
      ) : (
        <Text style={styles.permissionText}>None</Text>
      )}
      <Modal
        animationType="none"
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
                  style={{ width: 200, height: 200 }}
                />
              )}
            </View>
            <View style={styles.modalButtonsContainer}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={toggleTransferModal}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Define the modal content height based on the platform
const modalContentHeight = Platform.OS === "ios" ? "60%" : "75%";
const permissionWidth = Platform.OS === "ios" ? "40%" : "50%";

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  innerContainer: {
    flex: 1,
    flexDirection: "row",
    // borderWidth: 1,
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 10,
    padding: 8,

    alignItems: "center",
    backgroundColor: "black",
  },
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%", // Make sure the container takes the full width
    paddingHorizontal: 10,
  },
  tinyLogo: {
    width: 30,
    height: 30,
  },
  headline: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 10,
    color: "white",
    fontWeight: "500",
  },
  text: {
    color: "white",
    paddingLeft: 10,
    fontFamily,
    fontWeight: "500",
  },
  text2: {
    color: "white",
    paddingLeft: 10,
    paddingRight: 20,
    fontFamily,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    backgroundColor: GlobalStyles.colors.grey0,
    backgroundColor: `rgba(200, 200, 200, 0.95)`,
    borderRadius: 8,
    width: "80%", // Adjust the width to make it more centered
    padding: 20,
    alignItems: "center", // Center content horizontally
    elevation: 5,
    height: modalContentHeight, // Adjust the height as needed
    justifyContent: "space-between", // Add this to evenly space the elements vertically
  },
  ticketInfoContainer: {
    alignItems: "center",
  },
  ticketName: {
    fontFamily,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  ticketImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
    borderRadius: 8,
  },
  ticketQuantity: {
    fontFamily,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    height: 200,
    width: 200,
  },
  modalButtonsContainer: {
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  modalButton: {
    paddingVertical: 10,
    borderRadius: 5,
    width: "48%",
    alignItems: "center",
  },
  modalText: {
    fontFamily,
    fontSize: 18,
    marginBottom: 15,
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: "#000",
  },
  confirmButton: {
    backgroundColor: GlobalStyles.colors.grey9,
  },
  modalButtonText: {
    fontFamily,
    color: "white",
  },
  permissionText: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    marginVertical: 10,
    color: "white",
  },
  permissionText2: {
    fontFamily,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
  },
  dropdownButton: {
    margin: 10,
    borderWidth: 2,
    padding: 10,
    borderRadius: 10,
    width: permissionWidth,
    alignItems: "center",
    alignSelf: "center",
    borderColor: "white",
  },
});

export default MyEvents;
