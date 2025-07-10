import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import { AppCarousel } from "../../../components/ui";
import { GlobalStyles } from "../../../constants/styles";
import { goBack, navigateToAuth } from "../../../utils/navigation";

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
  handle?: string; // Added handle property for consistency
  images: ProductImage[];
  price: ProductPrice;
  descriptionHtml?: string;
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
  const { track } = usePostHog();

  // Parse the serialized product data
  const data: ProductData = JSON.parse(params.data as string);
  const { title, images, price, descriptionHtml, variants } = data;

  // Component state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [imagesLoaded, setImagesLoaded] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const totalImages = images ? images.length : 0;

  // Track image carousel interactions
  const handleImageCarouselSwipe = (index: number) => {
    const previousIndex = activeIndex;
    setActiveIndex(index);

    // Track carousel interaction for analytics
    track("product_image_carousel_swipe", {
      product_id: data.id,
      product_name: title,
      product_handle: data.handle || "unknown",
      image_index: index,
      total_images: totalImages,
      swipe_direction: index > previousIndex ? "next" : "previous",
      user_type: "guest",
    });
  };

  // Track screen view for analytics
  useScreenTracking("Guest Product Detail", {
    productId: data.id,
    productName: title,
    productHandle: data.handle || "unknown",
    price: price?.amount ? parseFloat(price.amount) : 0,
    currency: price?.currencyCode || "USD",
    userType: "guest",
    imageCount: images?.length || 0,
    variantCount: variants?.length || 0,
    hasDescription: !!descriptionHtml,
    isLoading: isLoading,
  });

  // Track product view for guest users
  useEffect(() => {
    if (data) {
      const productPrice = price?.amount ? parseFloat(price.amount) : 0;

      track("product_viewed", {
        product_id: data.id,
        product_name: title,
        product_handle: data.handle || "unknown",
        price: productPrice,
        currency: price?.currencyCode || "USD",
        category: "merchandise",
        image_count: images?.length || 0,
        variant_count: variants?.length || 0,
        has_description: !!descriptionHtml,
        screen_type: "guest",
      });
    }
  }, [data, track, title, price, images, variants, descriptionHtml]);

  useEffect(() => {
    // When all images are loaded, set loading to false
    if (imagesLoaded >= totalImages && totalImages > 0) {
      setIsLoading(false);
    }

    // Add a safety timeout to hide the spinner after 3 seconds
    // even if image loading events fail to trigger
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [imagesLoaded, totalImages]);

  const handleImageLoad = (): void => {
    setImagesLoaded((prev) => prev + 1);
  };

  const handleGuestCheckout = (): void => {
    // Navigate to welcome screen for authentication
    navigateToAuth();
  };

  // Format price for display
  const formattedPrice: string =
    price && price.amount
      ? `$${parseFloat(price.amount).toFixed(2)} ${price.currencyCode || "USD"}`
      : "Price unavailable";

  // Check if all variants are sold out
  const isSoldOut =
    variants && Array.isArray(variants) && variants.length > 0
      ? variants.every((variant) => !variant.available)
      : true;

  const handlePreviousImage = () => {
    setActiveIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const handleNextImage = () => {
    setActiveIndex((prev) => (prev + 1) % totalImages);
  };

  const renderImageCarousel = () => {
    if (!images || images.length === 0) {
      return (
        <View style={styles.swiperContainer}>
          <View style={styles.noImageContainer}>
            <Text style={styles.noImageText}>No images available</Text>
          </View>
        </View>
      );
    }

    // Use the new AppCarousel component for multiple images
    if (totalImages > 1) {
      return (
        <View style={styles.swiperContainer}>
          {isLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator
                size="large"
                color={GlobalStyles.colors.red7}
              />
            </View>
          )}

          <AppCarousel
            data={images}
            height={windowWidth * 1.2}
            currentIndex={activeIndex}
            onSnapToItem={handleImageCarouselSwipe}
            showsPagination={true}
            paginationStyle={styles.pagination}
            renderItem={({ item, index }) => (
              <Image
                source={{ uri: item.src }}
                style={styles.images}
                resizeMode="cover"
                onLoad={handleImageLoad}
                onError={handleImageLoad}
                accessibilityLabel={`Product image ${
                  index + 1
                } of ${totalImages}`}
              />
            )}
          />

          <View style={styles.imageNavContainer}>
            <Text style={styles.imageCounterText}>
              {`${activeIndex + 1}/${totalImages}`}
            </Text>
          </View>
        </View>
      );
    }

    // For a single image, just display it without carousel functionality
    return (
      <View style={styles.swiperContainer}>
        {isLoading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={GlobalStyles.colors.red7} />
          </View>
        )}

        <Image
          source={{ uri: images[0].src }}
          style={styles.images}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={handleImageLoad}
          accessibilityLabel="Product image"
        />
      </View>
    );
  };

  return (
    <ProductFetchErrorBoundary>
      <View style={styles.rootContainer}>
        <StatusBar barStyle="light-content" />

        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
          accessibilityLabel="Product details page"
        >
          {renderImageCarousel()}

          <View style={styles.productInfoContainer}>
            <View style={styles.titlePriceContainer}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.price}>{formattedPrice}</Text>
            </View>

            {descriptionHtml && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>
                  {descriptionHtml.replace(/<[^>]+>/g, "")}
                </Text>
              </View>
            )}

            {variants && variants.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Available Options</Text>
                <View style={styles.variantsList}>
                  {variants
                    .filter((variant) => variant.available)
                    .map((variant, index) => (
                      <View key={index} style={styles.optionContainer}>
                        <Text style={styles.optionText}>
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

            <TouchableOpacity
              style={[styles.actionButton, isSoldOut && styles.disabledButton]}
              onPress={handleGuestCheckout}
              disabled={isSoldOut}
              accessibilityRole="button"
              accessibilityLabel={
                isSoldOut ? "Product sold out" : "Sign in to purchase"
              }
              accessibilityHint="Redirects to login screen"
            >
              <Text style={styles.actionButtonText}>
                {isSoldOut ? "SOLD OUT" : "SIGN IN TO PURCHASE"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.reminderText}>
              Sign in or create an account to purchase this item
            </Text>
          </View>
        </ScrollView>
      </View>
    </ProductFetchErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20, // Adjust for status bar
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "black",
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  swiperContainer: {
    height: windowWidth * 1.1,
    position: "relative",
    backgroundColor: "#111",
  },
  pagination: {
    bottom: 20,
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
  images: {
    width: "100%",
    height: "100%",
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
  imageNavContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  imageNavButton: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    color: "white",
    fontFamily,
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignSelf: "center",
  },
  productInfoContainer: {
    padding: 20,
    backgroundColor: "#0d0d0d",
  },
  titlePriceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  title: {
    fontFamily,
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    flex: 3,
    marginRight: 10,
  },
  price: {
    fontFamily,
    fontSize: 20,
    fontWeight: "600",
    color: GlobalStyles.colors.red7 || "#ff3c00",
    flex: 1,
    textAlign: "right",
  },
  sectionContainer: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingTop: 15,
  },
  sectionTitle: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
  },
  description: {
    fontFamily,
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
  variantsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  optionContainer: {
    backgroundColor: "#222",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionText: {
    color: "#ccc",
    fontFamily,
    fontSize: 14,
  },
  soldOutText: {
    color: "#ff6666",
    fontFamily,
    fontSize: 14,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: GlobalStyles.colors.red7 || "#ff3c00",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: "#333",
  },
  actionButtonText: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  reminderText: {
    color: "#aaa",
    fontFamily,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
