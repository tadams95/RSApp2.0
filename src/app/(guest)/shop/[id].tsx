import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import { ProductFetchErrorBoundary } from "../../../components/shopify";
import AppCarousel from "../../../components/ui/AppCarousel";
import { Theme } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Parse the serialized product data
  const data: ProductData = JSON.parse(params.data as string);
  const { title, images, price, descriptionHtml, variants } = data;

  // Component state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [imagesLoaded, setImagesLoaded] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Extract unique available sizes and colors
  const availableSizes = useMemo(() => {
    if (!variants) return [];
    const sizes = variants
      .filter((v) => v.available && v.size)
      .map((v) => v.size as string);
    return Array.from(new Set(sizes));
  }, [variants]);

  const availableColors = useMemo(() => {
    if (!variants) return [];
    const colors = variants
      .filter((v) => v.available && v.color && v.color !== "Default")
      .map((v) => v.color);
    return Array.from(new Set(colors));
  }, [variants]);

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
              <ActivityIndicator size="large" color={theme.colors.accent} />
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
            <ActivityIndicator size="large" color={theme.colors.accent} />
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
            <Ionicons
              name="arrow-back"
              size={22}
              color={theme.colors.textPrimary}
            />
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

            {(availableSizes.length > 0 || availableColors.length > 0) && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Available Options</Text>

                {availableSizes.length > 0 && (
                  <View style={styles.optionGroup}>
                    <Text style={styles.optionLabel}>Sizes</Text>
                    <View style={styles.chipContainer}>
                      {availableSizes.map((size, index) => (
                        <View key={index} style={styles.chip}>
                          <Text style={styles.chipText}>{size}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {availableColors.length > 0 && (
                  <View style={styles.optionGroup}>
                    <Text style={styles.optionLabel}>Colors</Text>
                    <View style={styles.chipContainer}>
                      {availableColors.map((color, index) => (
                        <View key={index} style={styles.chip}>
                          <Text style={styles.chipText}>{color}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {availableSizes.length === 0 &&
                  availableColors.length === 0 && (
                    <Text style={styles.soldOutText}>
                      All options are currently sold out
                    </Text>
                  )}
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

const createStyles = (theme: Theme) => ({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    position: "absolute" as const,
    top: Platform.OS === "ios" ? 50 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  swiperContainer: {
    height: windowWidth * 1.1,
    position: "relative" as const,
    backgroundColor: theme.colors.bgElev1,
  },
  pagination: {
    bottom: 20,
  },
  loaderContainer: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 10,
  },
  images: {
    width: "100%" as const,
    height: "100%" as const,
  },
  noImageContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev2,
  },
  noImageText: {
    color: theme.colors.textSecondary,
    fontFamily,
    fontSize: 16,
  },
  imageNavContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    position: "absolute" as const,
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
    color: theme.colors.textPrimary,
    fontFamily,
    fontSize: 14,
    fontWeight: "600" as const,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignSelf: "center" as const,
  },
  productInfoContainer: {
    padding: 20,
    backgroundColor: theme.colors.bgElev1,
  },
  titlePriceContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 15,
  },
  title: {
    fontFamily,
    fontSize: 22,
    fontWeight: "bold" as const,
    color: theme.colors.textPrimary,
    flex: 3,
    marginRight: 10,
  },
  price: {
    fontFamily,
    fontSize: 20,
    fontWeight: "600" as const,
    color: theme.colors.accent,
    flex: 1,
    textAlign: "right" as const,
  },
  sectionContainer: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.bgElev2,
    paddingTop: 15,
  },
  sectionTitle: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold" as const,
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  description: {
    fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  variantsList: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
  },
  optionGroup: {
    marginBottom: 16,
  },
  optionLabel: {
    fontFamily,
    fontSize: 14,
    fontWeight: "600" as const,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  chip: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontFamily,
    fontSize: 14,
    fontWeight: "500" as const,
  },
  optionContainer: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionText: {
    color: theme.colors.textSecondary,
    fontFamily,
    fontSize: 14,
  },
  soldOutText: {
    color: theme.colors.danger,
    fontFamily,
    fontSize: 14,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center" as const,
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: theme.colors.bgElev2,
  },
  actionButtonText: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold" as const,
    color: theme.colors.textPrimary,
  },
  reminderText: {
    color: theme.colors.textSecondary,
    fontFamily,
    fontSize: 12,
    textAlign: "center" as const,
    marginTop: 12,
  },
});
