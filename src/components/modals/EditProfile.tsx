import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { useSelector } from "react-redux";
import { GlobalStyles } from "../../constants/styles";
import useProfileUpdateErrorHandler from "../../hooks/useProfileUpdateErrorHandler";
import { useSoundCloudTrack } from "../../hooks/useSoundCloudTrack";
import { NotificationManager } from "../../services/notificationManager";
import { selectLocalId } from "../../store/redux/userSlice";
import { updateUserData } from "../../utils/auth";
import { isValidSoundCloudUrl } from "../../utils/soundcloud";
import ProfileUpdateErrorNotice from "../ProfileUpdateErrorNotice";
import {
  formatPhoneNumberInput,
  validateEmail,
  validateName,
  validatePhoneNumber,
} from "./EditProfileValidation";

// Define interfaces for component props
interface EditProfileProps {
  onProfileUpdated: () => void;
  onCancel: () => void;
  initialData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    profileSongUrl?: string | null;
  };
}

// Define interface for user data updates
interface UserDataUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

// Interface for form validation errors
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  profileSongUrl?: string;
}

const EditProfile: React.FC<EditProfileProps> = ({
  onProfileUpdated,
  onCancel,
  initialData,
}) => {
  // State variables with proper types
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [profileSongUrl, setProfileSongUrl] = useState<string>("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formState, setFormState] = useState<UserDataUpdate>({});

  // SoundCloud track preview for profile song
  const {
    trackInfo: songPreview,
    isLoading: songLoading,
    error: songError,
  } = useSoundCloudTrack(profileSongUrl.trim() || null);

  // Get profile update error handler
  const {
    error: updateError,
    fieldErrors: updateFieldErrors,
    validationErrors, // Added new validationErrors from the hook
    recoveryAction,
    handleUpdateError,
    clearErrors,
  } = useProfileUpdateErrorHandler();

  // Get router for navigation
  const router = useRouter();

  // Get user ID from Redux store
  const userId = useSelector(selectLocalId);

  /**
   * Initialize form fields with existing user data
   */
  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || "");
      setLastName(initialData.lastName || "");
      setEmail(initialData.email || "");
      setPhoneNumber(initialData.phoneNumber || "");
      setProfileSongUrl(initialData.profileSongUrl || "");
    }
  }, [initialData]);

  /**
   * Apply update field errors to form errors
   */
  useEffect(() => {
    setFormErrors((prev) => ({ ...prev, ...updateFieldErrors }));
  }, [updateFieldErrors]);

  /**
   * Save form state for recovery on failed update
   */
  useEffect(() => {
    setFormState({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
    });
  }, [firstName, lastName, email, phoneNumber]);

  /**
   * Validates form fields when they change
   */
  const validateField = (field: keyof FormErrors, value: string) => {
    let error = "";

    switch (field) {
      case "firstName":
      case "lastName":
        const nameValidation = validateName(value);
        if (!nameValidation.isValid && value.trim() !== "") {
          error = nameValidation.errorMessage;
        }
        break;
      case "email":
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid) {
          error = emailValidation.errorMessage;
        }
        break;
      case "phoneNumber":
        const phoneValidation = validatePhoneNumber(value);
        if (!phoneValidation.isValid) {
          error = phoneValidation.errorMessage;
        }
        break;
      case "profileSongUrl":
        // Only validate if URL is provided
        if (value.trim() && !isValidSoundCloudUrl(value.trim())) {
          error = "Please enter a valid SoundCloud URL";
        }
        break;
    }

    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  /**
   * Handle profile song URL change
   */
  const handleProfileSongChange = (text: string) => {
    setProfileSongUrl(text);
    // Debounce validation slightly by clearing error immediately
    if (!text.trim()) {
      setFormErrors((prev) => ({ ...prev, profileSongUrl: "" }));
    } else {
      validateField("profileSongUrl", text);
    }
  };

  /**
   * Clear the profile song URL
   */
  const clearProfileSong = () => {
    setProfileSongUrl("");
    setFormErrors((prev) => ({ ...prev, profileSongUrl: "" }));
  };

  /**
   * Handle input change for phone number with formatting
   */
  const handlePhoneChange = (text: string) => {
    const formattedNumber = formatPhoneNumberInput(text);
    setPhoneNumber(formattedNumber);
    validateField("phoneNumber", formattedNumber);
  };

  /**
   * Handles canceling the edit process
   */
  const cancelEditHandler = (): void => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setProfileSongUrl("");
    setFormErrors({});
    clearErrors();
    onCancel();
  };

  /**
   * Resets all form fields
   */
  const resetFields = (): void => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setProfileSongUrl("");
    setFormErrors({});
    clearErrors();
  };

  /**
   * Validates the entire form
   */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    // Only validate fields that have values
    if (firstName) {
      const firstNameValidation = validateName(firstName);
      if (!firstNameValidation.isValid) {
        errors.firstName = firstNameValidation.errorMessage;
        isValid = false;
      }
    }

    if (lastName) {
      const lastNameValidation = validateName(lastName);
      if (!lastNameValidation.isValid) {
        errors.lastName = lastNameValidation.errorMessage;
        isValid = false;
      }
    }

    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        errors.email = emailValidation.errorMessage;
        isValid = false;
      }
    }

    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        errors.phoneNumber = phoneValidation.errorMessage;
        isValid = false;
      }
    }

    // Validate profile song URL if provided
    if (profileSongUrl.trim() && !isValidSoundCloudUrl(profileSongUrl.trim())) {
      errors.profileSongUrl = "Please enter a valid SoundCloud URL";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  /**
   * Retry update after error
   */
  const retryUpdate = () => {
    clearErrors();
    confirmEditHandler();
  };

  /**
   * Handles confirming and saving profile changes
   */
  const confirmEditHandler = async (): Promise<void> => {
    // Make sure we have a user ID before attempting to update
    if (!userId) {
      handleUpdateError({
        code: "not-found",
        message: "User ID not available. Please log in again.",
      });
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Set submitting state to true to show loading state if needed
    setIsSubmitting(true);

    // Create an object with only the fields that have changed
    const updatedUserData: UserDataUpdate = {};

    // Check each field against initial data to see what changed
    if (firstName !== (initialData?.firstName || "")) {
      updatedUserData.firstName = firstName || undefined;
    }
    if (lastName !== (initialData?.lastName || "")) {
      updatedUserData.lastName = lastName || undefined;
    }
    if (email !== (initialData?.email || "")) {
      updatedUserData.email = email || undefined;
    }
    if (phoneNumber !== (initialData?.phoneNumber || "")) {
      updatedUserData.phoneNumber = phoneNumber || undefined;
    }

    // Check if profile song URL changed
    const initialSongUrl = initialData?.profileSongUrl || "";
    const newSongUrl = profileSongUrl.trim();
    const profileSongChanged = newSongUrl !== initialSongUrl;

    // Only update if there are changes to make
    if (Object.keys(updatedUserData).length === 0 && !profileSongChanged) {
      console.warn("No changes to update");
      setIsSubmitting(false);
      onCancel();
      return;
    }

    try {
      // Update user data in both Firestore and RTDB using existing utility
      if (Object.keys(updatedUserData).length > 0) {
        const result = await updateUserData(userId, updatedUserData);

        if (!result.success) {
          throw new Error(result.message || "Failed to update profile");
        }
      }

      // Update profile song URL in /profiles collection if changed
      if (profileSongChanged) {
        const db = getFirestore();
        const profileRef = doc(db, "profiles", userId);
        await setDoc(
          profileRef,
          {
            profileSongUrl: newSongUrl || null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        console.log("Profile song URL updated successfully");
      }

      // Send profile update confirmation notification
      try {
        const changedFields = [
          ...Object.keys(updatedUserData),
          ...(profileSongChanged ? ["profileSongUrl"] : []),
        ];
        const updateType = changedFields.some(
          (field) => field === "email" || field === "phoneNumber"
        )
          ? "contact_info"
          : "basic_info";

        await NotificationManager.sendProfileUpdateConfirmation(
          {
            userId: userId,
            actionType: "profile_update",
            timestamp: new Date(),
            isSuccessful: true,
            changedFields,
          },
          updateType
        );
        console.log("Profile update notification sent");
      } catch (notificationError) {
        console.error(
          "Failed to send profile update notification:",
          notificationError
        );
        // Don't block the profile update flow if notification fails
      }

      resetFields();
      onProfileUpdated();
    } catch (error) {
      handleUpdateError(error, onProfileUpdated);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      accessibilityLabel="Edit profile form"
    >
      <View style={styles.container}>
        <Text style={styles.headline} accessibilityRole="header">
          Edit your profile details below
        </Text>

        {/* Enhanced to pass validation errors to the component */}
        {updateError && (
          <View style={styles.errorNoticeContainer}>
            <ProfileUpdateErrorNotice
              message={updateError}
              onRetry={retryUpdate}
              secondaryAction={recoveryAction || undefined}
              validationErrors={validationErrors}
            />
          </View>
        )}

        <View style={styles.editProfileContainer}>
          <Text style={styles.subtitle}>First Name</Text>
          <TextInput
            style={[styles.input, formErrors.firstName && styles.inputError]}
            placeholder="First Name Change"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              validateField("firstName", text);
            }}
            autoCapitalize="words"
            accessibilityLabel="First Name input"
            accessibilityHint="Enter your first name"
          />
          {formErrors.firstName ? (
            <Text style={styles.errorText}>{formErrors.firstName}</Text>
          ) : null}

          <Text style={styles.subtitle}>Last Name</Text>
          <TextInput
            style={[styles.input, formErrors.lastName && styles.inputError]}
            placeholder="Last Name Change"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              validateField("lastName", text);
            }}
            accessibilityLabel="Last Name input"
            accessibilityHint="Enter your last name"
          />
          {formErrors.lastName ? (
            <Text style={styles.errorText}>{formErrors.lastName}</Text>
          ) : null}

          <Text style={styles.subtitle}>Email</Text>
          <TextInput
            style={[styles.input, formErrors.email && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={(text) => {
              setEmail(text);
              validateField("email", text);
            }}
            value={email}
            inputMode="email"
            accessibilityLabel="Email input"
            accessibilityHint="Enter your email address"
          />
          {formErrors.email ? (
            <Text style={styles.errorText}>{formErrors.email}</Text>
          ) : null}

          <Text style={styles.subtitle}>Phone Number</Text>
          <TextInput
            style={[styles.input, formErrors.phoneNumber && styles.inputError]}
            placeholder="(555) 555-5555"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={handlePhoneChange}
            value={phoneNumber}
            inputMode="tel"
            accessibilityLabel="Phone Number input"
            accessibilityHint="Enter your phone number"
          />
          {formErrors.phoneNumber ? (
            <Text style={styles.errorText}>{formErrors.phoneNumber}</Text>
          ) : null}

          {/* Profile Song Section */}
          <View style={styles.profileSongSection}>
            <View style={styles.profileSongHeader}>
              <MaterialCommunityIcons
                name="music-note"
                size={20}
                color={GlobalStyles.colors.accent}
              />
              <Text style={styles.subtitle}>Profile Song</Text>
            </View>
            <Text style={styles.profileSongHint}>
              Add a SoundCloud track to display on your profile
            </Text>
            <View style={styles.profileSongInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.profileSongInput,
                  formErrors.profileSongUrl && styles.inputError,
                ]}
                placeholder="https://soundcloud.com/artist/track"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                value={profileSongUrl}
                onChangeText={handleProfileSongChange}
                accessibilityLabel="Profile Song URL input"
                accessibilityHint="Enter a SoundCloud URL for your profile song"
              />
              {profileSongUrl.trim() !== "" && (
                <Pressable
                  onPress={clearProfileSong}
                  style={styles.clearSongButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear profile song"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={24}
                    color="#888"
                  />
                </Pressable>
              )}
            </View>
            {formErrors.profileSongUrl ? (
              <Text style={styles.errorText}>{formErrors.profileSongUrl}</Text>
            ) : null}

            {/* Song Preview */}
            {songLoading && (
              <View style={styles.songPreviewContainer}>
                <ActivityIndicator
                  size="small"
                  color={GlobalStyles.colors.accent}
                />
                <Text style={styles.songPreviewText}>Loading preview...</Text>
              </View>
            )}
            {songPreview && !songLoading && (
              <View style={styles.songPreviewContainer}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={GlobalStyles.colors.success || "#4CAF50"}
                />
                <Text style={styles.songPreviewText} numberOfLines={1}>
                  {songPreview.title}
                </Text>
              </View>
            )}
            {songError && !songLoading && profileSongUrl.trim() !== "" && (
              <View style={styles.songPreviewContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#FF6B6B"
                />
                <Text style={styles.songErrorText}>
                  Unable to load track preview
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={cancelEditHandler}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>CANCEL</Text>
          </Pressable>

          <Pressable
            onPress={confirmEditHandler}
            style={[styles.tabButton, isSubmitting && styles.disabledButton]}
            accessibilityRole="button"
            accessibilityLabel="Confirm edit"
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? "UPDATING..." : "CONFIRM"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Define font family with proper type
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: Dimensions.get("window").height * 0.12,
    width: "100%",
  },
  headline: {
    fontFamily,
    paddingTop: 10,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  subtitle: {
    fontFamily,
    paddingBottom: 5,
    fontSize: 16,
    color: "white",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#222",
    padding: 14,
    marginBottom: 16,
    borderRadius: 8,
    fontFamily,
    width: "100%",
    fontSize: 16,
    color: "white",
    borderWidth: 1,
    borderColor: "#555",
  },
  inputError: {
    borderColor: "#FF6B6B", // Red border for error state
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginBottom: 10,
    marginTop: -8,
    fontFamily,
  },
  errorNoticeContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  editProfileContainer: {
    paddingTop: 10,
    width: "100%",
    paddingHorizontal: 20,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
    width: "100%",
  },
  tabButton: {
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
    width: "48%",
  },
  disabledButton: {
    backgroundColor: "#333",
    borderColor: "#444",
    opacity: 0.7,
  },
  buttonText: {
    fontFamily,
    textAlign: "center",
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // Profile Song styles
  profileSongSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  profileSongHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  profileSongHint: {
    fontFamily,
    fontSize: 12,
    color: "#888",
    marginBottom: 12,
  },
  profileSongInputContainer: {
    position: "relative",
    width: "100%",
  },
  profileSongInput: {
    paddingRight: 44, // Make room for the clear button
  },
  clearSongButton: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 4,
  },
  songPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 8,
  },
  songPreviewText: {
    fontFamily,
    fontSize: 14,
    color: "#ccc",
    flex: 1,
  },
  songErrorText: {
    fontFamily,
    fontSize: 14,
    color: "#FF6B6B",
    flex: 1,
  },
});

export default EditProfile;
