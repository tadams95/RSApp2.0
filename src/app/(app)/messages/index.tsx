import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatListItem, EmptyChat } from "../../../components/chat";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { useChatList } from "../../../hooks/useChatList";
import type { Theme } from "../../../constants/themes";
import type { ChatSummary } from "../../../types/chat";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { chats, isLoading, error } = useChatList();

  const handleChatPress = (chat: ChatSummary) => {
    router.push(`/messages/${chat.chatId}`);
  };

  const handleNewChat = () => {
    router.push("/messages/new");
  };

  const handleBack = () => {
    router.back();
  };

  const renderItem = ({ item }: { item: ChatSummary }) => (
    <ChatListItem chat={item} onPress={() => handleChatPress(item)} />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
          <Ionicons
            name="create-outline"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load messages</Text>
        </View>
      ) : chats.length === 0 ? (
        <EmptyChat onNewChat={handleNewChat} />
      ) : (
        <FlashList
          data={chats}
          renderItem={renderItem}
          estimatedItemSize={72}
          keyExtractor={(item) => item.chatId}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
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
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  newChatButton: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
});
