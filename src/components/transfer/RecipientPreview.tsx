import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { UserSearchResult } from "../../services/userSearchService";
import { ImageWithFallback } from "../ui";

// ============================================
// Types
// ============================================

export interface RecipientPreviewProps {
  /** User to preview as recipient */
  user: UserSearchResult;
  /** Callback when transfer is confirmed */
  onConfirm: () => void;
  /** Callback when transfer is cancelled */
  onCancel: () => void;
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
  /** Event name for display context */
  eventName?: string;
  /** Hide internal header when parent component provides one */
  hideHeader?: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get initials from a display name
 */
function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get verification badge based on status
 */
function getVerificationBadge(
  status?: "none" | "verified" | "artist"
): React.ReactNode {
  if (status === "verified") {
    return (
      <MaterialCommunityIcons
        name="check-decagram"
        size={18}
        color="#1DA1F2"
        style={styles.badge}
      />
    );
  }
  if (status === "artist") {
    return (
      <MaterialCommunityIcons
        name="star-circle"
        size={18}
        color={GlobalStyles.colors.yellow}
        style={styles.badge}
      />
    );
  }
  return null;
}

// ============================================
// RecipientPreview Component
// ============================================

export default function RecipientPreview({
  user,
  onConfirm,
  onCancel,
  isLoading = false,
  eventName,
  hideHeader = false,
}: RecipientPreviewProps) {
  const handleConfirm = () => {
    if (isLoading) return;
    // Light haptic feedback
    if (Platform.OS === "ios") {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(50);
    }
    onConfirm();
  };

  const handleCancel = () => {
    if (isLoading) return;
    onCancel();
  };

  const hasProfilePicture = !!user.profilePicture;

  return (
    <View style={styles.container}>
      {/* Header - hidden when parent provides one */}
      {!hideHeader && <Text style={styles.header}>Confirm Transfer</Text>}
      {eventName && (
        <Text style={styles.eventContext}>
          Transferring ticket for{" "}
          <Text style={styles.eventName}>{eventName}</Text>
        </Text>
      )}

      {/* Recipient Card */}
      <View style={styles.recipientCard}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {hasProfilePicture ? (
            <ImageWithFallback
              source={{ uri: user.profilePicture }}
              fallbackSource={require("../../assets/user.png")}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.initialsAvatar}>
              <Text style={styles.initialsText}>
                {getInitials(user.displayName)}
              </Text>
            </View>
          )}
          {/* Verification badge overlay */}
          {user.verificationStatus && user.verificationStatus !== "none" && (
            <View style={styles.badgeOverlay}>
              {getVerificationBadge(user.verificationStatus)}
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user.displayName}
            </Text>
          </View>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
          {user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}
        </View>
      </View>

      {/* Warning Notice */}
      <View style={styles.warningContainer}>
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={GlobalStyles.colors.yellow}
        />
        <Text style={styles.warningText}>
          This action cannot be undone. The recipient will receive the ticket
          immediately.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cancel transfer"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Confirm transfer"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>Send Ticket</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GlobalStyles.spacing.lg,
    paddingTop: GlobalStyles.spacing.lg,
    paddingBottom: GlobalStyles.spacing.md,
  },
  header: {
    fontSize: 18,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
    textAlign: "center",
    marginBottom: GlobalStyles.spacing.sm,
  },
  eventContext: {
    fontSize: 14,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginBottom: GlobalStyles.spacing.lg,
    lineHeight: 20,
  },
  eventName: {
    color: GlobalStyles.colors.primary,
    fontWeight: "600",
  },
  recipientCard: {
    backgroundColor: GlobalStyles.colors.surface,
    borderRadius: 8,
    paddingVertical: GlobalStyles.spacing.xl,
    paddingHorizontal: GlobalStyles.spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.border,
    marginBottom: GlobalStyles.spacing.lg,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: GlobalStyles.spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
  },
  initialsAvatar: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: GlobalStyles.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  initialsText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
  },
  badgeOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: GlobalStyles.colors.background,
    borderRadius: 10,
    padding: 2,
  },
  badge: {
    marginLeft: 0,
  },
  userInfo: {
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  displayName: {
    fontSize: 18,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
  },
  username: {
    fontSize: 15,
    color: GlobalStyles.colors.textSecondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 13,
    color: GlobalStyles.colors.grey5,
    textAlign: "center",
    paddingHorizontal: GlobalStyles.spacing.md,
    marginTop: GlobalStyles.spacing.xs,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(233, 185, 73, 0.1)",
    borderRadius: 8,
    padding: GlobalStyles.spacing.md,
    marginBottom: GlobalStyles.spacing.lg,
    gap: GlobalStyles.spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: GlobalStyles.colors.yellow,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: GlobalStyles.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: GlobalStyles.colors.surface,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: GlobalStyles.colors.text,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: GlobalStyles.colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: GlobalStyles.spacing.sm,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
