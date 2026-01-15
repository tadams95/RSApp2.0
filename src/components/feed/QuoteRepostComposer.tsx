import { Image } from "expo-image";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePostHog } from "../../analytics/PostHogProvider";
import { useTheme } from "../../contexts/ThemeContext";
import { repostPost } from "../../hooks/usePostInteractions";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { Post } from "../../services/feedService";

// Constants
const MAX_QUOTE_LENGTH = 280;
const MAX_PREVIEW_CONTENT_LENGTH = 200;

export interface QuoteRepostComposerProps {
  visible: boolean;
  post: Post | null; // Original post to quote
  onClose: () => void;
  onQuotePosted: () => void; // Callback to refresh feed
}

/**
 * Quote Repost Composer Modal
 * Allows users to add commentary when reposting
 */
export function QuoteRepostComposer({
  visible,
  post,
  onClose,
  onQuotePosted,
}: QuoteRepostComposerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const posthog = usePostHog();
  const [quoteText, setQuoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate remaining characters
  const remainingChars = MAX_QUOTE_LENGTH - quoteText.length;
  const isOverLimit = remainingChars < 0;

  // Validation: must have some text and not over limit
  const isValid = quoteText.trim().length > 0 && !isOverLimit;

  // Reset form state
  const resetForm = useCallback(() => {
    setQuoteText("");
    setIsSubmitting(false);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (quoteText.trim().length > 0) {
      Alert.alert(
        "Discard Quote?",
        "You have unsaved changes. Are you sure you want to discard?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              posthog.capture("quote_repost_cancelled", {
                post_id: post?.id || "",
              });
              resetForm();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  }, [quoteText, onClose, resetForm, posthog, post?.id]);

  // Handle submission
  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting || !post) return;

    setIsSubmitting(true);

    try {
      await repostPost(post.id, post, quoteText.trim());

      posthog.capture("quote_repost_created", {
        post_id: post.id,
        original_post_id: post.repostOf?.postId || post.id,
        original_author_id: post.userId,
        quote_length: quoteText.trim().length,
      });

      resetForm();
      onQuotePosted();
      onClose();
    } catch (error) {
      console.error("Error creating quote repost:", error);
      Alert.alert(
        "Quote Repost Failed",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    isSubmitting,
    post,
    quoteText,
    resetForm,
    onQuotePosted,
    onClose,
    posthog,
  ]);

  // Track composer open
  React.useEffect(() => {
    if (visible && post) {
      posthog.capture("quote_repost_composer_opened", {
        post_id: post.id,
        original_author_id: post.userId,
      });
    }
  }, [visible, post, posthog]);

  // Truncate preview content
  const getPreviewContent = () => {
    if (!post?.content) return "";
    if (post.content.length <= MAX_PREVIEW_CONTENT_LENGTH) {
      return post.content;
    }
    return post.content.substring(0, MAX_PREVIEW_CONTENT_LENGTH) + "...";
  };

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Quote</Text>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                styles.postButton,
                (!isValid || isSubmitting) && styles.postButtonDisabled,
              ]}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textPrimary}
                />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder="Add your thoughts..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              maxLength={MAX_QUOTE_LENGTH + 20}
              value={quoteText}
              onChangeText={setQuoteText}
              autoFocus
              autoCapitalize="sentences"
            />

            {/* Embedded Post Preview - Bordered card style */}
            <View style={styles.embeddedPreview}>
              {/* Author line: name @username */}
              <Text style={styles.previewAuthorLine} numberOfLines={1}>
                <Text style={styles.previewAuthorName}>
                  {post.userDisplayName || "User"}
                </Text>
                {post.usernameLower && (
                  <Text style={styles.previewAuthorUsername}>
                    {" "}
                    @{post.usernameLower}
                  </Text>
                )}
              </Text>

              {/* Original Post Content */}
              {post.content ? (
                <Text style={styles.previewContent} numberOfLines={3}>
                  {getPreviewContent()}
                </Text>
              ) : null}

              {/* Media thumbnail */}
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <View style={styles.previewMediaContainer}>
                  <Image
                    source={{
                      uri: post.optimizedMediaUrls?.[0] || post.mediaUrls[0],
                    }}
                    style={styles.previewMedia}
                    contentFit="cover"
                  />
                  {post.mediaUrls.length > 1 && (
                    <View style={styles.mediaCountBadge}>
                      <Text style={styles.mediaCountText}>
                        +{post.mediaUrls.length - 1}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer with character count */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
            <Text
              style={[
                styles.charCounter,
                isOverLimit && styles.charCounterError,
              ]}
            >
              {remainingChars}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  keyboardView: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSubtle,
  },
  headerButton: {
    minWidth: 70,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  postButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center" as const,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  textInput: {
    fontSize: 17,
    color: theme.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top" as const,
    marginBottom: 16,
  },
  embeddedPreview: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 12,
    padding: 12,
  },
  previewAuthorLine: {
    marginBottom: 4,
  },
  previewAuthorName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  previewAuthorUsername: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewContent: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  previewMediaContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  previewMedia: {
    width: "100%" as const,
    height: 120,
    borderRadius: 8,
  },
  mediaCountBadge: {
    position: "absolute" as const,
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mediaCountText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#fff",
  },
  footer: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSubtle,
  },
  charCounter: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  charCounterError: {
    color: "#ff4444",
    fontWeight: "600" as const,
  },
});
