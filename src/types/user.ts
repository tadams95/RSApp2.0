// User types - canonical definitions
// Re-exported from @/utils/auth and @/utils/resolveUserDisplay for backward compatibility

// Profile music cache type for faster loads
export interface ProfileMusic {
  platform: "soundcloud" | "spotify" | "youtube";
  url: string;
  title?: string;
  artist?: string;
  artworkUrl?: string | null;
  cachedAt?: string; // ISO date string
}

// Define types for user data
export interface UserData {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string;
  expoPushToken: string;
  qrCode: string;
  userId: string;
  createdAt: string;
  lastLogin: string;
  lastUpdated: string;
  profilePicture: string;
  stripeCustomerId: string;
  isAdmin: boolean;
  migratedFromRTDB: boolean;
  migrationDate?: string;
  // Social profile fields (Phase 1)
  bio?: string; // max 160 chars
  username?: string; // unique, lowercase
  socialLinks?: {
    soundcloud?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    spotify?: string;
    youtube?: string;
  };
  interests?: string[]; // music genres, event types
  location?: {
    city?: string;
    state?: string;
  };
  isPublic?: boolean; // profile visibility, defaults to true
  verificationStatus?: "none" | "verified" | "artist";
  // Alternative verification field from /profiles collection
  isVerified?: boolean;
  // Alternative photo field from /profiles collection
  photoURL?: string;
  // Alternative name field
  name?: string;
  // Profile song (MySpace vibes)
  profileSongUrl?: string;
  // Cached profile music metadata for faster loads
  profileMusic?: ProfileMusic;
  stats?: {
    eventsAttended: number;
    postsCount: number;
    followersCount: number;
    followingCount: number;
  };
  [key: string]: any; // For any additional fields
}

// Re-export ResolvedUserDisplay from its canonical location
export { ResolvedUserDisplay } from "../utils/resolveUserDisplay";
