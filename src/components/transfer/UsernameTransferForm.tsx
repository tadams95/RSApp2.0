import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
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
}

function UserResultItem({ user, onSelect }: UserResultItemProps) {
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
          color={GlobalStyles.colors.yellow}
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
        color={GlobalStyles.colors.grey5}
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
          MAX_RESULTS
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
    [eventId, ticketId, posthog]
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
            color={GlobalStyles.colors.error}
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
            color={GlobalStyles.colors.grey5}
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
            color={GlobalStyles.colors.grey6}
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
              color={GlobalStyles.colors.text}
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
            color={GlobalStyles.colors.grey5}
            style={styles.inputIcon}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={searchTerm}
            onChangeText={handleSearchChange}
            placeholder="username"
            placeholderTextColor={GlobalStyles.colors.grey6}
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
                color={GlobalStyles.colors.grey5}
              />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color={GlobalStyles.colors.primary}
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
              <UserResultItem user={item} onSelect={handleUserSelect} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    minHeight: 250,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GlobalStyles.spacing.md,
    paddingVertical: GlobalStyles.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
  },
  inputContainer: {
    paddingHorizontal: GlobalStyles.spacing.lg,
    paddingVertical: GlobalStyles.spacing.md,
    paddingTop: GlobalStyles.spacing.lg,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GlobalStyles.colors.grey8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GlobalStyles.colors.grey6,
    paddingHorizontal: GlobalStyles.spacing.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: GlobalStyles.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: GlobalStyles.colors.text,
    paddingVertical: 14,
    minHeight: 48,
  },
  clearButton: {
    padding: GlobalStyles.spacing.xs,
  },
  searchingIndicator: {
    marginLeft: GlobalStyles.spacing.sm,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    paddingBottom: GlobalStyles.spacing.xl,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: GlobalStyles.spacing.md,
    paddingHorizontal: GlobalStyles.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: GlobalStyles.spacing.md,
  },
  resultInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
    color: GlobalStyles.colors.text,
  },
  badge: {
    marginLeft: 4,
  },
  resultUsername: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    marginTop: 2,
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: GlobalStyles.spacing.xxl,
    paddingTop: GlobalStyles.spacing.xl,
    paddingBottom: GlobalStyles.spacing.xl,
  },
  emptyStateText: {
    fontSize: 16,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginTop: GlobalStyles.spacing.md,
  },
  emptyStateHint: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
    textAlign: "center",
    marginTop: GlobalStyles.spacing.xs,
  },
});
