import React, { useState } from "react";
import {
  Text,
  View,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";

import Swiper from "react-native-swiper";

export default function GuestProductDetail({ route, navigation }) {
  const { data } = route.params;
  const {
    title,
    images,
    price,
    description,
    // Add other necessary fields
  } = data;

  const handleGuestCheckout = () => {
    navigation.navigate("WelcomeScreen");
  };

  const formattedAmount = parseFloat(price.amount).toFixed(2);

  return (
    <ScrollView style={{ backgroundColor: "black" }}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>

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
            removeClippedSubviews={false}
            style={{ height: Dimensions.get("window").width * 0.9 }} // Adjust height dynamically
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
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{description}</Text>
          </View>
        )}

        <Pressable onPress={handleGuestCheckout} style={styles.tabButton}>
          <Text style={styles.buttonText}>LOG IN OR SIGN UP TO CHECK OUT</Text>
        </Pressable>
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
    height: Dimensions.get("window").width * 0.97,
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
  tabButton: {
    backgroundColor: "#000",
    paddingVertical: windowHeight * 0.01, // Adjust padding dynamically based on window height
    paddingHorizontal: windowWidth * 0.04, // Adjust padding dynamically based on window width
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    width: windowWidth * 0.7,
    marginVertical: windowHeight * 0.025,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "500",
    color: "#FFF",
    fontFamily,
    fontSize: windowWidth * 0.031, // Adjust font size dynamically based on window width
  },
  descriptionContainer: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingBottom: 25,
    marginTop: 10,
    borderColor: "white",
  },
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: "red",
    width: 12,
    height: 12,
  },
  inactiveDot: {
    backgroundColor: "rgba(255, 255, 255, 1)",
  },
});
