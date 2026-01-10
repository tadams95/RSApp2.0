import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Dimensions,
  ImageStyle,
  Platform,
  Pressable,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import { LazyImage } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  getProductLoadingState,
  useProducts,
} from "../../../hooks/useProducts";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { selectCartItemCount } from "../../../store/redux/cartSlice";
import type { Theme } from "../../../styles/theme";
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
  const insets = useSafeAreaInsets();
  const cartItemCount = useSelector(selectCartItemCount);
  const { theme } = useTheme();
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

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.headerTitle}>Shop</Text>
      <TouchableOpacity
        style={styles.cartButton}
        onPress={() => router.push("/cart")}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="cart-outline"
          size={26}
          color={theme.colors.textPrimary}
        />
        {cartItemCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>
              {cartItemCount > 9 ? "9+" : cartItemCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !isRefreshing && products.length === 0) {
    // Show skeleton loading with FlashList
    return (
      <ProductFetchErrorBoundary>
        <View style={styles.container}>
          {renderHeader()}
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
        {renderHeader()}
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
        {renderHeader()}
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
  header: ViewStyle;
  headerTitle: TextStyle;
  cartButton: ViewStyle;
  cartBadge: ViewStyle;
  cartBadgeText: TextStyle;
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

const createStyles = (theme: Theme): Styles =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.borderSubtle,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.textPrimary,
      fontFamily,
    },
    cartButton: {
      padding: 4,
      position: "relative",
    },
    cartBadge: {
      position: "absolute",
      top: -2,
      right: -4,
      backgroundColor: theme.colors.accent,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    cartBadgeText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: "bold",
      fontFamily,
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
      color: theme.colors.textPrimary,
      fontWeight: "500",
    },
    price: {
      fontFamily,
      textAlign: "center",
      color: theme.colors.textPrimary,
      paddingVertical: 4,
    },
    image: {
      height: windowWidth > 600 ? 375 : 200,
      width: "100%",
      alignSelf: "center",
      borderRadius: 8,
      overflow: "hidden",
    },
    itemsContainer: {
      flex: 1,
      marginBottom: 16,
      marginHorizontal: 5,
      borderRadius: 8,
      backgroundColor: theme.colors.bgRoot,
      borderWidth: 1,
      borderColor: theme.colors.bgElev2,
    },
    pressed: {
      opacity: 0.7,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.bgRoot,
      padding: 20,
    },
    errorText: {
      color: theme.colors.textPrimary,
      fontFamily,
      textAlign: "center",
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: theme.colors.borderSubtle,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
      fontFamily,
    },
    skeletonContainer: {
      borderRadius: 8,
      overflow: "hidden",
    },
    skeletonImage: {
      height: windowWidth > 600 ? 375 : 200,
      width: "100%",
      backgroundColor: theme.colors.bgElev2,
    },
    skeletonText: {
      height: 16,
      width: "80%",
      backgroundColor: theme.colors.bgElev2,
      marginVertical: 8,
      alignSelf: "center",
      borderRadius: 4,
    },
    skeletonPrice: {
      height: 14,
      width: "40%",
      backgroundColor: theme.colors.bgElev2,
      marginVertical: 4,
      alignSelf: "center",
      borderRadius: 4,
    },
    outOfStock: {
      opacity: 0.7,
    },
    imageContainer: {
      position: "relative",
      width: "100%",
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 8,
      overflow: "hidden",
    },
    soldOutBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -45 }, { translateY: -15 }],
      backgroundColor: "rgba(200, 0, 0, 0.85)",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 5,
    },
    soldOutText: {
      color: theme.colors.textPrimary,
      fontWeight: "bold",
      fontFamily,
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.textTertiary,
      textAlign: "center",
      fontFamily,
      marginTop: 50,
      width: "100%",
    },
  } as const);
