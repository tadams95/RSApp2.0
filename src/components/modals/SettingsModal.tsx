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
import { logError } from "../../utils/logError";
import { extractStorageErrorCode } from "../../utils/storageErrorHandler";

// Define interface for AdminModal props
interface AdminModalProps {
  visible: boolean;
  toggleModal: () => void;
  admin: any;
}

// Import from the new location
import AdminModal from "./AdminModal";

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
          // No user signed in - clear admin state
          setIsAdmin(false);
          setAdmin(null);
        }
      } catch (error: any) {
        // Enhanced error handling for user data fetching
        logError(error, "UserDataFetch", {
          userId: auth.currentUser?.uid || "unknown",
          errorType: error?.code || "unknown",
          action: "fetch_admin_status",
        });

        console.error("Error fetching user data:", error);

        // Reset admin state on error
        setIsAdmin(false);
        setAdmin(null);

        // Only show error to user if it's a network issue or permission problem
        if (error?.code === "permission-denied") {
          Alert.alert(
            "Permission Error",
            "Unable to verify admin status. Some features may not be available.",
            [{ text: "OK", style: "default" }]
          );
        } else if (error?.code === "network-request-failed") {
          Alert.alert(
            "Network Error",
            "Unable to load user settings. Please check your connection.",
            [{ text: "OK", style: "default" }]
          );
        }
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
          try {
            setAuthenticated(false);
            await AsyncStorage.removeItem("stayLoggedIn");
            if (typeof handleClose === "function") {
              handleClose();
            }
          } catch (error: any) {
            // Enhanced error handling for logout
            logError(error, "UserLogout", {
              userId: auth.currentUser?.uid || "unknown",
              errorType: error?.code || "unknown",
              action: "logout",
            });

            console.error("Error during logout:", error);

            // Still set authenticated to false even if storage clear fails
            setAuthenticated(false);
            if (typeof handleClose === "function") {
              handleClose();
            }

            // Only show error if it might affect user experience
            if (error?.message?.includes("AsyncStorage")) {
              Alert.alert(
                "Logout Warning",
                "You've been logged out, but your login preferences may not have been cleared properly.",
                [{ text: "OK", style: "default" }]
              );
            }
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
                } catch (deleteError: any) {
                  const errorCode = extractStorageErrorCode(deleteError);

                  if (errorCode === "storage/unauthorized") {
                    // Handle permission denied errors specifically
                    logError(deleteError, "ProfilePictureDeletion", {
                      userId: currentUser.uid,
                      errorType: "storage/unauthorized",
                      action: "deleteObject",
                      context: "account_deletion",
                    });

                    // Show warning but continue with account deletion
                    Alert.alert(
                      "Profile Picture Delete Warning",
                      "Your profile picture couldn't be deleted due to permissions, but your account will still be deleted. The picture may remain in storage.",
                      [{ text: "Continue", style: "default" }]
                    );
                  } else if (errorCode === "storage/object-not-found") {
                    // Ignore the error if the profile picture doesn't exist - this is expected
                    console.log(
                      "Profile picture not found - skipping deletion"
                    );
                  } else if (errorCode === "storage/quota-exceeded") {
                    // Handle quota exceeded errors
                    logError(deleteError, "ProfilePictureDeletion", {
                      userId: currentUser.uid,
                      errorType: "storage/quota-exceeded",
                      action: "deleteObject",
                      context: "account_deletion",
                    });

                    Alert.alert(
                      "Storage Quota Exceeded",
                      "Unable to delete profile picture due to storage quota limits. Your account will still be deleted.",
                      [{ text: "Continue", style: "default" }]
                    );
                  } else if (errorCode === "storage/retry-limit-exceeded") {
                    // Handle retry limit exceeded errors
                    logError(deleteError, "ProfilePictureDeletion", {
                      userId: currentUser.uid,
                      errorType: "storage/retry-limit-exceeded",
                      action: "deleteObject",
                      context: "account_deletion",
                    });

                    Alert.alert(
                      "Network Issue",
                      "Unable to delete profile picture due to network connectivity. Your account will still be deleted.",
                      [{ text: "Continue", style: "default" }]
                    );
                  } else {
                    // Log unknown storage errors but don't block account deletion
                    logError(deleteError, "ProfilePictureDeletion", {
                      userId: currentUser.uid,
                      errorType: errorCode || "unknown",
                      action: "deleteObject",
                      context: "account_deletion",
                    });

                    console.warn(
                      "Unexpected storage error during profile picture deletion:",
                      deleteError
                    );

                    // Show generic warning for unexpected errors
                    Alert.alert(
                      "Profile Picture Delete Issue",
                      "There was an issue deleting your profile picture, but your account will still be deleted.",
                      [{ text: "Continue", style: "default" }]
                    );
                  }
                }

                setAuthenticated(false);
                if (typeof handleClose === "function") {
                  handleClose();
                }
              } else {
                Alert.alert(
                  "Authentication Error",
                  "No authenticated user found. Please log in again.",
                  [{ text: "OK", style: "default" }]
                );
              }
            } catch (error: any) {
              // Enhanced error handling for account deletion failures
              const user = auth.currentUser;
              logError(error, "AccountDeletion", {
                userId: user?.uid || "unknown",
                errorType: error?.code || "unknown",
                action: "delete_account",
              });

              let errorMessage =
                "An unexpected error occurred while deleting your account.";

              if (error?.code === "auth/requires-recent-login") {
                errorMessage =
                  "For security reasons, please log out and log back in before deleting your account.";
              } else if (error?.code === "auth/network-request-failed") {
                errorMessage =
                  "Network error. Please check your connection and try again.";
              } else if (error?.code === "auth/too-many-requests") {
                errorMessage =
                  "Too many attempts. Please wait a moment and try again.";
              }

              Alert.alert("Account Deletion Failed", errorMessage, [
                { text: "OK", style: "default" },
              ]);

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
