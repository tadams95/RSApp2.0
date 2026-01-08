import {
  collection,
  doc,
  getDoc,
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
 * Uses the usernames collection for lookup, then fetches user details
 */
export async function searchUsersByUsername(
  username: string,
  maxResults: number = 10
): Promise<UserSearchResult[]> {
  if (!username || username.length < 2) {
    return [];
  }

  // Remove @ prefix if present and lowercase for consistent search
  const cleanUsername = username.replace(/^@/, "").toLowerCase();

  try {
    // Strategy 1: Search usernames collection (preferred - indexed)
    // The usernames collection has documents with lowercase username as doc ID
    const usernamesQuery = query(
      collection(db, "usernames"),
      where("__name__", ">=", cleanUsername),
      where("__name__", "<=", cleanUsername + "\uf8ff"),
      limit(maxResults)
    );

    const usernamesSnapshot = await getDocs(usernamesQuery);

    if (usernamesSnapshot.empty) {
      console.log(
        "No usernames found in usernames collection, trying customers..."
      );
      // Fall back to searching customers directly
      return searchUsersByNameFallback(cleanUsername, maxResults);
    }

    // Get user details for each matched username
    const results: UserSearchResult[] = [];

    for (const usernameDoc of usernamesSnapshot.docs) {
      const usernameData = usernameDoc.data();
      // The usernames collection stores userId as 'uid', 'oderId' (typo in original spec), or 'userId'
      const userId =
        usernameData.uid || usernameData.oderId || usernameData.userId;

      if (!userId) {
        console.warn(`Username ${usernameDoc.id} has no associated userId`);
        continue;
      }

      // Fetch user details from customers collection
      const userDoc = await getDoc(doc(db, "customers", userId));

      if (userDoc.exists()) {
        const userData = userDoc.data() as UserData;
        results.push({
          userId: userDoc.id,
          displayName:
            userData.displayName ||
            `${userData.firstName} ${userData.lastName}`,
          username: usernameDoc.id, // Use the document ID as it's the lowercase username
          profilePicture: userData.profilePicture || userData.photoURL,
          verificationStatus: userData.verificationStatus,
          bio: userData.bio,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Username search error:", error);
    // Fall back to client-side search on any error
    return searchUsersByNameFallback(cleanUsername, maxResults);
  }
}

/**
 * Fallback search that queries customers collection directly
 */
async function searchUsersByNameFallback(
  searchTerm: string,
  maxResults: number
): Promise<UserSearchResult[]> {
  const searchLower = searchTerm.toLowerCase();

  // Fetch users and filter client-side
  const usersQuery = query(
    collection(db, "customers"),
    orderBy("displayName"),
    limit(100)
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
        profilePicture: data.profilePicture || data.photoURL,
        verificationStatus: data.verificationStatus,
        bio: data.bio,
      });
    }
  });

  return results.slice(0, maxResults);
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
