import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {
  ref as databaseRef,
  DatabaseReference,
  get,
  getDatabase,
} from "firebase/database";
import {
  deleteObject,
  getStorage,
  ref as storageRef,
  StorageReference,
} from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth } from "../../firebase/firebase";

// Define interface for AdminModal props
interface AdminModalProps {
  visible: boolean;
  toggleModal: () => void;
  admin: any; // Replace with proper type when AdminModal is migrated
}

// Import from the legacy location until migrated
// Use dynamic import with type casting
const AdminModal = React.lazy(
  () => import("../../../screens/eventAdmin/AdminModal")
) as unknown as React.FC<AdminModalProps>;

interface AdminUser {
  isAdmin: boolean;
  [key: string]: any; // Add other admin properties as needed
}

interface SettingsModalProps {
  visible: boolean;
  setAuthenticated: (value: boolean) => void;
  handleClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  setAuthenticated,
  handleClose,
}) => {
  const [adminModalVisible, setAdminModalVisible] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    // Fetch current user data and check isAdmin status
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const db = getDatabase();
          const userDataRef: DatabaseReference = databaseRef(
            db,
            `users/${currentUser.uid}`
          );
          const snapshot = await get(userDataRef);
          const userData = snapshot.val();
          if (userData && userData.isAdmin) {
            setIsAdmin(true);
            setAdmin(userData as AdminUser);
          }
        } else {
          console.error("No user is signed in");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    if (visible) {
      fetchUserData();
    }
  }, [visible]);

  const toggleAdminVisibility = () => {
    if (isAdmin) {
      setAdminModalVisible(!adminModalVisible);
    } else {
      Alert.alert(
        "Unauthorized Access",
        "You are not authorized to access this feature."
      );
    }
  };

  const handleLogout = async () => {
    Alert.alert("Are you sure you want to log out?", "", [
      {
        text: "Yes",
        onPress: async () => {
          setAuthenticated(false);
          await AsyncStorage.removeItem("stayLoggedIn");
          if (typeof handleClose === "function") {
            handleClose();
          }
        },
      },
      {
        text: "No",
        style: "cancel",
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    const storage = getStorage();

    Alert.alert(
      "Are you sure you want to delete your account?",
      "This action cannot be undone.",
      [
        {
          text: "Yes",
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (currentUser) {
                // Get the reference to the user's profile picture in Firebase Storage
                const profilePictureRef: StorageReference = storageRef(
                  storage,
                  `profilePictures/${currentUser.uid}`
                );

                // Delete the user account in Firebase Authentication
                await currentUser.delete();

                // Delete the user record in the Realtime Database
                await axios.delete(
                  `https://ragestate-app-default-rtdb.firebaseio.com/users/${currentUser.uid}.json`
                );

                // Delete the user's profile picture in Firebase Storage if it exists
                try {
                  await deleteObject(profilePictureRef);
                } catch (error: any) {
                  // Ignore the error if the profile picture doesn't exist
                  if (error.code !== "storage/object-not-found") {
                    throw error; // Re-throw the error if it's not related to the profile picture not found
                  }
                }

                setAuthenticated(false);
                if (typeof handleClose === "function") {
                  handleClose();
                }
              } else {
                console.error("No user is authenticated");
              }
            } catch (error) {
              console.error("Error deleting account:", error);
            }
          },
        },
        {
          text: "No",
          style: "cancel",
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      style={styles.modal}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.headerText}>Settings</Text>
          </View>

          <View style={styles.content}>
            {isAdmin && (
              <Pressable
                style={styles.actionButton}
                onPress={toggleAdminVisibility}
                accessibilityRole="button"
                accessibilityLabel="Admin panel"
              >
                <Text style={styles.buttonText}>ADMIN PANEL</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.actionButton}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <Text style={styles.buttonText}>LOGOUT</Text>
            </Pressable>

            <Pressable
              style={styles.deleteActionButton}
              onPress={handleDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Text style={styles.deleteButtonText}>DELETE ACCOUNT</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Text style={styles.buttonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {adminModalVisible && (
        <AdminModal
          visible={adminModalVisible}
          toggleModal={toggleAdminVisibility}
          admin={admin as any}
        />
      )}
    </Modal>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#000",
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 50,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily,
    color: "white",
    textTransform: "uppercase",
  },
  content: {
    alignItems: "center",
  },
  actionButton: {
    marginVertical: 12,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    borderColor: "#555",
    backgroundColor: "#222",
  },
  deleteActionButton: {
    marginVertical: 12,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    borderColor: "#ff3b30",
    backgroundColor: "#222",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontFamily,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  deleteButtonText: {
    color: "#ff3b30",
    fontSize: 16,
    fontFamily,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

export default SettingsModal;
