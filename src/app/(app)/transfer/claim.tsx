import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../../analytics/PostHogProvider";
import { Theme } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebase/firebase";
import { useAuth } from "../../../hooks/AuthContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";

// ============================================
// Types
// ============================================

interface TicketTransfer {
  id: string;
  fromUserId: string;
  fromUserName?: string;
  fromUserEmail?: string;
  toUserId?: string;
  recipientEmail?: string;
  recipientUsername?: string;
  eventId: string;
  eventName: string;
  ragerId: string;
  status: "pending" | "claimed" | "cancelled" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
  claimToken?: string;
  claimTokenHash?: string;
}

type ClaimStatus =
  | "loading"
  | "ready"
  | "expired"
  | "claimed"
  | "not_found"
  | "error";

// ============================================
// Helper Functions
// ============================================

/**
 * Simple hash function for claim token
 * Note: This should match the hashing used on the server
 */
async function hashToken(token: string): Promise<string> {
  // For now, use the token directly since the Cloud Function
  // may store the token unhashed or use a specific hash
  // This can be updated once we know the exact hashing method
  return token;
}

/**
 * Calculate time remaining until expiration
 */
function getTimeRemaining(expiresAt: Timestamp): string {
  const now = new Date();
  const expiry = expiresAt.toDate();
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes} minutes remaining`;
}

// ============================================
// ClaimTransferScreen Component
// ============================================

export default function ClaimTransferScreen() {
  const { token, transferId } = useLocalSearchParams<{
    token: string;
    transferId?: string;
  }>();

  const { authenticated } = useAuth();
  const posthog = usePostHog();
  const auth = getAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [transfer, setTransfer] = useState<TicketTransfer | null>(null);
  const [status, setStatus] = useState<ClaimStatus>("loading");
  const [claiming, setClaiming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load transfer details on mount
  useEffect(() => {
    if (token) {
      loadTransferDetails();
    } else {
      setStatus("not_found");
      setErrorMessage("No claim token provided");
    }
  }, [token]);

  /**
   * Load transfer details by querying with claim token
   */
  const loadTransferDetails = async () => {
    try {
      setStatus("loading");
      setErrorMessage(null);

      // Hash the token to match stored hash (if applicable)
      const tokenToQuery = await hashToken(token!);

      // Query ticketTransfers by claimToken or claimTokenHash
      // Try both fields since implementation may vary
      let snapshot = await getDocs(
        query(
          collection(db, "ticketTransfers"),
          where("claimToken", "==", tokenToQuery)
        )
      );

      // If not found by claimToken, try claimTokenHash
      if (snapshot.empty) {
        snapshot = await getDocs(
          query(
            collection(db, "ticketTransfers"),
            where("claimTokenHash", "==", tokenToQuery)
          )
        );
      }

      // Also try by transferId if provided
      if (snapshot.empty && transferId) {
        snapshot = await getDocs(
          query(
            collection(db, "ticketTransfers"),
            where("__name__", "==", transferId)
          )
        );
      }

      if (snapshot.empty) {
        setStatus("not_found");
        setErrorMessage("Transfer not found. It may have been cancelled.");
        return;
      }

      const transferDoc = snapshot.docs[0];
      const transferData = {
        id: transferDoc.id,
        ...transferDoc.data(),
      } as TicketTransfer;

      setTransfer(transferData);

      // Check status
      if (transferData.status === "claimed") {
        setStatus("claimed");
        setErrorMessage("This ticket has already been claimed.");
        return;
      }

      if (transferData.status === "cancelled") {
        setStatus("not_found");
        setErrorMessage("This transfer has been cancelled by the sender.");
        return;
      }

      // Check expiration
      const now = new Date();
      const expiresAt = transferData.expiresAt?.toDate();
      if (expiresAt && now > expiresAt) {
        setStatus("expired");
        setErrorMessage(
          "This transfer has expired. Please ask the sender to initiate a new transfer."
        );
        return;
      }

      setStatus("ready");

      // Track view
      posthog?.capture("transfer_claim_viewed", {
        transfer_id: transferData.id,
        event_id: transferData.eventId,
        event_name: transferData.eventName,
      });
    } catch (error) {
      console.error("Error loading transfer:", error);
      setStatus("error");
      setErrorMessage("Failed to load transfer details. Please try again.");
    }
  };

  /**
   * Handle claiming the ticket
   */
  const handleClaim = async () => {
    const currentUser = auth.currentUser;
    if (!transfer || !currentUser?.uid || claiming) return;

    setClaiming(true);

    try {
      // Update the transfer document
      const transferRef = doc(db, "ticketTransfers", transfer.id);
      await updateDoc(transferRef, {
        status: "claimed",
        toUserId: currentUser.uid,
        claimedAt: Timestamp.now(),
      });

      // Update the rager (ticket) document with new owner
      const ragerRef = doc(
        db,
        "events",
        transfer.eventId,
        "ragers",
        transfer.ragerId
      );
      await updateDoc(ragerRef, {
        firebaseId: currentUser.uid,
        owner: currentUser.uid,
        active: true,
      });

      // Track successful claim
      posthog?.capture("transfer_claimed", {
        transfer_id: transfer.id,
        event_id: transfer.eventId,
        event_name: transfer.eventName,
        time_to_claim_hours: transfer.createdAt
          ? Math.floor(
              (Date.now() - transfer.createdAt.toDate().getTime()) /
                (1000 * 60 * 60)
            )
          : null,
      });

      // Show success and navigate to My Events
      Alert.alert(
        "Ticket Claimed!",
        `You've successfully claimed your ticket for ${transfer.eventName}.`,
        [
          {
            text: "View My Tickets",
            onPress: () => {
              router.replace("/(app)/events/my-events");
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error claiming transfer:", error);

      posthog?.capture("transfer_claim_failed", {
        transfer_id: transfer.id,
        error_type: "claim_error",
        error_message: error.message,
      });

      Alert.alert(
        "Claim Failed",
        "There was an error claiming your ticket. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setClaiming(false);
    }
  };

  // ============================================
  // Render States
  // ============================================

  // Loading state
  if (status === "loading") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading transfer details...</Text>
        </View>
      </View>
    );
  }

  // Error states
  if (status === "not_found" || status === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="ticket-confirmation-outline"
            size={64}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.errorTitle}>Transfer Not Found</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/(app)/events/my-events")}
          >
            <Text style={styles.secondaryButtonText}>Go to My Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Expired state
  if (status === "expired") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="clock-alert-outline"
            size={64}
            color={theme.colors.warning}
          />
          <Text style={styles.errorTitle}>Transfer Expired</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/(app)/events/my-events")}
          >
            <Text style={styles.secondaryButtonText}>Go to My Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Already claimed state
  if (status === "claimed") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={64}
            color={theme.colors.success}
          />
          <Text style={styles.successTitle}>Already Claimed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(app)/events/my-events")}
          >
            <Text style={styles.primaryButtonText}>View My Tickets</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Ready to claim state
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Transfer Card */}
        <View style={styles.transferCard}>
          <MaterialCommunityIcons
            name="ticket-confirmation"
            size={48}
            color={theme.colors.accent}
            style={styles.ticketIcon}
          />

          <Text style={styles.eventName}>{transfer?.eventName}</Text>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="account-arrow-left"
              size={20}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.infoLabel}>From:</Text>
            <Text style={styles.infoValue}>
              {transfer?.fromUserName || transfer?.fromUserEmail || "A friend"}
            </Text>
          </View>

          {transfer?.expiresAt && (
            <View style={styles.expirationBadge}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={theme.colors.warning}
              />
              <Text style={styles.expirationText}>
                {getTimeRemaining(transfer.expiresAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Notice */}
        <View style={styles.noticeContainer}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.colors.accent}
          />
          <Text style={styles.noticeText}>
            Once claimed, this ticket will be added to your My Events and can be
            used for entry.
          </Text>
        </View>

        {/* Claim Button */}
        <TouchableOpacity
          style={[styles.primaryButton, claiming && styles.buttonDisabled]}
          onPress={handleClaim}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="check"
                size={20}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.primaryButtonText}>Claim Ticket</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Link */}
        <TouchableOpacity
          style={styles.cancelLink}
          onPress={() => router.back()}
          disabled={claiming}
        >
          <Text style={styles.cancelLinkText}>Cancel</Text>
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
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    errorTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginTop: 16,
      textAlign: "center",
    },
    successTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.success,
      marginTop: 16,
      textAlign: "center",
    },
    errorText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 22,
    },
    transferCard: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      marginBottom: 20,
    },
    ticketIcon: {
      marginBottom: 16,
    },
    eventName: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      textAlign: "center",
      marginBottom: 20,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    expirationBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.warningMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginTop: 8,
    },
    expirationText: {
      fontSize: 13,
      color: theme.colors.warning,
      fontWeight: "500",
    },
    noticeContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.colors.accentMuted,
      borderRadius: 12,
      padding: 14,
      marginBottom: 24,
      gap: 10,
    },
    noticeText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.accent,
      lineHeight: 18,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    secondaryButton: {
      backgroundColor: theme.colors.bgElev2,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      marginTop: 20,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    cancelLink: {
      alignItems: "center",
      marginTop: 16,
      paddingVertical: 12,
    },
    cancelLinkText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });
