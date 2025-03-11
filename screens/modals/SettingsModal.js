import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import { auth } from "../../firebase/firebase";

import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { getDatabase, ref as databaseRef, get } from "firebase/database";

import axios from "axios";
import AdminModal from "../eventAdmin/AdminModal";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const handleLogout = async () => {
    Alert.alert("Are you sure you want to log out?", "", [
      {
        text: "Yes",
        onPress: async () => {
          setAuthenticated(false); // Change the authenticated state
          await AsyncStorage.removeItem("stayLoggedIn");
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
              <Pressable style={styles.actionButton} onPress={toggleAdminVisibility}>
                <Text style={styles.buttonText}>ADMIN PANEL</Text>
              </Pressable>
            )}
            
            <Pressable style={styles.actionButton} onPress={handleLogout}>
              <Text style={styles.buttonText}>LOGOUT</Text>
            </Pressable>
            
            <Pressable style={styles.deleteActionButton} onPress={handleDeleteAccount}>
              <Text style={styles.deleteButtonText}>DELETE ACCOUNT</Text>
            </Pressable>
            
            <Pressable style={styles.actionButton} onPress={handleClose}>
              <Text style={styles.buttonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      
      <AdminModal
        visible={adminModalVisible}
        toggleModal={toggleAdminVisibility}
        admin={admin}
      />
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
