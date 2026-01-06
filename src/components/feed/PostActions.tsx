import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";

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
          color={
            isLiked ? GlobalStyles.colors.redVivid5 : GlobalStyles.colors.grey4
          }
        />
        <Text
          style={[
            styles.actionText,
            isLiked && { color: GlobalStyles.colors.redVivid5 },
          ]}
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
          color={GlobalStyles.colors.grey4}
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
          color={isReposted ? "#19c37d" : GlobalStyles.colors.grey4}
        />
        <Text style={[styles.actionText, isReposted && { color: "#19c37d" }]}>
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
          color={GlobalStyles.colors.grey4}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 4,
    maxWidth: "90%",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 50,
  },
  actionText: {
    fontSize: 13,
    color: GlobalStyles.colors.grey4,
    fontWeight: "500",
  },
});
