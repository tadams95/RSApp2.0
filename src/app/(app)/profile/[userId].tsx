import { useLocalSearchParams } from "expo-router";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { UserProfileView } from "../../../components/profile";
import { selectLocalId, selectUserName } from "../../../store/redux/userSlice";

/**
 * Check if a string looks like a Firebase UID (typically 28 chars, alphanumeric)
 * vs a username (shorter, may contain underscores/dots)
 */
function looksLikeFirebaseUid(str: string): boolean {
  // Firebase UIDs are typically 28 characters, alphanumeric
  return /^[a-zA-Z0-9]{20,}$/.test(str);
}

/**
 * Look up a user by username using the /usernames collection
 * This collection maps lowercase usernames to user IDs and has public read access
 */
async function resolveUsernameToUid(username: string): Promise<string | null> {
  const db = getFirestore();
  // Usernames are stored lowercase without @ prefix
  const cleanUsername = username.toLowerCase().replace(/^@/, "");

  // The /usernames collection stores documents with the username as the doc ID
  // and { uid: "userId" } as the data
  const usernameDoc = doc(db, "usernames", cleanUsername);
  const snapshot = await getDoc(usernameDoc);

  if (snapshot.exists()) {
    const data = snapshot.data();
    return data.uid || null;
  }

  return null;
}

export default function UserProfileScreen() {
  const { userId: paramValue } = useLocalSearchParams<{ userId: string }>();
  const currentUserId = useSelector(selectLocalId);
  const currentUsername = useSelector(selectUserName);

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveUser() {
      if (!paramValue) {
        setError("No user specified");
        setIsLoading(false);
        return;
      }

      // Check if it's "me" or matches current user's username
      const cleanParam = paramValue.toLowerCase().replace(/^@/, "");
      if (
        cleanParam === "me" ||
        (currentUsername && cleanParam === currentUsername.toLowerCase())
      ) {
        setResolvedUserId(currentUserId || null);
        setIsLoading(false);
        return;
      }

      // If it looks like a Firebase UID, use it directly
      if (looksLikeFirebaseUid(paramValue)) {
        setResolvedUserId(paramValue);
        setIsLoading(false);
        return;
      }

      // Otherwise, treat it as a username and look it up
      try {
        const uid = await resolveUsernameToUid(paramValue);
        if (uid) {
          setResolvedUserId(uid);
        } else {
          setError(`User "@${cleanParam}" not found`);
        }
      } catch (err) {
        console.error("Error resolving username:", err);
        setError("Failed to load profile");
      }

      setIsLoading(false);
    }

    resolveUser();
  }, [paramValue, currentUserId, currentUsername]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ff1f42" />
      </View>
    );
  }

  if (error || !resolvedUserId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || "Profile not found"}</Text>
      </View>
    );
  }

  // Determine if viewing own profile
  const isOwnProfile = resolvedUserId === currentUserId;

  return (
    <UserProfileView userId={resolvedUserId} isOwnProfile={isOwnProfile} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
