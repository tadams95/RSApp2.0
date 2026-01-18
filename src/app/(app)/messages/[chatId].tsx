import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { usePostHog } from "../../../analytics/PostHogProvider";
import { ChatInput, MessageBubble } from "../../../components/chat";
import { ImageWithFallback } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { useChat } from "../../../hooks/useChat";
import { useChatList } from "../../../hooks/useChatList";
import { selectLocalId } from "../../../store/redux/userSlice";
import type { Theme } from "../../../constants/themes";
import type { Message } from "../../../types/chat";

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const segments = useSegments();
  const listRef = useRef<FlashList<Message>>(null);
  const { track } = usePostHog();

  const userId = useSelector(selectLocalId);
  const { chats } = useChatList();
  const { messages, isLoading, isSending, sendMessage, loadMore, hasMore, isLoadingMore } = useChat(
    chatId || "",
  );

  // Find current chat info from chat list
  const chatInfo = useMemo(() => {
    return chats.find((chat) => chat.chatId === chatId);
  }, [chats, chatId]);

  const isDm = chatInfo?.type === "dm";
  const headerTitle = isDm
    ? chatInfo?.peerName || "Chat"
    : chatInfo?.eventName || "Event Chat";

  const handleSend = async (text: string) => {
    await sendMessage(text);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleBack = () => {
    router.back();
  };

  const handleHeaderPress = () => {
    if (isDm && chatInfo?.peerId) {
      // Track analytics
      track("dm_profile_viewed", {
        peer_id: chatInfo.peerId,
        from_chat: true,
      });
      // Navigate to peer's profile within current tab stack
      const currentTab = (segments as string[])[1] || "messages";
      router.push(`/${currentTab}/profile/${chatInfo.peerId}`);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} isOwn={item.senderId === userId} />
  );

  const renderHeader = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={theme.colors.textTertiary} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>

        {/* Tappable header content for DMs */}
        <TouchableOpacity
          style={styles.headerContent}
          onPress={handleHeaderPress}
          disabled={!isDm}
          activeOpacity={isDm ? 0.7 : 1}
        >
          {isDm && chatInfo?.peerPhoto && (
            <ImageWithFallback
              source={{ uri: chatInfo.peerPhoto }}
              fallbackSource={require("../../../assets/user.png")}
              style={styles.headerAvatar}
              resizeMode="cover"
            />
          )}
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {isDm && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.textTertiary}
              style={styles.headerChevron}
            />
          )}
        </TouchableOpacity>

        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          estimatedItemSize={60}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          ListHeaderComponent={renderHeader}
          onStartReached={handleLoadMore}
          onStartReachedThreshold={0.1}
          onContentSizeChange={() => {
            if (!isLoadingMore) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isSending={isSending}
        style={{ paddingBottom: insets.bottom || 8 }}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgElev1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  headerChevron: {
    marginLeft: 4,
  },
  headerSpacer: {
    width: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  messagesContent: {
    padding: 16,
  },
  loadingMore: {
    paddingVertical: 12,
    alignItems: "center" as const,
  },
});
