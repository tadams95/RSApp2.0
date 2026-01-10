import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
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
  Switch,
  Text,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { auth } from "../../firebase/firebase";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { AnalyticsPreferences } from "../../utils/analyticsPreferences";
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
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [adminModalVisible, setAdminModalVisible] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  const postHog = usePostHog();

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

    const loadAnalyticsPreference = async () => {
      try {
        const preference = await AnalyticsPreferences.getPreference();
        setAnalyticsEnabled(preference.enabled);
      } catch (error) {
        console.error("Failed to load analytics preference:", error);
        // Default to enabled on error
        setAnalyticsEnabled(true);
      }
    };

    if (visible) {
      fetchUserData();
      loadAnalyticsPreference();
    }
  }, [visible]);

  const handleAnalyticsToggle = async (enabled: boolean) => {
    setLoadingAnalytics(true);
    try {
      await postHog.setAnalyticsEnabled(enabled);
      setAnalyticsEnabled(enabled);

      // Track the privacy preference change (if analytics is being enabled)
      if (enabled) {
        await postHog.track("analytics_preference_changed", {
          analytics_enabled: enabled,
          changed_from_settings: true,
          user_opted_in: enabled,
        });
      }

      Alert.alert(
        "Analytics Settings Updated",
        enabled
          ? "Analytics tracking has been enabled. This helps us improve the app experience."
          : "Analytics tracking has been disabled. No usage data will be collected.",
        [{ text: "OK", style: "default" }]
      );
    } catch (error) {
      console.error("Failed to update analytics preference:", error);
      Alert.alert(
        "Settings Error",
        "Failed to update analytics preference. Please try again.",
        [{ text: "OK", style: "default" }]
      );
      // Revert the state on error
      setAnalyticsEnabled(!enabled);
    } finally {
      setLoadingAnalytics(false);
    }
  };

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
            // Reset PostHog for privacy compliance
            await postHog.reset();

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

            // Still set authenticated to false and reset PostHog even if storage clear fails
            await postHog.reset();
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

                // Clear analytics preferences for GDPR compliance
                try {
                  await AnalyticsPreferences.clear();
                  await postHog.reset();
                } catch (cleanupError) {
                  console.warn(
                    "Failed to clear analytics data during account deletion:",
                    cleanupError
                  );
                  // Don't block account deletion on analytics cleanup failure
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

            {/* Notification Settings Link */}
            <Pressable
              style={styles.navigationButton}
              onPress={() => {
                handleClose();
                router.push("/(app)/account/notifications");
              }}
              accessibilityRole="button"
              accessibilityLabel="Notification settings"
            >
              <View style={styles.navigationButtonContent}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.navigationButtonText}>
                  Notification Settings
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            {/* Appearance Settings Link */}
            <Pressable
              style={styles.navigationButton}
              onPress={() => {
                handleClose();
                router.push("/(app)/account/appearance");
              }}
              accessibilityRole="button"
              accessibilityLabel="Appearance settings"
            >
              <View style={styles.navigationButtonContent}>
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.navigationButtonText}>Appearance</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            {/* Analytics Privacy Toggle */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabelContainer}>
                <Text style={styles.settingsLabel}>Analytics & Usage Data</Text>
                <Text style={styles.settingsDescription}>
                  Help improve the app by sharing usage data
                </Text>
              </View>
              <Switch
                value={analyticsEnabled}
                onValueChange={handleAnalyticsToggle}
                disabled={loadingAnalytics}
                trackColor={{
                  false: theme.colors.bgElev2,
                  true: theme.colors.success,
                }}
                thumbColor={analyticsEnabled ? "#ffffff" : "#f4f3f4"}
                accessibilityLabel="Toggle analytics tracking"
                accessibilityHint="When enabled, usage data is collected to improve the app"
              />
            </View>

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

const createStyles = (theme: Theme) =>
  ({
    modal: {
      margin: 0,
      backgroundColor: theme.colors.bgRoot,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    modalContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.colors.bgRoot,
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
      color: theme.colors.textPrimary,
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
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.bgElev2,
    },
    navigationButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginVertical: 12,
      borderWidth: 1,
      padding: 16,
      borderRadius: 8,
      width: "80%",
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.bgElev2,
    },
    navigationButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    navigationButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily,
      fontWeight: "600",
    },
    deleteActionButton: {
      marginVertical: 12,
      borderWidth: 1,
      padding: 16,
      borderRadius: 8,
      width: "80%",
      alignItems: "center",
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.bgElev2,
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    deleteButtonText: {
      color: theme.colors.danger,
      fontSize: 16,
      fontFamily,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    settingsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "80%",
      marginVertical: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: 8,
      backgroundColor: theme.colors.bgElev2,
    },
    settingsLabelContainer: {
      flex: 1,
      marginRight: 16,
    },
    settingsLabel: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily,
      fontWeight: "600",
      marginBottom: 4,
    },
    settingsDescription: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily,
      lineHeight: 16,
    },
  } as const);

export default SettingsModal;
