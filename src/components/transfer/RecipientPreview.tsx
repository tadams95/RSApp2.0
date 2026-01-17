/**
 * RecipientPreview Component
 *
 * Displays a preview of the recipient before confirming a ticket transfer.
 * Shows user avatar, name, username, bio, and verification status.
 * Includes warning notice and confirm/cancel action buttons.
 */

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
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
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

// ============================================
// VerificationBadge Sub-component
// ============================================

interface VerificationBadgeProps {
  status?: "none" | "verified" | "artist";
  theme: Theme;
}

function VerificationBadge({
  status,
  theme,
}: VerificationBadgeProps): React.ReactNode {
  if (status === "verified") {
    return (
      <MaterialCommunityIcons
        name="check-decagram"
        size={18}
        color="#1DA1F2"
        style={{ marginLeft: 0 }}
      />
    );
  }
  if (status === "artist") {
    return (
      <MaterialCommunityIcons
        name="star-circle"
        size={18}
        color={theme.colors.warning}
        style={{ marginLeft: 0 }}
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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

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
              <VerificationBadge
                status={user.verificationStatus}
                theme={theme}
              />
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
          color={theme.colors.warning}
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
            <Text style={styles.confirmButtonText}>Send Ticket</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    header: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      textAlign: "center",
      marginBottom: theme.spacing.sm,
    },
    eventContext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
    },
    eventName: {
      color: theme.colors.accent,
      fontWeight: "600",
    },
    recipientCard: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.card,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginBottom: theme.spacing.lg,
    },
    avatarContainer: {
      position: "relative",
      marginBottom: theme.spacing.md,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    initialsAvatar: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.card,
      backgroundColor: theme.colors.accent,
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
      backgroundColor: theme.colors.bgRoot,
      borderRadius: 10,
      padding: 2,
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
      color: theme.colors.textPrimary,
    },
    username: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    bio: {
      fontSize: 13,
      color: theme.colors.textTertiary,
      textAlign: "center",
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.xs,
    },
    warningContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.warningMuted,
      borderRadius: theme.radius.card,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.warning,
      lineHeight: 18,
    },
    buttonContainer: {
      flexDirection: "row",
      gap: theme.spacing.lg,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.button,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    confirmButton: {
      flex: 1,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.button,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
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
