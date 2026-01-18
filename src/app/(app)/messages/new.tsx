import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import { usePostHog } from "../../../analytics/PostHogProvider";
import { ImageWithFallback } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import {
  getExistingDmPeerIds,
  getRecentDmContacts,
  useChatList,
} from "../../../hooks/useChatList";
import { getOrCreateDmChat } from "../../../services/chatService";
import {
  getSuggestedUsers,
  searchUsersByName,
  searchUsersByUsername,
  UserSearchResult,
} from "../../../services/userSearchService";
import { selectLocalId } from "../../../store/redux/userSlice";
import type { Theme } from "../../../constants/themes";
import type { ChatSummary } from "../../../types/chat";

const DEBOUNCE_MS = 300;
const RECENT_LIMIT = 5;

export default function NewMessageScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { track } = usePostHog();

  const userId = useSelector(selectLocalId);
  const { chats } = useChatList();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Suggested users state
  const [suggestedUsers, setSuggestedUsers] = useState<UserSearchResult[]>([]);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(true);

  // Loading state for creating DM
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Filter recent DM contacts from chat list
  const recentDmContacts = useMemo(
    () => getRecentDmContacts(chats, RECENT_LIMIT),
    [chats],
  );

  // Get existing DM peer IDs to exclude from suggested
  const existingDmPeerIds = useMemo(
    () => getExistingDmPeerIds(chats),
    [chats],
  );

  // Load suggested users on mount
  useEffect(() => {
    async function loadSuggested() {
      if (!userId) return;

      try {
        const users = await getSuggestedUsers(userId, 10);
        // Filter out users we already have DMs with
        const filtered = users.filter(
          (user) => !existingDmPeerIds.has(user.userId),
        );
        setSuggestedUsers(filtered);
      } catch (error) {
        console.error("Failed to load suggested users:", error);
      } finally {
        setIsLoadingSuggested(false);
      }
    }

    loadSuggested();

    // Track screen open
    track("dm_screen_opened", { source: "new_button" });
  }, [userId, existingDmPeerIds, track]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const query = searchQuery.trim();
        // Use username search if query starts with @
        const results = query.startsWith("@")
          ? await searchUsersByUsername(query)
          : await searchUsersByName(query);

        // Filter out current user
        const filtered = results.filter((user) => user.userId !== userId);
        setSearchResults(filtered);

        // Track search
        track("dm_search_performed", {
          query: query.substring(0, 20), // Truncate for privacy
          query_length: query.length,
          results_count: filtered.length,
        });
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, userId, track]);

  const handleBack = () => {
    router.back();
  };

  const handleSeeAllRecent = () => {
    // Navigate to main messages list (already shows all chats)
    router.back();
  };

  const handleUserPress = useCallback(
    async (targetUserId: string, isNewChat: boolean, source: string) => {
      if (!userId || isCreatingChat) return;

      setIsCreatingChat(true);

      try {
        const chatId = await getOrCreateDmChat(userId, targetUserId);

        // Track DM started
        track("dm_started", {
          peer_id: targetUserId,
          is_new_chat: isNewChat,
          source,
        });

        router.replace(`/messages/${chatId}`);
      } catch (error) {
        console.error("Failed to create DM:", error);
        setIsCreatingChat(false);
      }
    },
    [userId, isCreatingChat, router, track],
  );

  const handleRecentPress = (chat: ChatSummary) => {
    if (chat.peerId) {
      handleUserPress(chat.peerId, false, "recent");
    }
  };

  const handleSuggestedPress = (user: UserSearchResult) => {
    const isNew = !existingDmPeerIds.has(user.userId);
    handleUserPress(user.userId, isNew, "suggested");
  };

  const handleSearchResultPress = (user: UserSearchResult) => {
    const isNew = !existingDmPeerIds.has(user.userId);
    handleUserPress(user.userId, isNew, "search");
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const getVerificationBadge = (status?: string) => {
    if (status === "verified") {
      return (
        <MaterialCommunityIcons
          name="check-decagram"
          size={14}
          color={theme.colors.accent}
          style={styles.badge}
        />
      );
    }
    if (status === "artist") {
      return (
        <MaterialCommunityIcons
          name="star-circle"
          size={14}
          color={theme.colors.warning}
          style={styles.badge}
        />
      );
    }
    return null;
  };

  // Render recent contact item (horizontal scroll)
  const renderRecentItem = (chat: ChatSummary) => (
    <TouchableOpacity
      key={chat.chatId}
      style={styles.recentItem}
      onPress={() => handleRecentPress(chat)}
      activeOpacity={0.7}
    >
      <ImageWithFallback
        source={
          chat.peerPhoto
            ? { uri: chat.peerPhoto }
            : require("../../../assets/user.png")
        }
        fallbackSource={require("../../../assets/user.png")}
        style={styles.recentAvatar}
        resizeMode="cover"
      />
      <Text style={styles.recentName} numberOfLines={1}>
        {chat.peerName}
      </Text>
    </TouchableOpacity>
  );

  // Render user card (for suggested and search results)
  const renderUserCard = ({
    item,
    onPress,
  }: {
    item: UserSearchResult;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ImageWithFallback
        source={
          item.profilePicture
            ? { uri: item.profilePicture }
            : require("../../../assets/user.png")
        }
        fallbackSource={require("../../../assets/user.png")}
        style={styles.userAvatar}
        resizeMode="cover"
      />
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName}
          </Text>
          {getVerificationBadge(item.verificationStatus)}
        </View>
        {item.username && (
          <Text style={styles.userUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        )}
        {item.bio && (
          <Text style={styles.userBio} numberOfLines={1}>
            {item.bio}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const isShowingSearch = searchQuery.trim().length > 0;

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
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading overlay when creating chat */}
      {isCreatingChat && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      )}

      {/* Content */}
      {isShowingSearch ? (
        // Search Results
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : (
            <FlashList
              data={searchResults}
              renderItem={({ item }) =>
                renderUserCard({
                  item,
                  onPress: () => handleSearchResultPress(item),
                })
              }
              estimatedItemSize={72}
              keyExtractor={(item) => item.userId}
            />
          )}
        </View>
      ) : (
        // Recent + Suggested
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recent Conversations */}
          {recentDmContacts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent</Text>
                <TouchableOpacity onPress={handleSeeAllRecent}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
              >
                {recentDmContacts.map(renderRecentItem)}
              </ScrollView>
            </View>
          )}

          {/* Suggested Users */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested</Text>
            </View>
            {isLoadingSuggested ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textPrimary}
                />
              </View>
            ) : suggestedUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No suggestions available
                </Text>
              </View>
            ) : (
              suggestedUsers.map((user) => (
                <View key={user.userId}>
                  {renderUserCard({
                    item: user,
                    onPress: () => handleSuggestedPress(user),
                  })}
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
    marginLeft: 12,
  },
  headerSpacer: {
    width: 32,
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  searchInputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  clearButton: {
    padding: 4,
  },
  // Loading overlay
  loadingOverlay: {
    ...({
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
    } as const),
  },
  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  searchResultsContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingVertical: 40,
  },
  // Sections
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: "500" as const,
  },
  // Recent items (horizontal)
  recentList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  recentItem: {
    alignItems: "center" as const,
    width: 72,
  },
  recentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  recentName: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: "center" as const,
  },
  // User card (vertical list)
  userCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  badge: {
    marginLeft: 4,
  },
  userUsername: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  userBio: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  // Loading/Empty states
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center" as const,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center" as const,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
});
