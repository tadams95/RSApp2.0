import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

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
          color={theme.colors.accent}
          style={styles.badge}
        />
      );
    }
    if (user.verificationStatus === "artist") {
      return (
        <MaterialCommunityIcons
          name="star-circle"
          size={14}
          color={theme.colors.warning}
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

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.bgRoot,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  displayName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  badge: {
    marginLeft: 4,
  },
  username: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  followButtonContainer: {
    marginLeft: "auto" as const,
  },
});
