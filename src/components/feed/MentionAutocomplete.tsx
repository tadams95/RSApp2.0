import NetInfo from "@react-native-community/netinfo";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { useUserSearch } from "../../hooks/useUserSearch";
import { MentionUser, MentionUserRow } from "./MentionUserRow";

export interface MentionAutocompleteProps {
  /** Current search query (text after @) */
  query: string;
  /** Whether the dropdown should be visible */
  visible: boolean;
  /** Called when user selects a mention */
  onSelect: (user: MentionUser) => void;
  /** Called when dropdown should close */
  onDismiss: () => void;
  /** Maximum height of the dropdown */
  maxHeight?: number;
}

/**
 * MentionAutocomplete - Dropdown for selecting users to mention
 *
 * Displays a list of user suggestions based on the current query.
 * Shows loading, empty, and error states appropriately.
 *
 * @example
 * ```tsx
 * <MentionAutocomplete
 *   query={mentionQuery}
 *   visible={showAutocomplete}
 *   onSelect={(user) => {
 *     const newText = insertMention(content, user.username);
 *     setContent(newText);
 *   }}
 *   onDismiss={clearMention}
 * />
 * ```
 */
export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = memo(
  ({ query, visible, onSelect, onDismiss, maxHeight = 200 }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { results, isLoading, error, search, clear } = useUserSearch(300);
    const [isOffline, setIsOffline] = useState(false);

    // Monitor network connectivity
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener((state) => {
        setIsOffline(!state.isConnected);
      });
      return () => unsubscribe();
    }, []);

    // Announce results to screen readers
    useEffect(() => {
      if (visible && results.length > 0) {
        AccessibilityInfo.announceForAccessibility(
          `${results.length} user${results.length === 1 ? "" : "s"} found`
        );
      } else if (visible && !isLoading && query && results.length === 0) {
        AccessibilityInfo.announceForAccessibility("No users found");
      }
    }, [visible, results.length, isLoading, query]);

    // Search when query changes
    useEffect(() => {
      if (visible && query !== undefined) {
        search(query);
      } else {
        clear();
      }
    }, [query, visible, search, clear]);

    // Handle user selection
    const handleSelect = useCallback(
      (user: MentionUser) => {
        onSelect(user);
      },
      [onSelect]
    );

    // Render a single user row
    const renderItem = useCallback(
      ({ item }: { item: MentionUser }) => (
        <MentionUserRow user={item} onPress={() => handleSelect(item)} />
      ),
      [handleSelect]
    );

    // Key extractor for FlatList
    const keyExtractor = useCallback((item: MentionUser) => item.uid, []);

    // Don't render if not visible
    if (!visible) {
      return null;
    }

    // Render loading state
    const renderLoading = () => (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.stateText}>Searching users...</Text>
      </View>
    );

    // Render empty state
    const renderEmpty = () => {
      // Don't show empty state while loading or for empty query
      if (isLoading || !query) {
        return null;
      }

      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>No users found for "@{query}"</Text>
        </View>
      );
    };

    // Render error state
    const renderError = () => (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>Couldn't search users</Text>
        <TouchableOpacity
          onPress={() => search(query)}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Retry search"
        >
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );

    // Render offline state
    const renderOffline = () => (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>You're offline</Text>
        <Text style={styles.offlineHint}>Connect to search for users</Text>
      </View>
    );

    return (
      <View
        style={[styles.container, { maxHeight }]}
        accessibilityRole="menu"
        accessibilityLabel="User mention suggestions"
      >
        {/* Header showing current search */}
        <View style={styles.header}>
          <Text style={styles.headerText}>@{query || "..."}</Text>
        </View>

        {/* Content */}
        {isOffline ? (
          renderOffline()
        ) : error ? (
          renderError()
        ) : isLoading && results.length === 0 ? (
          renderLoading()
        ) : results.length === 0 ? (
          renderEmpty()
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            accessibilityRole="list"
          />
        )}
      </View>
    );
  }
);

MentionAutocomplete.displayName = "MentionAutocomplete";

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: "hidden" as const,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgElev2,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: theme.colors.textSecondary,
  },
  stateContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center" as const,
  },
  stateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    textAlign: "center" as const,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: "center" as const,
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: "500" as const,
  },
  offlineHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center" as const,
  },
});

export default MentionAutocomplete;
