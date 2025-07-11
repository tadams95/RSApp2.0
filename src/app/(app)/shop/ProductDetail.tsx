import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react"; // Ensured useMemo is imported
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import { usePostHog } from "../../../analytics/PostHogProvider";
import {
  CartOperationErrorBoundary,
  ProductFetchErrorBoundary,
} from "../../../components/shopify";
import { AppCarousel, ImageWithFallback } from "../../../components/ui";
import { GlobalStyles } from "../../../constants/styles";
import { useErrorHandler } from "../../../hooks/useErrorHandler";
import { getProductLoadingState, useProduct } from "../../../hooks/useProducts"; // Use React Query hook
import { addToCart, CartItem } from "../../../store/redux/cartSlice";

// Define types based on your Shopify product structure (similar to ShopScreen)
interface ShopifyProductImage {
  url: string;
  altText?: string;
}
interface ShopifyProductVariant {
  id: string;
  title: string; // e.g., "Small / Red"
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale?: boolean;
  // Add other variant properties you need
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

interface ProductDetailProps {
  handle: string;
}

export default function ProductDetailScreen({ handle }: ProductDetailProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { error, setError, clearError } = useErrorHandler();
  const { track } = usePostHog();

  // Use React Query for product fetching
  const productQuery = useProduct(handle);
  const {
    isLoading,
    isError,
    error: productError,
  } = getProductLoadingState(productQuery);
  const product = productQuery.data;

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

  const availableSizes = useMemo(() => {
    if (!product) return [];
    const sizes = product.variants
      .map((v) => v.selectedOptions?.find((opt) => opt.name === "Size")?.value)
      .filter(Boolean) as string[];

    // Create an array of unique sizes without using spread operator on Set
    return Array.from(new Set(sizes));
  }, [product]);

  const availableColors = useMemo(() => {
    if (!product) return [];
    // This might need refinement based on how your color variants are structured
    const colors = product.variants
      .map((v) => v.selectedOptions?.find((opt) => opt.name === "Color")?.value)
      .filter(Boolean) as string[];

    // Create an array of unique colors without using spread operator on Set
    return Array.from(new Set(colors));
  }, [product]);

  const handleBackPress = () => {
    router.back();
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setSizeModalVisible(false);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setColorModalVisible(false);
  };

  const handleQuantitySelect = (quantity: number) => {
    setSelectedQuantity(quantity);
    setQuantityModalVisible(false);
  };

  const handleAddToCart = () => {
    if (!product) return;

    let missingSelection = "";
    if (availableSizes.length > 0 && !selectedSize) missingSelection = "size";
    else if (availableColors.length > 0 && !selectedColor)
      missingSelection = "color";
    else if (selectedQuantity <= 0)
      missingSelection = "quantity (must be greater than 0)";

    if (missingSelection) {
      Alert.alert(`Please select a ${missingSelection}.`);
      return;
    }

    // Find the specific variant based on selections (this might need adjustment)
    const matchedVariant = product.variants.find((variant) => {
      const sizeMatch =
        !selectedSize ||
        variant.selectedOptions?.some(
          (opt) => opt.name === "Size" && opt.value === selectedSize
        );
      const colorMatch =
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
      selectedColor: selectedColor || "", // Ensure it's never null
      selectedSize: selectedSize || "", // Ensure it's never null
      selectedQuantity: selectedQuantity,
      // Additional cart information
      title: product.title,
      image: product.images[0]?.url,
      price: {
        amount: parseFloat(matchedVariant.price.amount),
        currencyCode: matchedVariant.price.currencyCode,
      },
      variantId: matchedVariant.id,
    };

    // Track add to cart event with PostHog e-commerce properties
    track("add_to_cart", {
      $revenue: parseFloat(matchedVariant.price.amount) * selectedQuantity,
      $currency: matchedVariant.price.currencyCode,
      product_id: product.id,
      product_name: product.title,
      price: parseFloat(matchedVariant.price.amount),
      quantity: selectedQuantity,
      variant_id: matchedVariant.id,
      selected_size: selectedSize || null,
      selected_color: selectedColor || null,
      category: "merchandise",
      source: "product_detail_page",
    });

    dispatch(addToCart(productToAdd));
    setAddToCartConfirmationVisible(true);
    // Optionally reset selections
    // setSelectedSize(null);
    // setSelectedColor(null);
    // setSelectedQuantity(0);
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
            onSnapToItem={(index) => setActiveIndex(index)}
            showsPagination={true}
            paginationStyle={styles.pagination}
            renderItem={({ item, index }) => (
              <ImageWithFallback
                source={{ uri: item.url }}
                fallbackSource={require("../../../assets/ShopHero_1.png")}
                style={styles.images}
                resizeMode="cover"
                cacheType="PRODUCT"
                cacheId={`product-${product.id}-${index}`}
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
        <ImageWithFallback
          source={{ uri: product.images[0].url }}
          fallbackSource={require("../../../assets/ShopHero_1.png")}
          style={styles.images}
          resizeMode="cover"
          cacheType="PRODUCT"
          cacheId={`product-${product.id}-single`}
          accessibilityLabel="Product image"
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GlobalStyles.colors.red7} />
      </View>
    );
  }

  if (productError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{productError}</Text>
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
        <Text style={styles.errorText}>
          Product not found. Please try another product.
        </Text>
      </View>
    );
  }

  const formattedPrice = product.variants[0]?.price
    ? `$${parseFloat(product.variants[0].price.amount).toFixed(2)} ${
        product.variants[0].price.currencyCode || "USD"
      }`
    : "Price unavailable";

  return (
    <ProductFetchErrorBoundary
      onProductNotFound={() => {
        Alert.alert(
          "Product Not Found",
          "This product is no longer available. Returning to shop.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }}
    >
      <View style={styles.rootContainer}>
        <StatusBar barStyle="light-content" />

        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

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
                {/* Consider using react-native-render-html for HTML content */}
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

            <CartOperationErrorBoundary>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAddToCart}
              >
                <Text style={styles.actionButtonText}>ADD TO CART</Text>
              </TouchableOpacity>
            </CartOperationErrorBoundary>
          </View>
        </ScrollView>

        {/* Modals (Size, Color, Quantity, Confirmation) - Simplified for brevity */}
        {/* Size Modal */}
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
                {availableSizes.map((size, index) => (
                  <TouchableOpacity
                    key={index}
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

        {/* Color Modal */}
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
                {availableColors.map((color, index) => (
                  <TouchableOpacity
                    key={index}
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

        {/* Quantity Modal */}
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
                <TouchableOpacity
                  onPress={() => setQuantityModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {/* Max quantity of 10 for example */}
                {Array.from({ length: 10 }, (_, i) => i + 1).map(
                  (quantity, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.modalItem}
                      onPress={() => handleQuantitySelect(quantity)}
                    >
                      <Text style={styles.modalItemText}>{quantity}</Text>
                    </TouchableOpacity>
                  )
                )}
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

// Styles adapted from ProductDetailScreen.js - review and adjust as needed for dark theme and consistency
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: 0, // Ensure no top padding
    marginTop: 0, // Ensure no top margin
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20, // Adjust for status bar
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between", // Aligns back button to left, counter to right
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  }, // Semi-transparent background
  imageNavContainer: {
    // For next/prev image buttons
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
  scrollView: { flex: 1, backgroundColor: "black" },
  scrollViewContent: { paddingBottom: 40 }, // Ensure space for content below fold
  swiperContainer: {
    height: windowWidth * 1.1, // Match guest version height exactly
    position: "relative",
    backgroundColor: "#111",
  }, // Darker placeholder
  pagination: {
    bottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  errorMessage: {
    width: "100%",
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
  retryButtonText: { color: "white", fontFamily },
  images: { width: "100%", height: "100%" },
  productInfoContainer: { padding: 20, backgroundColor: "#0d0d0d" }, // Slightly off-black for info section
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
  }, // Use red color to match guest version
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
  descriptionContainer: { maxHeight: 100 }, // Limit description height, consider a "Read More" option
  description: { fontFamily, fontSize: 14, color: "#ccc", lineHeight: 20 },
  optionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  optionLabel: { fontFamily, fontSize: 15, color: "white" },
  optionSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 5,
  },
  optionText: { fontFamily, fontSize: 15, color: "white", marginRight: 8 },
  actionButton: {
    backgroundColor: GlobalStyles.colors.red7 || "#ff3c00",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  actionButtonText: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  }, // White text to match guest version
  // Modal Styles (keep them consistent)
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 20,
    maxHeight: windowHeight * 0.5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
  modalTitle: { fontFamily, fontSize: 18, fontWeight: "bold", color: "white" },
  modalScroll: { maxHeight: windowHeight * 0.3 },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalItemText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    textAlign: "center",
  },
  confirmationModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  confirmationModalContent: {
    backgroundColor: "#1e1e1e",
    padding: 30,
    borderRadius: 10,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmationModalText: {
    fontFamily,
    fontSize: 16,
    color: "white",
    textAlign: "center",
    marginBottom: 20,
  },
  confirmationButton: {
    backgroundColor: GlobalStyles.colors.red7 || "#ff3c00",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  confirmationButtonText: {
    fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
});
