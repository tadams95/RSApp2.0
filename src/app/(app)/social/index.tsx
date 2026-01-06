import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "../../../analytics/PostHogProvider";
import { PostCard } from "../../../components/feed";
import { GlobalStyles } from "../../../constants/styles";
import { useFeed } from "../../../hooks/useFeed";
import { likePost, unlikePost } from "../../../hooks/usePostInteractions";
import { Post } from "../../../services/feedService";

export default function SocialFeedScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Single feed - all public posts (like web version)
  const { posts, isLoading, error, refetch, loadMore, hasMore, isLoadingMore } =
    useFeed("forYou");

  // Debug: Log feed state
  useEffect(() => {
    console.log("[Feed Debug] isLoading:", isLoading);
    console.log("[Feed Debug] error:", error?.message);
    console.log("[Feed Debug] posts count:", posts.length);
    if (posts.length > 0) {
      console.log("[Feed Debug] first post:", posts[0].id);
    }
  }, [isLoading, error, posts]);

  // Track screen view
  useScreenTracking("Social Feed", {
    post_count: posts.length,
    has_error: !!error,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLikedPosts(new Set());
    setLikeCounts({});
    refetch();
    setTimeout(() => setRefreshing(false), 500);
  }, [refetch]);

  // Handle like/unlike with optimistic updates
  const handleLike = useCallback(
    async (postId: string) => {
      const currentlyLiked = likedPosts.has(postId);
      const post = posts.find((p) => p.id === postId);
      const currentCount = likeCounts[postId] ?? post?.likeCount ?? 0;

      // Optimistic update
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: currentlyLiked
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      }));

      try {
        if (currentlyLiked) {
          await unlikePost(postId);
        } else {
          await likePost(postId);
        }
      } catch (err) {
        // Rollback on error
        setLikedPosts((prev) => {
          const next = new Set(prev);
          if (currentlyLiked) {
            next.add(postId);
          } else {
            next.delete(postId);
          }
          return next;
        });
        setLikeCounts((prev) => ({
          ...prev,
          [postId]: currentCount,
        }));
        console.error("Failed to toggle like:", err);
      }
    },
    [likedPosts, likeCounts, posts]
  );

  // Load more posts when reaching end
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={GlobalStyles.colors.redVivid5} />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons
          name="message-text-outline"
          size={48}
          color={GlobalStyles.colors.grey5}
        />
      </View>
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptySubtext}>
        Be the first to share something with the RAGESTATE community
      </Text>
      {error && <Text style={styles.errorText}>{error.message}</Text>}
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = likedPosts.has(item.id);
    const displayLikeCount = likeCounts[item.id] ?? item.likeCount;

    return (
      <PostCard
        post={{
          ...item,
          likeCount: displayLikeCount,
        }}
        isLiked={isLiked}
        onPress={() => console.log("Post pressed:", item.id)}
        onProfilePress={(userId) => console.log("Profile pressed:", userId)}
        onLike={handleLike}
        onComment={(postId) => console.log("Comment pressed:", postId)}
        onRepost={(postId) => console.log("Repost pressed:", postId)}
        onShare={(postId) => console.log("Share pressed:", postId)}
        onMore={(postId) => console.log("More options pressed:", postId)}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Simple Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
      </View>

      {/* Feed Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={GlobalStyles.colors.redVivid5}
          />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={posts.length === 0 && styles.emptyList}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GlobalStyles.colors.redVivid5}
              colors={[GlobalStyles.colors.redVivid5]}
            />
          }
        />
      )}

      {/* Floating Compose Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GlobalStyles.colors.grey8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 15,
    color: GlobalStyles.colors.grey4,
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    fontSize: 13,
    color: GlobalStyles.colors.redVivid5,
    textAlign: "center",
    marginTop: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GlobalStyles.colors.redVivid5,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GlobalStyles.colors.redVivid5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
