import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useProfileSync } from "../hooks/useProfileSync";

/**
 * Demo component showcasing the useProfileSync hook functionality
 * Demonstrates error handling and conflict resolution for user profiles
 */
export default function ProfileSyncDemo() {
  const {
    profile,
    isLoading,
    error,
    updateProfile,
    retry,
    lastSyncTime,
    isConnected,
  } = useProfileSync();

  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) return;

    setIsSaving(true);
    try {
      // Update profile with new display name
      await updateProfile({ displayName: displayName.trim() });
      setDisplayName(""); // Clear input on success
    } catch (err) {
      console.error("Failed to update profile:", err);
      // Error will be handled by the hook and set to the error state
    } finally {
      setIsSaving(false);
    }
  };

  const renderSyncStatus = () => {
    if (!isConnected) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.offlineText}>
            Offline - Changes will sync when reconnected
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#0066cc" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Sync Error</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.statusContainer}>
        <Text style={styles.syncedText}>
          Profile synced{" "}
          {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : "never"}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Profile</Text>

      {renderSyncStatus()}

      <View style={styles.profileContainer}>
        {profile && (
          <>
            <Text style={styles.profileLabel}>Current Display Name:</Text>
            <Text style={styles.profileValue}>
              {profile.displayName || "Not set"}
            </Text>

            <Text style={styles.profileLabel}>Email:</Text>
            <Text style={styles.profileValue}>
              {profile.email || "Not available"}
            </Text>

            <Text style={styles.profileLabel}>Last Updated:</Text>
            <Text style={styles.profileValue}>
              {profile.lastUpdated
                ? new Date(profile.lastUpdated).toLocaleString()
                : "Never updated"}
            </Text>
          </>
        )}
      </View>

      <View style={styles.updateContainer}>
        <Text style={styles.updateTitle}>Update Profile</Text>

        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="New display name"
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isConnected || isSaving) && styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={!isConnected || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {!isConnected && (
          <Text style={styles.offlineWarning}>
            You are offline. Cannot update profile until reconnected.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: "#666",
  },
  syncedText: {
    color: "#008000",
  },
  offlineText: {
    color: "#cc6600",
  },
  errorContainer: {
    backgroundColor: "#fee",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#c00",
    marginBottom: 4,
  },
  errorText: {
    marginBottom: 8,
    color: "#c00",
  },
  retryButton: {
    backgroundColor: "#c00",
    padding: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
  },
  profileContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  profileLabel: {
    color: "#666",
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 16,
    marginBottom: 12,
  },
  updateContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#0066cc",
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  offlineWarning: {
    color: "#cc6600",
    marginTop: 8,
    fontStyle: "italic",
  },
});
