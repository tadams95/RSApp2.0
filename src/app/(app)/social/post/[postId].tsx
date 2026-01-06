import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlobalStyles } from "../../../../constants/styles";

/**
 * Single Post View Screen
 * Displays a post with its comments
 * TODO: Implement full functionality in Phase 1.2
 */
export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TODO: Fetch post data using postId
  // TODO: Fetch comments for this post
  // TODO: Implement comment submission

  return (
    <>
      <Stack.Screen
        options={{
          title: "Post",
          headerShown: true,
        }}
      />
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {/* Placeholder content - will be replaced with PostCard and comments */}
          <View style={styles.placeholder}>
            <MaterialCommunityIcons
              name="post-outline"
              size={48}
              color={GlobalStyles.colors.grey5}
            />
            <Text style={styles.placeholderTitle}>Post View</Text>
            <Text style={styles.placeholderText}>
              Post ID: {postId || "Unknown"}
            </Text>
            <Text style={styles.comingSoon}>
              Full post view with comments coming soon
            </Text>
          </View>
        </ScrollView>

        {/* Comment Input - Fixed at bottom */}
        <View style={styles.commentInputContainer}>
          <View style={styles.commentInputPlaceholder}>
            <Text style={styles.commentInputText}>Add a comment...</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    marginBottom: 4,
  },
  comingSoon: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
    marginTop: 16,
  },
  commentInputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GlobalStyles.colors.grey8,
    padding: 12,
  },
  commentInputPlaceholder: {
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentInputText: {
    color: GlobalStyles.colors.grey5,
    fontSize: 15,
  },
});
