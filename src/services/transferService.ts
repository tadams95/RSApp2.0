/**
 * Transfer Service
 *
 * Wraps Cloud Function API calls for ticket transfers.
 * Provides methods for initiating, cancelling, and querying transfers.
 */

import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// ============================================
// Constants
// ============================================

const FUNCTIONS_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

// ============================================
// Types
// ============================================

export interface InitiateTransferParams {
  /** The rager document ID (ticket ID) */
  ragerId: string;
  /** The event ID */
  eventId: string;
  /** Recipient's email address (for email transfer) */
  recipientEmail?: string;
  /** Recipient's username (for username transfer) */
  recipientUsername?: string;
  /** Recipient's user ID (for direct transfer) */
  recipientUserId?: string;
}

export interface TransferResult {
  /** The transfer document ID */
  transferId: string;
  /** Claim token for the transfer */
  claimToken?: string;
  /** Event name */
  eventName: string;
  /** Recipient email */
  recipientEmail?: string;
  /** Recipient username */
  recipientUsername?: string;
  /** Recipient display name */
  recipientDisplayName?: string;
  /** Success message */
  message: string;
}

export interface Transfer {
  /** Transfer document ID */
  id: string;
  /** Sender user ID */
  fromUserId: string;
  /** Recipient user ID (if known) */
  toUserId?: string;
  /** Recipient email */
  recipientEmail?: string;
  /** Recipient username */
  recipientUsername?: string;
  /** Event ID */
  eventId: string;
  /** Event name */
  eventName: string;
  /** Rager/ticket document ID */
  ragerId: string;
  /** Transfer status */
  status: "pending" | "claimed" | "cancelled" | "expired";
  /** Created timestamp */
  createdAt: Timestamp;
  /** Claimed timestamp */
  claimedAt?: Timestamp;
  /** Cancelled timestamp */
  cancelledAt?: Timestamp;
  /** Expiration timestamp (72 hours after creation) */
  expiresAt: Timestamp;
}

export interface TransferError extends Error {
  code?: string;
  statusCode?: number;
}

// ============================================
// Error Handling
// ============================================

/**
 * Create a typed transfer error
 */
function createTransferError(
  message: string,
  code?: string,
  statusCode?: number
): TransferError {
  const error = new Error(message) as TransferError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<TransferError> {
  try {
    const errorData = await response.json();
    return createTransferError(
      errorData.error || errorData.message || "Transfer failed",
      errorData.code,
      response.status
    );
  } catch {
    return createTransferError(
      `Request failed with status ${response.status}`,
      "UNKNOWN_ERROR",
      response.status
    );
  }
}

// ============================================
// API Functions
// ============================================

/**
 * Initiate a ticket transfer via Cloud Function
 *
 * @param params - Transfer parameters
 * @returns Transfer result with transferId and status
 * @throws TransferError on failure
 */
export async function initiateTransfer(
  params: InitiateTransferParams
): Promise<TransferResult> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw createTransferError("Not authenticated", "AUTH_ERROR", 401);
  }

  // Validate params
  if (!params.ragerId || !params.eventId) {
    throw createTransferError(
      "Missing required parameters",
      "VALIDATION_ERROR",
      400
    );
  }

  if (
    !params.recipientEmail &&
    !params.recipientUsername &&
    !params.recipientUserId
  ) {
    throw createTransferError(
      "Must provide recipient email, username, or user ID",
      "VALIDATION_ERROR",
      400
    );
  }

  try {
    const response = await fetch(`${FUNCTIONS_URL}/transfer-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ragerId: params.ragerId,
        eventId: params.eventId,
        recipientEmail: params.recipientEmail,
        recipientUsername: params.recipientUsername,
        recipientUserId: params.recipientUserId,
        senderUserId: user.uid,
        senderEmail: user.email,
        senderName: user.displayName,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const result = await response.json();
    return {
      transferId: result.transferId,
      claimToken: result.claimToken,
      eventName: result.eventName || "",
      recipientEmail: params.recipientEmail,
      recipientUsername: params.recipientUsername,
      recipientDisplayName: result.recipientDisplayName,
      message: result.message || "Transfer initiated successfully",
    };
  } catch (error) {
    // Re-throw if already a TransferError
    if ((error as TransferError).code) {
      throw error;
    }

    // Network or other error
    console.error("Transfer initiation error:", error);
    throw createTransferError(
      "Network error. Please check your connection and try again.",
      "NETWORK_ERROR"
    );
  }
}

/**
 * Cancel a pending ticket transfer
 *
 * @param transferId - The transfer document ID to cancel
 * @throws TransferError on failure
 */
export async function cancelTransfer(transferId: string): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw createTransferError("Not authenticated", "AUTH_ERROR", 401);
  }

  if (!transferId) {
    throw createTransferError(
      "Transfer ID is required",
      "VALIDATION_ERROR",
      400
    );
  }

  try {
    const response = await fetch(`${FUNCTIONS_URL}/cancel-transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transferId,
        userId: user.uid,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }
  } catch (error) {
    if ((error as TransferError).code) {
      throw error;
    }

    console.error("Cancel transfer error:", error);
    throw createTransferError(
      "Network error. Please check your connection and try again.",
      "NETWORK_ERROR"
    );
  }
}

/**
 * Get pending outgoing transfers for a user
 *
 * @param userId - The user ID to get transfers for
 * @returns Array of pending transfers
 */
export async function getPendingTransfers(userId: string): Promise<Transfer[]> {
  if (!userId) {
    return [];
  }

  try {
    const q = query(
      collection(db, "ticketTransfers"),
      where("fromUserId", "==", userId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Transfer[];
  } catch (error) {
    console.error("Error fetching pending transfers:", error);
    return [];
  }
}

/**
 * Get incoming transfers for a user
 *
 * @param userId - The user ID to get transfers for
 * @returns Array of incoming transfers
 */
export async function getIncomingTransfers(
  userId: string
): Promise<Transfer[]> {
  if (!userId) {
    return [];
  }

  try {
    const q = query(
      collection(db, "ticketTransfers"),
      where("toUserId", "==", userId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Transfer[];
  } catch (error) {
    console.error("Error fetching incoming transfers:", error);
    return [];
  }
}

/**
 * Resend claim email for a pending transfer
 *
 * @param transferId - The transfer document ID
 * @throws TransferError on failure
 */
export async function resendTransferEmail(transferId: string): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw createTransferError("Not authenticated", "AUTH_ERROR", 401);
  }

  if (!transferId) {
    throw createTransferError(
      "Transfer ID is required",
      "VALIDATION_ERROR",
      400
    );
  }

  try {
    // Re-call transfer-ticket endpoint with the same transfer to resend email
    const response = await fetch(`${FUNCTIONS_URL}/resend-transfer-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transferId,
        userId: user.uid,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }
  } catch (error) {
    if ((error as TransferError).code) {
      throw error;
    }

    console.error("Resend email error:", error);
    throw createTransferError(
      "Network error. Please check your connection and try again.",
      "NETWORK_ERROR"
    );
  }
}
