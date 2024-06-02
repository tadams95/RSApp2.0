import React, { useState } from "react";
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
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { useDispatch } from "react-redux";
import { addToCart } from "../../store/redux/cartSlice";

// import Modal from "react-native-modal";
import Swiper from "react-native-swiper";

export default function ProductDetailScreen({ route }) {
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
  const [addToCartConfirmationVisible, setAddToCartConfirmationVisible] =
    useState(false);

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

  const formattedAmount = parseFloat(price.amount).toFixed(2);
  const displayPrice = `${formattedAmount}`;

  return (
    <ScrollView style={{ backgroundColor: "black" }}>
      <View style={styles.container}>
        <Text style={styles.title}> {title}</Text>

        {/* Display product images with Swiper */}
        <View style={styles.swiperContainer}>
          <Swiper
            showsButtons={false}
            paginationStyle={{ bottom: 10, backgroundColor: "transparent" }}
            dotStyle={{
              backgroundColor: "rgba(255, 255, 255, 1)",
              width: 10,
              height: 10,
              borderRadius: 5,
            }}
            activeDotStyle={{
              backgroundColor: GlobalStyles.colors.red4,
              width: 12,
              height: 12,
              borderRadius: 6,
            }}
            style={{ height: Dimensions.get("window").width * 0.6 }} // Adjust height dynamically
          >
            {images &&
              images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image.src }}
                  style={styles.images}
                />
              ))}
          </Swiper>
        </View>

        {/* Display product description */}
        {description && (
          <View
            style={{
              borderWidth: 2,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingBottom: 25,
              marginTop: 20,
              borderColor: "white",
            }}
          >
            <Text style={styles.description}>{description}</Text>
          </View>
        )}

        {/* Display price */}
        {price && (
          <View>
            <Text style={styles.price}>
              ${displayPrice} {price.currencyCode}
            </Text>
          </View>
        )}

        <View style={styles.variantsContainer}>
          {/* Size variant dropdown */}
          <View style={styles.variantDropdown}>
            <Text style={styles.variantsTitle}>Size Options</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => setSizeModalVisible(true)}
            >
              <Text
                style={{
                  fontFamily,
                  textAlign: "center",
                  color: "white",
                  fontWeight: "500",
                }}
              >
                {selectedSize || "Size"}
              </Text>
            </Pressable>
            <Modal
              animationType="none"
              transparent={true}
              visible={sizeModalVisible}
            >
              {/* Size modal content */}
              <View style={styles.modalContainer3}>
                <ScrollView style={styles.sizeModalContainer}>
                  <Pressable onPress={() => setSizeModalVisible(false)}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                  {variants &&
                    // Create a set to track unique sizes
                    [...new Set(variants.map((variant) => variant.size))].map(
                      (uniqueSize, index) => (
                        <Pressable
                          key={index}
                          style={styles.modalItem}
                          onPress={() => handleSizeSelect(uniqueSize)}
                        >
                          <Text style={styles.variantsTitle}>{uniqueSize}</Text>
                          {/* Add more details as needed */}
                        </Pressable>
                      )
                    )}
                </ScrollView>
              </View>
            </Modal>
          </View>

          {/* Color variant dropdown */}
          <View style={styles.variantDropdown}>
            <Text style={styles.variantsTitle}>Color Options</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => setColorModalVisible(true)}
            >
              <Text
                style={{
                  fontFamily,
                  textAlign: "center",
                  color: "white",
                  fontWeight: "500",
                }}
              >
                {selectedColor || "Color"}
              </Text>
            </Pressable>
            <Modal
              animationType="none"
              transparent={true}
              visible={colorModalVisible}
            >
              {/* Color modal content */}
              <View style={styles.modalContainer3}>
                <ScrollView style={styles.modalContainer}>
                  <Pressable onPress={() => setColorModalVisible(false)}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                  {variants &&
                    // Create a set to track unique colors
                    [...new Set(variants.map((variant) => variant.color))].map(
                      (uniqueColor, index) => (
                        <Pressable
                          key={index}
                          style={styles.modalItem}
                          onPress={() => handleColorSelect(uniqueColor)}
                        >
                          <Text style={styles.variantsTitle}>
                            {uniqueColor}
                          </Text>
                          {/* Add more details as needed */}
                        </Pressable>
                      )
                    )}
                </ScrollView>
              </View>
            </Modal>
          </View>

          {/* Quantity variant dropdown */}
          <View style={styles.variantDropdown}>
            <Text style={styles.variantsTitle}>Quantity</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => setQuantityModalVisible(true)}
            >
              <Text
                style={{
                  fontFamily,
                  textAlign: "center",
                  color: "white",
                  fontWeight: "500",
                }}
              >
                {selectedQuantity || "0"}
              </Text>
            </Pressable>
            <Modal
              animationType="none"
              transparent={true}
              visible={quantityModalVisible}
            >
              {/* Quantity modal content */}
              <View style={styles.modalContainer3}>
                <ScrollView style={styles.quantityModalContainer}>
                  <Pressable onPress={() => setQuantityModalVisible(false)}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                  {/* Display numbers 0-9 */}
                  {Array.from({ length: 10 }, (_, index) => (
                    <Pressable
                      key={index}
                      style={styles.modalItem}
                      onPress={() => handleQuantitySelect(index)}
                    >
                      <Text style={styles.variantsTitle}>{index}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Modal>
          </View>
        </View>

        {/* Add to Cart Button */}
        <View style={styles.addToCartContainer}>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => handleAddToCart()}
          >
            <Text
              style={{
                fontFamily,
                textAlign: "center",
                color: "white",
                fontWeight: "500",
              }}
            >
              Add to Cart
            </Text>
          </Pressable>
        </View>

        {/* Add to Cart Confirmation Modal */}
        <Modal
          animationType="none"
          transparent={true}
          visible={addToCartConfirmationVisible}
        >
          <View style={styles.modalContainer2}>
            <View style={styles.modalContent2}>
              <Text style={styles.modalText2}>
                Item(s) successfully added to cart!
              </Text>
              <Pressable
                style={[styles.modalButton2, styles.confirmButton]}
                onPress={closeAddToCartConfirmation}
              >
                <Text style={styles.modalButtonText2}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingHorizontal: 16,
    paddingTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  images: {
    width: "100%",
    height: "90%",
    resizeMode: "cover", // Maintain aspect ratio and cover the entire container
    borderRadius: 10,
  },
  imageContainer: {
    alignItems: "center",
  },
  title: {
    fontFamily,
    fontWeight: "700",
    textAlign: "center",
    color: "white",
    paddingVertical: 4,
    fontSize: 20,
    marginBottom: 20,
    borderWidth: 2,
    padding: 10,
    borderRadius: 10,
    borderColor: "white",
  },
  price: {
    fontFamily,
    textAlign: "center",
    color: "white",
    paddingVertical: 4,
    fontSize: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    marginTop: 30,
    borderRadius: 10,
    alignItems: "center",
    borderColor: "white",
  },
  swiperContainer: {
    width: "100%",
    height: Dimensions.get("window").width * 0.87,
  },
  variantsContainer: {
    marginVertical: 20,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  variantDropdown: {
    flex: 1,
    marginRight: 10,
  },
  variantsTitle: {
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily,
    textAlign: "center",
    color: "white",
  },
  dropdownButton: {
    borderWidth: 2,
    borderColor: "#FFF",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
  },
  modalContainer: {
    marginVertical: "50%",
    marginHorizontal: "25%",
    backgroundColor: "black",
    padding: 20,
    borderRadius: 10,
  },
  sizeModalContainer: {
    marginVertical: "50%",
    marginHorizontal: "25%",
    backgroundColor: "black",
    padding: 20,
    borderRadius: 10,
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  quantityModalContainer: {
    marginVertical: "45%",
    marginHorizontal: "25%",
    backgroundColor: "black",
    padding: 20,
    paddingBottom: -20,
    borderRadius: 10,
  },
  selectedVariant: {
    borderColor: GlobalStyles.colors.redVivid4, // Change the border color for selected variant
  },
  description: {
    fontFamily,
    marginTop: 20,
    textAlign: "center",
    color: "white",
  },
  addToCartContainer: {
    marginTop: 5,
    marginBottom: 20,
    alignItems: "center",
  },

  modalContainer2: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    margin: -100,
  },
  modalContent2: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalText2: {
    // fontFamily: "ProximaNovaBlack",
    fontSize: 18,
    marginBottom: 20,
  },
  modalButton2: {
    padding: 10,
    borderRadius: 5,
    width: "70%",
    alignItems: "center",
    marginVertical: 10,
  },
  confirmButton: {
    backgroundColor: GlobalStyles.colors.grey9,
  },
  modalButtonText2: {
    // fontFamily: "ProximaNovaBlack",
    fontSize: 16,
    color: "white",
  },
  modalContainer3: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    margin: -100,
  },
  closeText: {
    // fontFamily: "ProximaNovaBlack",
    color: GlobalStyles.colors.red4,
    textAlign: "center",
    marginBottom: 50,
  },
});
