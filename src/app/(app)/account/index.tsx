import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { ImageWithFallback } from "../../../components/ui";
import { useAuth } from "../../../hooks/AuthContext";
import { selectUserName, setUserName } from "../../../store/redux/userSlice";
// Import the newly migrated modals from the barrel file
import {
  EditProfile,
  HistoryModal,
  QRModal,
  SettingsModal,
} from "../../../components/modals";

// Define the types for modals
// These are kept here for future extensions
interface ModalProps {
  visible?: boolean;
  handleClose?: () => void;
  onProfileUpdated?: () => void;
  onCancel?: () => void;
  setAuthenticated?: (auth: boolean) => void;
}

// Convert to default export
export default function AccountScreen() {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] =
    useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const userName = useSelector(selectUserName);
  const { signOut } = useAuth();
  const router = useRouter();

  const dispatch = useDispatch();

  // Access the localId from the Redux store
  const localId = useSelector((state: any) => state.user.localId);

  // Get a reference to the Firestore database
  const db = getFirestore();

  const fetchUserData = useCallback(() => {
    if (!localId) {
      console.error("User ID not available");
      return;
    }

    const userDocRef = doc(db, `customers/${localId}`);

    getDoc(userDocRef)
      .then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const name = `${userData.firstName} ${userData.lastName}`;
          const profilePic = userData.profilePicture;

          dispatch(setUserName(name));
          setProfilePicture(profilePic);
        } else {
          console.error("No user document found");
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
      // Request permission if needed (this is handled by the library in newer versions)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;

        if (!localId) {
          console.error("User ID not available for uploading profile picture");
          return;
        }

        // Get reference to Firebase Storage
        const storage = getStorage();

        // Create a reference to the profile picture in Firebase Storage
        const profilePictureRef = storageRef(
          storage,
          `profilePictures/${localId}/profile_${Date.now()}.jpeg`
        );

        // Convert imageUri to blob
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Upload the image to Firebase Storage
        await uploadBytes(profilePictureRef, blob);

        // Get the download URL of the uploaded image
        const downloadURL = await getDownloadURL(profilePictureRef);

        // Update the user's document in Firestore with the download URL
        const userDocRef = doc(db, `customers/${localId}`);
        await updateDoc(userDocRef, {
          profilePicture: downloadURL,
          lastUpdated: new Date().toISOString(),
        });

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
      : require("../../../assets/user.png"); // Update path to asset
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

  // Handle logout using AuthContext
  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)/");
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Profile Picture */}
          <TouchableOpacity
            onPress={pickImage}
            style={styles.profilePictureContainer}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <ImageWithFallback
              source={imageSource}
              fallbackSource={require("../../../assets/user.png")}
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
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.buttonText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          {/* Tab Container */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={showAccountHistory}
              style={[
                styles.tabButton,
                showHistoryModal && styles.activeTabButton,
              ]}
              accessibilityRole="tab"
              accessibilityLabel="History"
              accessibilityState={{ selected: showHistoryModal }}
            >
              <Text
                style={[
                  styles.buttonText,
                  showHistoryModal && styles.activeButtonText,
                ]}
              >
                HISTORY
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={eventQRHandler}
              style={[styles.tabButton, showQRModal && styles.activeTabButton]}
              accessibilityRole="tab"
              accessibilityLabel="QR Code"
              accessibilityState={{ selected: showQRModal }}
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
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Text style={styles.buttonText}>SETTINGS</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Container */}
          <View style={styles.modalContainer}>
            {showEditProfileModal && (
              <EditProfile
                onProfileUpdated={handleProfileUpdated}
                onCancel={() => setShowEditProfileModal(false)}
              />
            )}
            {showQRModal && <QRModal />}
            {showHistoryModal && <HistoryModal />}
          </View>
        </View>
      </ScrollView>

      {showSettingsModal && (
        <SettingsModal
          visible={showSettingsModal}
          handleClose={() => setShowSettingsModal(false)}
          setAuthenticated={(auth: boolean) => {
            if (!auth) handleLogout();
          }}
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
    width: "100%",
    flex: 1,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "flex-start",
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
    marginTop: 16,
    marginBottom: 8,
    width: "100%",
  },
  tabButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#555",
    backgroundColor: "#111",
    flex: 1,
    marginHorizontal: 4,
    height: 45,
  },
  activeTabButton: {
    borderColor: "#ff3c00",
    backgroundColor: "#222",
  },
  activeButtonText: {
    color: "#ff3c00",
  },
});
