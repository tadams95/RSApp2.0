import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Swiper from "react-native-swiper";

// Define types for product data
interface ProductPrice {
  amount: string;
  currencyCode: string;
}

interface ProductVariant {
  size: string | null;
  color: string;
  price: ProductPrice;
  available: boolean;
}

interface ProductImage {
  src: string;
}

interface ProductData {
  id: string;
  title: string;
  images: ProductImage[];
  price: ProductPrice;
  description?: string;
  variants: ProductVariant[];
}

// Define font family
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

// Get screen dimensions
const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export default function GuestProductDetail() {
  // Get params from URL
  const params = useLocalSearchParams();
  const router = useRouter();

  // Parse the serialized product data
  const data: ProductData = JSON.parse(params.data as string);
  const { title, images, price, description, variants } = data;

  // Component state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [imagesLoaded, setImagesLoaded] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const totalImages = images.length;

  useEffect(() => {
    // When all images are loaded, set loading to false
    if (imagesLoaded >= totalImages && totalImages > 0) {
      setIsLoading(false);
    }
  }, [imagesLoaded, totalImages]);

  const handleImageLoad = (): void => {
    setImagesLoaded((prev) => prev + 1);
  };

  const handleGuestCheckout = (): void => {
    // Navigate to welcome screen for authentication
    router.push("/(auth)/");
  };

  // Format price for display
  const formattedPrice: string =
    price && price.amount
      ? `$${price.amount}0 ${price.currencyCode || "USD"}`
      : "Price unavailable";

  // Check if all variants are sold out
  const isSoldOut = variants.every((variant) => !variant.available);

  return (
    <>
      <Stack.Screen
        options={{
          title: title || "Product Detail",
          headerTitleStyle: {
            fontFamily,
            color: "white",
          },
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        accessibilityLabel="Product details page"
      >
        {/* Image Carousel */}
        <View style={styles.imageContainer}>
          {isLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#ff3c00" />
            </View>
          )}

          {images && images.length > 0 ? (
            <Swiper
              style={styles.swiper}
              showsButtons={false}
              loop={false}
              onIndexChanged={setActiveIndex}
              dot={<View style={styles.dot} />}
              activeDot={<View style={styles.activeDot} />}
              paginationStyle={styles.pagination}
            >
              {images.map((image, index) => (
                <View key={index} style={styles.slide}>
                  <Image
                    source={{ uri: image.src }}
                    style={styles.productImage}
                    onLoad={handleImageLoad}
                    accessibilityLabel={`Product image ${index + 1} of ${
                      images.length
                    }`}
                  />
                </View>
              ))}
            </Swiper>
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}

          {/* Image Counter */}
          {totalImages > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {activeIndex + 1}/{totalImages}
              </Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.price}>{formattedPrice}</Text>

          {/* Description */}
          {description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
          )}

          {/* Available Variants */}
          {variants.length > 0 && (
            <View style={styles.variantsContainer}>
              <Text style={styles.sectionTitle}>Available Options</Text>
              <View style={styles.variantsList}>
                {variants
                  .filter((variant) => variant.available)
                  .map((variant, index) => (
                    <View key={index} style={styles.variantItem}>
                      <Text style={styles.variantText}>
                        {variant.size && `Size: ${variant.size}`}
                        {variant.size && variant.color && " | "}
                        {variant.color &&
                          variant.color !== "Default" &&
                          `Color: ${variant.color}`}
                      </Text>
                    </View>
                  ))}
                {variants.filter((variant) => variant.available).length ===
                  0 && (
                  <Text style={styles.soldOutText}>
                    All options are currently sold out
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Add To Cart Button - For Guest users, this will redirect to auth */}
          <TouchableOpacity
            style={[styles.addButton, isSoldOut && styles.disabledButton]}
            onPress={handleGuestCheckout}
            disabled={isSoldOut}
            accessibilityRole="button"
            accessibilityLabel={
              isSoldOut ? "Product sold out" : "Sign in to purchase"
            }
            accessibilityHint="Redirects to login screen"
          >
            <Text style={styles.addButtonText}>
              {isSoldOut ? "SOLD OUT" : "SIGN IN TO PURCHASE"}
            </Text>
          </TouchableOpacity>

          {/* Reminder Text */}
          <Text style={styles.reminderText}>
            Sign in or create an account to purchase this item
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  contentContainer: {
    paddingBottom: 40,
  },
  imageContainer: {
    height: windowHeight * 0.5,
    position: "relative",
  },
  loaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 10,
  },
  swiper: {
    height: windowHeight * 0.5,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  noImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  noImageText: {
    color: "#999",
    fontFamily,
    fontSize: 16,
  },
  imageCounter: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  imageCounterText: {
    color: "white",
    fontFamily,
    fontSize: 12,
  },
  pagination: {
    bottom: 10,
  },
  dot: {
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 3,
    marginRight: 3,
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 3,
    marginRight: 3,
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontFamily,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontFamily,
    color: "#ff3c00",
    marginBottom: 16,
    fontWeight: "700",
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  description: {
    fontSize: 14,
    fontFamily,
    color: "#ccc",
    lineHeight: 20,
  },
  variantsContainer: {
    marginBottom: 20,
  },
  variantsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  variantItem: {
    backgroundColor: "#222",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  variantText: {
    color: "#ccc",
    fontFamily,
    fontSize: 12,
  },
  soldOutText: {
    color: "#ff6666",
    fontFamily,
    fontSize: 14,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: "#ff3c00",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#333",
  },
  addButtonText: {
    color: "white",
    fontFamily,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 1,
  },
  reminderText: {
    color: "#aaa",
    fontFamily,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  backButton: {
    position: "absolute",
    top: 10 + (Platform.OS === "ios" ? 40 : 10),
    left: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
});
