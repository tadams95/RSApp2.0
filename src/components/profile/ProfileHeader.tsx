import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { UserData } from "../../utils/auth";
import { ImageWithFallback } from "../ui";
import ProfileSongCard from "./ProfileSongCard";

const { width: screenWidth } = Dimensions.get("window");

interface ProfileHeaderProps {
  profile: UserData | null;
  isOwnProfile: boolean;
  onEditPress?: () => void;
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  onEditPress,
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
      {/* Top Section: Avatar + Info */}
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
          {isOwnProfile && onEditPress && (
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={onEditPress}
            >
              <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          )}
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

          {/* Edit Profile Button (own profile only) */}
          {isOwnProfile && onEditPress && (
            <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Profile Song Section (full width, below profile info) */}
      {profile?.profileSongUrl && (
        <View style={styles.songSection}>
          <ProfileSongCard songUrl={profile.profileSongUrl} />
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
    alignItems: "stretch",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GlobalStyles.colors.grey8,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: GlobalStyles.colors.redVivid5,
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  infoSection: {
    flex: 1,
    justifyContent: "space-between",
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
    marginTop: 2,
  },
  bio: {
    fontSize: 13,
    color: GlobalStyles.colors.grey3,
    marginTop: 4,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  location: {
    fontSize: 12,
    color: GlobalStyles.colors.grey4,
    marginLeft: 4,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  songSection: {
    marginTop: 14,
  },
});
