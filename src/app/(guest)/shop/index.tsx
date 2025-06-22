import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import { ImageWithFallback } from "../../../components/ui";
import fetchShopifyProducts from "../../../services/shopifyService";
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
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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

  // Fetch products from Shopify
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedProducts = await fetchShopifyProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error(error);
      setError("Failed to load products. Please try again.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  // Load products when component mounts
  useLayoutEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
                ? `, $${product.variants[0].price.amount}0 ${product.variants[0].price.currencyCode}`
                : ""
            }${isOutOfStock ? ", Sold Out" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isOutOfStock }}
          >
            <View style={styles.imageContainer}>
              <ImageWithFallback
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
                ? `$${product.variants[0].price.amount}0 ${product.variants[0].price.currencyCode}`
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
      .map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.itemsContainer}>
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonText} />
            <View style={styles.skeletonPrice} />
          </View>
        </View>
      ));
  }, []);

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={fetchProducts}
          accessible={true}
          accessibilityLabel="Retry loading products"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Main render
  return (
    <ProductFetchErrorBoundary>
      <ScrollView
        style={{ backgroundColor: "#000" }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            colors={["white"]}
          />
        }
        accessibilityLabel="Shop products list"
      >
        <View style={styles.container}>
          {isLoading
            ? renderSkeletonItems()
            : products.map((product) => renderItem({ item: product }))}
        </View>
      </ScrollView>
    </ProductFetchErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#000",
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
  },
  itemsContainer: {
    width: windowWidth > 600 ? "32%" : "48%", // More responsive grid
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "black",
    elevation: 3,
    shadowColor: "#999",
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
  },
  pressed: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: windowHeight * 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: windowHeight * 0.5,
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
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
  },
  skeletonImage: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
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
    opacity: 0.7,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
  },
  soldOutBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -40 }, { translateY: -15 }],
    backgroundColor: "rgba(220, 38, 38, 0.8)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  soldOutText: {
    color: "white",
    fontWeight: "bold",
    fontFamily,
    fontSize: 14,
  },
});

export default GuestShop;
