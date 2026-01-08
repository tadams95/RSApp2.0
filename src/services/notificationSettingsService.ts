import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Notification settings interface
 * Stored at users/{userId}/settings/notifications
 */
export interface NotificationSettings {
  // Master toggle
  pushEnabled: boolean;

  // Activity notifications
  followNotifications: boolean;
  likeNotifications: boolean;
  commentNotifications: boolean;
  mentionNotifications: boolean;
  repostNotifications: boolean;

  // Transfer notifications (always on - critical)
  transferNotifications: boolean;

  // Event notifications
  eventReminders: boolean;

  // Marketing
  marketingNotifications: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}

/**
 * Default notification settings for new users
 */
export const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  followNotifications: true,
  likeNotifications: true,
  commentNotifications: true,
  mentionNotifications: true,
  repostNotifications: true,
  transferNotifications: true, // Cannot be disabled
  eventReminders: true,
  marketingNotifications: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  quietHoursTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/**
 * Get notification settings for a user
 * Creates default settings if none exist
 */
export async function getNotificationSettings(
  userId: string
): Promise<NotificationSettings> {
  const docRef = doc(db, "users", userId, "settings", "notifications");
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    // Initialize with defaults
    await setDoc(docRef, {
      ...DEFAULT_SETTINGS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return DEFAULT_SETTINGS;
  }

  return { ...DEFAULT_SETTINGS, ...snapshot.data() } as NotificationSettings;
}

/**
 * Update notification settings
 * Prevents disabling transfer notifications (critical for ticket transfers)
 */
export async function updateNotificationSettings(
  userId: string,
  updates: Partial<NotificationSettings>
): Promise<void> {
  // Ensure transferNotifications can't be disabled
  if (updates.transferNotifications === false) {
    delete updates.transferNotifications;
  }

  const docRef = doc(db, "users", userId, "settings", "notifications");
  await setDoc(
    docRef,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
