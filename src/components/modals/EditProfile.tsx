import React, { useEffect, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import useProfileUpdateErrorHandler from "../../hooks/useProfileUpdateErrorHandler";
import { NotificationManager } from "../../services/notificationManager";
import { selectLocalId } from "../../store/redux/userSlice";
import { updateUserData } from "../../utils/auth";
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
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formState, setFormState] = useState<UserDataUpdate>({});

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
    }

    setFormErrors((prev) => ({ ...prev, [field]: error }));
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

    // Only update if there are changes to make
    if (Object.keys(updatedUserData).length === 0) {
      console.warn("No changes to update");
      setIsSubmitting(false);
      onCancel();
      return;
    }

    try {
      // Update user data in both Firestore and RTDB using existing utility
      const result = await updateUserData(userId, updatedUserData);

      if (!result.success) {
        throw new Error(result.message || "Failed to update profile");
      }

      // Send profile update confirmation notification
      try {
        const changedFields = Object.keys(updatedUserData);
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
});

export default EditProfile;
