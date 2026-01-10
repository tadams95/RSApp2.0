import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePostHog } from "../../../../analytics/PostHogProvider";
import {
  CommentInput,
  CommentsList,
  PostCard,
} from "../../../../components/feed";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useComments } from "../../../../hooks/useComments";
import { likePost, unlikePost } from "../../../../hooks/usePostInteractions";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";
import { getPostById, Post } from "../../../../services/feedService";

/**
 * Single Post View Screen
 * Displays a post with its comments
 */
export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();

  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Post state
  const [post, setPost] = useState<Post | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [postError, setPostError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Comments
  const {
    comments,
    isLoading: isLoadingComments,
    addNewComment,
    removeComment,
    isSubmitting,
  } = useComments(postId || "");

  // Fetch post data
  const fetchPost = useCallback(async () => {
    if (!postId) return;

    try {
      setIsLoadingPost(true);
      setPostError(null);
      const fetchedPost = await getPostById(postId);

      if (fetchedPost) {
        setPost(fetchedPost);
        setLikeCount(fetchedPost.likeCount || 0);
      } else {
        setPostError(new Error("Post not found"));
      }
    } catch (error) {
      setPostError(error as Error);
    } finally {
      setIsLoadingPost(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Track screen view
  useEffect(() => {
    if (postId && post) {
      posthog.screen("Post Detail", {
        post_id: postId,
        author_id: post.userId,
        has_media: (post.mediaUrls?.length || 0) > 0,
        comment_count: post.commentCount || 0,
      });
    }
  }, [postId, post, posthog]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPost();
    setRefreshing(false);
  }, [fetchPost]);

  // Handle like with optimistic update
  const handleLike = useCallback(async () => {
    if (!postId) return;

    const wasLiked = isLiked;
    const previousCount = likeCount;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount(wasLiked ? previousCount - 1 : previousCount + 1);

    try {
      if (wasLiked) {
        await unlikePost(postId);
        posthog.capture("post_unliked", { post_id: postId });
      } else {
        await likePost(postId);
        posthog.capture("post_liked", {
          post_id: postId,
          author_id: post?.userId ?? null,
        });
      }
    } catch (error) {
      // Rollback on error
      setIsLiked(wasLiked);
      setLikeCount(previousCount);
    }
  }, [postId, isLiked, likeCount, post, posthog]);

  // Handle comment submission
  const handleSubmitComment = useCallback(
    async (content: string) => {
      await addNewComment(content);
      posthog.capture("comment_created", {
        post_id: postId,
        content_length: content.length,
      });
    },
    [addNewComment, postId, posthog]
  );

  // Handle comment deletion
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await removeComment(commentId);
      posthog.capture("comment_deleted", {
        post_id: postId,
        comment_id: commentId,
      });
    },
    [removeComment, postId, posthog]
  );

  // Navigate to user profile
  const handleProfilePress = useCallback(
    (userId: string) => {
      router.push(`/profile/${userId}`);
    },
    [router]
  );

  // Handle @mention tap - lookup userId from username and navigate to profile
  const handleMentionPress = useCallback(
    async (username: string) => {
      try {
        const db = getFirestore();
        const usernameDoc = await getDoc(
          doc(db, "usernames", username.toLowerCase())
        );

        if (usernameDoc.exists()) {
          const data = usernameDoc.data();
          const userId = data.uid || data.userId || data.oderId;

          if (userId) {
            posthog.capture("mention_tapped", {
              username,
              user_id: userId,
              source: "post_detail",
            });
            router.push(`/profile/${userId}`);
            return;
          }
        }

        Alert.alert("User Not Found", `@${username} doesn't exist.`);
      } catch (error) {
        console.error("Error looking up username:", error);
        Alert.alert("Error", "Could not find user profile.");
      }
    },
    [router, posthog]
  );

  // Navigate to comment (shows post)
  const handleCommentPress = useCallback(() => {
    // Already on post detail, no-op or scroll to comments
  }, []);

  // Loading state
  if (isLoadingPost) {
    return (
      <>
        <Stack.Screen options={{ title: "Post", headerShown: true }} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </>
    );
  }

  // Error state
  if (postError || !post) {
    return (
      <>
        <Stack.Screen options={{ title: "Post", headerShown: true }} />
        <View style={[styles.container, styles.centered]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.errorTitle}>Post not found</Text>
          <Text style={styles.errorText}>
            This post may have been deleted or is no longer available.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Post",
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.bgRoot },
          headerTintColor: theme.colors.textPrimary,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
        >
          {/* Post Card */}
          <PostCard
            post={{ ...post, likeCount }}
            isLiked={isLiked}
            onPress={() => {}}
            onProfilePress={handleProfilePress}
            onMentionPress={handleMentionPress}
            onLike={handleLike}
            onComment={handleCommentPress}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <Text style={styles.commentsHeader}>
              Comments {post.commentCount > 0 && `(${post.commentCount})`}
            </Text>
          </View>

          {/* Comments List */}
          <CommentsList
            comments={comments}
            isLoading={isLoadingComments}
            onDeleteComment={handleDeleteComment}
            onProfilePress={handleProfilePress}
          />
        </ScrollView>

        {/* Comment Input - Fixed at bottom */}
        <View style={{ paddingBottom: insets.bottom }}>
          <CommentInput
            onSubmit={handleSubmitComment}
            isSubmitting={isSubmitting}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (theme: import("../../../../constants/themes").Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  centered: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: "center" as const,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentsHeader: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
