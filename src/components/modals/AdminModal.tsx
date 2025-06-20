import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  ImageStyle,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { validateAndCleanupStorageReferences } from "../../utils/storageErrorHandler";
import ImageWithFallback from "../ui/ImageWithFallback";

import { Camera } from "expo-camera";
import {
  collection,
  DocumentData,
  Firestore,
  getDocs,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

// Import EventAdminView from modals directory
import EventAdminView from "./EventAdminView";

// Define interfaces for component props and data
interface AdminModalProps {
  visible: boolean;
  toggleModal: () => void;
  admin?: any; // Keeping this consistent with SettingsModal's usage
}

interface EventData {
  id?: string;
  name: string;
  dateTime: {
    toDate: () => Date;
  };
  imgURL: string;
  [key: string]: any; // For any additional event properties
}

const AdminModal: React.FC<AdminModalProps> = ({
  visible,
  toggleModal,
  admin,
}) => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventAdminViewVisible, setEventAdminViewVisible] =
    useState<boolean>(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null
  );

  // Fetch events and check camera permission on component mount
  useEffect(() => {
    // Function to fetch event data
    const fetchEventData = async (): Promise<void> => {
      try {
        const eventCollectionRef = collection(db as Firestore, "events");
        const eventSnapshot = await getDocs(eventCollectionRef);

        const currentDate = new Date();

        // Filter out past events
        const eventData = eventSnapshot.docs
          .map(
            (doc: QueryDocumentSnapshot<DocumentData>) =>
              doc.data() as EventData
          )
          .filter((event: EventData) => {
            const eventDateTime = event.dateTime.toDate();
            return eventDateTime >= currentDate;
          });

        // Validate storage references for all events
        const validateEventImages = async () => {
          for (const event of eventData) {
            if (event.id && event.imgURL) {
              try {
                await validateAndCleanupStorageReferences("events", event.id, {
                  imgURL: "",
                });
              } catch (error) {
                console.error(
                  `Error validating image for event ${event.id}:`,
                  error
                );
              }
            }
          }
        };

        // Run validation in background, don't block UI
        validateEventImages();

        setEvents(eventData);
      } catch (error) {
        console.error("Error fetching event data:", error);
      }
    };

    fetchEventData();

    // Better camera permission check with logging
    const checkCameraPermission = async (): Promise<void> => {
      try {
        console.log("Checking camera permission...");
        const { status } = await Camera.getCameraPermissionsAsync();
        console.log("Camera permission status:", status);
        setCameraPermission(status === "granted");
      } catch (error) {
        console.error("Error checking camera permission:", error);
        setCameraPermission(false);
      }
    };

    checkCameraPermission();
  }, [visible]); // Re-check permission when modal becomes visible

  // Function to request camera permission with improved logic
  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      console.log("Requesting camera permission...");
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log("Camera permission request result:", status);

      // Add a small delay to ensure the OS has processed the permission change
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check permission status again after delay
      const { status: updatedStatus } =
        await Camera.getCameraPermissionsAsync();
      console.log("Updated camera permission status:", updatedStatus);

      setCameraPermission(updatedStatus === "granted");
      return updatedStatus === "granted";
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      return false;
    }
  };

  const handleEventPress = async (event: EventData): Promise<void> => {
    // First, get the current permission state directly
    const { status } = await Camera.getCameraPermissionsAsync();

    if (status === "granted") {
      // Permission already granted, proceed
      setSelectedEvent(event);
      setEventAdminViewVisible(true);
    } else {
      // Need to request permission
      Alert.alert(
        "Camera Permission Required",
        "Admin functions require camera access for QR scanning.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Grant Permission",
            onPress: async () => {
              const granted = await requestCameraPermission();
              if (granted) {
                setSelectedEvent(event);
                setEventAdminViewVisible(true);
              } else {
                // If permission still denied after request, guide user to settings
                Alert.alert(
                  "Permission Required",
                  "Please enable camera access in your device settings for RAGESTATE.",
                  [
                    { text: "Not Now", style: "cancel" },
                    {
                      text: "Open Settings",
                      onPress: () => {
                        // On iOS this will open camera settings, on Android it may open app settings
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
  };

  const toggleEventAdminViewVisibility = (): void => {
    setEventAdminViewVisible(!eventAdminViewVisible);
  };

  return (
    <Modal visible={visible} animationType="none">
      <View style={styles.root}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            <Text style={styles.headline}>
              RAGESTATE ADMIN EVENT MANAGEMENT
            </Text>

            {events.length === 0 ? (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No events available</Text>
              </View>
            ) : (
              // Render events if there are any
              events.reverse().map((event, index) => (
                <View key={index} style={styles.eventContainer}>
                  <Pressable
                    onPress={() => handleEventPress(event)}
                    style={({ pressed }) =>
                      pressed ? styles.pressed : undefined
                    }
                  >
                    <ImageWithFallback
                      source={{ uri: event.imgURL }}
                      style={styles.eventImage}
                      fallbackSource={require("../../assets/BlurHero_2.png")}
                      showLoadingIndicator={true}
                      showRetryButton={false}
                      showErrorMessage={false}
                      maxRetries={2}
                      errorContext="AdminModal"
                      resizeMode="cover"
                    />
                    <Text style={styles.title}>{event.name}</Text>
                    <Text style={styles.subtitle}>
                      {event.dateTime.toDate().toDateString()}
                    </Text>
                    {/* Add other event details as needed */}
                  </Pressable>
                </View>
              ))
            )}
            <EventAdminView
              visible={eventAdminViewVisible}
              event={selectedEvent} // Pass the selected event to EventAdminView
              toggleModal={toggleEventAdminViewVisibility}
              // Note: EventAdminView only accepts visible, event, and toggleModal props
            />
          </View>
          <Pressable style={styles.actionButton} onPress={toggleModal}>
            <Text style={styles.buttonText}>CLOSE</Text>
          </Pressable>

          <Text style={styles.footerText}>THANKS FOR RAGING WITH US</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

// Define style types
interface Styles {
  root: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  container: ViewStyle;
  eventContainer: ViewStyle;
  noEventsContainer: ViewStyle;
  pressed: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  eventImage: ImageStyle;
  actionButton: ViewStyle;
  buttonText: TextStyle;
  headline: TextStyle;
  noEventsText: TextStyle;
  footerText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
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
  eventContainer: {
    width: "100%",
    marginVertical: 10,
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#555",
    overflow: "hidden",
  },
  noEventsContainer: {
    width: "100%",
    marginTop: Dimensions.get("window").height * 0.25,
    borderRadius: 8,
    backgroundColor: "#111",
    padding: 20,
    borderWidth: 1,
    borderColor: "#555",
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontFamily,
    textAlign: "center",
    paddingTop: 8,
    color: "white",
    fontWeight: "600",
    fontSize: 18,
  },
  subtitle: {
    fontFamily,
    textAlign: "center",
    paddingVertical: 4,
    color: "#aaa",
    paddingBottom: 12,
  },
  eventImage: {
    height: Dimensions.get("window").height * 0.25,
    width: "100%",
    alignSelf: "center",
  },
  actionButton: {
    marginVertical: 16,
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
    color: "white",
    fontWeight: "600",
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
  noEventsText: {
    fontFamily,
    textAlign: "center",
    fontSize: 18,
    color: "white",
    fontWeight: "500",
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

export default AdminModal;
