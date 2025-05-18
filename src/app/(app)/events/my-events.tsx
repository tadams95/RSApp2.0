import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BarcodeScanningResult,
  Camera,
  CameraView,
  PermissionStatus,
} from "expo-camera";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import { get, getDatabase, ref } from "firebase/database";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageStyle,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

// Calculate screen width once
const screenWidth = Dimensions.get("window").width;

// Types for events and tickets
interface EventData {
  id: string;
  name: string;
  date?: string;
  dateTime?: any; // Timestamp in Firestore
  location: string;
  price: number;
  imgURL: string;
  quantity: number;
}

interface TicketData {
  id: string;
  firebaseId: string;
  active: boolean;
  [key: string]: any;
}

interface EventWithTickets {
  id: string;
  eventData: EventData;
  ragersData: TicketData[];
}

interface RecipientData {
  name: string;
  email: string;
  firebaseId: string;
  expoPushToken?: string;
}

// Event Ticket Card Component
const EventTicketCard: React.FC<{
  eventName: string;
  imageUrl: string;
  eventDate?: string;
  toggleTransferModal: () => void;
}> = ({ eventName, imageUrl, eventDate, toggleTransferModal }) => (
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
        <Text style={styles.eventTitle} numberOfLines={2}>
          {eventName}
        </Text>

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

export default function MyEventsScreen() {
  const [eventsData, setEventsData] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<PermissionStatus | null>(
    null
  );
  const [transferModalVisible, setTransferModalVisible] =
    useState<boolean>(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [scanningAllowed, setScanningAllowed] = useState<boolean>(true);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [eventNameTransfer, setEventNameTransfer] = useState<string>("");

  const firestore = getFirestore();
  const auth = getAuth();

  // Check if user is logged in
  const currentUser = auth.currentUser?.uid;

  const fetchEventsData = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const eventsCollectionRef = collection(firestore, "events");
      const querySnapshot = await getDocs(eventsCollectionRef);

      const eventsDataPromises = querySnapshot.docs.map(async (doc) => {
        const eventData = doc.data() as EventData;
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
        })) as TicketData[];

        return {
          id: doc.id,
          eventData: {
            ...eventData,
            id: doc.id,
          },
          ragersData,
        };
      });

      const eventsData = await Promise.all(eventsDataPromises);
      setEventsData(eventsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching events data:", error);
      setLoading(false);
    }
  }, [currentUser, firestore]);

  useEffect(() => {
    fetchEventsData();
  }, [fetchEventsData]);

  // Function to request camera permissions with improved error handling
  const requestPermissions = async () => {
    try {
      console.log("Requesting camera permission...");
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log("Camera permission status:", status);
      setHasPermission(status);
      return status === "granted";
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      return false;
    }
  };

  // Function to transfer a ticket to another user
  const transferTicket = async (
    recipientId: string,
    recipientData: RecipientData
  ) => {
    if (!currentUser || !selectedTicketId || !eventNameTransfer) {
      throw new Error("Missing required data for transfer");
    }

    try {
      // Get the ticket document reference
      const ticketRef = doc(
        firestore,
        "events",
        eventNameTransfer,
        "ragers",
        selectedTicketId
      );

      // Update the ticket with the new owner's Firebase ID
      await updateDoc(ticketRef, {
        firebaseId: recipientId,
        transferredFrom: currentUser,
        transferDate: new Date(),
      });

      return true;
    } catch (error) {
      console.error("Error transferring ticket:", error);
      throw error;
    }
  };

  // Handle QR code scanning
  const handleBarCodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!scanningAllowed || scannedData) return;

      setScannedData(data);
      setScanningAllowed(false);

      // Process the QR code data
      const processScannedData = async () => {
        try {
          console.log("QR code scanned:", data);

          // Query the realtime database to get the recipient's details
          const db = getDatabase();
          const userRef = ref(db, `userProfiles/${data}`);
          const snapshot = await get(userRef);

          if (!snapshot.exists()) {
            Alert.alert("Invalid QR Code", "No user found with this QR code.", [
              { text: "OK", onPress: () => setScanningAllowed(true) },
            ]);
            setScannedData(null);
            return;
          }

          const recipientData = snapshot.val();
          const recipientName =
            recipientData.name || recipientData.email || "User";

          // Confirm the transfer with the user
          Alert.alert(
            "Confirm Transfer",
            `Do you want to transfer your ticket to ${recipientName}?`,
            [
              {
                text: "Cancel",
                onPress: () => {
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
                    await transferTicket(data, recipientData);

                    // Send push notification to the recipient if they have a token
                    if (recipientData.expoPushToken) {
                      await sendPushNotification(recipientData.expoPushToken);
                    }

                    // Handle successful transfer
                    const message = `You transferred your ticket to ${recipientName}`;
                    Alert.alert("Success", message);

                    fetchEventsData(); // Refresh events data
                    setTransferModalVisible(false);
                    setScanningAllowed(true);
                    setScannedData(null);
                  } catch (error: any) {
                    console.error("Error transferring ticket:", error);
                    Alert.alert(
                      "Transfer Failed",
                      `Could not transfer ticket: ${
                        error.message || "Permission denied"
                      }`
                    );
                    setScannedData(null);
                    setScanningAllowed(true);
                  }
                },
              },
            ],
            { cancelable: false }
          );
        } catch (error) {
          console.error("Error fetching recipient data:", error);
          Alert.alert("Error", "Failed to process QR code");
          setScannedData(null);
          setScanningAllowed(true);
          setTransferModalVisible(false);
        }
      };

      processScannedData();
    },
    [
      currentUser,
      eventNameTransfer,
      selectedTicketId,
      fetchEventsData,
      scannedData,
      scanningAllowed,
    ]
  );

  // Send push notification
  const sendPushNotification = async (expoPushToken: string) => {
    try {
      // Send the push notification with an immediate trigger
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "RAGESTATE",
          body: "You received a new ticket!",
          vibrate: [1000, 500, 2000],
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  function toggleTransferModal(
    eventData: EventData,
    ticketId: string,
    eventName: string
  ) {
    // First check current permission status directly from the API
    Camera.getCameraPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        // We already have permission, proceed
        setTransferModalVisible(true);
        setEventData(eventData);
        setSelectedTicketId(ticketId);
        setEventNameTransfer(eventName);
      } else {
        // Need to request permission
        Alert.alert(
          "Camera Permission Required",
          "To transfer tickets, you need to allow RAGESTATE to access your camera.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Grant Permission",
              onPress: async () => {
                const granted = await requestPermissions();
                if (granted) {
                  // Success! Now open the modal
                  setTransferModalVisible(true);
                  setEventData(eventData);
                  setSelectedTicketId(ticketId);
                  setEventNameTransfer(eventName);
                } else {
                  // If permission still denied, guide user to settings
                  Alert.alert(
                    "Permission Required",
                    "Please enable camera access in your device settings for RAGESTATE.",
                    [
                      { text: "Not Now", style: "cancel" },
                      {
                        text: "Open Settings",
                        onPress: () => Linking.openSettings(),
                      },
                    ]
                  );
                }
              },
            },
          ]
        );
      }
    });
  }

  // Navigate back to events list
  const handleBackPress = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#ffffff"
          style={{ marginVertical: 20 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
      </TouchableOpacity>

      <Text style={styles.headline}>Your Events</Text>

      {eventsData.length === 0 ? (
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
        onShow={() => {
          // Recheck permission when modal shows
          Camera.getCameraPermissionsAsync().then(({ status }) => {
            setHasPermission(status);
          });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Transfer Ticket</Text>

            {eventData && (
              <View style={styles.ticketInfoContainer}>
                <Text style={styles.ticketName}>{eventData.name}</Text>
                <Image
                  style={styles.ticketImage}
                  source={{ uri: eventData.imgURL }}
                />
                <Text style={styles.ticketQuantity}>Quantity: 1</Text>
              </View>
            )}

            <View style={styles.cameraContainer}>
              {hasPermission !== PermissionStatus.GRANTED ? (
                <View style={styles.permissionContainer}>
                  <Text style={styles.permissionText}>
                    Camera permission is required to scan QR codes
                  </Text>
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermissions}
                  >
                    <Text style={styles.permissionButtonText}>
                      Grant Permission
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.permissionButton, { marginTop: 10 }]}
                    onPress={Linking.openSettings}
                  >
                    <Text style={styles.permissionButtonText}>
                      Open Settings
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                scanningAllowed && (
                  <CameraView
                    onBarcodeScanned={handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr", "pdf417"],
                    }}
                    style={styles.camera}
                  />
                )
              )}
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setTransferModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Define the modal content height based on the platform
const modalContentHeight = Platform.OS === "ios" ? "60%" : "75%";

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

interface Styles {
  container: ViewStyle;
  backButton: ViewStyle;
  headline: TextStyle;
  noTicketsText: TextStyle;
  cardsContainer: ViewStyle;
  cardWrapper: ViewStyle;
  cardContainer: ViewStyle;
  cardContent: ViewStyle;
  imageSection: ViewStyle;
  cardImage: ImageStyle;
  dateContainer: ViewStyle;
  dateText: TextStyle;
  cardDetails: ViewStyle;
  eventTitle: TextStyle;
  transferSection: ViewStyle;
  transferText: TextStyle;
  innerContainer: ViewStyle;
  itemContainer: ViewStyle;
  tinyLogo: ImageStyle;
  text: TextStyle;
  modalContainer: ViewStyle;
  modalContent: ViewStyle;
  ticketInfoContainer: ViewStyle;
  ticketName: TextStyle;
  ticketImage: ImageStyle;
  ticketQuantity: TextStyle;
  cameraContainer: ViewStyle;
  camera: ViewStyle;
  cancelButton: ViewStyle;
  cancelButtonText: TextStyle;
  buttonText: TextStyle;
  actionButton: ViewStyle;
  modalText: TextStyle;
  permissionContainer: ViewStyle;
  permissionText: TextStyle;
  permissionButton: ViewStyle;
  permissionButtonText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingVertical: 10,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    width: "100%",
  },
  backButton: {
    marginBottom: 16,
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

  // Card styles
  cardsContainer: {
    alignItems: "center", // Center cards horizontally
    paddingVertical: 12,
  },
  cardWrapper: {
    width: "100%",
    alignItems: "center", // Center the card
  },
  cardContainer: {
    width: screenWidth * 0.9, // 90% of screen width
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
    height: 200, // Fixed height for the image
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
    padding: 20, // Increased padding
    flexDirection: "column", // Column layout
    justifyContent: "space-between",
    gap: 16, // Add gap between title and button
  },
  eventTitle: {
    color: "white",
    fontFamily,
    fontSize: 18, // Larger font size
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 24,
  },
  transferSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center", // Center the content
    borderWidth: 1,
    borderColor: "#444",
  },
  transferText: {
    color: "white",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    fontFamily,
  },
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
    textTransform: "uppercase",
    textAlign: "center",
  },
  buttonText: {
    fontWeight: "600",
    color: "white",
    textTransform: "uppercase",
    textAlign: "center",
    fontFamily,
  },
  actionButton: {
    backgroundColor: "#222",
    borderColor: "#555",
    alignSelf: "center",
    alignItems: "center",
    width: "50%",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    margin: 10,
  },
  modalText: {
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 20,
    fontFamily,
  },
  permissionContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    width: 200,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#555",
  },
  permissionText: {
    color: "white",
    textAlign: "center",
    marginBottom: 16,
    fontFamily,
    padding: 8,
  },
  permissionButton: {
    backgroundColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#555",
  },
  permissionButtonText: {
    color: "white",
    fontFamily,
    fontWeight: "600",
  },
});
