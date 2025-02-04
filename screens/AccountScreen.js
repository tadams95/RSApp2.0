import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
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
      : require("../assets/trollFace.png");
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
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView>
        <View style={styles.container}>
          {/* Profile Picture */}
          <Pressable onPress={pickImage}>
            <Image
              source={imageSource}
              style={styles.profilePicture}
              resizeMode="cover"
            />
          </Pressable>

          {/* Profile Name */}
          <Text style={styles.nameTag}>{userName}</Text>

          {/* Edit Profile Button */}
          <Pressable
            onPress={handleEditProfile}
            style={styles.editProfileButton}
          >
            <Text style={styles.secondaryText}>EDIT PROFILE</Text>
          </Pressable>

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <Pressable onPress={showAccountHistory} style={styles.tabButton}>
              <Text style={styles.secondaryText}>HISTORY</Text>
            </Pressable>

            <Pressable onPress={eventQRHandler} style={styles.tabButton}>
              <Text style={styles.secondaryText}>QR</Text>
            </Pressable>

            <Pressable onPress={showSettingsHandler} style={styles.tabButton}>
              <Text style={styles.secondaryText}>SETTINGS</Text>
            </Pressable>
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

        {showSettingsModal && (
          <SettingsModal
            visible={showSettingsModal}
            handleClose={() => setShowSettingsModal(false)}
            setAuthenticated={setAuthenticated}
          />
        )}
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    // backgroundColor: GlobalStyles.colors.red0,
    alignItems: "center",
    justifyContent: "center",
  },
  nameTag: {
    fontFamily,
    fontWeight: "700",
    fontSize: 24,
    marginTop: 10,
    color: "white",
  },
  secondaryText: {
    fontFamily,
    textAlign: "center",
    color: "white",
    fontWeight: "500",
  },
  profilePicture: {
    width: Dimensions.get("window").width * 0.45,
    height: Dimensions.get("window").width * 0.45,
    borderRadius: 10,
    marginTop: 10,
  },
  footerText: {
    backgroundColor: "#000",
    textAlign: "center",
    fontFamily,
    fontSize: 14,
    marginBottom: 10,
    color: "white",
    fontWeight: "500",
  },
  editProfileButton: {
    margin: 10,
    borderWidth: 2,
    padding: 5,
    borderRadius: 10,
    width: "30%",
    alignItems: "center",
    borderColor: "white",
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabButton: {
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "30%",
    margin: 5,
  },
});
