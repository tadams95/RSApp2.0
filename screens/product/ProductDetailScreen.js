import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  Platform,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/redux/cartSlice";
import { Ionicons } from "@expo/vector-icons";
import Swiper from "react-native-swiper";

export default function ProductDetailScreen({ route, navigation }) {
  const { data } = route.params;
  const {
    productId,
    title,
    images,
    variants,
    price,
    description,
    // Add other necessary fields
  } = data;

  const dispatch = useDispatch();

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(0);
  const [sizeModalVisible, setSizeModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] = useState(false);
  
  // New states for image handling (similar to GuestProductDetail)
  const [isLoading, setIsLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const totalImages = images ? images.length : 0;

  useEffect(() => {
    // When all images are loaded, set loading to false
    if (imagesLoaded >= totalImages && totalImages > 0) {
      setIsLoading(false);
    }
  }, [imagesLoaded, totalImages]);

  const handleImageLoad = () => {
    setImagesLoaded((prev) => prev + 1);
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
    setTimeout(() => setSizeModalVisible(false), 50);
  };

  const handleColorSelect = (selectedColor) => {
    setSelectedColor(selectedColor);
    setTimeout(() => setColorModalVisible(false), 50);
  };

  const handleQuantitySelect = (quantity) => {
    setSelectedQuantity(quantity);
    setTimeout(() => setQuantityModalVisible(false), 50);
  };

  const handleAddToCart = () => {
    //check if all required selections are made
    if (selectedSize && selectedColor && selectedQuantity > 0) {
      const productToAdd = {
        productId: data.id, // Use data.productId here
        images,
        title,
        price,
        selectedVariant,
        selectedSize,
        selectedColor,
        selectedQuantity,
      };
      dispatch(addToCart(productToAdd));
      setAddToCartConfirmationVisible(true);
      setSelectedSize(null);
      setSelectedColor(null);
      setSelectedQuantity(0);
    } else {
      // Handle the case where not all required selections are made
      if (!selectedSize) {
        Alert.alert("Please select a size.");
      }
      if (!selectedColor) {
        Alert.alert("Please select a color.");
      }
      if (!(selectedQuantity > 0)) {
        Alert.alert("Please select a quantity greater than 0.");
      }
    }
  };

  const closeAddToCartConfirmation = () => {
    setAddToCartConfirmationVisible(false);
  };

  const formattedPrice =
    price && price.amount
      ? `$${parseFloat(price.amount).toFixed(2)} ${price.currencyCode || "USD"}`
      : "Price unavailable";

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" />

      {/* Header with back button and image counter */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          accessible={true}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>

        {totalImages > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {`${activeIndex + 1}/${totalImages}`}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Image Carousel */}
        <View style={styles.swiperContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}

          {totalImages > 1 ? (
            <Swiper
              style={styles.swiper}
              showsButtons={Platform.OS === "android"}
              loop={true}
              dot={<View style={styles.dot} />}
              activeDot={<View style={styles.activeDot} />}
              paginationStyle={styles.pagination}
              onIndexChanged={setActiveIndex}
              removeClippedSubviews={false}
              autoplay={false}
              buttonWrapperStyle={styles.buttonWrapperStyle}
              nextButton={
                <View style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </View>
              }
              prevButton={
                <View style={styles.navButton}>
                  <Ionicons name="chevron-back" size={24} color="white" />
                </View>
              }
            >
              {images && images.map((image, index) => (
                <View key={index} style={styles.slideContainer}>
                  <Image
                    source={{ uri: image.src }}
                    style={styles.images}
                    onLoad={handleImageLoad}
                    resizeMode="cover"
                    accessible={true}
                    accessibilityLabel={`Product image ${index + 1} of ${totalImages}`}
                  />
                </View>
              ))}
            </Swiper>
          ) : (
            // Single image view when there's just one image
            <View style={styles.singleImageContainer}>
              {images && images.length > 0 && (
                <Image
                  source={{ uri: images[0].src }}
                  style={styles.singleImage}
                  onLoad={handleImageLoad}
                  resizeMode="cover"
                  accessible={true}
                  accessibilityLabel="Product image"
                />
              )}
            </View>
          )}
        </View>

        {/* Product Info Section */}
        <View style={styles.productInfoContainer}>
          {/* Title and Price */}
          <View style={styles.titlePriceContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.price}>{formattedPrice}</Text>
          </View>

          {/* Description Section */}
          {description && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <View style={styles.descriptionContainer}>
                <Text style={styles.description}>{description}</Text>
              </View>
            </View>
          )}

          {/* Product Options Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Product Options</Text>
            
            {/* Size Selection */}
            <View style={styles.optionContainer}>
              <Text style={styles.optionLabel}>Size:</Text>
              <TouchableOpacity
                style={styles.optionSelector}
                onPress={() => setSizeModalVisible(true)}
              >
                <Text style={styles.optionText}>{selectedSize || "Select Size"}</Text>
                <Ionicons name="chevron-down" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {/* Color Selection */}
            <View style={styles.optionContainer}>
              <Text style={styles.optionLabel}>Color:</Text>
              <TouchableOpacity
                style={styles.optionSelector}
                onPress={() => setColorModalVisible(true)}
              >
                <Text style={styles.optionText}>{selectedColor || "Select Color"}</Text>
                <Ionicons name="chevron-down" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {/* Quantity Selection */}
            <View style={styles.optionContainer}>
              <Text style={styles.optionLabel}>Quantity:</Text>
              <TouchableOpacity
                style={styles.optionSelector}
                onPress={() => setQuantityModalVisible(true)}
              >
                <Text style={styles.optionText}>{selectedQuantity || "Select Quantity"}</Text>
                <Ionicons name="chevron-down" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAddToCart}
            accessible={true}
            accessibilityLabel="Add to cart"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>ADD TO CART</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
              {variants &&
                [...new Set(variants.map((variant) => variant.size))].map(
                  (uniqueSize, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.modalItem}
                      onPress={() => handleSizeSelect(uniqueSize)}
                    >
                      <Text style={styles.modalItemText}>{uniqueSize}</Text>
                    </TouchableOpacity>
                  )
                )}
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
              {variants &&
                [...new Set(variants.map((variant) => variant.color))].map(
                  (uniqueColor, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.modalItem}
                      onPress={() => handleColorSelect(uniqueColor)}
                    >
                      <Text style={styles.modalItemText}>{uniqueColor}</Text>
                    </TouchableOpacity>
                  )
                )}
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
              <TouchableOpacity onPress={() => setQuantityModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {Array.from({ length: 10 }, (_, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalItem}
                  onPress={() => handleQuantitySelect(index)}
                >
                  <Text style={styles.modalItemText}>{index}</Text>
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

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  imageCounter: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  imageCounterText: {
    color: "white",
    fontFamily,
    fontSize: 12,
    fontWeight: "600",
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
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 10,
  },
  swiper: {
    backgroundColor: "#111",
  },
  slideContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  singleImageContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111",
  },
  images: {
    width: "100%",
    height: "100%",
  },
  singleImage: {
    width: "100%",
    height: "100%",
  },
  pagination: {
    bottom: 10,
  },
  dot: {
    backgroundColor: "rgba(255,255,255,.3)",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "white",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  productInfoContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  titlePriceContainer: {
    marginBottom: 20,
  },
  title: {
    fontFamily,
    fontWeight: "700",
    color: "white",
    fontSize: 24,
    marginBottom: 8,
  },
  price: {
    fontFamily,
    color: "white",
    fontSize: 18,
    opacity: 0.9,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily,
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  descriptionContainer: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
  },
  description: {
    fontFamily,
    color: "white",
    lineHeight: 22,
    opacity: 0.9,
  },
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 12,
  },
  optionLabel: {
    fontFamily,
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  optionSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    fontFamily,
    color: "white",
    marginRight: 8,
  },
  actionButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    marginTop: 16,
    padding: 15,
    alignItems: "center",
  },
  actionButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: windowHeight * 0.7,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    fontFamily,
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  modalScroll: {
    maxHeight: windowHeight * 0.5,
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalItemText: {
    fontFamily,
    color: "white",
    fontSize: 16,
  },
  confirmationModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmationModalContent: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    width: "80%",
  },
  confirmationModalText: {
    fontFamily,
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  confirmationButton: {
    backgroundColor: GlobalStyles.colors.red4,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  confirmationButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonWrapperStyle: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    left: 0,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
