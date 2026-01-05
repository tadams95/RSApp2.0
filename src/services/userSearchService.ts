import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { UserData } from "../utils/auth";

const db = getFirestore();

export interface UserSearchResult {
  userId: string;
  displayName: string;
  username?: string;
  profilePicture?: string;
  verificationStatus?: "none" | "verified" | "artist";
  bio?: string;
}

/**
 * Search users by display name (case-insensitive prefix search)
 * Note: Firestore doesn't support true case-insensitive search,
 * so we search by prefix and filter client-side
 */
export async function searchUsersByName(
  searchTerm: string,
  maxResults: number = 20
): Promise<UserSearchResult[]> {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const searchLower = searchTerm.toLowerCase();
  const searchUpper = searchTerm.toLowerCase() + "\uf8ff";

  // Search by displayName - requires a composite index
  // For now, we'll fetch recent users and filter client-side
  // This is more practical for small-to-medium user bases
  const usersQuery = query(
    collection(db, "customers"),
    orderBy("displayName"),
    limit(100) // Fetch more to filter
  );

  const snapshot = await getDocs(usersQuery);

  const results: UserSearchResult[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as UserData;
    const displayNameLower = (data.displayName || "").toLowerCase();
    const usernameLower = (data.username || "").toLowerCase();

    // Match by displayName or username
    if (
      displayNameLower.includes(searchLower) ||
      usernameLower.includes(searchLower)
    ) {
      results.push({
        userId: doc.id,
        displayName: data.displayName || `${data.firstName} ${data.lastName}`,
        username: data.username,
        profilePicture: data.profilePicture,
        verificationStatus: data.verificationStatus,
        bio: data.bio,
      });
    }
  });

  return results.slice(0, maxResults);
}

/**
 * Search users by username (exact or prefix match)
 */
export async function searchUsersByUsername(
  username: string,
  maxResults: number = 10
): Promise<UserSearchResult[]> {
  if (!username || username.length < 2) {
    return [];
  }

  // Remove @ prefix if present
  const cleanUsername = username.replace(/^@/, "").toLowerCase();

  const usersQuery = query(
    collection(db, "customers"),
    where("username", ">=", cleanUsername),
    where("username", "<=", cleanUsername + "\uf8ff"),
    limit(maxResults)
  );

  try {
    const snapshot = await getDocs(usersQuery);

    return snapshot.docs.map((doc) => {
      const data = doc.data() as UserData;
      return {
        userId: doc.id,
        displayName: data.displayName || `${data.firstName} ${data.lastName}`,
        username: data.username,
        profilePicture: data.profilePicture,
        verificationStatus: data.verificationStatus,
        bio: data.bio,
      };
    });
  } catch (error) {
    // If index doesn't exist yet, fall back to client-side search
    console.log("Username index may not exist, using fallback search");
    return searchUsersByName(cleanUsername, maxResults);
  }
}

/**
 * Get suggested users to follow (users with most followers)
 * This is a simple implementation - could be enhanced with ML recommendations
 */
export async function getSuggestedUsers(
  currentUserId: string,
  maxResults: number = 10
): Promise<UserSearchResult[]> {
  // For now, just return recent users excluding current user
  // Could be enhanced to exclude already-followed users
  const usersQuery = query(
    collection(db, "customers"),
    orderBy("createdAt", "desc"),
    limit(maxResults + 1) // +1 to account for current user
  );

  const snapshot = await getDocs(usersQuery);

  return snapshot.docs
    .filter((doc) => doc.id !== currentUserId)
    .slice(0, maxResults)
    .map((doc) => {
      const data = doc.data() as UserData;
      return {
        userId: doc.id,
        displayName: data.displayName || `${data.firstName} ${data.lastName}`,
        username: data.username,
        profilePicture: data.profilePicture,
        verificationStatus: data.verificationStatus,
        bio: data.bio,
      };
    });
}
