import * as Notifications from "expo-notifications";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";

/**
 * Real-time unread notification count hook
 * - Listens to unread notifications in Firestore
 * - Updates app icon badge automatically
 * - Returns current unread count for tab bar badge
 */
export function useNotificationBadge(): number {
  const { authenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!authenticated || !currentUser?.uid) {
      setUnreadCount(0);
      // Clear app badge when logged out
      Notifications.setBadgeCountAsync(0).catch(console.error);
      return;
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", currentUser.uid, "notifications"),
        where("read", "==", false)
      ),
      (snapshot) => {
        const count = snapshot.size;
        setUnreadCount(count);

        // Update app icon badge
        Notifications.setBadgeCountAsync(count).catch(console.error);
      },
      (error) => {
        console.error("Error listening to notifications:", error);
      }
    );

    return unsubscribe;
  }, [authenticated]);

  return unreadCount;
}

export default useNotificationBadge;
