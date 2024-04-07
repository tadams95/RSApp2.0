import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { auth } from "../../firebase/firebase";

import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { getDatabase, ref as databaseRef, get } from "firebase/database";

import axios from "axios";
import AdminModal from "../eventAdmin/AdminModal";

const SettingsModal = ({ visible, setAuthenticated, handleClose }) => {
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    // Fetch current user data and check isAdmin status
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const db = getDatabase(); // Get a reference to the database
          const userDataRef = databaseRef(db, `users/${currentUser.uid}`); // Reference to user data
          const snapshot = await get(userDataRef); // Fetch user data
          const userData = snapshot.val();
          if (userData && userData.isAdmin) {
            setIsAdmin(true);
            setAdmin(userData);
          }
        } else {
          console.error("No user is signed in");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    // Call fetchUserData function when the component mounts
    fetchUserData();
  }, []);

  const toggleAdminVisibility = () => {
    if (isAdmin) {
      // User is an admin, allow opening the admin modal
      setAdminModalVisible(!adminModalVisible);
    } else {
      // User is not an admin, display a message or take appropriate action
      Alert.alert(
        "Unauthorized Access",
        "You are not authorized to access this feature."
      );
      // Optionally, you can set a state to display a message to the user
    }
  };

  const handleLogout = () => {
    Alert.alert("Are you sure you want to log out?", "", [
      {
        text: "Yes",
        onPress: () => {
          setAuthenticated(false); // Change the authenticated state
          if (typeof handleClose === "function") {
            handleClose();
          }
        },
      },
      {
        text: "No",
        onPress: () => {
          // Do nothing
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    const storage = getStorage(); // Pass the Firebase app instance

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
                const profilePictureRef = storageRef(
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
                  await deleteObject(profilePictureRef); // Call deleteObject() method on the reference
                } catch (error) {
                  // Ignore the error if the profile picture doesn't exist
                  if (error.code !== "storage/object-not-found") {
                    throw error; // Re-throw the error if it's not related to the profile picture not found
                  }
                }

                setAuthenticated(false); // Change the authenticated state
                if (typeof handleClose === "function") {
                  handleClose(); // Close the modal
                }
              } else {
                console.error("No user is authenticated");
              }
            } catch (error) {
              console.error("Error deleting account:", error);
              // Handle error messages and state accordingly
            }
          },
        },
        {
          text: "No",
          onPress: () => {
            // Do nothing
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      style={{ backgroundColor: "black" }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.headerText}>Settings</Text>
          <Pressable style={styles.closeButton} onPress={toggleAdminVisibility}>
            <Text style={styles.closeButtonText}>Admin</Text>
          </Pressable>
          <AdminModal
            visible={adminModalVisible}
            toggleModal={toggleAdminVisibility}
            admin={admin}
          />
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={handleLogout}>
            <Text style={styles.closeButtonText}>Logout</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </Pressable>
        </View>
        <View style={styles.content}></View>
      </View>
    </Modal>
  );
};

export default SettingsModal;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

export const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: "black",
    flex: 1,
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#000",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxWidth: 400,
    maxHeight: 600,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily,
    alignSelf: "center",
    textTransform: "uppercase",
    color: "white",
  },
  inputContainer: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  closeButton: {
    backgroundColor: "#000",
    padding: 10,
    marginTop: 10,
    borderRadius: 5,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "50%",
    alignSelf: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 12,
    fontFamily,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  saveButton: {
    backgroundColor: "#2ecc71",
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#000",
    padding: 10,
    marginTop: 10,
    borderRadius: 5,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "red",
    width: "50%",
    alignSelf: "center",
  },
  deleteButtonText: {
    color: "red",
    fontSize: 12,
    fontFamily,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  confirmationModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
    justifyContent: "center",
  },
  confirmationModalTitle: {
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily,
    textAlign: "center",
  },
  confirmationModalInput: {
    width: "100%",
    backgroundColor: "#F6F6F6",
    padding: 15,
    marginBottom: 10,
    borderRadius: 5,
  },
  confirmationModalButtonContainer: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmationModalButton: {
    backgroundColor: "black",
    padding: 15,
    borderRadius: 5,
    width: "48%",
    alignItems: "center",
  },
  confirmationModalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily,
  },
  confirmationModalCancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "black",
  },
  confirmationModalCancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily,
  },
  blackout: {
    backgroundColor: "black",
  },
});
