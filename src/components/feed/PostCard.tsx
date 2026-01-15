import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Image } from "expo-image";
import { Timestamp } from "firebase/firestore";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { Post } from "../../services/feedService";
import { ImageWithFallback, LinkedText } from "../ui";
import { MediaGrid } from "./MediaGrid";
import { PostActions } from "./PostActions";

// Helper to detect quote reposts
const isQuoteRepost = (post: Post): boolean => {
  return !!(post.repostOf && post.repostOf.originalContent !== undefined);
};

// Verification badge component
const VerifiedBadge = () => {
  const { theme } = useTheme();
  return (
    <MaterialCommunityIcons
      name="check-decagram"
      size={14}
      color={theme.colors.accent}
      style={{ marginLeft: 4 }}
    />
  );
};

interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  isReposted?: boolean;
  onPress?: () => void;
  onProfilePress?: (userId: string) => void;
  onMentionPress?: (username: string) => void;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onMore?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isLiked = false,
  isReposted = false,
  onPress,
  onProfilePress,
  onMentionPress,
  onLike,
  onComment,
  onRepost,
  onShare,
  onMore,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    id,
    userId,
    userDisplayName,
    usernameLower,
    userProfilePicture,
    userVerified,
    content,
    mediaUrls,
    mediaTypes,
    optimizedMediaUrls,
    isProcessing,
    timestamp,
    likeCount,
    commentCount,
    repostCount,
    repostOf,
  } = post;

  // Check if this is a repost
  const isRepostPost = !!repostOf;
  // Check if this is a quote repost (has originalContent in repostOf)
  const isQuoteRepostPost = isQuoteRepost(post);

  // For regular reposts, show original author's info
  // For quote reposts, show quoter's info (the person who quoted)
  const displayName =
    isRepostPost && !isQuoteRepostPost
      ? repostOf.authorName || "User"
      : userDisplayName;
  const displayUsername =
    isRepostPost && !isQuoteRepostPost
      ? repostOf.authorUsername
      : usernameLower;
  const displayPhoto =
    isRepostPost && !isQuoteRepostPost
      ? repostOf.authorPhoto
      : userProfilePicture;
  const displayUserId =
    isRepostPost && !isQuoteRepostPost ? repostOf.authorId : userId;

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
    onProfilePress?.(displayUserId);
  };

  // Navigate to reposter's profile
  const handleReposterPress = () => {
    onProfilePress?.(userId);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Repost indicator header - only for regular reposts, not quote reposts */}
      {isRepostPost && !isQuoteRepostPost && (
        <TouchableOpacity
          style={styles.repostHeader}
          onPress={handleReposterPress}
          hitSlop={{ top: 5, bottom: 5, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="repeat"
            size={14}
            color={theme.colors.textTertiary}
            style={styles.repostIcon}
          />
          <Text style={styles.repostText}>
            {usernameLower ? `@${usernameLower}` : userDisplayName || "User"}{" "}
            reposted
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.postContent}>
        <View style={styles.leftColumn}>
          <TouchableOpacity onPress={handleProfilePress}>
            {displayPhoto ? (
              <ImageWithFallback
                source={{ uri: displayPhoto }}
                style={styles.avatar}
                resizeMode="cover"
                maxRetries={1}
                renderFallback={() => (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {displayName?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {displayName?.charAt(0).toUpperCase() || "?"}
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
              <View style={styles.nameRow}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {displayName}
                </Text>
                {!isRepostPost && userVerified && <VerifiedBadge />}
              </View>
              {displayUsername && (
                <Text style={styles.username} numberOfLines={1}>
                  @{displayUsername}
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
                  color={theme.colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {content ? (
            <LinkedText
              text={content}
              style={styles.content}
              onMentionPress={onMentionPress}
            />
          ) : null}

          {/* Embedded Post Preview (for quote reposts) - Bordered card style */}
          {isQuoteRepostPost && repostOf && (
            <View style={styles.embeddedPreview}>
              {/* Author line: name @username */}
              <Text style={styles.embeddedAuthorLine} numberOfLines={1}>
                <Text style={styles.embeddedAuthorName}>
                  {repostOf.authorName || "User"}
                </Text>
                {repostOf.authorUsername && (
                  <Text style={styles.embeddedAuthorUsername}>
                    {" "}
                    @{repostOf.authorUsername}
                  </Text>
                )}
              </Text>

              {/* Original Post Content */}
              {repostOf.originalContent ? (
                <Text style={styles.embeddedContent} numberOfLines={3}>
                  {repostOf.originalContent}
                </Text>
              ) : null}

              {/* Media thumbnail */}
              {repostOf.originalMediaUrls &&
                repostOf.originalMediaUrls.length > 0 && (
                  <View style={styles.embeddedMediaContainer}>
                    <Image
                      source={{ uri: repostOf.originalMediaUrls[0] }}
                      style={styles.embeddedMedia}
                      contentFit="cover"
                    />
                    {repostOf.originalMediaUrls.length > 1 && (
                      <View style={styles.embeddedMediaBadge}>
                        <Text style={styles.embeddedMediaBadgeText}>
                          +{repostOf.originalMediaUrls.length - 1}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
            </View>
          )}

          {/* Media (for regular posts and regular reposts, not quote reposts) */}
          {!isQuoteRepostPost && mediaUrls && mediaUrls.length > 0 && (
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
            isReposted={isReposted}
            onLikePress={() => onLike?.(id)}
            onCommentPress={() => onComment?.(id)}
            onRepostPress={() => onRepost?.(id)}
            onSharePress={() => onShare?.(id)}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

import { StyleSheet } from "react-native";

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flexDirection: "column" as const,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgRoot,
  },
  repostHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 8,
    marginLeft: 56, // Align with content (avatar width + margin)
  },
  repostIcon: {
    marginRight: 6,
  },
  repostText: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontWeight: "500" as const,
  },
  postContent: {
    flexDirection: "row" as const,
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
    backgroundColor: theme.colors.bgElev2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
  },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: "column" as const,
    flex: 1,
    marginRight: 4,
  },
  nameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  displayName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
  },
  verifiedBadge: {
    marginRight: 4,
  },
  username: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  metaInfo: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  dot: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  moreButton: {
    marginLeft: 8,
  },
  content: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },
  // Embedded preview styles (for quote reposts) - Bordered card style
  embeddedPreview: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  embeddedAuthorLine: {
    marginBottom: 4,
  },
  embeddedAuthorName: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  embeddedAuthorUsername: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  embeddedContent: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 19,
  },
  embeddedMediaContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  embeddedMedia: {
    width: "100%" as const,
    height: 100,
    borderRadius: 8,
  },
  embeddedMediaBadge: {
    position: "absolute" as const,
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  embeddedMediaBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: "#fff",
  },
});
