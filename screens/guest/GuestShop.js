import React, { useState, useLayoutEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  Pressable,
  Image,
  RefreshControl
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import fetchShopifyProducts from "../../shopify/shopifyService";

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

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
    shadowColor: GlobalStyles.colors.neutral6,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
  },
  pressed: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: windowHeight * 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: windowHeight * 0.5,
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontFamily,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontFamily,
  },
  skeletonContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  skeletonImage: {
    height: windowWidth > 600 ? 375 : 200,
    width: "100%",
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  skeletonText: {
    height: 16,
    width: '80%',
    backgroundColor: '#1a1a1a',
    marginVertical: 8,
    alignSelf: 'center',
    borderRadius: 4,
  },
  skeletonPrice: {
    height: 14,
    width: '40%',
    backgroundColor: '#1a1a1a',
    marginVertical: 4,
    alignSelf: 'center',
    borderRadius: 4,
  },
  outOfStock: {
    opacity: 0.7,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  soldOutBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -15 }],
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  soldOutText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily,
    fontSize: 14,
  }
});

const GuestShop = ({ navigation, setAuthenticated }) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const serializeObject = useMemo(() => {
    const serialize = (obj) => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(serialize);
      }

      const serialized = {};
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
    (product) => {
      // Check if product is out of stock before navigation
      const isOutOfStock = product.variants.every(variant => !variant.available);
      
      if (isOutOfStock) {
        // If product is out of stock, don't navigate
        return;
      }
      
      // Serialize product data
      const serializedProduct = {
        id: product.id,
        title: product.title,
        images: product.images.map((image) => ({ src: image.src })),
        variants: product.variants.map((variant) => {
          const [size, color] = (variant.title.split(" / ") || []).map((str) =>
            str.trim()
          );

          const selectedSize =
            size ||
            variant.selectedOptions.find((opt) => opt.name === "Size")?.value ||
            null;
          const selectedColor = color || "Default";

          return {
            size: selectedSize,
            color: selectedColor,
            price: {
              amount: variant.price.amount,
              currencyCode: variant.price.currencyCode,
            },
            available: variant.available,
            // Add more variant details as needed
          };
        }),
        price: {
          amount: product.variants[0].price.amount,
          currencyCode: product.variants[0].price.currencyCode,
        },
        description: product.description,
        // Add other necessary data here
      };

      navigation.navigate("GuestProductDetail", { data: serializedProduct });
    },
    [navigation, serializeObject]
  );

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedProducts = await fetchShopifyProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error(error);
      setError('Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  useLayoutEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const renderItem = useCallback(
    ({ item: product }) => {
      // Check if product is out of stock
      const isOutOfStock = product.variants.every(variant => !variant.available);
      
      return (
        <View key={product.id} style={styles.itemsContainer}>
          <Pressable
            onPress={() => handleProductPress(product)}
            style={({ pressed }) => [
              isOutOfStock && styles.outOfStock,
              pressed && styles.pressed
            ]}
            accessible={true}
            accessibilityLabel={`${product.title}, $${product.variants[0].price.amount}0 ${product.variants[0].price.currencyCode}${isOutOfStock ? ', Sold Out' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: isOutOfStock }}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: product.images[0].src }} 
                style={styles.image}
                accessibilityLabel={`Image of ${product.title}`}
              />
              {isOutOfStock && (
                <View style={styles.soldOutBadge}>
                  <Text style={styles.soldOutText}>SOLD OUT</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{product.title}</Text>
            <Text style={styles.price}>
              ${product.variants[0].price.amount}0{" "}
              {product.variants[0].price.currencyCode}
            </Text>
          </Pressable>
        </View>
      );
    },
    [handleProductPress]
  );

  const renderSkeletonItems = useCallback(() => {
    const numberOfSkeletons = 6;
    return Array(numberOfSkeletons).fill(0).map((_, index) => (
      <View key={`skeleton-${index}`} style={styles.itemsContainer}>
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonText} />
          <View style={styles.skeletonPrice} />
        </View>
      </View>
    ));
  }, []);

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

  return (
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
    >
      <View style={styles.container}>
        {isLoading ? (
          renderSkeletonItems()
        ) : (
          products.map((product) => renderItem({ item: product }))
        )}
      </View>
    </ScrollView>
  );
};

export default GuestShop;
