import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useScreenTracking } from "../../../analytics/PostHogProvider";
import { LazyImage } from "../../../components/ui";
import { useShopifyPagination } from "../../../hooks/useShopifyPagination";
import { ShopifyProduct } from "../../../services/shopifyService";

// Default font family for styling consistency
const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * PaginatedShopScreen component displaying products with robust pagination
 * and error handling for cursor errors, out-of-bounds requests, and network issues
 */
export default function PaginatedShopScreen() {
  // Track screen view for analytics
  useScreenTracking("Paginated Shop", {
    userType: "authenticated",
    screenType: "pagination",
  });

  const handleProductPress = (product: ShopifyProduct) => {
    // Check if variants is defined before calling every
    const isOutOfStock =
      product.variants &&
      Array.isArray(product.variants) &&
      product.variants.length > 0
        ? product.variants.every(
            (variant) =>
              // Check for both availableForSale (app interface) and available (guest interface)
              !(variant.availableForSale || (variant as any).available)
          )
        : true;

    if (isOutOfStock) {
      return;
    }
    // Navigate to product detail screen using Expo Router
    router.push(`/shop/${product.handle}`);
  };

  // Render individual product card
  const renderProductCard = ({
    item,
    index,
  }: {
    item: ShopifyProduct;
    index: number;
  }) => {
    // Safe check for variants and availability
    const isOutOfStock =
      item.variants && Array.isArray(item.variants) && item.variants.length > 0
        ? item.variants.every(
            (variant) =>
              // Check for both availableForSale (app interface) and available (guest interface)
              !(variant.availableForSale || (variant as any).available)
          )
        : true;

    // Handle different image field structures
    const firstImage =
      item.images && item.images.length > 0 ? item.images[0] : null;

    const firstVariant =
      item.variants && Array.isArray(item.variants) && item.variants.length > 0
        ? item.variants[0]
        : null;

    if (!firstVariant) return null;

    return (
      <Pressable
        onPress={() => handleProductPress(item)}
        style={({ pressed }) => [
          styles.productCard,
          isOutOfStock && styles.outOfStock,
          pressed && styles.pressed,
        ]}
        accessible={true}
        accessibilityLabel={`${item.title}, $${parseFloat(
          firstVariant.price.amount
        ).toFixed(2)} ${firstVariant.price.currencyCode}${
          isOutOfStock ? ", Sold Out" : ""
        }`}
        accessibilityRole="button"
        accessibilityState={{ disabled: isOutOfStock }}
      >
        <View style={styles.imageContainer}>
          {firstImage && (
            <LazyImage
              source={{ uri: firstImage.url || (firstImage as any).src }}
              fallbackSource={require("../../../assets/ShopHero_1.png")}
              style={styles.image}
              accessibilityLabel={`Image of ${item.title}`}
            />
          )}

          {isOutOfStock && (
            <View style={styles.soldOutTag}>
              <Text style={styles.soldOutText}>SOLD OUT</Text>
            </View>
          )}

          <View style={styles.priceTag}>
            <Text style={styles.priceText}>
              ${parseFloat(firstVariant.price.amount).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.productContent}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
      </Pressable>
    );
  };

  // Use the custom hook for Shopify pagination
  const {
    products,
    loading,
    error,
    hasNextPage,
    hasPrevPage,
    currentPage,
    loadNextPage,
    loadPrevPage,
    refreshProducts,
  } = useShopifyPagination({ pageSize: 10 });

  // Error handling UI
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={24} color="#ef4444" />
      <Text style={styles.errorText}>
        {error || "An error occurred while loading products."}
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={refreshProducts}
        accessibilityRole="button"
        accessibilityLabel="Retry loading products"
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
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.emptyText}>Loading products...</Text>
        </View>
      );
    }

    if (error) {
      return renderError();
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No products available</Text>
      </View>
    );
  };

  // Pagination controls
  const renderPaginationControls = () => {
    if (!hasNextPage && !hasPrevPage && currentPage === 1) {
      return null;
    }

    return (
      <View style={styles.paginationControls}>
        <TouchableOpacity
          style={[styles.pageButton, hasPrevPage ? {} : styles.disabledButton]}
          onPress={loadPrevPage}
          disabled={!hasPrevPage || loading}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={hasPrevPage ? "#ffffff" : "#666"}
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
          onPress={loadNextPage}
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
            color={hasNextPage ? "#ffffff" : "#666"}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlashList
        data={products}
        renderItem={({
          item,
          index,
        }: {
          item: ShopifyProduct;
          index: number;
        }) => renderProductCard({ item, index })}
        keyExtractor={(item: ShopifyProduct) => item.id}
        estimatedItemSize={200}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Shop</Text>
            <Text style={styles.headerSubtitle}>
              Browse our latest merchandise
            </Text>
          </View>
        }
        ListFooterComponent={renderPaginationControls}
        onRefresh={refreshProducts}
        refreshing={loading && currentPage === 1}
        onEndReached={hasNextPage ? loadNextPage : undefined}
        onEndReachedThreshold={0.2}
      />
    </View>
  );
}

// Component styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  listContent: {
    padding: 10,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingVertical: 16,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily,
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily,
    fontSize: 16,
    color: "#999",
    marginBottom: 10,
  },
  productCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  imageContainer: {
    height: 180,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  productContent: {
    padding: 16,
  },
  productTitle: {
    fontFamily,
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  priceTag: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  priceText: {
    fontFamily,
    fontWeight: "700",
    color: "white",
    fontSize: 16,
  },
  soldOutTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.5)",
  },
  soldOutText: {
    fontFamily,
    fontWeight: "700",
    color: "#ff4444",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.8,
  },
  outOfStock: {
    opacity: 0.6,
  },
  // Pagination styles
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
    backgroundColor: "#222",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  pageButtonText: {
    fontFamily,
    fontSize: 14,
    color: "white",
    marginHorizontal: 4,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: "#111",
    borderColor: "#333",
  },
  disabledText: {
    color: "#666",
  },
  pageIndicator: {
    backgroundColor: "#333",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pageIndicatorText: {
    fontFamily,
    fontSize: 14,
    color: "white",
  },
  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontFamily,
    fontSize: 16,
    color: "#ef4444",
    marginTop: 10,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  retryButtonText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily,
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    textAlign: "center",
  },
});
