import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { UserSearchResult } from "../../services/userSearchService";
import { ImageWithFallback } from "../ui";
import FollowButton from "./FollowButton";

interface UserCardProps {
  user: UserSearchResult;
  showFollowButton?: boolean;
  onPress?: () => void;
}

export default function UserCard({
  user,
  showFollowButton = true,
  onPress,
}: UserCardProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/profile/${user.userId}`);
    }
  };

  const getVerificationBadge = () => {
    if (user.verificationStatus === "verified") {
      return (
        <MaterialCommunityIcons
          name="check-decagram"
          size={14}
          color="#1DA1F2"
          style={styles.badge}
        />
      );
    }
    if (user.verificationStatus === "artist") {
      return (
        <MaterialCommunityIcons
          name="star-circle"
          size={14}
          color={GlobalStyles.colors.yellow}
          style={styles.badge}
        />
      );
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <ImageWithFallback
        source={
          user.profilePicture
            ? { uri: user.profilePicture }
            : require("../../assets/user.png")
        }
        fallbackSource={require("../../assets/user.png")}
        style={styles.avatar}
        resizeMode="cover"
      />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.displayName}
          </Text>
          {getVerificationBadge()}
        </View>
        {user.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
        {user.bio && (
          <Text style={styles.bio} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>

      {showFollowButton && (
        <View style={styles.followButtonContainer}>
          <FollowButton targetUserId={user.userId} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  badge: {
    marginLeft: 4,
  },
  username: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    marginTop: 2,
  },
  bio: {
    fontSize: 13,
    color: GlobalStyles.colors.grey5,
    marginTop: 4,
  },
  followButtonContainer: {
    marginLeft: "auto",
  },
});
