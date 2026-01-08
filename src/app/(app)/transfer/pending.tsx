import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getAuth } from "firebase/auth";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../../analytics/PostHogProvider";
import { GlobalStyles } from "../../../constants/styles";
import {
  cancelTransfer,
  getPendingTransfers,
  resendTransferEmail,
  Transfer,
} from "../../../services/transferService";

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate time remaining until expiration
 */
function getTimeRemaining(expiresAt: any): string {
  if (!expiresAt) return "Unknown";

  const now = new Date();
  const expiry = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

/**
 * Format date for display
 */
function formatDate(timestamp: any): string {
  if (!timestamp) return "";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================
// PendingTransferCard Component
// ============================================

interface PendingTransferCardProps {
  transfer: Transfer;
  onCancel: (transferId: string) => void;
  onResendEmail?: (transferId: string) => void;
  cancelling: boolean;
  resending?: boolean;
}

function PendingTransferCard({
  transfer,
  onCancel,
  onResendEmail,
  cancelling,
  resending = false,
}: PendingTransferCardProps) {
  const recipientDisplay =
    transfer.recipientUsername ||
    transfer.recipientEmail ||
    "Unknown recipient";

  // Show resend button only for email transfers (not @username transfers)
  const isEmailTransfer =
    !transfer.recipientUsername && !!transfer.recipientEmail;

  const isExpired =
    transfer.expiresAt &&
    new Date() >
      (typeof transfer.expiresAt.toDate === "function"
        ? transfer.expiresAt.toDate()
        : new Date(transfer.expiresAt as unknown as string));

  return (
    <View style={styles.card}>
      {/* Header with event name */}
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name="ticket-outline"
          size={20}
          color={GlobalStyles.colors.primary}
        />
        <Text style={styles.eventName} numberOfLines={1}>
          {transfer.eventName}
        </Text>
      </View>

      {/* Transfer details */}
      <View style={styles.cardBody}>
        {/* Recipient */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="account-arrow-right"
            size={18}
            color={GlobalStyles.colors.grey5}
          />
          <Text style={styles.infoLabel}>To:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {transfer.recipientUsername
              ? `@${recipientDisplay.replace("@", "")}`
              : recipientDisplay}
          </Text>
        </View>

        {/* Created date */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={GlobalStyles.colors.grey5}
          />
          <Text style={styles.infoLabel}>Sent:</Text>
          <Text style={styles.infoValue}>{formatDate(transfer.createdAt)}</Text>
        </View>

        {/* Time remaining */}
        <View
          style={[
            styles.statusBadge,
            isExpired ? styles.expiredBadge : styles.pendingBadge,
          ]}
        >
          <MaterialCommunityIcons
            name={isExpired ? "clock-alert-outline" : "timer-sand"}
            size={14}
            color={
              isExpired ? GlobalStyles.colors.error : GlobalStyles.colors.yellow
            }
          />
          <Text
            style={[
              styles.statusText,
              isExpired ? styles.expiredText : styles.pendingText,
            ]}
          >
            {isExpired ? "Expired" : getTimeRemaining(transfer.expiresAt)}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      {!isExpired && (
        <View style={styles.buttonRow}>
          {/* Resend Email button (email transfers only) */}
          {isEmailTransfer && onResendEmail && (
            <TouchableOpacity
              style={[styles.resendButton, resending && styles.buttonDisabled]}
              onPress={() => onResendEmail(transfer.id)}
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
                    size={18}
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
            onPress={() => onCancel(transfer.id)}
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
                  size={18}
                  color={GlobalStyles.colors.error}
                />
                <Text style={styles.cancelButtonText}>Cancel Transfer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================
// PendingTransfersScreen Component
// ============================================

export default function PendingTransfersScreen() {
  const auth = getAuth();
  const posthog = usePostHog();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  /**
   * Load pending transfers
   */
  const loadTransfers = async (isRefresh = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const pendingTransfers = await getPendingTransfers(currentUser.uid);
      setTransfers(pendingTransfers);
    } catch (error) {
      console.error("Error loading pending transfers:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadTransfers();
    }, [])
  );

  /**
   * Handle cancel transfer
   */
  const handleCancel = async (transferId: string) => {
    const transfer = transfers.find((t) => t.id === transferId);

    Alert.alert(
      "Cancel Transfer",
      `Are you sure you want to cancel this transfer${
        transfer?.eventName ? ` for ${transfer.eventName}` : ""
      }? The ticket will be returned to your account.`,
      [
        {
          text: "Keep Transfer",
          style: "cancel",
        },
        {
          text: "Cancel Transfer",
          style: "destructive",
          onPress: async () => {
            setCancellingId(transferId);

            try {
              await cancelTransfer(transferId);

              // Track cancellation
              posthog?.capture("transfer_cancelled", {
                transfer_id: transferId,
                event_name: transfer?.eventName || null,
              });

              // Remove from local state
              setTransfers((prev) => prev.filter((t) => t.id !== transferId));

              Alert.alert(
                "Transfer Cancelled",
                "The ticket has been returned to your account.",
                [{ text: "OK" }]
              );
            } catch (error: any) {
              console.error("Error cancelling transfer:", error);

              posthog?.capture("transfer_cancel_failed", {
                transfer_id: transferId,
                error_message: error.message,
              });

              Alert.alert(
                "Cancel Failed",
                error.message || "Failed to cancel transfer. Please try again.",
                [{ text: "OK" }]
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle resend email for pending transfer
   */
  const handleResendEmail = async (transferId: string) => {
    const transfer = transfers.find((t) => t.id === transferId);
    setResendingId(transferId);

    try {
      await resendTransferEmail(transferId);

      posthog?.capture("transfer_email_resent", {
        transfer_id: transferId,
        recipient_email: transfer?.recipientEmail || null,
      });

      Alert.alert("Email Sent", "The claim email has been resent.", [
        { text: "OK" },
      ]);
    } catch (error: any) {
      console.error("Error resending email:", error);

      posthog?.capture("transfer_resend_failed", {
        transfer_id: transferId,
        error_message: error.message,
      });

      // Handle rate limit error specifically
      if (error.statusCode === 429) {
        Alert.alert(
          "Please Wait",
          error.message || "You can only resend once every 5 minutes.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Resend Failed",
          error.message || "Failed to resend email. Please try again.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setResendingId(null);
    }
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="send-check"
        size={64}
        color={GlobalStyles.colors.grey5}
      />
      <Text style={styles.emptyTitle}>No Pending Transfers</Text>
      <Text style={styles.emptyText}>
        When you transfer a ticket to someone, it will appear here until they
        claim it.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.replace("/(app)/events/my-events")}
      >
        <Text style={styles.emptyButtonText}>Go to My Events</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render transfer card
   */
  const renderItem = ({ item }: { item: Transfer }) => (
    <PendingTransferCard
      transfer={item}
      onCancel={handleCancel}
      onResendEmail={
        item.recipientEmail && !item.recipientUsername
          ? handleResendEmail
          : undefined
      }
      cancelling={cancellingId === item.id}
      resending={resendingId === item.id}
    />
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GlobalStyles.colors.primary} />
          <Text style={styles.loadingText}>Loading transfers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transfers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          transfers.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTransfers(true)}
            tintColor={GlobalStyles.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlobalStyles.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: GlobalStyles.colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContent: {
    flex: 1,
  },

  // Card styles
  card: {
    backgroundColor: GlobalStyles.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.border,
  },
  eventName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
  },
  cardBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: GlobalStyles.colors.textSecondary,
    width: 40,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: GlobalStyles.colors.text,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 4,
  },
  pendingBadge: {
    backgroundColor: "rgba(233, 185, 73, 0.15)",
  },
  expiredBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pendingText: {
    color: GlobalStyles.colors.yellow,
  },
  expiredText: {
    color: GlobalStyles.colors.error,
  },

  // Button row
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: GlobalStyles.colors.border,
  },

  // Resend button
  resendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.primary,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlobalStyles.colors.primary,
  },

  // Cancel button
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.error,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlobalStyles.colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
    marginTop: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: GlobalStyles.colors.grey8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: GlobalStyles.colors.text,
  },
});
