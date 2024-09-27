import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";

import { ref, update, getDatabase } from "firebase/database";

import { selectLocalId } from "../../store/redux/userSlice";
import { useSelector } from "react-redux";

export default function EditProfile({ onProfileUpdated, onCancel }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const userId = useSelector(selectLocalId);
  const database = getDatabase();

  function cancelEditHandler() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    onCancel();
  }

  function resetFields() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
  }

  function confirmEditHandler() {
    // Reference to the user node in the database
    const userRef = ref(database, `users/${userId}`);

    // Create an object with the specific fields you want to update
    const updatedUserData = {};
    if (firstName) updatedUserData.firstName = firstName;
    if (lastName) updatedUserData.lastName = lastName;
    if (email) updatedUserData.email = email;
    if (phoneNumber) updatedUserData.phoneNumber = phoneNumber;

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
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.container}>
        <Text style={styles.headline}>Edit your profile details below</Text>

        <View style={styles.editProfileContainer}>
          <Text style={styles.subtitle}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name Change"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Text style={styles.subtitle}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Last Name Change"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.subtitle}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={setEmail}
            value={email}
          />

          <Text style={styles.subtitle}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={setPhoneNumber}
            value={phoneNumber}
            inputMode="numeric"
          />
        </View>

        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <Pressable onPress={cancelEditHandler} style={styles.tabButton}>
            <Text style={styles.secondaryText}>CANCEL</Text>
          </Pressable>

          <Pressable onPress={confirmEditHandler} style={styles.tabButton}>
            <Text style={styles.secondaryText}>CONFIRM</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    marginBottom: Dimensions.get("window").height * 0.12,
  },
  headline: {
    fontFamily,
    paddingTop: 10,
    textAlign: "center",
    textTransform: "uppercase",
  },
  subtitle: {
    fontFamily,
    paddingBottom: 5,
    fontSize: 18,
    color: "white",
  },
  input: {
    backgroundColor: "#F6F6F6",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    fontFamily,
    width: Dimensions.get("window").width * 0.9,
    fontSize: 18,
  },
  editProfileContainer: {
    paddingTop: 10,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 10,
  },
  tabButton: {
    backgroundColor: "#000",
    padding: 6,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    width: "30%",
  },
  secondaryText: {
    fontFamily,
    textAlign: "center",
    color: "white",
  },
});
