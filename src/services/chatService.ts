import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { Message, ChatSummary, UserInfo } from "../types/chat";

const CHATS_COLLECTION = "chats";
const MESSAGES_COLLECTION = "messages";
const CHAT_SUMMARIES = "chatSummaries";
const PAGE_SIZE = 50;

// ============================================
// HELPER: Deterministic DM Chat ID
// ============================================

/**
 * Generate deterministic chat ID for DMs
 * This eliminates the need for expensive queries to find existing chats
 */
export function getDmChatId(userId1: string, userId2: string): string {
  return `dm_${[userId1, userId2].sort().join("_")}`;
}

// ============================================
// HELPER: User Info (follows feedService pattern)
// ============================================

/**
 * Get user display info from both customers and profiles collections
 * Follows the multi-collection pattern used in feedService
 */
export async function getUserDisplayInfo(userId: string): Promise<UserInfo> {
  const [customerDoc, profileDoc] = await Promise.all([
    getDoc(doc(db, "customers", userId)),
    getDoc(doc(db, "profiles", userId)),
  ]);

  const customer = customerDoc.data();
  const profile = profileDoc.data();

  return {
    userId,
    displayName:
      profile?.displayName ||
      customer?.displayName ||
      `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() ||
      "Anonymous",
    photoURL:
      profile?.photoURL ||
      profile?.profilePicture ||
      customer?.profilePicture ||
      null,
    username: profile?.usernameLower || customer?.username || null,
  };
}

// ============================================
// DM CHAT OPERATIONS
// ============================================

/**
 * Get or create a DM chat using deterministic ID (no query needed)
 * Note: Chat summaries are created by Cloud Function (onDmChatCreated)
 * to avoid permission issues with writing to other user's subcollections
 */
export async function getOrCreateDmChat(
  currentUserId: string,
  peerId: string,
): Promise<string> {
  const chatId = getDmChatId(currentUserId, peerId);
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const chatDoc = await getDoc(chatRef);

  if (chatDoc.exists()) {
    return chatId;
  }

  // Create chat document only - Cloud Function creates summaries for both users
  await setDoc(chatRef, {
    type: "dm",
    members: [currentUserId, peerId].sort(),
    memberCount: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true,
    lastMessage: null,
  });

  return chatId;
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

/**
 * Send a text message
 * Cloud Function handles updating lastMessage, unreadCount, and push notifications
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
): Promise<string> {
  const messagesRef = collection(
    db,
    CHATS_COLLECTION,
    chatId,
    MESSAGES_COLLECTION,
  );

  const messageData = {
    senderId,
    senderName,
    senderPhoto,
    text,
    createdAt: serverTimestamp(),
    readBy: [senderId],
  };

  const messageRef = await addDoc(messagesRef, messageData);
  return messageRef.id;
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to messages in a chat (real-time)
 * Returns unsubscribe function for cleanup
 */
export function subscribeToMessages(
  chatId: string,
  onUpdate: (
    messages: Message[],
    lastDoc: QueryDocumentSnapshot | null,
  ) => void,
  onError: (error: Error) => void,
  limitCount = PAGE_SIZE,
): Unsubscribe {
  const messagesRef = collection(
    db,
    CHATS_COLLECTION,
    chatId,
    MESSAGES_COLLECTION,
  );
  const q = query(messagesRef, orderBy("createdAt", "desc"), limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        chatId,
        senderId: docSnap.data().senderId,
        senderName: docSnap.data().senderName,
        senderPhoto: docSnap.data().senderPhoto,
        text: docSnap.data().text,
        mediaUrl: docSnap.data().mediaUrl,
        mediaType: docSnap.data().mediaType,
        createdAt:
          (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
        status: "sent",
      }));

      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      // Reverse to show oldest first (for chat display)
      onUpdate(messages.reverse(), lastDoc);
    },
    (error) => {
      console.error("Error subscribing to messages:", error);
      onError(error);
    },
  );
}

/**
 * Fetch older messages for pagination
 */
export async function fetchOlderMessages(
  chatId: string,
  lastDoc: QueryDocumentSnapshot<DocumentData>,
  limitCount = PAGE_SIZE,
): Promise<{ messages: Message[]; lastDoc: QueryDocumentSnapshot | null }> {
  const messagesRef = collection(
    db,
    CHATS_COLLECTION,
    chatId,
    MESSAGES_COLLECTION,
  );
  const q = query(
    messagesRef,
    orderBy("createdAt", "desc"),
    startAfter(lastDoc),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const messages: Message[] = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    chatId,
    senderId: docSnap.data().senderId,
    senderName: docSnap.data().senderName,
    senderPhoto: docSnap.data().senderPhoto,
    text: docSnap.data().text,
    createdAt:
      (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
    status: "sent",
  }));

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages: messages.reverse(), lastDoc: newLastDoc };
}

/**
 * Subscribe to chat list (real-time)
 * Returns unsubscribe function for cleanup
 */
export function subscribeToChatList(
  userId: string,
  onUpdate: (chats: ChatSummary[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const summariesRef = collection(db, `users/${userId}/${CHAT_SUMMARIES}`);
  const q = query(summariesRef, orderBy("updatedAt", "desc"), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatSummary[] = snapshot.docs.map((docSnap) => ({
        chatId: docSnap.id,
        type: docSnap.data().type,
        peerId: docSnap.data().peerId,
        peerName: docSnap.data().peerName,
        peerPhoto: docSnap.data().peerPhoto,
        eventId: docSnap.data().eventId,
        eventName: docSnap.data().eventName,
        lastMessage: docSnap.data().lastMessage
          ? {
              ...docSnap.data().lastMessage,
              createdAt:
                docSnap.data().lastMessage.createdAt?.toDate() || new Date(),
            }
          : null,
        unreadCount: docSnap.data().unreadCount || 0,
        muted: docSnap.data().muted || false,
        updatedAt:
          (docSnap.data().updatedAt as Timestamp)?.toDate() || new Date(),
      }));

      onUpdate(chats);
    },
    (error) => {
      console.error("Error subscribing to chat list:", error);
      onError(error);
    },
  );
}

/**
 * Mark chat as read (reset unread count)
 */
export async function markChatAsRead(
  userId: string,
  chatId: string,
): Promise<void> {
  const summaryRef = doc(db, `users/${userId}/${CHAT_SUMMARIES}/${chatId}`);
  await setDoc(summaryRef, { unreadCount: 0 }, { merge: true });
}

/**
 * Subscribe to total unread count across all chats (for badge)
 */
export function subscribeToTotalUnread(
  userId: string,
  onUpdate: (count: number) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const summariesRef = collection(db, `users/${userId}/${CHAT_SUMMARIES}`);

  return onSnapshot(
    summariesRef,
    (snapshot) => {
      const totalUnread = snapshot.docs.reduce(
        (sum, docSnap) => sum + (docSnap.data().unreadCount || 0),
        0,
      );
      onUpdate(totalUnread);
    },
    (error) => {
      console.error("Error subscribing to unread count:", error);
      onError(error);
    },
  );
}
