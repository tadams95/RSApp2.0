import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface ResolvedUserDisplay {
  displayName: string;
  profilePicture: string | null;
  username: string | null;
  usernameLower: string | null;
  isVerified: boolean;
  bio: string | null;
  socialLinks: Record<string, string> | null;
  profileSongUrl: string | null;
}

/**
 * Canonical utility for resolving user display data from both
 * /profiles and /customers collections.
 * Precedence: profiles > customers > defaults
 */
export async function resolveUserDisplay(
  userId: string,
): Promise<ResolvedUserDisplay> {
  const [profileDoc, customerDoc] = await Promise.all([
    getDoc(doc(db, "profiles", userId)).catch(() => null),
    getDoc(doc(db, "customers", userId)).catch(() => null),
  ]);

  const profile = profileDoc?.exists() ? profileDoc.data() : null;
  const customer = customerDoc?.exists() ? customerDoc.data() : null;

  const displayName =
    profile?.displayName ||
    customer?.displayName ||
    customer?.firstName ||
    customer?.name ||
    customer?.email ||
    "Anonymous";

  const profilePicture =
    profile?.photoURL ||
    profile?.profilePicture ||
    customer?.profilePicture ||
    null;

  const username = profile?.username || customer?.username || null;
  const usernameLower =
    profile?.usernameLower || customer?.username?.toLowerCase() || null;

  const isVerified =
    profile?.isVerified === true ||
    customer?.verificationStatus === "verified" ||
    customer?.verificationStatus === "artist";

  const bio = profile?.bio || customer?.bio || null;
  const socialLinks = profile?.socialLinks || customer?.socialLinks || null;
  const profileSongUrl =
    profile?.profileSongUrl || customer?.profileSongUrl || null;

  return {
    displayName,
    profilePicture,
    username,
    usernameLower,
    isVerified,
    bio,
    socialLinks,
    profileSongUrl,
  };
}
