import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import {
  searchUsersByUsername,
  UserSearchResult,
} from "../../services/userSearchService";
import { ImageWithFallback } from "../ui";

// ============================================
// Types
// ============================================

export interface UsernameTransferFormProps {
  /** Ticket ID being transferred */
  ticketId: string;
  /** Event ID for the ticket */
  eventId: string;
  /** Event name for display */
  eventName: string;
  /** Callback when a user is selected for transfer */
  onUserSelected: (user: UserSearchResult) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Hide internal header when parent component provides one */
  hideHeader?: boolean;
}

// ============================================
// Constants
// ============================================

const DEBOUNCE_DELAY = 300; // ms
const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 10;
const USERNAME_REGEX = /^@?[a-zA-Z0-9_]{0,20}$/;

// ============================================
// Helper Components
// ============================================

interface UserResultItemProps {
  user: UserSearchResult;
  onSelect: (user: UserSearchResult) => void;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

function UserResultItem({
  user,
  onSelect,
  theme,
  styles,
}: UserResultItemProps) {
  const getVerificationBadge = () => {
    if (user.verificationStatus === "verified") {
      return (
        <MaterialCommunityIcons
          name="check-decagram"
          size={14}
          color="#1DA1F2"
          style={styles.badge}
        />
      );
    }
    if (user.verificationStatus === "artist") {
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

  return (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onSelect(user)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Select ${user.displayName}`}
    >
      <ImageWithFallback
        source={
          user.profilePicture
            ? { uri: user.profilePicture }
            : require("../../assets/user.png")
        }
        fallbackSource={require("../../assets/user.png")}
        style={styles.resultAvatar}
        resizeMode="cover"
      />
      <View style={styles.resultInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.resultName} numberOfLines={1}>
            {user.displayName}
          </Text>
          {getVerificationBadge()}
        </View>
        {user.username && (
          <Text style={styles.resultUsername} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

// ============================================
// UsernameTransferForm Component
// ============================================

export default function UsernameTransferForm({
  ticketId,
  eventId,
  eventName,
  onUserSelected,
  onCancel,
  hideHeader = false,
}: UsernameTransferFormProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Validate username format
   */
  const validateUsername = (username: string): boolean => {
    const cleanUsername = username.replace(/^@/, "");
    if (cleanUsername.length < MIN_SEARCH_LENGTH) {
      return false;
    }
    return USERNAME_REGEX.test(username);
  };

  /**
   * Perform the search with debouncing
   */
  const performSearch = useCallback(
    async (term: string) => {
      const cleanTerm = term.replace(/^@/, "").trim();

      if (cleanTerm.length < MIN_SEARCH_LENGTH) {
        setResults([]);
        setHasSearched(false);
        setError(null);
        return;
      }

      if (!validateUsername(term)) {
        setError("Invalid username format");
        setResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchResults = await searchUsersByUsername(
          cleanTerm,
          MAX_RESULTS,
        );
        setResults(searchResults);
        setHasSearched(true);

        // Track search analytics
        posthog?.capture("transfer_recipient_searched", {
          search_term: cleanTerm,
          results_count: searchResults.length,
          method: "username",
          event_id: eventId,
          ticket_id: ticketId,
        });
      } catch (err) {
        console.error("Username search error:", err);
        setError("Failed to search users. Please try again.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [eventId, ticketId, posthog],
  );

  /**
   * Handle text input change with debouncing
   */
  const handleSearchChange = (text: string) => {
    // Ensure @ prefix
    let formattedText = text;
    if (!text.startsWith("@") && text.length > 0) {
      formattedText = "@" + text;
    }

    setSearchTerm(formattedText);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      performSearch(formattedText);
    }, DEBOUNCE_DELAY);
  };

  /**
   * Handle user selection
   */
  const handleUserSelect = (user: UserSearchResult) => {
    Keyboard.dismiss();

    // Track selection analytics
    posthog?.capture("transfer_recipient_previewed", {
      recipient_id: user.userId,
      recipient_username: user.username || null,
      method: "username",
      event_id: eventId,
      ticket_id: ticketId,
    });

    onUserSelected(user);
  };

  /**
   * Handle clear search
   */
  const handleClear = () => {
    setSearchTerm("");
    setResults([]);
    setHasSearched(false);
    setError(null);
    inputRef.current?.focus();
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (isSearching) {
      return null;
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.danger}
          />
          <Text style={styles.emptyStateText}>{error}</Text>
        </View>
      );
    }

    if (hasSearched && results.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="account-search-outline"
            size={48}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.emptyStateText}>
            No user found with username "{searchTerm}"
          </Text>
          <Text style={styles.emptyStateHint}>
            Try a different username or use email instead
          </Text>
        </View>
      );
    }

    if (!hasSearched && searchTerm.length < MIN_SEARCH_LENGTH + 1) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="at"
            size={48}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.emptyStateText}>Enter a username to search</Text>
          <Text style={styles.emptyStateHint}>
            Type at least {MIN_SEARCH_LENGTH} characters
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header - hidden when parent provides one */}
      {!hideHeader && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Find by Username</Text>
          <View style={styles.backButton} />
        </View>
      )}

      {/* Search Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons
            name="at"
            size={20}
            color={theme.colors.textTertiary}
            style={styles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={searchTerm}
            onChangeText={handleSearchChange}
            placeholder="username"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
            onSubmitEditing={() => performSearch(searchTerm)}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.colors.textTertiary}
              />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={theme.colors.accent}
              style={styles.searchingIndicator}
            />
          )}
        </View>
      </View>

      {/* Results or Empty State */}
      <View style={styles.resultsContainer}>
        {results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <UserResultItem
                user={item}
                onSelect={handleUserSelect}
                theme={theme}
                styles={styles}
              />
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
          />
        ) : (
          renderEmptyState()
        )}
      </View>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    minHeight: 250,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
  },
  inputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 14,
    minHeight: 48,
  },
  clearButton: {
    padding: 4,
  },
  searchingIndicator: {
    marginLeft: 8,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    paddingBottom: 32,
  },
  resultItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bgElev2,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 16,
  },
  resultInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  badge: {
    marginLeft: 4,
  },
  resultUsername: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 48,
    paddingTop: 32,
    paddingBottom: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center" as const,
    marginTop: 16,
  },
  emptyStateHint: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: "center" as const,
    marginTop: 4,
  },
});
