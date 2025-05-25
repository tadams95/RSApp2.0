import React, { useState } from "react";
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

import { getDatabase, ref, update } from "firebase/database";

import { useSelector } from "react-redux";
import { selectLocalId } from "../../store/redux/userSlice";

// Define interfaces for component props
interface EditProfileProps {
  onProfileUpdated: () => void;
  onCancel: () => void;
}

// Define interface for user data updates
interface UserDataUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

const EditProfile: React.FC<EditProfileProps> = ({
  onProfileUpdated,
  onCancel,
}) => {
  // State variables with proper types
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // Get user ID from Redux store
  const userId = useSelector(selectLocalId);

  // Get Firebase Realtime Database instance
  const database = getDatabase();

  /**
   * Handles canceling the edit process
   */
  const cancelEditHandler = (): void => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
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
  };

  /**
   * Handles confirming and saving profile changes
   */
  const confirmEditHandler = (): void => {
    // Make sure we have a user ID before attempting to update
    if (!userId) {
      console.error("User ID not available");
      return;
    }

    // Reference to the user node in the database
    const userRef = ref(database, `users/${userId}`);

    // Create an object with the specific fields you want to update
    const updatedUserData: UserDataUpdate = {};
    if (firstName) updatedUserData.firstName = firstName;
    if (lastName) updatedUserData.lastName = lastName;
    if (email) updatedUserData.email = email;
    if (phoneNumber) updatedUserData.phoneNumber = phoneNumber;

    // Only update if there are changes to make
    if (Object.keys(updatedUserData).length === 0) {
      console.warn("No changes to update");
      onCancel();
      return;
    }

    // Update the specific fields of the user's details in the database
    update(userRef, updatedUserData)
      .then(() => {
        resetFields();
        onProfileUpdated();
      })
      .catch((error) => {
        console.error("Error updating user details:", error);
        // Handle any errors that occur during the update process
      });
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

        <View style={styles.editProfileContainer}>
          <Text style={styles.subtitle}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name Change"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            accessibilityLabel="First Name input"
            accessibilityHint="Enter your first name"
          />

          <Text style={styles.subtitle}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Last Name Change"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
            accessibilityLabel="Last Name input"
            accessibilityHint="Enter your last name"
          />

          <Text style={styles.subtitle}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={setEmail}
            value={email}
            inputMode="email"
            accessibilityLabel="Email input"
            accessibilityHint="Enter your email address"
          />

          <Text style={styles.subtitle}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={setPhoneNumber}
            value={phoneNumber}
            inputMode="numeric"
            accessibilityLabel="Phone Number input"
            accessibilityHint="Enter your phone number"
          />
        </View>

        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={cancelEditHandler}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
          >
            <Text style={styles.buttonText}>CANCEL</Text>
          </Pressable>

          <Pressable
            onPress={confirmEditHandler}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityLabel="Confirm edit"
          >
            <Text style={styles.buttonText}>CONFIRM</Text>
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
  buttonText: {
    fontFamily,
    textAlign: "center",
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

export default EditProfile;
