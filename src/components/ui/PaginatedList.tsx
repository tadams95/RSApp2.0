import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { usePagination } from "../../hooks/usePagination";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface PaginatedListProps<T> {
  collectionPath: string;
  renderItem: ({
    item,
    index,
  }: {
    item: T;
    index: number;
  }) => React.ReactElement;
  keyExtractor?: (item: T, index: number) => string;
  pageSize?: number;
  emptyText?: string;
  errorText?: string;
  loadingText?: string;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  whereConditions?: [string, any, any][];
  persistKey?: string;
  autoLoad?: boolean;
  listStyle?: ViewStyle;
  containerStyle?: ViewStyle;
  headerComponent?: React.ReactElement | null;
  footerComponent?: React.ReactElement | null;
  refreshable?: boolean;
  showPaginationControls?: boolean;
  paginationControlsStyle?: ViewStyle;
  itemSeparatorComponent?: React.ComponentType<any> | null;
}

// Default font for styling
const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

/**
 * PaginatedList component for displaying paginated Firestore data with error handling
 */
function PaginatedList<T extends { id: string }>({
  collectionPath,
  renderItem,
  keyExtractor = (item: T) => item.id,
  pageSize = 10,
  emptyText = "No items found",
  errorText = "An error occurred while loading data",
  loadingText = "Loading...",
  orderByField = "createdAt",
  orderDirection = "desc",
  whereConditions = [],
  persistKey,
  autoLoad = true,
  listStyle,
  containerStyle,
  headerComponent = null,
  footerComponent = null,
  refreshable = true,
  showPaginationControls = true,
  paginationControlsStyle,
  itemSeparatorComponent = null,
}: PaginatedListProps<T>) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    data,
    loading,
    error,
    hasNextPage,
    hasPrevPage,
    currentPage,
    fetchInitialPage,
    fetchNextPage,
    fetchPrevPage,
    refreshData,
  } = usePagination<T>(collectionPath, {
    pageSize,
    persistKey,
    autoLoad,
    orderByField,
    orderDirection,
    whereConditions: whereConditions as any,
  });

  // Error handling UI
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={24} color={theme.colors.danger} />
      <Text style={styles.errorText}>{error || errorText}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={fetchInitialPage}
        accessibilityRole="button"
        accessibilityLabel="Retry loading data"
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty state UI
  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
          <Text style={styles.emptyText}>{loadingText}</Text>
        </View>
      );
    }

    if (error) {
      return renderError();
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="document-text-outline"
          size={48}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  };

  // Pagination controls
  const renderPaginationControls = () => {
    if (
      !showPaginationControls ||
      (!hasNextPage && !hasPrevPage && currentPage === 1)
    ) {
      return null;
    }

    return (
      <View style={[styles.paginationControls, paginationControlsStyle]}>
        <TouchableOpacity
          style={[styles.pageButton, hasPrevPage ? {} : styles.disabledButton]}
          onPress={fetchPrevPage}
          disabled={!hasPrevPage || loading}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={
              hasPrevPage ? theme.colors.textPrimary : theme.colors.textTertiary
            }
          />
          <Text
            style={[
              styles.pageButtonText,
              hasPrevPage ? {} : styles.disabledText,
            ]}
          >
            Prev
          </Text>
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>Page {currentPage}</Text>
        </View>

        <TouchableOpacity
          style={[styles.pageButton, hasNextPage ? {} : styles.disabledButton]}
          onPress={fetchNextPage}
          disabled={!hasNextPage || loading}
          accessibilityRole="button"
          accessibilityLabel="Next page"
        >
          <Text
            style={[
              styles.pageButtonText,
              hasNextPage ? {} : styles.disabledText,
            ]}
          >
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={
              hasNextPage ? theme.colors.textPrimary : theme.colors.textTertiary
            }
          />
        </TouchableOpacity>
      </View>
    );
  };

  // Loading footer when fetching next page
  const renderFooter = () => {
    if (!loading || data.length === 0) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.textPrimary} />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  };

  // Render the entire component
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.listContent, listStyle]}>
        <FlashList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={120}
          ListEmptyComponent={renderEmptyComponent}
          ListHeaderComponent={headerComponent}
          ListFooterComponent={
            <>
              {renderFooter()}
              {footerComponent}
              {renderPaginationControls()}
            </>
          }
          onRefresh={refreshable ? refreshData : undefined}
          refreshing={refreshable ? loading && currentPage === 1 : false}
          onEndReached={hasNextPage && !loading ? fetchNextPage : undefined}
          onEndReachedThreshold={0.2}
          ItemSeparatorComponent={itemSeparatorComponent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

// Component styles
const createStyles = (theme: Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    listContent: {
      padding: 10,
    },
    emptyListContent: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyText: {
      fontFamily,
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 16,
      textAlign: "center",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorText: {
      fontFamily,
      fontSize: 16,
      color: theme.colors.danger,
      marginTop: 10,
      marginBottom: 20,
      textAlign: "center",
    },
    retryButton: {
      backgroundColor: theme.colors.bgElev2,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    retryButtonText: {
      fontFamily,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
    footerLoader: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
    },
    footerLoaderText: {
      fontFamily,
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 10,
    },
    paginationControls: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 10,
      marginTop: 10,
    },
    pageButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.bgElev2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    pageButtonText: {
      fontFamily,
      fontSize: 14,
      color: theme.colors.textPrimary,
      marginHorizontal: 4,
    },
    disabledButton: {
      opacity: 0.5,
      backgroundColor: theme.colors.bgElev1,
      borderColor: theme.colors.borderSubtle,
    },
    disabledText: {
      color: theme.colors.textTertiary,
    },
    pageIndicator: {
      backgroundColor: theme.colors.bgElev2,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    pageIndicatorText: {
      fontFamily,
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
  } as const);

export default PaginatedList;
