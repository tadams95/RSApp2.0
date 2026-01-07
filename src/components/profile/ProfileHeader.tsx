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
    if (profile?.verificationStatus === "verified") {
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
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: GlobalStyles.colors.grey8,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: GlobalStyles.colors.redVivid5,
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  nameContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontSize: 22,
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
    fontSize: 14,
    color: GlobalStyles.colors.grey2,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  location: {
    fontSize: 13,
    color: GlobalStyles.colors.grey4,
    marginLeft: 4,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey6,
    marginTop: 8,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
