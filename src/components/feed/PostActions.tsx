import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface PostActionsProps {
  likeCount: number;
  commentCount: number;
  repostCount: number;
  isLiked?: boolean;
  isReposted?: boolean;
  onLikePress: () => void;
  onCommentPress: () => void;
  onRepostPress: () => void;
  onSharePress?: () => void;
}

export const PostActions: React.FC<PostActionsProps> = ({
  likeCount,
  commentCount,
  repostCount,
  isLiked = false,
  isReposted = false,
  onLikePress,
  onCommentPress,
  onRepostPress,
  onSharePress,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + "M";
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count > 0 ? count.toString() : "";
  };

  return (
    <View style={styles.container}>
      {/* Like Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onLikePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={isLiked ? "heart" : "heart-outline"}
          size={20}
          color={isLiked ? theme.colors.accent : theme.colors.textSecondary}
        />
        <Text
          style={[styles.actionText, isLiked && { color: theme.colors.accent }]}
        >
          {formatCount(likeCount)}
        </Text>
      </TouchableOpacity>

      {/* Comment Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onCommentPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="comment-outline"
          size={20}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.actionText}>{formatCount(commentCount)}</Text>
      </TouchableOpacity>

      {/* Repost Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onRepostPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="repeat"
          size={22}
          color={isReposted ? theme.colors.success : theme.colors.textSecondary}
        />
        <Text
          style={[
            styles.actionText,
            isReposted && { color: theme.colors.success },
          ]}
        >
          {formatCount(repostCount)}
        </Text>
      </TouchableOpacity>

      {/* Share Button - Optional */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onSharePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="share-variant-outline"
          size={20}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingTop: 12,
    marginTop: 4,
    maxWidth: "90%" as const,
  },
  actionButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    minWidth: 50,
  },
  actionText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "500" as const,
  },
});
