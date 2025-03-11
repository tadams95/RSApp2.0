import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import Swiper from "react-native-swiper";

export default function GuestProductDetail({ route, navigation }) {
  const { data } = route.params;
  const { title, images, price, description, variants } = data;

  const [isLoading, setIsLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const totalImages = images.length;

  useEffect(() => {
    // When all images are loaded, set loading to false
    if (imagesLoaded >= totalImages && totalImages > 0) {
      setIsLoading(false);
    }
  }, [imagesLoaded, totalImages]);

  const handleImageLoad = () => {
    setImagesLoaded((prev) => prev + 1);
  };

  const handleGuestCheckout = () => {
    navigation.navigate("WelcomeScreen");
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Format price for display
  const formattedPrice =
    price && price.amount
      ? `$${price.amount}0 ${price.currencyCode || "USD"}`
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
              {images.map((image, index) => (
                <View key={index} style={styles.slideContainer}>
                  <Image
                    source={{ uri: image.src }}
                    style={styles.images}
                    onLoad={handleImageLoad}
                    resizeMode="cover"
                    accessible={true}
                    accessibilityLabel={`Product image ${
                      index + 1
                    } of ${totalImages}`}
                  />
                </View>
              ))}
            </Swiper>
          ) : (
            // Single image view when there's just one image
            <View style={styles.singleImageContainer}>
              <Image
                source={{ uri: images[0].src }}
                style={styles.singleImage}
                onLoad={handleImageLoad}
                resizeMode="cover"
                accessible={true}
                accessibilityLabel="Product image"
              />
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

          {/* Variants Section - Display if there are variants */}
          {variants && variants.length > 1 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Available Options</Text>
              <View style={styles.variantsList}>
                {variants.map(
                  (variant, index) =>
                    variant.available && (
                      <View key={index} style={styles.variantItem}>
                        <Text style={styles.variantText}>
                          {variant.size && `Size: ${variant.size}`}
                          {variant.size && variant.color && " | "}
                          {variant.color &&
                            variant.color !== "Default" &&
                            `Color: ${variant.color}`}
                        </Text>
                      </View>
                    )
                )}
              </View>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGuestCheckout}
            accessible={true}
            accessibilityLabel="Log in or sign up to check out"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>
              LOG IN OR SIGN UP TO CHECK OUT
            </Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimerText}>
            Create an account or log in to purchase this item and access more
            features.
          </Text>
        </View>
      </ScrollView>
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
  variantsList: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 8,
  },
  variantItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  variantText: {
    fontFamily,
    color: "white",
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    marginTop: 16,
    padding: 16,
    alignItems: "center",
  },
  actionButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  disclaimerText: {
    fontFamily,
    color: "#999",
    textAlign: "center",
    fontSize: 12,
    marginHorizontal: 10,
    marginTop: 16,
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
