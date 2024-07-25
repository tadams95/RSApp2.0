import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import React, { useLayoutEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { GlobalStyles } from "../constants/styles";

import fetchShopifyProducts from "../shopify/shopifyService";

export default function ShopScreen() {
  const [products, setProducts] = useState([]);
  const navigation = useNavigation();

  function handleProductPress(product) {
    const serializeObject = (obj) => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(serializeObject);
      }

      const serialized = {};
      for (const key in obj) {
        if (key !== "nextPageQueryAndPath" && typeof obj[key] !== "function") {
          serialized[key] = serializeObject(obj[key]);
        }
      }
      return serialized;
    };

    // Serialize product data
    const serializedProduct = {
      id: product.id,
      title: product.title,
      images: product.images.map((image) => ({ src: image.src })),
      variants: product.variants.map((variant) => {
        const [size, color] = (variant.title.split(" / ") || []).map((str) =>
          str.trim()
        );

        return {
          size:
            size ||
            (color
              ? variant.selectedOptions.find((opt) => opt.name === "Size")
                  ?.value
              : null),
          color: color ? color : "Default",
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
      description: product.descriptionHtml,
      // Add other necessary data here
    };

    navigation.navigate("ProductDetailScreen", { data: serializedProduct });
  }

  useLayoutEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedProducts = await fetchShopifyProducts();
        setProducts(fetchedProducts);
      } catch (error) {
        // Handle errors
        console.error(error);
      }
    };

    fetchData();
  }, []);

  return (
    <ScrollView style={{ backgroundColor: "#000" }}>
      <View style={styles.container}>
        {products.map((product) => (
          <View key={product.id} style={styles.itemsContainer}>
            <Pressable
              onPress={() => handleProductPress(product)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Image
                source={{ uri: product.images[0].src }}
                style={styles.image}
              />
              <Text style={styles.title}>{product.title}</Text>
              <Text style={styles.price}>
                ${product.variants[0].price.amount}0{" "}
                {product.variants[0].price.currencyCode}
              </Text>
            </Pressable>
          </View>
        ))}
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
    flexDirection: "row",
    flexWrap: "wrap", // Allow items to wrap to the next line
    justifyContent: "space-between", // Adjust as needed
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
    height: windowWidth > 600 ? 375 : 200, // Adjust height dynamically based on screen size
    width: "100%",
    alignSelf: "center",
    borderRadius: 8,
  },
  itemsContainer: {
    width: "48%", // Adjust as needed for spacing
    marginBottom: 10, // Adjust as needed for spacing
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
});
