import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import { LazyImage } from "../../../components/ui";
import { Theme } from "../../../constants/themes";
import {
  getProductLoadingState,
  useProducts,
} from "../../../hooks/useProducts";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { navigateToGuestProduct } from "../../../utils/navigation";

// Define interfaces for Shopify products
interface ShopifyPrice {
  amount: string;
  currencyCode: string;
}

interface ShopifyVariant {
  id: string;
  title?: string; // Make optional to match ShopifyProductVariant
  price: ShopifyPrice;
  available?: boolean; // Make optional
  availableForSale?: boolean; // Add alternative property name
  selectedOptions?: Array<{
    name: string;
    value: string;
  }>;
}

interface ShopifyImage {
  id?: string;
  src?: string; // Make src optional to match ShopifyProductImage
  url?: string; // Add url as alternative property name
  altText?: string;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description?: string; // Keep description for backward compatibility
  descriptionHtml?: string; // Add descriptionHtml property to match authenticated shop
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  handle?: string;
}

interface SerializedProduct {
  id: string;
  title: string;
  images: { src?: string; url?: string }[]; // Make src optional and add url
  variants: Array<{
    size: string | null;
    color: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    available?: boolean; // Make optional
  }>;
  price: {
    amount: string;
    currencyCode: string;
  };
  descriptionHtml?: string; // Changed from description to descriptionHtml to match ProductData interface
  handle?: string; // Added handle for consistency
}

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined cases

const GuestShop: React.FC = () => {
  const posthog = usePostHog();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

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
        user_type: "guest",
      });
    }
  }, [products.length, isLoading, posthog]);

  // Track screen view
  useScreenTracking("Guest Shop Screen", {
    user_type: "guest",
    product_count: products.length,
    is_loading: isLoading,
  });

  // Memoized serializer function to prepare product data for navigation
  const serializeObject = useMemo(() => {
    const serialize = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(serialize);
      }

      const serialized: Record<string, any> = {};
      for (const key in obj) {
        if (key !== "nextPageQueryAndPath" && typeof obj[key] !== "function") {
          serialized[key] = serialize(obj[key]);
        }
      }
      return serialized;
    };
    return serialize;
  }, []);

  const handleProductPress = useCallback(
    (product: ShopifyProduct) => {
      // Check if product is out of stock before navigation
      const isOutOfStock =
        product.variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
          ? product.variants.every((variant) => !variant.available)
          : true;

      if (isOutOfStock) {
        // If product is out of stock, don't navigate
        return;
      }

      // Serialize product data for navigation
      const serializedProduct: SerializedProduct = {
        id: product.id,
        title: product.title,
        images:
          product.images && Array.isArray(product.images)
            ? product.images.map((image) => ({
                src: image.src || image.url || "",
                url: image.url || image.src || "",
              }))
            : [],
        variants:
          product.variants && Array.isArray(product.variants)
            ? product.variants.map((variant) => {
                const variantTitle = variant.title || "";
                const [size, color] = (variantTitle.split(" / ") || []).map(
                  (str) => str.trim()
                );

                const selectedSize =
                  size ||
                  variant.selectedOptions?.find((opt) => opt.name === "Size")
                    ?.value ||
                  null;
                const selectedColor = color || "Default";

                return {
                  size: selectedSize,
                  color: selectedColor,
                  price: {
                    amount: variant.price.amount,
                    currencyCode: variant.price.currencyCode,
                  },
                  available:
                    variant.available ?? variant.availableForSale ?? true,
                };
              })
            : [],
        price:
          product.variants && product.variants[0] && product.variants[0].price
            ? {
                amount: product.variants[0].price.amount,
                currencyCode: product.variants[0].price.currencyCode,
              }
            : {
                amount: "0",
                currencyCode: "USD",
              },
        descriptionHtml: product.descriptionHtml || product.description, // Use descriptionHtml with fallback to description
        handle: product.handle,
      };

      // Navigate using our navigation utility function
      navigateToGuestProduct(product.id, serializedProduct);
    },
    [serializeObject]
  );

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    productsQuery.refetch();
  }, [productsQuery]);

  // Render a product item
  const renderItem = useCallback(
    ({ item: product }: { item: ShopifyProduct }) => {
      // Check if product is out of stock
      const isOutOfStock =
        product.variants &&
        Array.isArray(product.variants) &&
        product.variants.length > 0
          ? product.variants.every((variant) => !variant.available)
          : true;

      return (
        <View key={product.id} style={styles.itemsContainer}>
          <Pressable
            onPress={() => handleProductPress(product)}
            style={({ pressed }) => [
              isOutOfStock && styles.outOfStock,
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityLabel={`${product.title}${
              product.variants &&
              product.variants[0] &&
              product.variants[0].price
                ? `, $${parseFloat(product.variants[0].price.amount).toFixed(
                    2
                  )} ${product.variants[0].price.currencyCode}`
                : ""
            }${isOutOfStock ? ", Sold Out" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isOutOfStock }}
          >
            <View style={styles.imageContainer}>
              <LazyImage
                source={{
                  uri:
                    product.images && product.images[0]
                      ? product.images[0].src
                      : "",
                }}
                fallbackSource={require("../../../assets/ShopHero_1.png")}
                style={styles.image}
                accessibilityLabel={`Image of ${product.title}`}
              />
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
              {product.variants &&
              product.variants[0] &&
              product.variants[0].price
                ? `$${parseFloat(product.variants[0].price.amount).toFixed(
                    2
                  )} ${product.variants[0].price.currencyCode}`
                : "Price unavailable"}
            </Text>
          </Pressable>
        </View>
      );
    },
    [handleProductPress]
  );

  // Render skeleton placeholders while loading
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

  // Error state
  if (error) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
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

  // Main render - Loading state with skeleton
  if (isLoading && !isRefreshing && products.length === 0) {
    return (
      <ProductFetchErrorBoundary>
        <View style={[styles.container, { paddingTop: insets.top }]}>
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

  return (
    <ProductFetchErrorBoundary>
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  flashListContent: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 20,
  },
  emptyText: {
    color: theme.colors.textTertiary,
    textAlign: "center" as const,
    fontFamily,
    marginTop: 50,
  },
  title: {
    fontFamily,
    textAlign: "center" as const,
    paddingTop: 8,
    color: theme.colors.textPrimary,
    fontWeight: "500" as const,
  },
  price: {
    fontFamily,
    textAlign: "center" as const,
    color: theme.colors.textPrimary,
    paddingVertical: 4,
  },
  image: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%" as const,
    alignSelf: "center" as const,
    borderRadius: 8,
  },
  itemsContainer: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: theme.colors.bgRoot,
    elevation: 3,
    shadowColor: theme.colors.textSecondary,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
  },
  pressed: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    height: windowHeight * 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    height: windowHeight * 0.5,
    padding: 20,
  },
  errorText: {
    color: theme.colors.textPrimary,
    fontFamily,
    textAlign: "center" as const,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.bgElev2,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.textPrimary,
    fontFamily,
  },
  skeletonContainer: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 8,
  },
  skeletonImage: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%" as const,
    borderRadius: 8,
    backgroundColor: theme.colors.bgElev2,
  },
  skeletonText: {
    height: 16,
    width: "80%" as const,
    backgroundColor: theme.colors.bgElev2,
    marginVertical: 8,
    alignSelf: "center" as const,
    borderRadius: 4,
  },
  skeletonPrice: {
    height: 14,
    width: "40%" as const,
    backgroundColor: theme.colors.bgElev2,
    marginVertical: 4,
    alignSelf: "center" as const,
    borderRadius: 4,
  },
  outOfStock: {
    opacity: 0.7,
  },
  imageContainer: {
    position: "relative" as const,
    width: "100%" as const,
  },
  soldOutBadge: {
    position: "absolute" as const,
    top: "50%" as const,
    left: "50%" as const,
    transform: [{ translateX: -40 }, { translateY: -15 }],
    backgroundColor: "rgba(220, 38, 38, 0.8)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  soldOutText: {
    color: theme.colors.textPrimary,
    fontWeight: "bold" as const,
    fontFamily,
    fontSize: 14,
  },
});

export default GuestShop;
