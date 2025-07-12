import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import ImageWithFallback from "../ui/ImageWithFallback";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import NetInfo from "@react-native-community/netinfo";
import { Camera, CameraView } from "expo-camera";
import * as Notifications from "expo-notifications";
import { getAuth } from "firebase/auth";
import { get, getDatabase, ref } from "firebase/database";

// Import notification manager for event notifications
import { NotificationManager } from "../../services/notificationManager";
import { retryWithBackoff } from "../../utils/cart/networkErrorDetection";
import { extractDatabaseErrorCode } from "../../utils/databaseErrorHandler";
import {
  getRetryBackoffTime,
  handleEventFetchError,
  sanitizeEventData,
  shouldRetryEventFetch,
} from "../../utils/eventDataHandler";

// Calculate screen width once
const screenWidth = Dimensions.get("window").width;

// Define types for our components and data
interface EventTicketCardProps {
  eventName: string;
  imageUrl: string;
  eventDate?: string;
  toggleTransferModal: () => void;
}

interface RecipientData {
  firstName: string;
  lastName: string;
  email: string;
  expoPushToken: string | null;
  id: string;
}

interface EventData {
  name: string;
  imgURL: string;
  date?: string;
  [key: string]: any;
}

interface TicketData {
  id: string;
  active: boolean;
  email: string;
  expoPushToken?: string;
  firebaseId: string;
  owner: string;
  [key: string]: any;
}

interface EventWithRagers {
  id: string;
  eventData: EventData;
  ragersData: TicketData[];
}

// Updated card-style component for event tickets with larger vertical size
const EventTicketCard: React.FC<EventTicketCardProps> = ({
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
        <ImageWithFallback
          style={styles.cardImage}
          source={{ uri: imageUrl }}
          fallbackSource={require("../../assets/BlurHero_2.png")}
          showLoadingIndicator={true}
          showRetryButton={false}
          showErrorMessage={false}
          maxRetries={2}
          errorContext="MyEventsCard"
          resizeMode="cover"
        />
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

const MyEvents: React.FC = () => {
  const [eventsData, setEventsData] = useState<EventWithRagers[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);
  const [dataFetchFailed, setDataFetchFailed] = useState<boolean>(false);

  const firestore = getFirestore();
  const auth = getAuth();
  const currentUser = auth.currentUser?.uid || "";
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [transferModalVisible, setTransferModalVisible] =
    useState<boolean>(false);
  const [eventData, setEventData] = useState<EventData>({
    name: "",
    imgURL: "",
  });
  const [scanningAllowed, setScanningAllowed] = useState<boolean>(true);
  const [scannedData, setScannedData] = useState<{
    type: string;
    data: string;
  } | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [eventNameTransfer, setEventNameTransfer] = useState<string>("");

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);

      // If we're coming back online and had a previous error, retry fetch
      if (state.isConnected && dataFetchFailed) {
        handleRetryFetch();
      }
    });

    return () => unsubscribe();
  }, [dataFetchFailed]);

  const fetchEventsData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      if (isOffline) {
        setErrorMessage("You're offline. Please check your connection.");
        setLoading(false);
        setDataFetchFailed(true);
        return;
      }

      const eventsCollection = collection(firestore, "events");
      const eventsSnapshot = await getDocs(eventsCollection);

      let userEvents: EventWithRagers[] = []; // Process each event
      for (const eventDoc of eventsSnapshot.docs) {
        // Sanitize event data with fallbacks for missing properties
        const eventData = sanitizeEventData({
          ...eventDoc.data(),
          id: eventDoc.id,
        });

        try {
          // Query tickets (ragers) for this event where the current user is the owner
          const ragersCollection = collection(
            firestore,
            `events/${eventDoc.id}/ragers`
          );
          const userRagersQuery = query(
            ragersCollection,
            where("owner", "==", currentUser)
          );
          const userRagersSnapshot = await getDocs(userRagersQuery);

          if (!userRagersSnapshot.empty) {
            // Map the rager documents to data objects with proper error handling
            const ragersData = userRagersSnapshot.docs.map((ragerDoc) => {
              // Get document data and ensure we have all required fields with defaults
              const docData = ragerDoc.data();
              const ticketData: TicketData = {
                id: ragerDoc.id,
                active: docData.active ?? true,
                email: docData.email ?? "",
                expoPushToken: docData.expoPushToken,
                firebaseId: docData.firebaseId ?? "",
                owner: docData.owner ?? "",
                ...docData,
              };
              return ticketData;
            });

            // Add this event with its ragers to our result array
            userEvents.push({
              id: eventDoc.id,
              eventData,
              ragersData,
            });
          }
        } catch (ragerError) {
          // Log the specific error for this event's ragers but continue with others
          console.error(
            `Error fetching ragers for event ${eventDoc.id}:`,
            ragerError
          );
          // Don't fail the entire operation, just skip this event
          continue;
        }
      }

      setEventsData(userEvents);
      setDataFetchFailed(false);
      setRetryAttempts(0);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching events data:", error);

      // Extract error code for better handling
      const errorCode = extractDatabaseErrorCode(error);

      // Get user-friendly error message
      const friendlyError = handleEventFetchError(error, "MyEvents component", {
        userId: currentUser,
      });

      setErrorMessage(friendlyError);
      setLoading(false);
      setDataFetchFailed(true);

      // Check if we should retry
      if (shouldRetryEventFetch(errorCode, retryAttempts)) {
        const backoffTime = getRetryBackoffTime(retryAttempts);
        setTimeout(() => {
          setRetryAttempts((prev) => prev + 1);
          fetchEventsData();
        }, backoffTime);
      }
    }
  }, [currentUser, retryAttempts, isOffline, firestore]);

  // Function to handle retry button press
  const handleRetryFetch = () => {
    setRetryAttempts(0);
    setDataFetchFailed(false);
    fetchEventsData();
  };

  useEffect(() => {
    fetchEventsData();
  }, [fetchEventsData]);

  // Function to request camera permissions with improved error handling
  const requestPermissions = async (): Promise<boolean> => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check permission status again after delay
      const { status: updatedStatus } =
        await Camera.getCameraPermissionsAsync();
      console.log("Updated camera permission status:", updatedStatus);

      setHasPermission(updatedStatus === "granted");
      return updatedStatus === "granted";
    } catch (error) {
      console.error("Error requesting camera permissions:", error);
      return false;
    }
  };

  // Request camera permission on component mount with retry mechanism
  useEffect(() => {
    const checkPermission = async () => {
      // First check if we already have permission
      const { status } = await Camera.getCameraPermissionsAsync();

      if (status === "granted") {
        setHasPermission(true);
        return;
      }

      // If not, request it
      const granted = await requestPermissions();

      // If permission wasn't granted, we can add a retry mechanism
      if (!granted) {
        console.log("Camera permission not granted initially");
      }
    };

    checkPermission();
  }, []);

  const fetchRecipientData = async (data: string): Promise<RecipientData> => {
    const recipientRef = ref(getDatabase(), `users/${data}`);
    const snapshot = await get(recipientRef);
    if (snapshot.exists()) {
      const recipientData = snapshot.val();
      return {
        firstName: recipientData.firstName,
        lastName: recipientData.lastName,
        email: recipientData.email,
        expoPushToken: recipientData.expoPushToken || null,
        id: data,
      };
    } else {
      throw new Error("Recipient data not found");
    }
  };

  const transferTicket = async (
    ticketUrl: string,
    recipientData: RecipientData
  ): Promise<void> => {
    try {
      // Check if the ticket belongs to the current user before attempting to transfer
      const ticketRef = doc(firestore, ticketUrl);
      const ticketSnapshot = await getDoc(ticketRef);

      if (!ticketSnapshot.exists()) {
        throw new Error("Ticket not found");
      }

      const ticketData = ticketSnapshot.data();

      // Verify the current user is the ticket owner
      if (ticketData.firebaseId !== currentUser) {
        throw new Error("You don't have permission to transfer this ticket");
      }

      // Now attempt to update the ticket with retry logic
      await retryWithBackoff(async () => {
        await updateDoc(ticketRef, {
          active: true,
          email: recipientData.email,
          expoPushToken: recipientData.expoPushToken,
          firebaseId: recipientData.id,
          owner: recipientData.id,
        });
      });

      console.log("Ticket transferred successfully");
    } catch (error) {
      console.error("Error in transferTicket:", error);
      throw error; // Re-throw to be handled by caller
    }
  };

  const handleBarCodeScanned = useCallback(
    async ({ type, data }: { type: string; data: string }) => {
      // Stop further scanning
      setScanningAllowed(false);
      // Store the scanned data
      setScannedData({ type, data });

      try {
        const recipientData = await fetchRecipientData(data);
        const recipientName = `${recipientData.firstName} ${recipientData.lastName}`;
        // Remove leading slash from path
        const ticketUrl = `events/${eventNameTransfer}/ragers/${selectedTicketId}`;

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
                  await transferTicket(ticketUrl, recipientData);
                  Alert.alert("Success", "Ticket transferred successfully!");

                  // Send transfer confirmation notifications using NotificationManager
                  const currentEventData = {
                    eventId: eventNameTransfer,
                    eventName: eventData.name,
                    eventDate: eventData.date
                      ? new Date(eventData.date)
                      : undefined,
                    eventLocation: eventData.location,
                    ticketId: selectedTicketId,
                    recipientName: `${recipientData.firstName} ${recipientData.lastName}`,
                    transferFromUser:
                      auth.currentUser?.displayName ||
                      auth.currentUser?.email ||
                      "You",
                  };

                  // Send confirmation to sender (current user)
                  await NotificationManager.sendTicketTransferConfirmation(
                    currentEventData,
                    false // isRecipient = false (sender)
                  );

                  // Send old-style push notification to recipient if they have a token
                  // (keeping this for backward compatibility until all users update)
                  if (recipientData.expoPushToken) {
                    await sendPushNotification(recipientData.expoPushToken);
                  }

                  // Reload events data
                  await fetchEventsData();

                  // Close modal and reset state
                  setTransferModalVisible(false);
                  setScannedData(null);

                  // Allow scanning again
                  setScanningAllowed(true);
                } catch (error: any) {
                  console.error("Error transferring ticket:", error);
                  // More helpful error message
                  Alert.alert(
                    "Transfer Failed",
                    `Could not transfer ticket: ${
                      error.message || "Permission denied"
                    }`
                  );
                  // Reset state
                  setScannedData(null);
                  setScanningAllowed(true);
                }
              },
            },
          ],
          { cancelable: false }
        );
      } catch (error: any) {
        console.error("Error fetching recipient data:", error);
        Alert.alert("Error", error.message);
        // Reset scanned data and allow scanning again
        setScannedData(null);
        setScanningAllowed(true);
        setTransferModalVisible(false);
      }
    },
    [currentUser, eventNameTransfer, selectedTicketId, fetchEventsData]
  );

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
      // Handle error
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
                  // If still not granted, guide the user to settings
                  Alert.alert(
                    "Permission Required",
                    "Please enable camera access in your device settings to use this feature.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Open Settings",
                        onPress: () => {
                          Linking.openSettings();
                        },
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

  // Render function with error states and retry options
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
      <Text style={styles.headline}>Your events</Text>

      {/* Show offline banner if applicable */}
      {isOffline && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#ffcc00" />
          <Text style={styles.errorText}>
            You're offline. Some data may not be current.
          </Text>
        </View>
      )}

      {/* Show error state if applicable */}
      {errorMessage && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={24}
            color="#ff6666"
          />
          <Text style={styles.errorMessageText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetryFetch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#ffffff"
          style={{ marginVertical: 20 }}
        />
      ) : dataFetchFailed ? (
        // If data fetch completely failed and we have no tickets to show
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons
            name="ticket-confirmation"
            size={40}
            color="#555"
          />
          <Text style={styles.noTicketsText}>Could not load your tickets</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetryFetch}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
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
                      event.id // Using the event ID directly which is more reliable
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
            setHasPermission(status === "granted");
          });
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Transfer Ticket</Text>
            <View style={styles.ticketInfoContainer}>
              <Text style={styles.ticketName}>{eventData.name}</Text>
              <ImageWithFallback
                style={styles.ticketImage}
                source={{ uri: eventData.imgURL }}
                fallbackSource={require("../../assets/BlurHero_2.png")}
                showLoadingIndicator={true}
                showRetryButton={false}
                showErrorMessage={false}
                maxRetries={2}
                errorContext="TicketTransfer"
                resizeMode="cover"
              />
              <Text style={styles.ticketQuantity}>Quantity: 1</Text>
            </View>
            <View style={styles.cameraContainer}>
              {hasPermission === false ? (
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
                    onPress={() => Linking.openSettings()}
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

  // Error handling styles
  errorBanner: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 204, 0, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#ffcc00",
    fontFamily,
    marginLeft: 8,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  errorMessageText: {
    color: "#ff6666",
    fontFamily,
    textAlign: "center",
    marginVertical: 8,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  retryButtonText: {
    color: "white",
    fontFamily,
    fontWeight: "600",
  },
  centeredContent: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingBottom: 40,
  },

  // Updated card styles for larger vertical size
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
    height: 200,
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
    padding: 20,
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 16,
  },
  eventTitle: {
    color: "white",
    fontFamily,
    fontSize: 18,
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
    justifyContent: "center",
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

export default MyEvents;
