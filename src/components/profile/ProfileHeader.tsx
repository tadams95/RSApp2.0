import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { UserData } from "../../utils/auth";
import { ImageWithFallback } from "../ui";
import FollowButton from "./FollowButton";
import ProfileSongCard from "./ProfileSongCard";
import SocialLinksRow from "./SocialLinksRow";

interface ProfileHeaderProps {
  profile: UserData | null;
  isOwnProfile: boolean;
  onEditPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  onEditPress,
  onFollowersPress,
  onFollowingPress,
  onFollowChange,
}: ProfileHeaderProps) {
  const displayName = profile?.displayName || "User";
  const username = profile?.username ? `@${profile.username}` : null;
  const bio = profile?.bio || null;
  const location =
    profile?.location?.city && profile?.location?.state
      ? `${profile.location.city}, ${profile.location.state}`
      : null;

  const getVerificationBadge = () => {
    // Check both isVerified (boolean) and verificationStatus (string) for compatibility
    if (
      profile?.isVerified === true ||
      profile?.verificationStatus === "verified"
    ) {
      return (
        <MaterialCommunityIcons
          name="check-decagram"
          size={18}
          color={GlobalStyles.colors.redVivid5}
          style={styles.verifiedBadge}
        />
      );
    }
    if (profile?.verificationStatus === "artist") {
      return (
        <MaterialCommunityIcons
          name="star-circle"
          size={18}
          color={GlobalStyles.colors.yellow}
          style={styles.verifiedBadge}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Top Section: Avatar + Name/Username/Bio/Location */}
      <View style={styles.topSection}>
        {/* Profile Picture */}
        <View style={styles.avatarContainer}>
          <ImageWithFallback
            source={
              profile?.profilePicture
                ? { uri: profile.profilePicture }
                : require("../../assets/user.png")
            }
            fallbackSource={require("../../assets/user.png")}
            style={styles.avatar}
            resizeMode="cover"
          />
        </View>

        {/* Info beside avatar */}
        <View style={styles.infoSection}>
          {/* Name and Username */}
          <View style={styles.nameContainer}>
            <View style={styles.displayNameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              {getVerificationBadge()}
            </View>
            {username && <Text style={styles.username}>{username}</Text>}
          </View>

          {/* Bio */}
          {bio && <Text style={styles.bio}>{bio}</Text>}

          {/* Location */}
          {location && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={14}
                color={GlobalStyles.colors.grey4}
              />
              <Text style={styles.location}>{location}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Profile Song Section - Personal expression/vibe */}
      {profile?.profileSongUrl && (
        <View style={styles.songSection}>
          <ProfileSongCard songUrl={profile.profileSongUrl} />
        </View>
      )}

      {/* Stats Row - Full Width */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          onPress={onFollowingPress}
          activeOpacity={0.7}
          style={styles.statItem}
        >
          <Text style={styles.statsNumber}>
            {profile?.stats?.followingCount ?? 0}
          </Text>
          <Text style={styles.statsLabel}>Following</Text>
        </TouchableOpacity>
        <View style={styles.statsDivider} />
        <TouchableOpacity
          onPress={onFollowersPress}
          activeOpacity={0.7}
          style={styles.statItem}
        >
          <Text style={styles.statsNumber}>
            {profile?.stats?.followersCount ?? 0}
          </Text>
          <Text style={styles.statsLabel}>Followers</Text>
        </TouchableOpacity>
      </View>

      {/* Action Row - Edit Profile OR Follow Button */}
      <View style={styles.actionRow}>
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEditPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color="#fff"
              style={styles.editIcon}
            />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          profile?.userId && (
            <View style={styles.followButtonContainer}>
              <FollowButton
                targetUserId={profile.userId}
                onFollowChange={onFollowChange}
              />
            </View>
          )
        )}
      </View>

      {/* Social Links Row - Full Width, Centered */}
      {profile?.socialLinks && (
        <View style={styles.socialLinksContainer}>
          <SocialLinksRow
            socialLinks={profile.socialLinks}
            userId={profile.userId}
            isOwnProfile={isOwnProfile}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  topSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GlobalStyles.colors.grey8,
  },
  infoSection: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  nameContainer: {
    marginBottom: 2,
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  verifiedBadge: {
    marginLeft: 6,
  },
  username: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    marginTop: 1,
  },
  bio: {
    fontSize: 13,
    color: GlobalStyles.colors.grey3,
    marginTop: 6,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  location: {
    fontSize: 12,
    color: GlobalStyles.colors.grey4,
    marginLeft: 4,
  },
  // Stats Row Styles
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 10,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  statsNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statsLabel: {
    fontSize: 12,
    color: GlobalStyles.colors.grey4,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: GlobalStyles.colors.grey7,
  },
  // Action Row Styles
  actionRow: {
    marginTop: 12,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey6,
    backgroundColor: "transparent",
  },
  editIcon: {
    marginRight: 6,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  followButtonContainer: {
    width: "100%",
  },
  // Social Links Styles
  socialLinksContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  // Song Section
  songSection: {
    marginTop: 14,
  },
});
