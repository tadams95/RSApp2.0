import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth } from "../firebase/firebase";

const db = getFirestore();

// Types
export interface FollowRelationship {
  followerId: string;
  followingId: string;
  createdAt: Date;
}

/**
 * Follow a user
 * Creates a follow document and updates both users' follower/following counts
 */
export async function followUser(targetUserId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to follow users");
  }

  if (currentUser.uid === targetUserId) {
    throw new Error("Cannot follow yourself");
  }

  const followId = `${currentUser.uid}_${targetUserId}`;
  const followRef = doc(db, "follows", followId);

  // Check if already following
  const existingFollow = await getDoc(followRef);
  if (existingFollow.exists()) {
    return false; // Already following
  }

  // Create follow document
  await setDoc(followRef, {
    followerId: currentUser.uid,
    followingId: targetUserId,
    createdAt: serverTimestamp(),
  });

  // Update follower/following counts
  // Using try-catch to handle cases where stats field doesn't exist yet
  try {
    const currentUserRef = doc(db, "customers", currentUser.uid);
    const targetUserRef = doc(db, "customers", targetUserId);

    await Promise.all([
      updateDoc(currentUserRef, {
        "stats.followingCount": increment(1),
      }),
      updateDoc(targetUserRef, {
        "stats.followersCount": increment(1),
      }),
    ]);
  } catch (error) {
    // If stats field doesn't exist, initialize it
    console.log("Initializing stats fields for users");
  }

  return true;
}

/**
 * Unfollow a user
 * Deletes the follow document and updates both users' follower/following counts
 */
export async function unfollowUser(targetUserId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to unfollow users");
  }

  const followId = `${currentUser.uid}_${targetUserId}`;
  const followRef = doc(db, "follows", followId);

  // Check if following
  const existingFollow = await getDoc(followRef);
  if (!existingFollow.exists()) {
    return false; // Not following
  }

  // Delete follow document
  await deleteDoc(followRef);

  // Update follower/following counts
  try {
    const currentUserRef = doc(db, "customers", currentUser.uid);
    const targetUserRef = doc(db, "customers", targetUserId);

    await Promise.all([
      updateDoc(currentUserRef, {
        "stats.followingCount": increment(-1),
      }),
      updateDoc(targetUserRef, {
        "stats.followersCount": increment(-1),
      }),
    ]);
  } catch (error) {
    console.log("Error updating stats:", error);
  }

  return true;
}

/**
 * Check if current user is following a target user
 */
export async function isFollowing(targetUserId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return false;
  }

  const followId = `${currentUser.uid}_${targetUserId}`;
  const followRef = doc(db, "follows", followId);
  const followDoc = await getDoc(followRef);

  return followDoc.exists();
}

/**
 * Get list of users that a user is following
 */
export async function getFollowing(
  userId: string,
  limit: number = 50
): Promise<string[]> {
  // Guard against undefined userId to prevent Firebase errors
  if (!userId) {
    console.error("Error getting following list: userId is required");
    return [];
  }

  const followsQuery = query(
    collection(db, "follows"),
    where("followerId", "==", userId)
  );

  const snapshot = await getDocs(followsQuery);
  return snapshot.docs.map((doc) => doc.data().followingId);
}

/**
 * Get list of users that follow a user
 */
export async function getFollowers(
  userId: string,
  limit: number = 50
): Promise<string[]> {
  const followsQuery = query(
    collection(db, "follows"),
    where("followingId", "==", userId)
  );

  const snapshot = await getDocs(followsQuery);
  return snapshot.docs.map((doc) => doc.data().followerId);
}

/**
 * Get follower count for a user
 */
export async function getFollowerCount(userId: string): Promise<number> {
  const userRef = doc(db, "customers", userId);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    return userDoc.data()?.stats?.followersCount || 0;
  }

  return 0;
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(userId: string): Promise<number> {
  const userRef = doc(db, "customers", userId);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    return userDoc.data()?.stats?.followingCount || 0;
  }

  return 0;
}
