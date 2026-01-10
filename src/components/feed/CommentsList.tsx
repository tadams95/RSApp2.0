import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Timestamp } from "firebase/firestore";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { auth } from "../../firebase/firebase";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { Comment } from "../../services/commentService";
import { ImageWithFallback } from "../ui";

// Verification badge component
const VerifiedBadge = () => {
  const { theme } = useTheme();
  return (
    <MaterialCommunityIcons
      name="check-decagram"
      size={12}
      color={theme.colors.accent}
      style={{ marginLeft: 4 }}
    />
  );
};

interface CommentsListProps {
  comments: Comment[];
  isLoading: boolean;
  onDeleteComment?: (commentId: string) => void;
  onProfilePress?: (userId: string) => void;
}

const CommentItem: React.FC<{
  comment: Comment;
  onDelete?: (commentId: string) => void;
  onProfilePress?: (userId: string) => void;
}> = ({ comment, onDelete, onProfilePress }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const currentUserId = auth.currentUser?.uid;
  const isOwnComment = currentUserId === comment.userId;

  const getTimeAgo = () => {
    if (!comment.createdAt) return "";
    const date =
      comment.createdAt instanceof Timestamp
        ? comment.createdAt.toDate()
        : new Date(comment.createdAt);

    return formatDistanceToNowStrict(date, { addSuffix: false })
      .replace(" seconds", "s")
      .replace(" second", "s")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d");
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete?.(comment.id),
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.commentContainer}>
      <TouchableOpacity
        onPress={() => onProfilePress?.(comment.userId)}
        activeOpacity={0.7}
      >
        {comment.userProfilePicture ? (
          <ImageWithFallback
            source={{ uri: comment.userProfilePicture }}
            fallbackSource={require("../../assets/user.png")}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {getInitials(comment.userDisplayName || "?")}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <TouchableOpacity
            onPress={() => onProfilePress?.(comment.userId)}
            style={styles.nameRow}
          >
            <Text style={styles.userName}>
              {comment.userDisplayName || "User"}
            </Text>
            {comment.userVerified && <VerifiedBadge />}
          </TouchableOpacity>
          <Text style={styles.timestamp}>{getTimeAgo()}</Text>
        </View>

        <Text style={styles.commentText}>{comment.content}</Text>
      </View>

      {isOwnComment && (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={16}
            color={theme.colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export const CommentsList: React.FC<CommentsListProps> = ({
  comments,
  isLoading,
  onDeleteComment,
  onProfilePress,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        onDelete={onDeleteComment}
        onProfilePress={onProfilePress}
      />
    ),
    [onDeleteComment, onProfilePress]
  );

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.textTertiary} />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="comment-outline"
          size={32}
          color={theme.colors.textTertiary}
        />
        <Text style={styles.emptyText}>No comments yet</Text>
        <Text style={styles.emptySubtext}>Be the first to comment</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={comments}
      renderItem={renderComment}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      scrollEnabled={false} // Disable scroll since parent ScrollView handles it
    />
  );
};

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center" as const,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center" as const,
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500" as const,
  },
  emptySubtext: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 4,
  },
  commentContainer: {
    flexDirection: "row" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.borderSubtle,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitials: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  nameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  timestamp: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginLeft: 8,
  },
  commentText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
