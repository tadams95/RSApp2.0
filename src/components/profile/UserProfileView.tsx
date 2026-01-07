import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useScreenTracking } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import { getUserPosts, Post } from "../../services/feedService";
import { UserData } from "../../utils/auth";
import { PostCard } from "../feed";
import { EditProfile } from "../modals";
import FollowButton from "./FollowButton";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";

interface UserProfileViewProps {
  userId: string;
  isOwnProfile: boolean;
}

/**
 * Default stats object for users without initialized stats
 */
const DEFAULT_STATS = {
  eventsAttended: 0,
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
};

/**
 * Compute user stats by querying actual collections
 * This ensures accurate counts even if stored stats are out of sync
 */
async function computeUserStats(userId: string): Promise<typeof DEFAULT_STATS> {
  const db = getFirestore();

  try {
    // Query posts count - posts where userId matches
    const postsQuery = query(
      collection(db, "posts"),
      where("userId", "==", userId)
    );

    // Query followers count - follows where followingId (the person being followed) matches this user
    // Note: followService uses "followingId" for the target user being followed
    const followersQuery = query(
      collection(db, "follows"),
      where("followingId", "==", userId)
    );

    // Query following count - follows where followerId (the person following) matches this user
    const followingQuery = query(
      collection(db, "follows"),
      where("followerId", "==", userId)
    );

    // Execute all count queries in parallel
    const [postsSnapshot, followersSnapshot, followingSnapshot] =
      await Promise.all([
        getCountFromServer(postsQuery),
        getCountFromServer(followersQuery),
        getCountFromServer(followingQuery),
      ]);

    const stats = {
      postsCount: postsSnapshot.data().count,
      followersCount: followersSnapshot.data().count,
      followingCount: followingSnapshot.data().count,
      eventsAttended: 0, // TODO: Query events/ragers collection if needed
    };

    return stats;
  } catch (error) {
    console.log("Error computing user stats:", error);
    return DEFAULT_STATS;
  }
}

/**
 * Fetch user profile by userId from Firestore
 * - Own profile: reads from /customers/{userId} (private data)
 * - Other users: reads from /profiles/{userId} (public data) + /customers for stats
 *
 * Note: Firestore rules allow:
 * - /customers/{userId} - only owner can read
 * - /profiles/{userId} - anyone can read (public profile data)
 */
async function fetchUserProfile(userId: string): Promise<UserData | null> {
  const db = getFirestore();
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = currentUserId === userId;

  // Compute actual stats from collections (more accurate than stored stats)
  const computedStats = await computeUserStats(userId);

  if (isOwnProfile) {
    // Own profile: read from customers collection (full access)
    const userDocRef = doc(db, "customers", userId);
    const docSnapshot = await getDoc(userDocRef);

    if (docSnapshot.exists()) {
      const data = docSnapshot.data();

      // Update stored stats with computed values (keeps them in sync)
      try {
        await updateDoc(userDocRef, {
          stats: computedStats,
          isPublic: data.isPublic ?? true,
        });
      } catch (error) {
        console.log("Could not update stats field:", error);
      }

      return {
        ...data,
        userId,
        stats: computedStats,
      } as UserData;
    }
    return null;
  }

  // Other user's profile: try profiles collection first (public), then customers
  try {
    const userDocRef = doc(db, "customers", userId);
    const docSnapshot = await getDoc(userDocRef);

    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      return {
        ...data,
        userId,
        stats: computedStats,
      } as UserData;
    }
  } catch (error) {
    console.log(
      "Could not fetch profile from customers, trying profiles:",
      error
    );

    // Try the public profiles collection as fallback
    try {
      const profileRef = doc(db, "profiles", userId);
      const profileSnapshot = await getDoc(profileRef);

      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.data();
        return {
          ...profileData,
          userId,
          stats: computedStats,
        } as UserData;
      }
    } catch (profileError) {
      console.log(
        "Could not fetch from profiles collection either:",
        profileError
      );
    }
  }

  return null;
}

export default function UserProfileView({
  userId,
  isOwnProfile,
}: UserProfileViewProps) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);

  // Track screen view
  useScreenTracking("User Profile", {
    user_id: userId,
    is_own_profile: isOwnProfile,
  });

  // Fetch profile data
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
    staleTime: 0, // Always refetch for fresh stats
    gcTime: 1000 * 60, // Keep in cache for 1 minute
  });

  // Fetch user posts
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["userPosts", userId],
    queryFn: () => getUserPosts(userId, 50),
    enabled: !!userId,
    staleTime: 0,
  });

  const handleEditPress = () => {
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
  };

  const handleProfileUpdated = () => {
    setShowEditModal(false);
    refetchProfile();
  };

  const handleRefresh = () => {
    refetchProfile();
    refetchPosts();
  };

  const handlePostPress = (postId: string) => {
    router.push(`/social/post/${postId}`);
  };

  const handleProfilePress = (targetUserId: string) => {
    if (targetUserId !== userId) {
      router.push(`/profile/${targetUserId}`);
    }
  };

  const isLoading = profileLoading;
  const error = profileError; // Loading state
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GlobalStyles.colors.redVivid5} />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <Text style={styles.errorSubtext}>
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </View>
    );
  }

  // Profile not found
  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  // Check if profile is private and not own profile
  const isPrivateProfile = profile.isPublic === false && !isOwnProfile;

  if (isPrivateProfile) {
    return (
      <View style={styles.container}>
        <ProfileHeader profile={profile} isOwnProfile={false} />
        <View style={styles.privateContainer}>
          <Text style={styles.privateText}>This profile is private</Text>
        </View>
      </View>
    );
  }

  // Render header (profile info, stats, etc.)
  const renderHeader = () => (
    <View>
      {/* Profile Header */}
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEditPress={isOwnProfile ? handleEditPress : undefined}
      />

      {/* Follow Button (for other profiles only) */}
      {!isOwnProfile && (
        <View style={styles.followButtonContainer}>
          <FollowButton targetUserId={userId} />
        </View>
      )}

      {/* Profile Stats */}
      <ProfileStats
        profile={profile}
        onFollowersPress={() => {
          // TODO: Navigate to followers list
        }}
        onFollowingPress={() => {
          // TODO: Navigate to following list
        }}
      />

      {/* Posts Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Posts</Text>
      </View>
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (postsLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={GlobalStyles.colors.grey4} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {isOwnProfile ? "You haven't posted yet" : "No posts yet"}
        </Text>
      </View>
    );
  };

  // Render individual post
  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onPress={() => handlePostPress(item.id)}
      onProfilePress={handleProfilePress}
      onComment={() => handlePostPress(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={profileLoading}
            onRefresh={handleRefresh}
            tintColor={GlobalStyles.colors.redVivid5}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Edit Profile Modal (own profile only) */}
      {isOwnProfile && showEditModal && (
        <EditProfile
          onProfileUpdated={handleProfileUpdated}
          onCancel={handleEditClose}
          initialData={{
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phoneNumber: profile.phoneNumber,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  listContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  followButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: GlobalStyles.colors.redVivid5,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    textAlign: "center",
  },
  privateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  privateText: {
    fontSize: 16,
    color: GlobalStyles.colors.grey4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
  },
});
