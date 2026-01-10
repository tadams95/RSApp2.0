import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
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
import { Camera, CameraView, PermissionStatus } from "expo-camera";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { get, getDatabase, ref } from "firebase/database";

// Import notification manager for event notifications
import { usePostHog } from "../../analytics/PostHogProvider";
import {
  cancelTransfer,
  getPendingTransfers,
  initiateTransfer,
  resendTransferEmail,
} from "../../services/transferService";
import { UserSearchResult } from "../../services/userSearchService";
import { retryWithBackoff } from "../../utils/cart/networkErrorDetection";
import { extractDatabaseErrorCode } from "../../utils/databaseErrorHandler";
import {
  getRetryBackoffTime,
  handleEventFetchError,
  sanitizeEventData,
  shouldRetryEventFetch,
} from "../../utils/eventDataHandler";
import {
  EmailTransferForm,
  PendingTransferCard,
  RecipientPreview,
  TransferMethodPicker,
  UsernameTransferForm,
} from "../transfer";

// Calculate screen width once
const screenWidth = Dimensions.get("window").width;

// Transfer mode type for modal state management
type TransferMode = "picker" | "qr" | "username" | "email";

// Component props
interface MyEventsProps {
  /** When true, renders as a standalone screen with back button and extra padding */
  isStandaloneScreen?: boolean;
}

// Define types for our components and data
interface EventTicketCardProps {
  eventName: string;
  imageUrl: string;
  eventDate?: string;
  toggleTransferModal: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
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
  styles,
  theme,
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
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.transferText}>Transfer Ticket</Text>
        </TouchableOpacity>
      </View>
    </View>
  </TouchableOpacity>
);

const MyEvents: React.FC<MyEventsProps> = ({ isStandaloneScreen = false }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [eventsData, setEventsData] = useState<EventWithRagers[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);
  const [dataFetchFailed, setDataFetchFailed] = useState<boolean>(false);

  const firestore = getFirestore();
  const auth = getAuth();
  const posthog = usePostHog();
  const router = useRouter();
  const currentUser = auth.currentUser?.uid || "";

  // Screen tracking for analytics (only when standalone)
  useEffect(() => {
    if (isStandaloneScreen) {
      posthog?.screen("My Events", {
        screen_type: "my_events",
        user_authenticated: !!auth.currentUser,
        is_standalone: true,
      });
    }
  }, [isStandaloneScreen, posthog, auth.currentUser]);

  const [hasPermission, setHasPermission] = useState<PermissionStatus | null>(
    null
  );
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

  // New state for transfer mode management
  const [transferMode, setTransferMode] = useState<TransferMode>("picker");
  const [selectedRecipient, setSelectedRecipient] =
    useState<UserSearchResult | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [cancellingTransferId, setCancellingTransferId] = useState<
    string | null
  >(null);
  const [resendingTransferId, setResendingTransferId] = useState<string | null>(
    null
  );

  // React Query client for cache invalidation
  const queryClient = useQueryClient();

  // Fetch pending transfers using React Query
  const { data: pendingTransfers, refetch: refetchPending } = useQuery({
    queryKey: ["pendingTransfers", currentUser],
    queryFn: () => getPendingTransfers(currentUser),
    enabled: !!currentUser,
    staleTime: 30000, // 30 seconds
  });

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

      // Don't fetch if user is not authenticated
      if (!currentUser) {
        setEventsData([]);
        setLoading(false);
        return;
      }

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

      setHasPermission(updatedStatus);
      return updatedStatus === PermissionStatus.GRANTED;
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

      if (status === PermissionStatus.GRANTED) {
        setHasPermission(status);
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
                  // Use Cloud Function for transfer (creates ticketTransfers doc + sends notifications)
                  await initiateTransfer({
                    ragerId: selectedTicketId,
                    eventId: eventNameTransfer,
                    recipientUserId: recipientData.id,
                  });

                  Alert.alert("Success", "Ticket transferred successfully!");

                  // Track analytics
                  posthog?.capture("ticket_transferred", {
                    event_id: eventNameTransfer,
                    ticket_id: selectedTicketId,
                    transfer_method: "qr",
                    recipient_id: recipientData.id,
                    transferred_from: currentUser,
                    transfer_timestamp: new Date().toISOString(),
                    user_type: "authenticated",
                  });

                  // Reload events data
                  await fetchEventsData();

                  // Close modal and reset state
                  setTransferModalVisible(false);
                  setScannedData(null);

                  // Allow scanning again
                  setScanningAllowed(true);
                } catch (error: any) {
                  console.error("Error transferring ticket:", error);

                  posthog?.capture("ticket_transfer_failed", {
                    event_id: eventNameTransfer,
                    ticket_id: selectedTicketId,
                    transfer_method: "qr",
                    recipient_id: recipientData.id,
                    error_message: error.message,
                    error_code: error.code,
                    user_type: "authenticated",
                  });

                  // More helpful error message
                  Alert.alert(
                    "Transfer Failed",
                    error.message ||
                      "Could not transfer ticket. Please try again."
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
    // Reset transfer mode and recipient when opening modal
    setTransferMode("picker");
    setSelectedRecipient(null);
    setIsTransferring(false);

    // First check current permission status directly from the API
    Camera.getCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status);
      // We don't need camera permission to open the modal anymore
      // since user can choose username/email transfer
      setTransferModalVisible(true);
      setEventData(eventData);
      setSelectedTicketId(ticketId);
      setEventNameTransfer(eventName);

      // Track transfer modal opening
      posthog?.capture("ticket_transfer_initiated", {
        event_id: eventName,
        ticket_id: ticketId,
        event_title: eventData.name,
        camera_permission_status: status,
        screen_context: isStandaloneScreen
          ? "my_events_screen"
          : "account_qr_modal",
        user_type: "authenticated",
      });
    });
  }

  // Reset modal state helper
  const resetTransferModal = useCallback(() => {
    setTransferModalVisible(false);
    setTransferMode("picker");
    setSelectedRecipient(null);
    setIsTransferring(false);
    setScanningAllowed(true);
    setScannedData(null);
  }, []);

  // Handle cancel pending transfer
  const handleCancelTransfer = useCallback(
    async (transferId: string, eventName?: string) => {
      Alert.alert(
        "Cancel Transfer",
        `Cancel this pending transfer${
          eventName ? ` for ${eventName}` : ""
        }? The ticket will be returned to your account.`,
        [
          { text: "Keep Transfer", style: "cancel" },
          {
            text: "Cancel Transfer",
            style: "destructive",
            onPress: async () => {
              setCancellingTransferId(transferId);
              try {
                await cancelTransfer(transferId);

                posthog?.capture("transfer_cancelled", {
                  transfer_id: transferId,
                  event_name: eventName || null,
                  screen_context: "my_events",
                });

                // Refetch both pending transfers and events
                refetchPending();
                fetchEventsData();

                Alert.alert(
                  "Cancelled",
                  "Transfer cancelled. Ticket returned."
                );
              } catch (error: any) {
                console.error("Error cancelling transfer:", error);
                Alert.alert(
                  "Cancel Failed",
                  error.message || "Could not cancel transfer."
                );
              } finally {
                setCancellingTransferId(null);
              }
            },
          },
        ]
      );
    },
    [posthog, refetchPending, fetchEventsData]
  );

  // Handle resend email for pending transfer
  const handleResendEmail = useCallback(
    async (transferId: string, recipientEmail?: string) => {
      setResendingTransferId(transferId);
      try {
        await resendTransferEmail(transferId);

        posthog?.capture("transfer_email_resent", {
          transfer_id: transferId,
          recipient_email: recipientEmail || null,
          screen_context: "my_events",
        });

        Alert.alert("Email Sent", "The claim email has been resent.");
      } catch (error: any) {
        console.error("Error resending email:", error);
        // Handle rate limit error specifically
        if (error.statusCode === 429) {
          Alert.alert(
            "Please Wait",
            error.message || "You can only resend once every 5 minutes."
          );
        } else {
          Alert.alert(
            "Resend Failed",
            error.message || "Could not resend email."
          );
        }
      } finally {
        setResendingTransferId(null);
      }
    },
    [posthog]
  );

  // Navigate to pending transfers screen
  const handleViewAllPending = useCallback(() => {
    router.push("/(app)/transfer/pending");
  }, [router]);

  // Transfer method handlers
  const handleSelectQR = useCallback(async () => {
    // Check/request camera permission before switching to QR mode
    const { status } = await Camera.getCameraPermissionsAsync();
    if (status === PermissionStatus.GRANTED) {
      setTransferMode("qr");
      setScanningAllowed(true);
      setScannedData(null);
    } else {
      const { status: newStatus } =
        await Camera.requestCameraPermissionsAsync();
      if (newStatus === PermissionStatus.GRANTED) {
        setHasPermission(newStatus);
        setTransferMode("qr");
        setScanningAllowed(true);
        setScannedData(null);
      } else {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to scan QR codes.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    }
  }, []);

  const handleSelectUsername = useCallback(() => {
    setTransferMode("username");
    setSelectedRecipient(null);
  }, []);

  const handleSelectEmail = useCallback(() => {
    setTransferMode("email");
  }, []);

  // Handle email transfer submission
  const handleEmailSubmit = useCallback(
    async (email: string) => {
      if (!currentUser || isTransferring) return;

      setIsTransferring(true);

      try {
        // Call transfer service to initiate email transfer
        const result = await initiateTransfer({
          ragerId: selectedTicketId,
          eventId: eventNameTransfer,
          recipientEmail: email,
        });

        // Track successful transfer
        posthog?.capture("ticket_transferred", {
          event_id: eventNameTransfer,
          ticket_id: selectedTicketId,
          transfer_method: "email",
          recipient_email: email,
          transfer_id: result.transferId,
          transferred_from: currentUser,
          transfer_timestamp: new Date().toISOString(),
          screen_context: isStandaloneScreen
            ? "my_events_screen"
            : "account_qr_modal",
          user_type: "authenticated",
        });

        // Show success message
        Alert.alert(
          "Transfer Sent!",
          `We've sent an email to ${email}. They have 72 hours to claim your ticket.`,
          [{ text: "OK" }]
        );

        // Refresh and close
        fetchEventsData();
        resetTransferModal();
      } catch (error: any) {
        console.error("Error transferring ticket via email:", error);

        posthog?.capture("ticket_transfer_failed", {
          event_id: eventNameTransfer,
          ticket_id: selectedTicketId,
          transfer_method: "email",
          recipient_email: email,
          error_message: error.message,
          error_code: error.code,
          user_type: "authenticated",
        });

        Alert.alert(
          "Transfer Failed",
          error.message || "Could not send transfer. Please try again."
        );
      } finally {
        setIsTransferring(false);
      }
    },
    [
      currentUser,
      isTransferring,
      selectedTicketId,
      eventNameTransfer,
      fetchEventsData,
      resetTransferModal,
      posthog,
      isStandaloneScreen,
    ]
  );

  // Handle user selection from username search
  const handleUserSelected = useCallback((user: UserSearchResult) => {
    setSelectedRecipient(user);
  }, []);

  // Handle back to method picker
  const handleBackToPicker = useCallback(() => {
    setTransferMode("picker");
    setSelectedRecipient(null);
    setScanningAllowed(true);
    setScannedData(null);
  }, []);

  // Handle confirm username transfer
  const handleConfirmUsernameTransfer = useCallback(async () => {
    if (!selectedRecipient || !currentUser || isTransferring) return;

    setIsTransferring(true);

    try {
      // Build ticket URL for transfer
      const ticketUrl = `events/${eventNameTransfer}/ragers/${selectedTicketId}`;

      // Create recipient data object
      const recipientData: RecipientData = {
        firstName: selectedRecipient.displayName.split(" ")[0] || "",
        lastName:
          selectedRecipient.displayName.split(" ").slice(1).join(" ") || "",
        email: "",
        expoPushToken: null,
        id: selectedRecipient.userId,
      };

      // Transfer the ticket using existing function
      await transferTicket(ticketUrl, recipientData);

      // Track successful transfer
      posthog?.capture("ticket_transferred", {
        event_id: eventNameTransfer,
        ticket_id: selectedTicketId,
        transfer_method: "username",
        recipient_id: selectedRecipient.userId,
        recipient_username: selectedRecipient.username || null,
        recipient_name: selectedRecipient.displayName,
        transferred_from: currentUser,
        transfer_timestamp: new Date().toISOString(),
        screen_context: isStandaloneScreen
          ? "my_events_screen"
          : "account_qr_modal",
        user_type: "authenticated",
      });

      // Show success
      Alert.alert(
        "Success",
        `You transferred your ticket to ${selectedRecipient.displayName}`
      );

      // Refresh and close
      fetchEventsData();
      resetTransferModal();
    } catch (error: any) {
      console.error("Error transferring ticket:", error);

      posthog?.capture("ticket_transfer_failed", {
        event_id: eventNameTransfer,
        ticket_id: selectedTicketId,
        transfer_method: "username",
        recipient_id: selectedRecipient.userId,
        error_message: error.message,
        user_type: "authenticated",
      });

      Alert.alert(
        "Transfer Failed",
        `Could not transfer ticket: ${error.message || "Please try again"}`
      );
    } finally {
      setIsTransferring(false);
    }
  }, [
    selectedRecipient,
    currentUser,
    isTransferring,
    eventNameTransfer,
    selectedTicketId,
    fetchEventsData,
    resetTransferModal,
    posthog,
    isStandaloneScreen,
  ]);

  // Render function with error states and retry options
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          isStandaloneScreen && styles.standaloneContainer,
        ]}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.textPrimary}
          style={{ marginVertical: 20 }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isStandaloneScreen && styles.standaloneContainer,
      ]}
    >
      {/* Back button for standalone screen */}
      {isStandaloneScreen && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.headline}>Your events</Text>

      {/* Show offline banner if applicable */}
      {isOffline && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="wifi-off"
            size={20}
            color={theme.colors.warning}
          />
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
            color={theme.colors.danger}
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
          color={theme.colors.textPrimary}
          style={{ marginVertical: 20 }}
        />
      ) : dataFetchFailed ? (
        // If data fetch completely failed and we have no tickets to show
        <View style={styles.centeredContent}>
          <MaterialCommunityIcons
            name="ticket-confirmation"
            size={40}
            color={theme.colors.borderStrong}
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
          {/* Pending Transfers Section */}
          {pendingTransfers && pendingTransfers.length > 0 && (
            <View style={styles.pendingSection}>
              <View style={styles.pendingSectionHeader}>
                <View style={styles.pendingTitleRow}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={18}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.pendingSectionTitle}>
                    Pending Transfers
                  </Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>
                      {pendingTransfers.length}
                    </Text>
                  </View>
                </View>
                {pendingTransfers.length > 2 && (
                  <TouchableOpacity onPress={handleViewAllPending}>
                    <Text style={styles.viewAllLink}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
              {pendingTransfers.slice(0, 2).map((transfer) => (
                <PendingTransferCard
                  key={transfer.id}
                  transfer={transfer}
                  onCancel={() =>
                    handleCancelTransfer(transfer.id, transfer.eventName)
                  }
                  onResendEmail={
                    transfer.recipientEmail && !transfer.recipientUsername
                      ? () =>
                          handleResendEmail(
                            transfer.id,
                            transfer.recipientEmail
                          )
                      : undefined
                  }
                  cancelling={cancellingTransferId === transfer.id}
                  resending={resendingTransferId === transfer.id}
                  compact
                />
              ))}
            </View>
          )}

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
                  styles={styles}
                  theme={theme}
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
        onRequestClose={resetTransferModal}
      >
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.modalContent,
              // Adjust height based on transfer mode
              transferMode === "picker" && { height: "auto", maxHeight: "90%" },
              // Username mode needs more space for input and results
              transferMode === "username" &&
                !selectedRecipient && {
                  height: "70%",
                  maxHeight: "85%",
                  justifyContent: "flex-start",
                },
              // Email mode - compact auto-height
              transferMode === "email" && {
                height: "auto",
                justifyContent: "flex-start",
              },
            ]}
          >
            {/* Header with back button when not on picker */}
            <View style={styles.modalHeader}>
              {transferMode !== "picker" && (
                <TouchableOpacity
                  style={styles.modalBackButton}
                  onPress={handleBackToPicker}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={theme.colors.textPrimary}
                  />
                </TouchableOpacity>
              )}
              <Text style={styles.modalText}>
                {transferMode === "picker" && "Transfer Ticket"}
                {transferMode === "qr" && "Scan QR Code"}
                {transferMode === "username" &&
                  (selectedRecipient ? "Confirm Transfer" : "Find by Username")}
                {transferMode === "email" && "Transfer by Email"}
              </Text>
              {transferMode !== "picker" && <View style={{ width: 24 }} />}
            </View>

            {/* Event info - shown in picker mode */}
            {transferMode === "picker" && (
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
            )}

            {/* Transfer Method Picker */}
            {transferMode === "picker" && (
              <View style={styles.methodPickerContainer}>
                <TransferMethodPicker
                  onSelectQR={handleSelectQR}
                  onSelectUsername={handleSelectUsername}
                  onSelectEmail={handleSelectEmail}
                  eventId={eventNameTransfer}
                  ticketId={selectedTicketId}
                />
              </View>
            )}

            {/* QR Scanner Mode */}
            {transferMode === "qr" && (
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
            )}

            {/* Username Transfer Mode */}
            {transferMode === "username" && !selectedRecipient && (
              <View style={styles.usernameFormContainer}>
                <UsernameTransferForm
                  ticketId={selectedTicketId}
                  eventId={eventNameTransfer}
                  eventName={eventData?.name || ""}
                  onUserSelected={handleUserSelected}
                  onCancel={handleBackToPicker}
                  hideHeader
                />
              </View>
            )}

            {/* Recipient Preview (when user selected from username search) */}
            {transferMode === "username" && selectedRecipient && (
              <View style={styles.recipientPreviewContainer}>
                <RecipientPreview
                  user={selectedRecipient}
                  onConfirm={handleConfirmUsernameTransfer}
                  onCancel={() => setSelectedRecipient(null)}
                  isLoading={isTransferring}
                  eventName={eventData?.name}
                  hideHeader
                />
              </View>
            )}

            {/* Email Transfer Mode */}
            {transferMode === "email" && (
              <View style={styles.emailFormContainer}>
                <EmailTransferForm
                  ticketId={selectedTicketId}
                  eventId={eventNameTransfer}
                  eventName={eventData?.name || ""}
                  onSubmit={handleEmailSubmit}
                  onCancel={handleBackToPicker}
                  hideHeader
                  isLoading={isTransferring}
                />
              </View>
            )}

            {/* Cancel Button - hide when RecipientPreview is shown (it has its own buttons) */}
            {!(transferMode === "username" && selectedRecipient) &&
              transferMode !== "email" && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    // Track transfer modal closure
                    posthog?.capture("ticket_transfer_cancelled", {
                      event_id: eventNameTransfer,
                      ticket_id: selectedTicketId,
                      transfer_mode: transferMode,
                      cancellation_stage: "transfer_modal",
                      user_type: "authenticated",
                    });

                    resetTransferModal();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
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

const createStyles = (theme: Theme) =>
  ({
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
      color: theme.colors.textPrimary,
      fontWeight: "600",
      fontSize: 16,
    },
    noTicketsText: {
      color: theme.colors.textSecondary,
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
      color: theme.colors.warning,
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
      color: theme.colors.danger,
      fontFamily,
      textAlign: "center",
      marginVertical: 8,
      fontSize: 14,
    },
    retryButton: {
      backgroundColor: theme.colors.borderSubtle,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
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
      alignItems: "center",
      paddingVertical: 12,
    },
    // Pending transfers section styles
    pendingSection: {
      width: screenWidth * 0.9,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    pendingSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    pendingTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pendingSectionTitle: {
      color: theme.colors.textPrimary,
      fontFamily,
      fontSize: 15,
      fontWeight: "600",
    },
    pendingBadge: {
      backgroundColor: theme.colors.accent,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: "center",
    },
    pendingBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: "700",
    },
    viewAllLink: {
      color: theme.colors.accent,
      fontFamily,
      fontSize: 13,
      fontWeight: "600",
    },
    cardWrapper: {
      width: "100%",
      alignItems: "center",
    },
    cardContainer: {
      width: screenWidth * 0.9,
      backgroundColor: theme.colors.bgElev1,
      marginVertical: 12,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      elevation: 4,
      shadowColor: theme.colors.bgRoot,
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
      color: theme.colors.textPrimary,
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
      color: theme.colors.textPrimary,
      fontFamily,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 6,
      lineHeight: 24,
    },
    transferSection: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.borderSubtle,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    transferText: {
      color: theme.colors.textPrimary,
      marginLeft: 8,
      fontSize: 14,
      fontWeight: "600",
      fontFamily,
    },
    innerContainer: {
      marginVertical: 6,
      marginHorizontal: 0,
      borderRadius: 8,
      backgroundColor: theme.colors.bgElev1,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
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
      color: theme.colors.textPrimary,
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
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 8,
      width: "80%",
      padding: 20,
      alignItems: "center",
      elevation: 5,
      height: modalContentHeight,
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
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
      color: theme.colors.textPrimary,
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
      color: theme.colors.textPrimary,
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
      borderColor: theme.colors.borderSubtle,
    },
    cancelButton: {
      backgroundColor: theme.colors.bgElev2,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      width: "100%",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      marginTop: 16,
    },
    cancelButtonText: {
      fontFamily,
      color: theme.colors.textPrimary,
      fontWeight: "600",
      textTransform: "uppercase",
      textAlign: "center",
    },
    buttonText: {
      fontWeight: "600",
      color: theme.colors.textPrimary,
      textTransform: "uppercase",
      textAlign: "center",
      fontFamily,
    },
    actionButton: {
      backgroundColor: theme.colors.bgElev2,
      borderColor: theme.colors.borderStrong,
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
      color: theme.colors.textPrimary,
      textAlign: "center",
      fontSize: 20,
      fontFamily,
    },
    permissionContainer: {
      alignItems: "center",
      justifyContent: "center",
      height: 200,
      width: 200,
      borderRadius: 8,
      backgroundColor: theme.colors.bgElev2,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    permissionText: {
      color: theme.colors.textPrimary,
      textAlign: "center",
      marginBottom: 16,
      fontFamily,
      padding: 8,
    },
    permissionButton: {
      backgroundColor: theme.colors.borderSubtle,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    permissionButtonText: {
      color: theme.colors.textPrimary,
      fontFamily,
      fontWeight: "600",
    },
    // Standalone screen styles
    standaloneContainer: {
      flex: 1,
      paddingTop: Platform.OS === "ios" ? 50 : 30,
      paddingHorizontal: 16,
      width: "100%",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      paddingVertical: 8,
    },
    backButtonText: {
      color: theme.colors.textPrimary,
      fontFamily,
      fontSize: 16,
      marginLeft: 8,
    },
    // Modal header styles for transfer modes
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      marginBottom: 16,
      position: "relative",
      minHeight: 32,
    },
    modalBackButton: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      padding: 4,
    },
    // Container styles for transfer modes
    methodPickerContainer: {
      width: "100%",
      marginVertical: 8,
    },
    usernameFormContainer: {
      width: "100%",
      flex: 1,
      minHeight: 300,
      marginVertical: 8,
      overflow: "hidden",
    },
    emailFormContainer: {
      width: "100%",
      marginTop: 8,
    },
    recipientPreviewContainer: {
      width: "100%",
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  } as const);

export default MyEvents;
