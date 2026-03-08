import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import ErrorBoundary from "../../../components/ErrorBoundary";
import AppCarousel from "../../../components/ui/AppCarousel";
import type { Theme } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { getProductLoadingState, useProduct } from "../../../hooks/useProducts";
import { addToCart, CartItem } from "../../../store/redux/cartSlice";

// Importing the ProductDetail component
import ProductDetail from "./ProductDetail";

// Wrapping the ProductDetail with ErrorBoundary
export default function ProductDetailScreenWithErrorBoundary() {
  const params = useLocalSearchParams<{ handle: string }>();

  return (
    <ErrorBoundary>
      <ProductDetail handle={params.handle} />
    </ErrorBoundary>
  );
}

// Define types based on your Shopify product structure
interface ShopifyProductImage {
  url: string;
  altText?: string;
}
interface ShopifyProductVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale?: boolean;
  selectedOptions?: Array<{ name: string; value: string }>;
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
}

function ProductDetailScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const { track } = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Use React Query for product fetching
  const productQuery = useProduct(handle);
  const { isLoading, isError, error } = getProductLoadingState(productQuery);
  const product = productQuery.data;

  // Track screen view for analytics
  useScreenTracking("Product Detail", {
    productId: product?.id || null,
    productName: product?.title || null,
    productHandle: handle,
    price: product?.variants?.[0]?.price?.amount
      ? parseFloat(product.variants[0].price.amount)
      : 0,
    currency: product?.variants?.[0]?.price?.currencyCode || "USD",
    userType: "authenticated",
    imageCount: product?.images?.length || 0,
    variantCount: product?.variants?.length || 0,
    hasDescription: !!product?.descriptionHtml,
    isLoading: isLoading,
    isError: isError,
  });

  // Track product view when product data is loaded
  useEffect(() => {
    if (product && handle) {
      const firstVariant = product.variants?.[0];
      const price = firstVariant?.price?.amount
        ? parseFloat(firstVariant.price.amount)
        : 0;

      track("product_viewed", {
        product_id: product.id,
        product_name: product.title,
        product_handle: handle,
        price: price,
        currency: firstVariant?.price?.currencyCode || "USD",
        category: "merchandise",
        image_count: product.images?.length || 0,
        variant_count: product.variants?.length || 0,
        has_description: !!product.descriptionHtml,
        screen_type: "authenticated",
      });
    }
  }, [product, handle, track]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(0);

  const [sizeModalVisible, setSizeModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] =
    useState(false);
  const [activeIndex, setActiveIndex] = useState(0); // For image swiping

  // Track image carousel interactions
  const handleImageCarouselSwipe = (index: number) => {
    setActiveIndex(index);

    // Track carousel interaction for analytics
    if (product) {
      track("product_image_carousel_swipe", {
        product_id: product.id,
        product_name: product.title,
        product_handle: handle,
        image_index: index,
        total_images: product.images?.length || 0,
        swipe_direction: index > activeIndex ? "next" : "previous",
        user_type: "authenticated",
      });
    }
  };

  const availableSizes = useMemo(() => {
    if (!product) return [];
    const sizes = product.variants
      .map((v) => v.selectedOptions?.find((opt) => opt.name === "Size")?.value)
      .filter(Boolean) as string[];

    return Array.from(new Set(sizes));
  }, [product]);

  const availableColors = useMemo(() => {
    if (!product) return [];
    const colors = product.variants
      .map((v) => v.selectedOptions?.find((opt) => opt.name === "Color")?.value)
      .filter(Boolean) as string[];

    return Array.from(new Set(colors));
  }, [product]);

  const handleBackPress = () => {
    router.back();
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setSizeModalVisible(false);

    // Track variant selection for analytics
    track("product_variant_selected", {
      product_id: product?.id || null,
      product_name: product?.title || null,
      product_handle: handle,
      variant_type: "size",
      variant_value: size,
      available_sizes: availableSizes.length,
      user_type: "authenticated",
    });
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setColorModalVisible(false);

    // Track variant selection for analytics
    track("product_variant_selected", {
      product_id: product?.id || null,
      product_name: product?.title || null,
      product_handle: handle,
      variant_type: "color",
      variant_value: color,
      available_colors: availableColors.length,
      user_type: "authenticated",
    });
  };

  const handleQuantitySelect = (quantity: number) => {
    setSelectedQuantity(quantity);
    setQuantityModalVisible(false);

    // Track variant selection for analytics
    track("product_variant_selected", {
      product_id: product?.id || null,
      product_name: product?.title || null,
      product_handle: handle,
      variant_type: "quantity",
      variant_value: quantity,
      user_type: "authenticated",
    });
  };

  const handleAddToCart = () => {
    if (!product) return;

    let missingSelection = "";
    if (availableSizes.length > 0 && !selectedSize) missingSelection = "size";
    else if (availableColors.length > 0 && !selectedColor)
      missingSelection = "color";
    else if (!selectedQuantity) missingSelection = "quantity";

    if (missingSelection) {
      Alert.alert(
        "Selection Required",
        `Please select a ${missingSelection} before adding to cart.`
      );
      return;
    }

    // Find the matching variant based on selected options
    const matchedVariant = product.variants.find((variant) => {
      // Check size match if sizes are available
      const sizeMatch =
        !availableSizes.length ||
        !selectedSize ||
        variant.selectedOptions?.some(
          (opt) => opt.name === "Size" && opt.value === selectedSize
        );
      // Check color match if colors are available
      const colorMatch =
        !availableColors.length ||
        !selectedColor ||
        variant.selectedOptions?.some(
          (opt) => opt.name === "Color" && opt.value === selectedColor
        );
      return sizeMatch && colorMatch && variant.availableForSale;
    });

    if (!matchedVariant) {
      Alert.alert("Selected combination is not available.");
      return;
    }

    // Structure the product according to the CartItem interface
    const productToAdd: CartItem = {
      productId: product.id,
      selectedColor: selectedColor || "",
      selectedSize: selectedSize || "",
      selectedQuantity: selectedQuantity,
      title: product.title,
      image: product.images[0]?.url,
      price: {
        amount: parseFloat(matchedVariant.price.amount),
        currencyCode: matchedVariant.price.currencyCode,
      },
      variantId: matchedVariant.id,
    };
    dispatch(addToCart(productToAdd));
    setAddToCartConfirmationVisible(true);
  };

  const closeAddToCartConfirmation = () => {
    setAddToCartConfirmationVisible(false);
  };

  const renderImageCarousel = () => {
    if (!product || !product.images || product.images.length === 0) return null;

    const totalImages = product.images.length;

    // Use the AppCarousel component for multiple images
    if (totalImages > 1) {
      return (
        <View style={styles.swiperContainer}>
          <AppCarousel
            data={product.images}
            height={windowWidth * 1.1}
            currentIndex={activeIndex}
            onSnapToItem={handleImageCarouselSwipe}
            renderItem={({ item, index }) => (
              <Image
                source={{ uri: item.url }}
                style={styles.productImage}
                resizeMode="cover"
                accessibilityLabel={
                  item.altText || `Product image ${index + 1}`
                }
              />
            )}
          />
          <View style={styles.imageCounterContainer}>
            <Text style={styles.imageCounterText}>
              {activeIndex + 1} / {totalImages}
            </Text>
          </View>
        </View>
      );
    }

    // Single image display is simpler
    return (
      <View style={styles.swiperContainer}>
        <Image
          source={{ uri: product.images[0].url }}
          style={styles.productImage}
          resizeMode="cover"
          accessibilityLabel="Product image"
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => productQuery.refetch()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
      </View>
    );
  }

  const formattedPrice = product.variants[0]?.price
    ? `$${parseFloat(product.variants[0].price.amount).toFixed(2)} ${
        product.variants[0].price.currencyCode || "USD"
      }`
    : "Price unavailable";

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {renderImageCarousel()}

        <View style={styles.productInfoContainer}>
          <View style={styles.titlePriceContainer}>
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.price}>{formattedPrice}</Text>
          </View>

          {product.descriptionHtml && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {product.descriptionHtml.replace(/<[^>]+>/g, "")}
              </Text>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Product Options</Text>
            {availableSizes.length > 0 && (
              <View style={styles.optionContainer}>
                <Text style={styles.optionLabel}>Size:</Text>
                <TouchableOpacity
                  style={styles.optionSelector}
                  onPress={() => setSizeModalVisible(true)}
                >
                  <Text style={styles.optionText}>
                    {selectedSize || "Select Size"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="white" />
                </TouchableOpacity>
              </View>
            )}
            {availableColors.length > 0 && (
              <View style={styles.optionContainer}>
                <Text style={styles.optionLabel}>Color:</Text>
                <TouchableOpacity
                  style={styles.optionSelector}
                  onPress={() => setColorModalVisible(true)}
                >
                  <Text style={styles.optionText}>
                    {selectedColor || "Select Color"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="white" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.optionContainer}>
              <Text style={styles.optionLabel}>Quantity:</Text>
              <TouchableOpacity
                style={styles.optionSelector}
                onPress={() => setQuantityModalVisible(true)}
              >
                <Text style={styles.optionText}>
                  {selectedQuantity || "Select Quantity"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (!selectedSize && availableSizes.length > 0) ||
              (!selectedColor && availableColors.length > 0) ||
              !selectedQuantity
                ? { opacity: 0.6 }
                : null,
            ]}
            onPress={handleAddToCart}
            disabled={
              (!selectedSize && availableSizes.length > 0) ||
              (!selectedColor && availableColors.length > 0) ||
              !selectedQuantity
            }
          >
            <Text style={styles.actionButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Size Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sizeModalVisible}
        onRequestClose={() => setSizeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Size</Text>
              <TouchableOpacity onPress={() => setSizeModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {availableSizes.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={styles.modalItem}
                  onPress={() => handleSizeSelect(size)}
                >
                  <Text style={styles.modalItemText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Color Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={colorModalVisible}
        onRequestClose={() => setColorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Color</Text>
              <TouchableOpacity onPress={() => setColorModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {availableColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={styles.modalItem}
                  onPress={() => handleColorSelect(color)}
                >
                  <Text style={styles.modalItemText}>{color}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quantity Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={quantityModalVisible}
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Quantity</Text>
              <TouchableOpacity onPress={() => setQuantityModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {[1, 2, 3, 4, 5].map((quantity) => (
                <TouchableOpacity
                  key={quantity}
                  style={styles.modalItem}
                  onPress={() => handleQuantitySelect(quantity)}
                >
                  <Text style={styles.modalItemText}>{quantity}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add to Cart Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addToCartConfirmationVisible}
        onRequestClose={closeAddToCartConfirmation}
      >
        <View style={styles.confirmationModalOverlay}>
          <View style={styles.confirmationModalContent}>
            <Text style={styles.confirmationModalText}>
              Item(s) successfully added to cart!
            </Text>
            <TouchableOpacity
              style={styles.confirmationButton}
              onPress={closeAddToCartConfirmation}
            >
              <Text style={styles.confirmationButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const createStyles = (theme: Theme) =>
  ({
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
      paddingHorizontal: theme.spacing.lg,
    },
    backButton: {
      padding: theme.spacing.sm,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)",
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
      padding: theme.spacing.sm,
      borderRadius: 20,
    },
    imageCounterContainer: {
      position: "absolute" as const,
      bottom: 15,
      alignSelf: "center" as const,
    },
    imageCounterText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.meta,
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 15,
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
    productImage: {
      width: "100%" as const,
      height: "100%" as const,
      backgroundColor: theme.colors.bgElev2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.bgRoot,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.bgRoot,
      padding: theme.spacing.xl,
    },
    errorText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      textAlign: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    retryButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: theme.radius.button,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: theme.typography.weights.bold,
    },
    productInfoContainer: {
      padding: theme.spacing.lg,
    },
    titlePriceContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
      flex: 2,
      marginRight: 10,
    },
    price: {
      fontSize: 18,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.accent,
      flex: 1,
      textAlign: "right" as const,
    },
    sectionContainer: {
      marginBottom: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
      paddingTop: 15,
    },
    sectionTitle: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
      marginBottom: 10,
    },
    descriptionContainer: {
      maxHeight: 100,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    optionContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 12,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    optionLabel: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
    },
    optionSelector: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.bgElev2,
      borderRadius: theme.radius.button,
    },
    optionText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.sm,
    },
    actionButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 15,
      borderRadius: theme.radius.button,
      alignItems: "center" as const,
      marginTop: 10,
    },
    actionButtonText: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textInverse,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end" as const,
      backgroundColor: theme.colors.overlay,
    },
    modalContent: {
      backgroundColor: theme.colors.bgElev2,
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      padding: theme.spacing.modalPadding,
      maxHeight: windowHeight * 0.5,
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
      paddingBottom: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
    },
    modalScroll: {
      maxHeight: windowHeight * 0.3,
    },
    modalItem: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderStrong,
    },
    modalItemText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      textAlign: "center" as const,
    },
    confirmationModalOverlay: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.overlay,
    },
    confirmationModalContent: {
      backgroundColor: theme.colors.bgElev2,
      padding: 30,
      borderRadius: theme.radius.card,
      alignItems: "center" as const,
      width: "80%" as const,
      ...theme.shadows.modal,
    },
    confirmationModalText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textPrimary,
      textAlign: "center" as const,
      marginBottom: theme.spacing.xl,
    },
    confirmationButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 30,
      borderRadius: theme.radius.button,
    },
    confirmationButtonText: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.bold,
    },
  } as const);
