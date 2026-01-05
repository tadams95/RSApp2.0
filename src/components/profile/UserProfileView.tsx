import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useScreenTracking } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import { UserData } from "../../utils/auth";
import { EditProfile } from "../modals";
import FollowButton from "./FollowButton";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";

interface UserProfileViewProps {
  userId: string;
  isOwnProfile: boolean;
}

/**
 * Fetch user profile by userId from Firestore
 */
async function fetchUserProfile(userId: string): Promise<UserData | null> {
  const db = getFirestore();
  const userDocRef = doc(db, "customers", userId);
  const docSnapshot = await getDoc(userDocRef);

  if (docSnapshot.exists()) {
    return { ...docSnapshot.data(), userId } as UserData;
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
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleEditPress = () => {
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
  };

  const handleProfileUpdated = () => {
    setShowEditModal(false);
    refetch();
  };

  // Loading state
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={GlobalStyles.colors.redVivid5}
        />
      }
    >
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

      {/* Content sections will be added in later phases */}
      <View style={styles.contentPlaceholder}>
        <Text style={styles.placeholderText}>
          {isOwnProfile
            ? "Your posts will appear here"
            : "Posts will appear here"}
        </Text>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
  contentPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  placeholderText: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
  },
});
