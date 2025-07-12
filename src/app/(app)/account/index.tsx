import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { doc, getFirestore, updateDoc } from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useScreenTracking } from "../../../analytics/PostHogProvider";
import { ImageWithFallback } from "../../../components/ui";
import { useAuth } from "../../../hooks/AuthContext";
import { useFirebaseImage } from "../../../hooks/useFirebaseImage";
import { useUserProfileWithHelpers } from "../../../hooks/useUserProfile";
import {
  selectLocalId,
  selectUserEmail,
  selectUserName,
  setUserName,
} from "../../../store/redux/userSlice";
import { retryWithBackoff } from "../../../utils/cart/networkErrorDetection";
import { logError } from "../../../utils/logError";
import {
  extractStorageErrorCode,
  getStorageErrorMessage,
} from "../../../utils/storageErrorHandler";
// Import offline profile management
import { ProfileData, useOfflineProfile } from "../../../utils/offlineProfile";
// Import image compression utility
import {
  compressImage,
  COMPRESSION_PRESETS,
  CompressionResult,
} from "../../../utils/imageCompression";
// Import the newly migrated modals from the barrel file
import {
  EditProfile,
  HistoryModal,
  QRModal,
  SettingsModal,
} from "../../../components/modals";

// Import account error boundaries
import {
  EditProfileErrorBoundary,
  ProfilePictureErrorBoundary,
  SettingsErrorBoundary,
  UserDataErrorBoundary,
} from "../../../components/account";

// Define the types for modals
// These are kept here for future extensions
interface ModalProps {
  visible?: boolean;
  handleClose?: () => void;
  onProfileUpdated?: () => void;
  onCancel?: () => void;
  setAuthenticated?: (auth: boolean) => void;
}

// Upload state enum for handling different upload states
enum UploadState {
  IDLE,
  UPLOADING,
  SUCCESS,
  ERROR,
}

// Convert to default export
export default function AccountScreen() {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] =
    useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadUri, setLastUploadUri] = useState<string | null>(null);
  const [compressionResult, setCompressionResult] =
    useState<CompressionResult | null>(null);
  const userName = useSelector(selectUserName);
  const { signOut } = useAuth();
  const router = useRouter();

  const dispatch = useDispatch();

  // Access user data from Redux store using typed selectors
  const localId = useSelector(selectLocalId);
  const userEmail = useSelector(selectUserEmail);

  // Memoize the database instance for image upload functionality
  const db = useMemo(() => getFirestore(), []);

  // Use React Query for user profile data
  const {
    profile: userProfile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
    hasProfile,
  } = useUserProfileWithHelpers();

  // Track screen view
  useScreenTracking("Account Screen", {
    user_type: "authenticated",
    has_profile: hasProfile,
    has_profile_picture: !!profilePicture,
    has_user_name: !!userName,
    is_loading_profile: isLoadingProfile,
  });

  // Update Redux and local state when profile data changes
  useEffect(() => {
    if (userProfile) {
      const name = `${userProfile.firstName} ${userProfile.lastName}`;
      dispatch(setUserName(name));
      setProfilePicture(userProfile.profilePicture || null);
    }
  }, [userProfile, dispatch]);

  // Memoize the current profile object to prevent unnecessary re-renders
  const currentProfile: ProfileData | null = useMemo(() => {
    return localId && userProfile
      ? {
          localId,
          userEmail: userEmail || undefined,
          userName: (userName as string) || undefined,
          profilePicture: profilePicture || undefined,
        }
      : null;
  }, [localId, userEmail, userName, profilePicture, userProfile]);

  const {
    profile: offlineProfile,
    isOffline,
    hasOfflineChanges,
    updateCachedProfile,
  } = useOfflineProfile(currentProfile);

  const handleProfileUpdated = useCallback(() => {
    refetchProfile();
  }, [refetchProfile]);

  // Retry the last failed upload
  const retryUpload = useCallback(async () => {
    if (!lastUploadUri) {
      Alert.alert("Error", "No previous upload to retry");
      return;
    }

    try {
      // Clear previous error and compression result
      setUploadError(null);
      setCompressionResult(null);
      // Start new upload with the last selected image
      await handleImageUpload(lastUploadUri);
    } catch (error) {
      console.error("Error retrying upload:", error);
      setUploadError(getStorageErrorMessage(error));
      setUploadState(UploadState.ERROR);
    }
  }, [lastUploadUri]);

  // Handle the image upload process with compression and retry logic
  const handleImageUpload = async (imageUri: string): Promise<void> => {
    if (!localId) {
      const error = "User ID not available for uploading profile picture";
      console.error(error);
      setUploadError(error);
      setUploadState(UploadState.ERROR);
      return;
    }

    // Get reference to Firebase Storage
    const storage = getStorage();

    // Create a reference to the profile picture in Firebase Storage
    const profilePictureRef = storageRef(
      storage,
      `profilePictures/${localId}/profile_${Date.now()}.jpeg`
    );

    try {
      setUploadState(UploadState.UPLOADING);
      setUploadProgress(0);

      // Step 1: Compress the image (10% progress)
      setUploadProgress(10);
      const compressed = await compressImage(
        imageUri,
        COMPRESSION_PRESETS.PROFILE
      );
      setCompressionResult(compressed);

      if (__DEV__ && compressed.compressionRatio) {
        console.log(
          `Profile picture compressed: ${(
            compressed.compressionRatio * 100
          ).toFixed(1)}% size reduction`
        );
      }

      setUploadProgress(25); // Compression complete

      // Step 2: Convert compressed image to blob
      const response = await fetch(compressed.uri);
      const blob = await response.blob();

      // Check compressed file size - should be much smaller now, but still validate
      if (blob.size > 5 * 1024 * 1024) {
        // This should be rare after compression, but handle it gracefully
        throw new Error(
          `Compressed image still exceeds 5MB limit (${(
            blob.size /
            (1024 * 1024)
          ).toFixed(1)}MB)`
        );
      }

      setUploadProgress(35); // Blob conversion complete

      // Step 3: Upload the compressed image to Firebase Storage with retry logic
      await retryWithBackoff(async () => {
        try {
          await uploadBytes(profilePictureRef, blob);
          setUploadProgress(75); // Set to 75% after upload
        } catch (uploadError: any) {
          const errorCode = extractStorageErrorCode(uploadError);

          if (errorCode === "storage/unauthorized") {
            // Handle permission denied errors specifically
            const message =
              "You don't have permission to upload images. Please log in again and try once more.";
            setUploadError(message);
            setUploadState(UploadState.ERROR);

            // Show permission-specific alert with re-authentication option
            Alert.alert("Upload Permission Required", message, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log In Again",
                onPress: async () => {
                  try {
                    await signOut();
                    router.replace("/(auth)/");
                  } catch (signOutError) {
                    console.error("Error signing out:", signOutError);
                  }
                },
              },
            ]);

            logError(uploadError, "ProfilePictureUpload", {
              userId: localId,
              errorType: "storage/unauthorized",
              action: "uploadBytes",
              compressionInfo: compressed,
            });
            return;
          }

          // Re-throw other errors to be handled by the retry mechanism
          throw uploadError;
        }
      });

      // Get the download URL of the uploaded image with retry logic
      const downloadURL = await retryWithBackoff(async () => {
        return await getDownloadURL(profilePictureRef);
      });
      setUploadProgress(90); // Set to 90% after getting URL

      // Update the user's document in Firestore with retry logic and permission error handling
      await retryWithBackoff(async () => {
        try {
          const userDocRef = doc(db, `customers/${localId}`);
          await updateDoc(userDocRef, {
            profilePicture: downloadURL,
            lastUpdated: new Date().toISOString(),
          });
        } catch (firestoreError: any) {
          // Check if this is a permission error for Firestore
          if (firestoreError.code === "permission-denied") {
            const message =
              "Unable to update your profile. Please log in again and try once more.";
            setUploadError(message);
            setUploadState(UploadState.ERROR);

            // Show permission-specific alert
            Alert.alert("Profile Update Permission Required", message, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log In Again",
                onPress: async () => {
                  try {
                    await signOut();
                    router.replace("/(auth)/");
                  } catch (signOutError) {
                    console.error("Error signing out:", signOutError);
                  }
                },
              },
            ]);

            logError(firestoreError, "ProfilePictureUpload", {
              userId: localId,
              errorType: "firestore/permission-denied",
              action: "updateDoc",
              compressionInfo: compressed,
            });
            return;
          }

          // Re-throw other Firestore errors to be handled by the retry mechanism
          throw firestoreError;
        }
      });

      // Once uploaded, set the profile picture URI in your component state
      setProfilePicture(downloadURL);
      setUploadState(UploadState.SUCCESS);
      setUploadProgress(100);

      // Reset upload state after 2 seconds
      setTimeout(() => {
        setUploadState(UploadState.IDLE);
        setUploadProgress(0);
      }, 2000);
    } catch (error: any) {
      // Log error for analysis
      logError(error, "ProfilePictureUpload", {
        userId: localId,
        compressionInfo: compressionResult,
      });

      // Set user-friendly error message
      setUploadError(getStorageErrorMessage(error));
      setUploadState(UploadState.ERROR);

      // Re-throw to be handled by caller
      throw error;
    }
  };

  const pickImage = useCallback(async () => {
    try {
      // Reset upload state and compression result
      setUploadState(UploadState.IDLE);
      setUploadError(null);
      setCompressionResult(null);

      // Request permission if needed (this is handled by the library in newer versions)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1, // We'll handle compression ourselves
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;

        // Store the URI for potential retry
        setLastUploadUri(imageUri);

        // Start upload process with compression
        await handleImageUpload(imageUri);
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      setUploadError(getStorageErrorMessage(error));
      setUploadState(UploadState.ERROR);

      // Show error alert
      Alert.alert("Upload Failed", getStorageErrorMessage(error), [
        { text: "OK" },
        { text: "Retry", onPress: retryUpload },
      ]);
    }
  }, [localId, db, retryUpload]);

  // Use our new hook to handle Firebase Storage image loading with error handling
  const {
    imageSource,
    isLoading: isImageLoading,
    error: imageError,
    reload: reloadImage,
  } = useFirebaseImage(profilePicture, {
    fallbackImage: require("../../../assets/user.png"),
    cacheExpiry: 3600000, // 1 hour cache
  });

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

  // Render upload state overlay
  const renderUploadOverlay = () => {
    if (uploadState === UploadState.IDLE) {
      return null;
    }

    return (
      <View style={styles.uploadOverlay}>
        {uploadState === UploadState.UPLOADING && (
          <>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.uploadStatusText}>
              {uploadProgress <= 25 ? "Compressing..." : "Uploading..."}{" "}
              {uploadProgress.toFixed(0)}%
            </Text>
            {compressionResult && uploadProgress > 25 && (
              <Text style={styles.uploadSubtext}>
                {compressionResult.compressionRatio
                  ? `${(compressionResult.compressionRatio * 100).toFixed(
                      0
                    )}% smaller`
                  : "Optimized for faster upload"}
              </Text>
            )}
          </>
        )}

        {uploadState === UploadState.SUCCESS && (
          <>
            <View style={styles.uploadSuccessIcon}>
              <Text style={styles.uploadSuccessIconText}>✓</Text>
            </View>
            <Text style={styles.uploadStatusText}>Upload Complete</Text>
            {compressionResult && compressionResult.compressionRatio && (
              <Text style={styles.uploadSubtext}>
                Reduced size by{" "}
                {(compressionResult.compressionRatio * 100).toFixed(0)}%
              </Text>
            )}
          </>
        )}

        {uploadState === UploadState.ERROR && (
          <>
            <View style={styles.uploadErrorIcon}>
              <Text style={styles.uploadErrorIconText}>!</Text>
            </View>
            <Text style={styles.uploadStatusText}>{uploadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryUpload}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <UserDataErrorBoundary
      onError={(error, errorInfo) => {
        console.error("User Data Error:", error, errorInfo);
      }}
      onAuthError={() => {
        // Handle auth errors by signing out and redirecting to login
        handleLogout();
      }}
    >
      <View style={styles.root}>
        <StatusBar style="light" />

        {/* Show loading indicator while fetching profile data */}
        {isLoadingProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : profileError ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Failed to load profile</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchProfile()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              {/* Profile Picture with Upload State */}
              <ProfilePictureErrorBoundary
                onError={(error, errorInfo) => {
                  console.error("Profile Picture Error:", error, errorInfo);
                  // Reset upload state on error
                  setUploadState(UploadState.ERROR);
                  setUploadError(error.message);
                }}
                onAuthError={() => {
                  // Handle auth errors by signing out and redirecting to login
                  handleLogout();
                }}
              >
                <TouchableOpacity
                  onPress={
                    uploadState === UploadState.UPLOADING
                      ? undefined
                      : pickImage
                  }
                  style={styles.profilePictureContainer}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture"
                  disabled={uploadState === UploadState.UPLOADING}
                >
                  <ImageWithFallback
                    source={imageSource}
                    fallbackSource={require("../../../assets/user.png")}
                    style={styles.profilePicture}
                    resizeMode="cover"
                    showLoadingIndicator={true}
                    loadingIndicatorColor="#ff3c00"
                    loadingIndicatorSize="large"
                    maxRetries={3}
                    showRetryButton={imageError !== null}
                    errorContext="ProfilePicture"
                    onLoadError={(error) => {
                      logError(error, "ProfilePicture", { userId: localId });
                      // Show error alert for serious errors only if not already in error state
                      if (uploadState !== UploadState.ERROR && imageError) {
                        Alert.alert(
                          "Image Load Error",
                          "Failed to load profile picture. Would you like to retry?",
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Retry", onPress: reloadImage },
                          ]
                        );
                      }
                    }}
                    onLoadSuccess={() => {
                      // Clear any upload errors when image loads successfully
                      if (uploadState === UploadState.ERROR) {
                        setUploadState(UploadState.IDLE);
                        setUploadError(null);
                      }
                    }}
                  />
                  {renderUploadOverlay()}
                </TouchableOpacity>
              </ProfilePictureErrorBoundary>

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
                  style={[
                    styles.tabButton,
                    showQRModal && styles.activeTabButton,
                  ]}
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
                  <EditProfileErrorBoundary
                    onError={(error, errorInfo) => {
                      console.error("EditProfile Error:", error, errorInfo);
                      // Optionally close modal on error
                      setShowEditProfileModal(false);
                    }}
                  >
                    <EditProfile
                      onProfileUpdated={handleProfileUpdated}
                      onCancel={() => setShowEditProfileModal(false)}
                      initialData={{
                        firstName: userProfile?.firstName || "",
                        lastName: userProfile?.lastName || "",
                        email: userProfile?.email || userEmail || "",
                        phoneNumber: userProfile?.phoneNumber || "",
                      }}
                    />
                  </EditProfileErrorBoundary>
                )}
                {showQRModal && <QRModal />}
                {showHistoryModal && <HistoryModal />}
              </View>
            </View>
          </ScrollView>
        )}

        {showSettingsModal && (
          <SettingsErrorBoundary
            onError={(error, errorInfo) => {
              console.error("SettingsModal Error:", error, errorInfo);
              // Optionally close modal on error
              setShowSettingsModal(false);
            }}
            onAuthError={() => {
              // Handle auth errors by signing out and redirecting to login
              handleLogout();
            }}
          >
            <SettingsModal
              visible={showSettingsModal}
              handleClose={() => setShowSettingsModal(false)}
              setAuthenticated={(auth: boolean) => {
                if (!auth) handleLogout();
              }}
            />
          </SettingsErrorBoundary>
        )}

        <Text style={styles.footerText}>THANKS FOR RAGING WITH US</Text>
      </View>
    </UserDataErrorBoundary>
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
    paddingVertical: 10, // Reduced from 20px to maximize content area
    paddingHorizontal: 15, // Reduced from 20px to be more efficient
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    marginTop: 16,
    fontFamily,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
    textAlign: "center",
    fontFamily,
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
    position: "relative",
  },
  profilePicture: {
    width: Dimensions.get("window").width * 0.45,
    height: Dimensions.get("window").width * 0.45,
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  uploadStatusText: {
    color: "white",
    marginTop: 10,
    fontSize: 14,
    fontFamily,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  uploadSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 5,
    fontSize: 12,
    fontFamily,
    textAlign: "center",
    paddingHorizontal: 10,
    fontStyle: "italic",
  },
  uploadSuccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadSuccessIconText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  uploadErrorIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF5252",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadErrorIconText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#333",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#555",
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontFamily,
    fontWeight: "600",
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
