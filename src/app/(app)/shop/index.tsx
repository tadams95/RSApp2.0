import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Dimensions,
  ImageStyle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import { LazyImage } from "../../../components/ui";
import {
  getProductLoadingState,
  useProducts,
} from "../../../hooks/useProducts";
// Import offline product management
import { useOfflineProducts } from "../../../utils/offlineProducts";

// Define a type for your product data based on the Shopify API response
interface ShopifyProductImage {
  url: string;
  altText?: string;
}
interface ShopifyProductVariant {
  id: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  // Add other variant properties you need, e.g., availableForSale, title (for size/color)
  availableForSale: boolean;
  title?: string;
  selectedOptions?: Array<{
    name: string;
    value: string;
  }>;
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
}

export default function ShopScreen() {
  const router = useRouter();
  const posthog = usePostHog();

  // Use React Query for product fetching
  const productsQuery = useProducts();
  const { isLoading, isError, isFetching, isRefreshing, error } =
    getProductLoadingState(productsQuery);
  const products = productsQuery.data || [];

  // Track product list viewed when products are loaded
  useEffect(() => {
    if (products.length > 0 && !isLoading) {
      posthog.track("product_list_viewed", {
        product_count: products.length,
        category: "all_products",
        page_type: "shop_index",
        user_type: "authenticated",
      });
    }
  }, [products.length, isLoading, posthog]);

  // Initialize offline product management
  const {
    products: offlineProducts,
    isOffline,
    hasOfflineData,
    cacheProduct,
  } = useOfflineProducts(products.length > 0 ? products : null);

  // Track screen view
  useScreenTracking("Shop Screen", {
    user_type: "authenticated",
    product_count: products.length,
    is_loading: isLoading,
    is_offline: isOffline,
    has_offline_data: hasOfflineData,
  });

  const handleProductPress = useCallback(
    (product: ShopifyProduct) => {
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
      // Pass the product handle or ID. Serializing the whole object can be problematic.
      router.push(`/shop/${product.handle}`);
    },
    [router]
  );

  const onRefresh = useCallback(() => {
    productsQuery.refetch();
  }, [productsQuery]);

  const renderItem = useCallback(
    ({ item: product }: { item: ShopifyProduct }) => {
      // Safe check for variants and availability
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

      // Handle different image field structures (url for app shop, src for guest shop)
      const firstImage =
        product.images && product.images.length > 0 ? product.images[0] : null;

      const firstVariant =
        product.variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
          ? product.variants[0]
          : null;

      if (!firstVariant) return null; // Or some placeholder if a variant is essential

      return (
        <View style={styles.itemsContainer}>
          <Pressable
            onPress={() => handleProductPress(product)}
            style={({ pressed }) => [
              isOutOfStock && styles.outOfStock,
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityLabel={`${product.title}, $${parseFloat(
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
                  accessibilityLabel={`Image of ${product.title}`}
                />
              )}
              {isOutOfStock && (
                <View style={styles.soldOutBadge}>
                  <Text style={styles.soldOutText}>SOLD OUT</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
              {product.title}
            </Text>
            <Text style={styles.price}>
              ${parseFloat(firstVariant.price.amount).toFixed(2)}{" "}
              {firstVariant.price.currencyCode}
            </Text>
          </Pressable>
        </View>
      );
    },
    [handleProductPress]
  );

  const renderSkeletonItems = useCallback(() => {
    const numberOfSkeletons = 6;
    return Array(numberOfSkeletons)
      .fill(0)
      .map((_, index) => ({
        id: `skeleton-${index}`,
        title: "",
        images: [],
        variants: [],
        handle: "",
        isSkeleton: true,
      }));
  }, []);

  const renderSkeletonItem = useCallback(() => {
    return (
      <View style={styles.itemsContainer}>
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonText} />
          <View style={styles.skeletonPrice} />
        </View>
      </View>
    );
  }, []);

  if (isLoading && !isRefreshing && products.length === 0) {
    // Show skeleton loading with FlashList
    return (
      <ProductFetchErrorBoundary>
        <View style={styles.container}>
          <FlashList
            data={renderSkeletonItems()}
            renderItem={renderSkeletonItem}
            keyExtractor={(item) => item.id}
            numColumns={windowWidth > 600 ? 3 : 2}
            estimatedItemSize={windowWidth > 600 ? 415 : 250}
            contentContainerStyle={styles.flashListContent}
          />
        </View>
      </ProductFetchErrorBoundary>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => productsQuery.refetch()}
          accessible={true}
          accessibilityLabel="Retry loading products"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ProductFetchErrorBoundary>
      <View style={styles.container}>
        <FlashList
          data={products}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={windowWidth > 600 ? 3 : 2}
          estimatedItemSize={windowWidth > 600 ? 415 : 250}
          contentContainerStyle={styles.flashListContent}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products found.</Text>
              </View>
            ) : null
          }
        />
      </View>
    </ProductFetchErrorBoundary>
  );
}

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

// Define types for StyleSheet to ensure proper typing
interface Styles {
  container: ViewStyle;
  flashListContent: ViewStyle;
  emptyContainer: ViewStyle;
  title: TextStyle;
  price: TextStyle;
  image: ImageStyle;
  itemsContainer: ViewStyle;
  pressed: ViewStyle;
  errorContainer: ViewStyle;
  errorText: TextStyle;
  retryButton: ViewStyle;
  retryButtonText: TextStyle;
  skeletonContainer: ViewStyle;
  skeletonImage: ViewStyle;
  skeletonText: ViewStyle;
  skeletonPrice: ViewStyle;
  outOfStock: ViewStyle;
  imageContainer: ViewStyle;
  soldOutBadge: ViewStyle;
  soldOutText: TextStyle;
  emptyText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  flashListContent: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontFamily,
    textAlign: "center",
    paddingTop: 8,
    color: "white",
    fontWeight: "500",
  },
  price: {
    fontFamily,
    textAlign: "center",
    color: "white",
    paddingVertical: 4,
  },
  image: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%",
    alignSelf: "center",
    borderRadius: 8,
    // Explicitly set overflow to a compatible value for Image
    overflow: "hidden",
  },
  itemsContainer: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: "black", // Card background
    borderWidth: 1,
    borderColor: "#222", // Subtle border for dark theme
  },
  pressed: {
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  errorText: {
    color: "white",
    fontFamily,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontFamily,
  },
  skeletonContainer: {
    // backgroundColor: '#1a1a1a', // Already on itemsContainer
    borderRadius: 8,
    overflow: "hidden", // Ensures children conform to border radius
  },
  skeletonImage: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%",
    backgroundColor: "#1a1a1a", // Darker skeleton color
  },
  skeletonText: {
    height: 16,
    width: "80%",
    backgroundColor: "#1a1a1a",
    marginVertical: 8,
    alignSelf: "center",
    borderRadius: 4,
  },
  skeletonPrice: {
    height: 14,
    width: "40%",
    backgroundColor: "#1a1a1a",
    marginVertical: 4,
    alignSelf: "center",
    borderRadius: 4,
  },
  outOfStock: {
    opacity: 0.7, // Keep some opacity to indicate it's still a product
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    backgroundColor: "#111", // Placeholder background for images
    borderRadius: 8, // Match item container
    overflow: "hidden", // Clip image to rounded corners
  },
  soldOutBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -45 }, { translateY: -15 }], // Adjust for text length
    backgroundColor: "rgba(200, 0, 0, 0.85)", // More vibrant red
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  soldOutText: {
    color: "white",
    fontWeight: "bold",
    fontFamily,
    fontSize: 12, // Slightly smaller for badge
  },
  emptyText: {
    color: "#777",
    textAlign: "center",
    fontFamily,
    marginTop: 50,
    width: "100%",
  },
});
