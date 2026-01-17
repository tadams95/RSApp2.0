/**
 * PendingTransferCard Component
 *
 * Displays a pending outgoing ticket transfer with:
 * - Event name
 * - Recipient info (username or email)
 * - Time remaining until expiration
 * - Cancel button
 *
 * Supports both compact (inline) and full card views.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Timestamp } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

// ============================================
// Types
// ============================================

export interface PendingTransfer {
  id: string;
  eventName: string;
  recipientEmail?: string;
  recipientUsername?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  status: "pending" | "claimed" | "cancelled" | "expired";
}

export interface PendingTransferCardProps {
  transfer: PendingTransfer;
  onCancel: () => void;
  onResendEmail?: () => void;
  onViewAll?: () => void;
  cancelling?: boolean;
  resending?: boolean;
  compact?: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate time remaining until expiration
 */
function getTimeRemaining(expiresAt: Timestamp | null | undefined): string {
  if (!expiresAt) return "Unknown";

  const now = new Date();
  const expiry =
    typeof expiresAt.toDate === "function"
      ? expiresAt.toDate()
      : new Date(expiresAt as unknown as string);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

/**
 * Check if transfer is expired
 */
function isExpired(expiresAt: Timestamp | null | undefined): boolean {
  if (!expiresAt) return false;

  const now = new Date();
  const expiry =
    typeof expiresAt.toDate === "function"
      ? expiresAt.toDate()
      : new Date(expiresAt as unknown as string);

  return now > expiry;
}

// ============================================
// Component
// ============================================

const PendingTransferCard: React.FC<PendingTransferCardProps> = ({
  transfer,
  onCancel,
  onResendEmail,
  cancelling = false,
  resending = false,
  compact = false,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const recipientDisplay =
    transfer.recipientUsername ||
    transfer.recipientEmail ||
    "Unknown recipient";

  const expired = isExpired(transfer.expiresAt);
  const timeLeft = getTimeRemaining(transfer.expiresAt);

  // Show resend button only for email transfers (not @username transfers)
  const isEmailTransfer =
    !transfer.recipientUsername && !!transfer.recipientEmail;

  if (compact) {
    // Compact version for inline display in My Events
    return (
      <View style={styles.compactCard}>
        <View style={styles.compactLeft}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={expired ? theme.colors.danger : theme.colors.warning}
          />
          <View style={styles.compactInfo}>
            <Text style={styles.compactEventName} numberOfLines={1}>
              {transfer.eventName}
            </Text>
            <Text style={styles.compactRecipient} numberOfLines={1}>
              To:{" "}
              {transfer.recipientUsername
                ? `@${recipientDisplay.replace("@", "")}`
                : recipientDisplay}
            </Text>
          </View>
        </View>
        <View style={styles.compactRight}>
          <Text
            style={[
              styles.compactTimeLeft,
              expired && styles.compactTimeExpired,
            ]}
          >
            {timeLeft}
          </Text>
          {!expired && isEmailTransfer && onResendEmail && (
            <TouchableOpacity
              onPress={onResendEmail}
              disabled={resending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {resending ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <MaterialCommunityIcons
                  name="email-outline"
                  size={18}
                  color={theme.colors.accent}
                />
              )}
            </TouchableOpacity>
          )}
          {!expired && (
            <TouchableOpacity
              onPress={onCancel}
              disabled={cancelling}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={theme.colors.danger}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Full card version
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="send-clock"
          size={20}
          color={theme.colors.accent}
        />
        <Text style={styles.headerText}>Pending Transfer</Text>
      </View>

      {/* Event name */}
      <Text style={styles.eventName} numberOfLines={1}>
        {transfer.eventName}
      </Text>

      {/* Recipient */}
      <View style={styles.infoRow}>
        <MaterialCommunityIcons
          name="account-arrow-right"
          size={16}
          color={theme.colors.textTertiary}
        />
        <Text style={styles.infoLabel}>To:</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {transfer.recipientUsername
            ? `@${recipientDisplay.replace("@", "")}`
            : recipientDisplay}
        </Text>
      </View>

      {/* Time remaining badge */}
      <View
        style={[
          styles.timeBadge,
          expired ? styles.expiredBadge : styles.pendingBadge,
        ]}
      >
        <MaterialCommunityIcons
          name={expired ? "clock-alert-outline" : "timer-sand"}
          size={14}
          color={expired ? theme.colors.danger : theme.colors.warning}
        />
        <Text
          style={[
            styles.timeText,
            expired ? styles.expiredText : styles.pendingText,
          ]}
        >
          {timeLeft}
        </Text>
      </View>

      {/* Action buttons */}
      {!expired && (
        <View style={styles.buttonRow}>
          {/* Resend Email button (email transfers only) */}
          {isEmailTransfer && onResendEmail && (
            <TouchableOpacity
              style={[styles.resendButton, resending && styles.buttonDisabled]}
              onPress={onResendEmail}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="email-edit-outline"
                    size={16}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.resendButtonText}>Resend Email</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
            onPress={onCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={16}
                  color={theme.colors.danger}
                />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ============================================
// Styles
// ============================================

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Full card styles
    card: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    headerText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    eventName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
    },
    infoLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    timeBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginBottom: 10,
    },
    pendingBadge: {
      backgroundColor: theme.colors.warningMuted,
    },
    expiredBadge: {
      backgroundColor: theme.colors.dangerMuted,
    },
    timeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    pendingText: {
      color: theme.colors.warning,
    },
    expiredText: {
      color: theme.colors.danger,
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    resendButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    resendButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    cancelButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.danger,
    },
    buttonDisabled: {
      opacity: 0.5,
    },

    // Compact card styles
    compactCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.accentMuted,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginBottom: 8,
    },
    compactLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    compactInfo: {
      flex: 1,
    },
    compactEventName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    compactRecipient: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    compactRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    compactTimeLeft: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.warning,
    },
    compactTimeExpired: {
      color: theme.colors.danger,
    },
  });

export default PendingTransferCard;
