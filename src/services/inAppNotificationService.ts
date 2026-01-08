import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase/firebase";

/**
 * In-app notification interface
 * Matches Firestore schema in users/{userId}/notifications
 */
export interface Notification {
  id: string;
  type:
    | "post_liked"
    | "comment_added"
    | "new_follower"
    | "mention"
    | "post_reposted"
    | "ticket_transfer_sent"
    | "ticket_transfer_received"
    | "ticket_transfer_claimed"
    | "ticket_transfer_cancelled"
    | string;
  title: string;
  body: string;
  data: {
    actorId?: string;
    actorName?: string;
    postId?: string;
    eventId?: string;
    transferId?: string;
    commentId?: string;
    [key: string]: string | undefined;
  };
  link: string;
  deepLink: string;
  read: boolean;
  seenAt: Timestamp | null;
  createdAt: Timestamp;
}

const DEFAULT_LIMIT = 50;

/**
 * Fetch notifications for a user (one-time query)
 */
export async function getNotifications(
  userId: string,
  limitCount = DEFAULT_LIMIT
): Promise<Notification[]> {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Notification[];
}

/**
 * Subscribe to real-time notification updates
 * Returns unsubscribe function
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  onError?: (error: Error) => void,
  limitCount = DEFAULT_LIMIT
): Unsubscribe {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[];
      onUpdate(notifications);
    },
    (error) => {
      console.error("Error subscribing to notifications:", error);
      onError?.(error);
    }
  );
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const notifRef = doc(db, "users", userId, "notifications", notificationId);
  await updateDoc(notifRef, {
    read: true,
    seenAt: Timestamp.now(),
  });
}

/**
 * Mark all notifications as read using Cloud Function
 * More efficient for batch operations and maintains counter consistency
 */
export async function markAllNotificationsRead(): Promise<{
  updated: number;
  remainingUnread: number;
}> {
  const functions = getFunctions();
  const batchMarkRead = httpsCallable<
    { markAll: boolean; max: number },
    { updated: number; remainingUnread: number }
  >(functions, "batchMarkNotificationsRead");

  const result = await batchMarkRead({ markAll: true, max: 100 });
  return result.data;
}
