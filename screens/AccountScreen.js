import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  Dimensions,
  TouchableOpacity,
} from "react-native";

import React, { useState, useEffect, useCallback, useMemo } from "react";

import {
  getDatabase,
  ref as databaseRef,
  get,
  update,
} from "firebase/database";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { useSelector, useDispatch } from "react-redux";
import { selectUserName, setUserName } from "../store/redux/userSlice";

import * as ImagePicker from "expo-image-picker";
import SettingsModal from "./modals/SettingsModal";
import QRCodeModal from "./modals/QRModal";
import HistoryModal from "./modals/HistoryModal";
import EditProfile from "./modals/EditProfile";

export default function AccountScreen({ setAuthenticated }) {
  const [profilePicture, setProfilePicture] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const userName = useSelector(selectUserName);

  // Inside your component
  const dispatch = useDispatch();

  // Access the localId from the Redux store
  const localId = useSelector((state) => state.user.localId);
  // Get a reference to the database
  const db = getDatabase();

  const fetchUserData = useCallback(() => {
    const userRef = databaseRef(db, `users/${localId}`);

    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const name = `${userData.firstName} ${userData.lastName}`;
          const profilePicture = userData.profilePicture;

          dispatch(setUserName(name));
          setProfilePicture(profilePicture);
        } else {
          console.error("No data available");
        }
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
      });
  }, [db, localId, dispatch]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleProfileUpdated = useCallback(() => {
    fetchUserData();
  }, [fetchUserData]);

  const pickImage = useCallback(async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;

        // Get reference to Firebase Storage
        const storage = getStorage();

        // Create a reference to the profile picture in Firebase Storage
        const profilePictureRef = storageRef(
          storage,
          `profilePictures/${localId}`
        );

        // Convert imageUri to blob
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Upload the image to Firebase Storage
        await uploadBytes(profilePictureRef, blob);

        // Get the download URL of the uploaded image
        const downloadURL = await getDownloadURL(profilePictureRef);

        // Update the user's record in the Realtime Database with the download URL
        const userRef = databaseRef(db, `users/${localId}`);
        await update(userRef, { profilePicture: downloadURL });

        // Once uploaded, set the profile picture URI in your component state
        setProfilePicture(downloadURL);
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    }
  }, [localId, db]);

  const imageSource = useMemo(() => {
    return profilePicture
      ? { uri: profilePicture }
      : require("../assets/user.png");
  }, [profilePicture]);

  const handleEditProfile = () => {
    setShowEditProfileModal(!showEditProfileModal);
    setShowHistoryModal(false);
    setShowQRModal(false);
  };

  const showAccountHistory = () => {
    setShowHistoryModal(!showHistoryModal);
    setShowQRModal(false);
    setShowEditProfileModal(false);
  };

  const eventQRHandler = () => {
    setShowQRModal(!showQRModal);
    setShowHistoryModal(false);
    setShowEditProfileModal(false);
  };

  const showSettingsHandler = () => {
    setShowSettingsModal(!showSettingsModal);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Profile Picture */}
          <TouchableOpacity
            onPress={pickImage}
            style={styles.profilePictureContainer}
          >
            <Image
              source={imageSource}
              style={styles.profilePicture}
              resizeMode="cover"
            />
          </TouchableOpacity>

          {/* Profile Name */}
          <Text style={styles.nameTag}>{userName}</Text>

          {/* Edit Profile Button */}
          <TouchableOpacity
            onPress={handleEditProfile}
            style={styles.actionButton}
          >
            <Text style={styles.buttonText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={showAccountHistory}
              style={styles.tabButton}
            >
              <Text style={styles.buttonText}>HISTORY</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={eventQRHandler}
              style={[styles.tabButton, showQRModal && styles.activeTabButton]}
            >
              <Text
                style={[
                  styles.buttonText,
                  showQRModal && styles.activeButtonText,
                ]}
              >
                QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showSettingsHandler}
              style={styles.tabButton}
            >
              <Text style={styles.buttonText}>SETTINGS</Text>
            </TouchableOpacity>
          </View>

          {/* Edit Profile, History, and QR Modal Container */}
          <View style={styles.modalContainer}>
            {showEditProfileModal && (
              <EditProfile
                onProfileUpdated={handleProfileUpdated}
                onCancel={() => setShowEditProfileModal(false)}
              />
            )}
            {showQRModal && <QRCodeModal />}
            {showHistoryModal && <HistoryModal />}
          </View>
        </View>
      </ScrollView>

      {showSettingsModal && (
        <SettingsModal
          visible={showSettingsModal}
          handleClose={() => setShowSettingsModal(false)}
          setAuthenticated={setAuthenticated}
        />
      )}

      <Text style={styles.footerText}>THANKS FOR RAGING WITH US</Text>
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
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
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  nameTag: {
    fontFamily,
    fontWeight: "700",
    fontSize: 24,
    marginTop: 16,
    marginBottom: 8,
    color: "white",
  },
  profilePictureContainer: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#333",
    marginTop: 20,
  },
  profilePicture: {
    width: Dimensions.get("window").width * 0.45,
    height: Dimensions.get("window").width * 0.45,
  },
  footerText: {
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    padding: 16,
    color: "#aaa",
    fontWeight: "500",
  },
  actionButton: {
    marginVertical: 16,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "50%",
    alignItems: "center",
    borderColor: "#555",
    backgroundColor: "#222",
  },
  buttonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },
  tabButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
    backgroundColor: "transparent",
    flex: 1,
    marginHorizontal: 4,
  },
  activeTabButton: {
    borderColor: "#fff",
    backgroundColor: "#222",
  },
  activeButtonText: {
    color: "#fff",
  },
});
