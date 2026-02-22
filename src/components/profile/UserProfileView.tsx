import { useQuery } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
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
  Modal,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { usePostHog, useScreenTracking } from "../../analytics/PostHogProvider";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { getOrCreateDmChat } from "../../services/chatService";
import { getUserPosts, Post } from "../../services/feedService";
import { selectLocalId } from "../../store/redux/userSlice";
import { UserData } from "../../utils/auth";
import { PostCard } from "../feed";
import { EditProfile } from "../modals";
import ProfileHeader from "./ProfileHeader";

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
 *
 * @param userId - The user ID to compute stats for
 * @param isOwnProfile - If true, count all posts; if false, only count public posts
 */
async function computeUserStats(
  userId: string,
  isOwnProfile: boolean,
): Promise<typeof DEFAULT_STATS> {
  const db = getFirestore();

  try {
    // Query posts count - posts where userId matches
    // For other users, only count public posts (required by Firestore security rules)
    const postsQuery = isOwnProfile
      ? query(collection(db, "posts"), where("userId", "==", userId))
      : query(
          collection(db, "posts"),
          where("userId", "==", userId),
          where("isPublic", "==", true),
        );

    // Query followers count - follows where followingId (the person being followed) matches this user
    // Note: followService uses "followingId" for the target user being followed
    const followersQuery = query(
      collection(db, "follows"),
      where("followingId", "==", userId),
    );

    // Query following count - follows where followerId (the person following) matches this user
    const followingQuery = query(
      collection(db, "follows"),
      where("followerId", "==", userId),
    );

    // Execute all count queries in parallel
    const [postsSnapshot, followersSnapshot, followingSnapshot] =
      await Promise.all([
        getCountFromServer(postsQuery),
        getCountFromServer(followersQuery),
        getCountFromServer(followingQuery),
      ]);

    // Read eventsAttended separately — profiles is publicly readable, customers is owner-only.
    // Try profiles first (works for any viewer), then fall back to customers for own profile
    // (preserves legacy data from before the dual-write Cloud Function deploy).
    let eventsAttended = 0;
    try {
      const profileDoc = await getDoc(doc(db, "profiles", userId));
      eventsAttended = profileDoc.data()?.stats?.eventsAttended || 0;
    } catch {
      // Doc missing or read failed — fall through
    }
    if (eventsAttended === 0 && isOwnProfile) {
      try {
        const customerDoc = await getDoc(doc(db, "customers", userId));
        eventsAttended = customerDoc.data()?.stats?.eventsAttended || 0;
      } catch {
        // Fallback failed — stay at 0
      }
    }

    const stats = {
      postsCount: postsSnapshot.data().count,
      followersCount: followersSnapshot.data().count,
      followingCount: followingSnapshot.data().count,
      eventsAttended,
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
  // Pass isOwnProfile so we only count public posts for other users
  const computedStats = await computeUserStats(userId, isOwnProfile);

  if (isOwnProfile) {
    // Own profile: read from customers collection (full access)
    const userDocRef = doc(db, "customers", userId);
    const docSnapshot = await getDoc(userDocRef);

    if (docSnapshot.exists()) {
      const data = docSnapshot.data();

      // Also fetch from /profiles to get profileSongUrl and other public fields
      let profileData = {};
      try {
        const profileRef = doc(db, "profiles", userId);
        const profileSnapshot = await getDoc(profileRef);
        if (profileSnapshot.exists()) {
          profileData = profileSnapshot.data();
        }
      } catch (error) {
        console.log("Could not fetch profile data:", error);
      }

      // Update stored stats with computed values (keeps them in sync)
      try {
        await updateDoc(userDocRef, {
          stats: computedStats,
          isPublic: data.isPublic ?? true,
        });
      } catch (error) {
        console.log("Could not update stats field:", error);
      }

      // Merge: customers data takes priority, but include profileSongUrl from profiles
      return {
        ...profileData,
        ...data,
        profileSongUrl:
          data.profileSongUrl || (profileData as any).profileSongUrl,
        userId,
        stats: computedStats,
      } as UserData;
    }
    return null;
  }

  // Other user's profile: fetch from both customers and profiles collections
  try {
    const userDocRef = doc(db, "customers", userId);
    const docSnapshot = await getDoc(userDocRef);

    // Also fetch from /profiles to get socialLinks and profileSongUrl
    let profileData = {};
    try {
      const profileRef = doc(db, "profiles", userId);
      const profileSnapshot = await getDoc(profileRef);
      if (profileSnapshot.exists()) {
        profileData = profileSnapshot.data();
      }
    } catch (error) {
      console.log("Could not fetch profile data for other user:", error);
    }

    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      // Merge: customers data takes priority, but include socialLinks and profileSongUrl from profiles
      return {
        ...profileData,
        ...data,
        socialLinks: (profileData as any).socialLinks || data.socialLinks,
        profileSongUrl:
          data.profileSongUrl || (profileData as any).profileSongUrl,
        userId,
        stats: computedStats,
      } as UserData;
    }

    // If no customers doc, try profiles only
    if (Object.keys(profileData).length > 0) {
      return {
        ...profileData,
        // Normalize field names: profiles may use photoURL, customers uses profilePicture
        profilePicture:
          (profileData as any).profilePicture || (profileData as any).photoURL,
        userId,
        stats: computedStats,
      } as UserData;
    }
  } catch (error) {
    console.log(
      "Could not fetch profile from customers, trying profiles:",
      error,
    );

    // Try the public profiles collection as fallback
    try {
      const profileRef = doc(db, "profiles", userId);
      const profileSnapshot = await getDoc(profileRef);

      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.data();
        // Normalize field names: profiles may use photoURL, customers uses profilePicture
        return {
          ...profileData,
          profilePicture: profileData.profilePicture || profileData.photoURL,
          userId,
          stats: computedStats,
        } as UserData;
      }
    } catch (profileError) {
      console.log(
        "Could not fetch from profiles collection either:",
        profileError,
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
  const segments = useSegments();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { track } = usePostHog();
  const currentUserId = useSelector(selectLocalId);

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
  // For other users' profiles, only fetch public posts (required by Firestore rules)
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["userPosts", userId, isOwnProfile],
    queryFn: () => getUserPosts(userId, 50, !isOwnProfile),
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
    router.push(`/home/post/${postId}`);
  };

  const handleProfilePress = (targetUserId: string) => {
    if (targetUserId !== userId) {
      // Navigate within current tab's stack for proper back button
      const currentTab = (segments as string[])[1] || "home";
      router.push(`/${currentTab}/profile/${targetUserId}`);
    }
  };

  const handleMessagePress = async () => {
    if (!currentUserId || isCreatingChat || isOwnProfile) return;

    setIsCreatingChat(true);

    try {
      const chatId = await getOrCreateDmChat(currentUserId, userId);

      // Track analytics
      track("dm_started", {
        peer_id: userId,
        is_new_chat: true,
        source: "profile",
      });

      router.push(`/messages/${chatId}`);
    } catch (error) {
      console.error("Failed to create DM:", error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const isLoading = profileLoading;
  const error = profileError; // Loading state
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
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
        <ProfileHeader
          profile={profile}
          isOwnProfile={false}
          onMessagePress={handleMessagePress}
        />
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
        onMessagePress={!isOwnProfile ? handleMessagePress : undefined}
        onFollowersPress={() => {
          router.push({
            pathname: "/profile/follow-list",
            params: { userId, type: "followers" },
          });
          track("followers_list_viewed", {
            profile_user_id: userId,
            is_own_profile: isOwnProfile,
          });
        }}
        onFollowingPress={() => {
          router.push({
            pathname: "/profile/follow-list",
            params: { userId, type: "following" },
          });
          track("following_list_viewed", {
            profile_user_id: userId,
            is_own_profile: isOwnProfile,
          });
        }}
      />
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (postsLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
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
            tintColor={theme.colors.accent}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Edit Profile Modal (own profile only) */}
      {isOwnProfile && (
        <Modal
          visible={showEditModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleEditClose}
        >
          <View style={styles.modalContainer}>
            <EditProfile
              onProfileUpdated={handleProfileUpdated}
              onCancel={handleEditClose}
              initialData={{
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                phoneNumber: profile.phoneNumber,
                profileSongUrl: profile.profileSongUrl,
                socialLinks: profile.socialLinks,
              }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  listContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgRoot,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.danger,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center" as const,
  },
  privateContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: 60,
  },
  privateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    // paddingHorizontal: 16,
    // paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    paddingTop: 20,
  },
});
