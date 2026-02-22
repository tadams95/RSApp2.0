import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, RefreshControl, Text, View } from "react-native";
import UserCard from "../../../components/profile/UserCard";
import { useTheme } from "../../../contexts/ThemeContext";
import { useFollowList } from "../../../hooks/useFollowList";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { UserSearchResult } from "../../../services/userSearchService";

export default function FollowListScreen() {
  const { userId, type } = useLocalSearchParams<{
    userId: string;
    type: "followers" | "following";
  }>();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    users,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useFollowList(userId || "", type || "followers");

  const title = type === "followers" ? "Followers" : "Following";

  const renderItem = ({ item }: { item: UserSearchResult }) => (
    <UserCard user={item} />
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {type === "followers"
            ? "No followers yet"
            : "Not following anyone yet"}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: title,
          headerShadowVisible: false,
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlashList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.userId}
          estimatedItemSize={75}
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => refetch()}
              tintColor={theme.colors.textPrimary}
              colors={[theme.colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textTertiary,
    },
    footerLoader: {
      paddingVertical: 16,
      alignItems: "center" as const,
    },
  }) as const;
