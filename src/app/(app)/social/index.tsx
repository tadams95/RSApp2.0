import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "../../../analytics/PostHogProvider";
import { GlobalStyles } from "../../../constants/styles";

type FeedTab = "following" | "forYou";

export default function SocialFeedScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [refreshing, setRefreshing] = useState(false);

  // Track screen view
  useScreenTracking("Social Feed", {
    tab: activeTab,
  });

  // Placeholder data - will be replaced with real Firestore data
  const posts: any[] = [];
  const isLoading = false;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Refetch feed data
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons
          name={activeTab === "following" ? "account-heart-outline" : "fire"}
          size={48}
          color={GlobalStyles.colors.grey5}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "following" ? "Your Feed is Empty" : "Nothing Here Yet"}
      </Text>
      <Text style={styles.emptySubtext}>
        {activeTab === "following"
          ? "Follow people to see their posts in your feed"
          : "Be the first to share something with the community"}
      </Text>
      {activeTab === "following" && (
        <TouchableOpacity style={styles.discoverButton}>
          <Text style={styles.discoverButtonText}>Discover People</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPost = ({ item }: { item: any }) => {
    // PostCard component will be implemented in later tasks
    return (
      <View style={styles.postPlaceholder}>
        <Text style={styles.postPlaceholderText}>Post: {item.id}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with centered tabs */}
      <View style={styles.header}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "following" && styles.activeTab]}
            onPress={() => setActiveTab("following")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "following" && styles.activeTabText,
              ]}
            >
              Following
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "forYou" && styles.activeTab]}
            onPress={() => setActiveTab("forYou")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "forYou" && styles.activeTabText,
              ]}
            >
              For You
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={GlobalStyles.colors.redVivid5}
          />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={posts.length === 0 && styles.emptyList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GlobalStyles.colors.redVivid5}
              colors={[GlobalStyles.colors.redVivid5]}
            />
          }
        />
      )}

      {/* Floating Compose Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#fff",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: GlobalStyles.colors.grey4,
  },
  activeTabText: {
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GlobalStyles.colors.grey8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 15,
    color: GlobalStyles.colors.grey4,
    textAlign: "center",
    lineHeight: 22,
  },
  discoverButton: {
    marginTop: 24,
    backgroundColor: GlobalStyles.colors.redVivid5,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  discoverButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  postPlaceholder: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  postPlaceholderText: {
    color: GlobalStyles.colors.grey4,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GlobalStyles.colors.redVivid5,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GlobalStyles.colors.redVivid5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
