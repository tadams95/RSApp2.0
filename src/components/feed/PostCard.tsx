import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Timestamp } from "firebase/firestore";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { Post } from "../../services/feedService";
import { ImageWithFallback } from "../ui";
import { MediaGrid } from "./MediaGrid";
import { PostActions } from "./PostActions";

interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  onPress?: () => void;
  onProfilePress?: (userId: string) => void;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onMore?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isLiked = false,
  onPress,
  onProfilePress,
  onLike,
  onComment,
  onRepost,
  onShare,
  onMore,
}) => {
  const {
    id,
    userId,
    userDisplayName,
    usernameLower,
    userProfilePicture,
    content,
    mediaUrls,
    mediaTypes,
    optimizedMediaUrls,
    isProcessing,
    timestamp,
    likeCount,
    commentCount,
    repostCount,
  } = post;

  // Format timestamp
  const getTimeAgo = () => {
    if (!timestamp) return "";

    // Handle both Firestore Timestamp and regular Date objects
    const date =
      timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

    return formatDistanceToNowStrict(date, { addSuffix: false })
      .replace(" seconds", "s")
      .replace(" second", "s")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" months", "mo")
      .replace(" month", "mo")
      .replace(" years", "y")
      .replace(" year", "y");
  };

  const handleProfilePress = () => {
    onProfilePress?.(userId);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.leftColumn}>
        <TouchableOpacity onPress={handleProfilePress}>
          {userProfilePicture ? (
            <ImageWithFallback
              source={{ uri: userProfilePicture }}
              style={styles.avatar}
              resizeMode="cover"
              maxRetries={1}
              renderFallback={() => (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {userDisplayName?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {userDisplayName?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.rightColumn}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={handleProfilePress}
            hitSlop={{ top: 5, bottom: 5, left: 0, right: 0 }}
          >
            <Text style={styles.displayName} numberOfLines={1}>
              {userDisplayName}
            </Text>
            {usernameLower && (
              <Text style={styles.username} numberOfLines={1}>
                @{usernameLower}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.metaInfo}>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timestamp}>{getTimeAgo()}</Text>
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => onMore?.(id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={GlobalStyles.colors.grey5}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {content ? <Text style={styles.content}>{content}</Text> : null}

        {/* Media */}
        {mediaUrls && mediaUrls.length > 0 && (
          <MediaGrid
            mediaUrls={mediaUrls}
            mediaTypes={mediaTypes || []}
            optimizedMediaUrls={optimizedMediaUrls}
            isProcessing={isProcessing}
          />
        )}

        {/* Actions */}
        <PostActions
          likeCount={likeCount || 0}
          commentCount={commentCount || 0}
          repostCount={repostCount || 0}
          isLiked={isLiked}
          onLikePress={() => onLike?.(id)}
          onCommentPress={() => onComment?.(id)}
          onRepostPress={() => onRepost?.(id)}
          onSharePress={() => onShare?.(id)}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.grey8,
    backgroundColor: "#000",
  },
  leftColumn: {
    marginRight: 12,
  },
  rightColumn: {
    flex: 1,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GlobalStyles.colors.grey7,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 4,
  },
  displayName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginRight: 4,
  },
  verifiedBadge: {
    marginRight: 4,
  },
  username: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    flexShrink: 1,
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
  },
  moreButton: {
    marginLeft: 8,
  },
  content: {
    fontSize: 15,
    color: "#fff",
    lineHeight: 22,
    marginBottom: 8,
  },
});
