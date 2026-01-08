/**
 * PendingTransferCard Component
 *
 * Displays a pending outgoing ticket transfer with:
 * - Event name
 * - Recipient info (username or email)
 * - Time remaining until expiration
 * - Cancel button
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
import { GlobalStyles } from "../../constants/styles";

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
            color={
              expired ? GlobalStyles.colors.error : GlobalStyles.colors.yellow
            }
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
                <ActivityIndicator
                  size="small"
                  color={GlobalStyles.colors.primary}
                />
              ) : (
                <MaterialCommunityIcons
                  name="email-send"
                  size={18}
                  color={GlobalStyles.colors.primary}
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
                <ActivityIndicator
                  size="small"
                  color={GlobalStyles.colors.error}
                />
              ) : (
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={GlobalStyles.colors.error}
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
          color={GlobalStyles.colors.primary}
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
          color={GlobalStyles.colors.grey5}
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
          color={
            expired ? GlobalStyles.colors.error : GlobalStyles.colors.yellow
          }
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
                <ActivityIndicator
                  size="small"
                  color={GlobalStyles.colors.primary}
                />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="email-send-outline"
                    size={16}
                    color={GlobalStyles.colors.primary}
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
              <ActivityIndicator
                size="small"
                color={GlobalStyles.colors.error}
              />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={16}
                  color={GlobalStyles.colors.error}
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

const styles = StyleSheet.create({
  // Full card styles
  card: {
    backgroundColor: GlobalStyles.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.border,
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
    color: GlobalStyles.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventName: {
    fontSize: 16,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
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
    color: GlobalStyles.colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: GlobalStyles.colors.text,
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
    backgroundColor: "rgba(233, 185, 73, 0.15)",
  },
  expiredBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pendingText: {
    color: GlobalStyles.colors.yellow,
  },
  expiredText: {
    color: GlobalStyles.colors.error,
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
    borderColor: GlobalStyles.colors.primary,
  },
  resendButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlobalStyles.colors.primary,
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
    borderColor: GlobalStyles.colors.error,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlobalStyles.colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Compact card styles
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 107, 53, 0.08)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.2)",
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
    color: GlobalStyles.colors.text,
    marginBottom: 2,
  },
  compactRecipient: {
    fontSize: 12,
    color: GlobalStyles.colors.textSecondary,
  },
  compactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compactTimeLeft: {
    fontSize: 11,
    fontWeight: "600",
    color: GlobalStyles.colors.yellow,
  },
  compactTimeExpired: {
    color: GlobalStyles.colors.error,
  },
});

export default PendingTransferCard;
