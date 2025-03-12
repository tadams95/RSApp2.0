import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";

import {
  selectCartItems,
  removeFromCart,
  clearCart,
  setCheckoutPrice,
  selectCheckoutPrice,
} from "../store/redux/cartSlice";

import {
  selectUserEmail,
  selectLocalId,
  selectUserName,
  selectStripeCustomerId,
  selectExpoPushToken,
} from "../store/redux/userSlice";

import * as Notifications from "expo-notifications";

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  addDoc,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

import {
  StripeProvider,
  useStripe,
  AddressSheet,
} from "@stripe/stripe-react-native";

import { useState, useEffect } from "react";
import { GlobalStyles } from "../constants/styles";

export default function CartScreen({ navigation }) {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const [totalPrice, setTotalPrice] = useState(0);
  const [checkoutInProgress, setCheckoutInProgress] = useState(true);
  const [clearConfirmationModalVisible, setClearConfirmationModalVisible] =
    useState(false);
  const userEmail = useSelector(selectUserEmail);
  const firebaseId = useSelector(selectLocalId);
  const amount = useSelector(selectCheckoutPrice);
  const userName = useSelector(selectUserName);
  const stripeCustomerId = useSelector(selectStripeCustomerId);
  const expoPushToken = useSelector(selectExpoPushToken);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const firestore = getFirestore();
  const [loading, setLoading] = useState(false);
  const [paymentSheetInitialized, setPaymentSheetInitialized] = useState(false);
  const [stripePaymentIntent, setStripePaymentIntent] = useState("");
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [addressDetails, setAddressDetails] = useState(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);

  const API_URL =
    "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

  // Function to check if there are clothing items in the cart
  const hasClothingItems = cartItems.some((item) => !item.eventDetails);
  const shipping = hasClothingItems ? "$4.99" : "$0.00";

  useEffect(() => {
    // Calculate total price
    const newTotalPrice = cartItems.reduce((accumulator, item) => {
      const itemPrice = item.price.amount * item.selectedQuantity;
      return accumulator + itemPrice;
    }, 0);

    // Function to check if there are clothing items in the cart
    const hasClothingItems = cartItems.some((item) => !item.eventDetails);
    const shippingCost = hasClothingItems ? 4.99 : 0.0;

    // Calculate tax (assuming a tax rate of 10%)
    const taxRate = 0.1;
    const taxAmount = newTotalPrice * taxRate;

    // Calculate final total price including shipping and tax
    const finalTotalPrice = newTotalPrice + shippingCost + taxAmount;

    // Update state
    setTotalPrice(finalTotalPrice);
    setShippingCost(shippingCost);
    setTaxAmount(taxAmount);

    // Dispatch the updated checkout price (convert to cents)
    dispatch(setCheckoutPrice(finalTotalPrice * 100));
  }, [cartItems, dispatch]);

  // Rest of the logic functions remain the same
  const handleCheckout = async () => {
    // ...existing code...
    const totalPriceInCents = Math.round(totalPrice * 100); // Convert dollars to cents
    dispatch(setCheckoutPrice(totalPriceInCents));

    try {
      if (hasClothingItems) {
        // If there are clothing items, first present the address sheet
        setShowAddressSheet(true);

        // Wait for the address sheet submission
        const addressDetails = await new Promise((resolve) => {
          // Add a callback function to execute when the address sheet is submitted
          onSubmitAddressSheet = resolve;
        });

        // Initialize payment sheet and fetch payment intent prefix
        const { paymentIntentPrefix } = await initializePaymentSheet(
          addressDetails
        );

        // Open payment sheet with the retrieved payment intent prefix and addressDetails
        await openPaymentSheet(paymentIntentPrefix, addressDetails);
      } else {
        // Initialize payment sheet and fetch payment intent prefix
        const { paymentIntentPrefix } = await initializePaymentSheet(
          addressDetails
        );

        // Open payment sheet with the retrieved payment intent prefix
        await openPaymentSheet(paymentIntentPrefix, addressDetails);
      }
    } catch (error) {
      console.error("Error handling checkout:", error);
      // Display error message to the user or retry checkout
    }
  };

  const handleRemoveFromCart = (productId, selectedColor, selectedSize) => {
    dispatch(removeFromCart({ productId, selectedColor, selectedSize }));
  };

  const handleClearCart = () => {
    setClearConfirmationModalVisible(true);
  };

  const confirmClearCart = () => {
    dispatch(clearCart());
    setClearConfirmationModalVisible(false);
  };

  const cancelClearCart = () => {
    setClearConfirmationModalVisible(false);
  };

  const sendPurchaseNotification = async () => {
    try {
      // Schedule a notification to be sent to the user
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Thanks for your purchase!",
          body: "Your purchase details can be found in your Account History.",
        },
        trigger: null, // Set to null to trigger immediately, otherwise set a future trigger
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
      throw new Error("Failed to send push notification");
    }
  };

  const fetchPaymentSheetParams = async (addressDetails) => {
    // ...existing code...
    try {
      const { address } = addressDetails; // Extract the address object from addressDetails
      const shipping = {
        address: {
          city: address.city,
          country: address.country,
          line1: address.line1,
          line2: address.line2,
          postal_code: address.postalCode,
          state: address.state,
        },
      };

      const response = await fetch(`${API_URL}/payment-sheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          name: userName,
          customerEmail: userEmail,
          firebaseId,
          shipping: shipping, // Pass the shipping object to Stripe
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch payment sheet params");
      }

      const { paymentIntent, ephemeralKey, customer } = await response.json();

      // Find the index of the second underscore
      const firstUnderscoreIndex = paymentIntent.indexOf("_");
      const secondUnderscoreIndex = paymentIntent.indexOf(
        "_",
        firstUnderscoreIndex + 1
      );

      // Extract the substring before the second underscore
      const paymentIntentPrefix = paymentIntent.substring(
        0,
        secondUnderscoreIndex
      );
      setStripePaymentIntent(paymentIntentPrefix);

      return { paymentIntent, paymentIntentPrefix, ephemeralKey, customer };
    } catch (error) {
      console.error("Error fetching payment sheet params:", error);
      throw new Error("Failed to fetch payment sheet params");
    }
  };

  const initializePaymentSheet = async (addressDetails) => {
    // ...existing code...
    try {
      if (!addressDetails) {
        addressDetails = {
          address: {
            city: "null",
            country: "null",
            line1: "null",
            line2: "null",
            postalCode: "null",
            state: "null",
          },
          name: userName,
          phone: "null",
        };
      }

      const { paymentIntent, ephemeralKey, customer, paymentIntentPrefix } =
        await fetchPaymentSheetParams(addressDetails);

      const { error } = await initPaymentSheet({
        merchantDisplayName: "RAGESTATE",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        style: "alwaysDark",
        allowsDelayedPaymentMethods: true,
        applePay: {
          merchantCountryCode: "US",
        },
        defaultShippingDetails: {
          address: {
            city: addressDetails.address.city,
            country: addressDetails.address.country,
            line1: addressDetails.address.line1,
            line2: addressDetails.address.line2,
            postal_code: addressDetails.address.postalCode,
            state: addressDetails.address.state,
          },
          name: addressDetails.name,
          phone: addressDetails.phone,
        }, // Pass the shipping object to Stripe
        appearance: {
          colors: {
            primary: "#000000",
            componentBorder: "000000",
            componentDivider: "000000",
          },
          shapes: {
            borderRadius: 8,
            borderWidth: 2,
          },
          primaryButton: { shapes: { borderRadius: 8 } },
        },
        returnURL: "ragestate://stripe-redirect",
      });

      if (!error) {
        setLoading(true);
        setPaymentSheetInitialized(true);
      } else {
        throw new Error(`Error initializing payment sheet: ${error.message}`);
      }

      // Return the paymentIntentPrefix along with other data
      return { paymentIntent, ephemeralKey, customer, paymentIntentPrefix };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to initialize payment sheet");
    }
  };

  const openPaymentSheet = async (paymentIntentPrefix, addressDetails) => {
    // ...existing code...
    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === "Canceled") {
          console.warn("Payment canceled by the user");
        } else {
          Alert.alert(`Error code: ${error.code}`, error.message);
        }
      } else {
        Alert.alert("Success", "Your order is confirmed!");

        // Create Firestore document for user's purchase
        const purchaseDocumentRef = doc(
          firestore,
          `customers/${firebaseId}/purchases`,
          paymentIntentPrefix
        );
        const purchaseData = {
          email: userEmail,
          name: userName,
          stripeId: stripeCustomerId.customerId,
          addressDetails: addressDetails,
          cartItems: cartItems.map((item) => {
            const {
              title,
              price,
              selectedQuantity,
              selectedSize,
              selectedColor,
              productId,
              images,
            } = item;
            const productImageSrc =
              images && images.length > 0 ? images[0].src : null;
            const merchandiseData = {
              productId,
              title,
              price: parseFloat(price.amount),
              quantity: selectedQuantity,
              productImageSrc,
            };
            if (selectedSize && selectedColor) {
              merchandiseData.size = selectedSize;
              merchandiseData.color = selectedColor;
            }
            return merchandiseData;
          }),
          dateTime: new Date(),
        };

        await setDoc(purchaseDocumentRef, purchaseData);

        // Iterate through each cart item
        for (const item of cartItems) {
          // Find the event ID for the current item
          const eventId = item.eventDetails ? item.productId : null;

          // Proceed only if the event ID is valid
          if (eventId) {
            // Get the current quantity of the event
            const eventDocRef = doc(firestore, "events", eventId);
            const eventDocSnap = await getDoc(eventDocRef);
            const currentQuantity = eventDocSnap.data().quantity;

            // Update the quantity by decrementing
            await updateDoc(eventDocRef, { quantity: currentQuantity - 1 });

            // Create Firestore document for the user's ticket
            const userData = {
              active: true,
              email: userEmail,
              expoPushToken: expoPushToken,
              firebaseId: firebaseId,
              owner: userName,
            };

            const eventRef = doc(firestore, "events", eventId);
            const eventRagersRef = collection(eventRef, "ragers");

            await addDoc(eventRagersRef, userData);
          }
        }

        // Send push notification to the user
        await sendPurchaseNotification();

        dispatch(clearCart());
      }
    } catch (error) {
      console.error("Error opening payment sheet:", error);
      throw new Error("Failed to open payment sheet");
    }
  };

  const primaryAddyStyle = Platform.select({
    ios: "#222222",
    android: "#2e2e2e",
    default: "system",
  });

  const backgroundAddyStyle = Platform.select({
    ios: "#000000",
    android: "#F7F7F7",
    default: "system",
  });

  const primaryText = Platform.select({
    ios: "#FFFFFF",
    android: "#222222",
    default: "system",
  });

  // Define a custom appearance object for AddressSheet with proper hex format
  const addressSheetAppearance = {
    colors: {
      primary: "#ff3c00",             // Brand accent color for primary actions
      background: "#111111",          // Dark background matching the app (6 characters)
      componentBackground: "#222222", // Slightly lighter for form fields (6 characters)
      componentBorder: "#444444",     // Border color matching cards (6 characters)
      componentDivider: "#333333",    // Divider color matching the app (6 characters)
      componentText: "#FFFFFF",       // White text matching the app
      secondaryText: "#AAAAAA",       // Gray text for secondary information
      placeholderText: "#777777",     // Placeholder text color
      icon: "#CCCCCC",                // Icon color
      error: "#FF5555",               // Error color
    },
    fonts: {
      scale: 1.0,                     // Standard scale
      family: fontFamily,             // Use the same font family as the app
    },
    shapes: {
      borderRadius: 8,                // Match the border radius used in your app
      borderWidth: 1,                 // Match the border width used in your app
    }
  };

  return (
    <StripeProvider
      publishableKey={
        "pk_live_51NFhuOHnXmOBmfaDu16tJEuppfYKPUivMapB9XLXaBpiOLqiPRz2uoPAiifxqiLT49dyPCHOSKs74wjBspzJ8zo600yGYluqUe"
      }
      merchantIdentifier="merchant.com.tyrelle.ragestate-beta"
    >
      <View style={styles.rootContainer}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
          {cartItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearCart}
              accessible={true}
              accessibilityLabel="Clear cart"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyCartContainer}>
            <Ionicons name="cart-outline" size={64} color="#333" />
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => navigation.navigate("Shop")}
            >
              <Text style={styles.shopButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {checkoutInProgress && (
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
              >
                {/* Display cart items */}
                {cartItems.map((item, index) => (
                  <View
                    style={styles.cartItemCard}
                    key={`${item.productId}-${item.selectedColor}-${item.selectedSize}-${index}`}
                  >
                    <Image
                      source={{ uri: item.images[0].src }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />

                    <View style={styles.itemDetailsContainer}>
                      <Text
                        style={styles.itemTitle}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.title}
                      </Text>

                      <View style={styles.itemMetaContainer}>
                        {item.eventDetails ? (
                          <Text style={styles.itemType}>Event</Text>
                        ) : (
                          <>
                            {item.selectedColor && (
                              <Text style={styles.itemMeta}>
                                Color:{" "}
                                <Text style={styles.itemMetaValue}>
                                  {item.selectedColor}
                                </Text>
                              </Text>
                            )}
                            {item.selectedSize && (
                              <Text style={styles.itemMeta}>
                                Size:{" "}
                                <Text style={styles.itemMetaValue}>
                                  {item.selectedSize}
                                </Text>
                              </Text>
                            )}
                          </>
                        )}
                        <Text style={styles.itemMeta}>
                          Qty:{" "}
                          <Text style={styles.itemMetaValue}>
                            {item.selectedQuantity}
                          </Text>
                        </Text>
                      </View>

                      <View style={styles.itemBottomRow}>
                        <Text style={styles.itemPrice}>
                          $
                          {(item.price.amount * item.selectedQuantity).toFixed(
                            2
                          )}
                        </Text>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() =>
                            handleRemoveFromCart(
                              item.productId,
                              item.selectedColor,
                              item.selectedSize
                            )
                          }
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {checkoutInProgress && hasClothingItems && (
              <AddressSheet
                visible={showAddressSheet}
                onSubmit={async (addressDetails) => {
                  setShowAddressSheet(false);
                  onSubmitAddressSheet(addressDetails);
                }}
                onError={(error) => {
                  if (error.code === "Canceled") {
                    setShowAddressSheet(false);
                  } else {
                    console.log(error);
                  }
                }}
                appearance={addressSheetAppearance}
                defaultValues={{
                  phone: "111-222-3333",
                  address: {
                    country: "United States",
                    city: "San Diego",
                    state: "California",
                  },
                }}
                additionalFields={{
                  phoneNumber: "required",
                }}
                allowedCountries={["US"]}
                primaryButtonTitle={"CONFIRM ADDRESS"}
                sheetTitle={"Shipping Address"}
                presentationStyle="fullscreen"
              />
            )}

            {checkoutInProgress && (
              <View style={styles.orderSummaryContainer}>
                <Text style={styles.orderSummaryTitle}>Order Summary</Text>

                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Subtotal</Text>
                  <Text style={styles.orderSummaryValue}>
                    ${(totalPrice - shippingCost - taxAmount).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Shipping</Text>
                  <Text style={styles.orderSummaryValue}>{shipping}</Text>
                </View>

                <View style={styles.orderSummaryRow}>
                  <Text style={styles.orderSummaryLabel}>Tax</Text>
                  <Text style={styles.orderSummaryValue}>
                    ${taxAmount.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.orderSummaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ${totalPrice.toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.checkoutButton}
                  onPress={handleCheckout}
                  accessible={true}
                  accessibilityLabel="Proceed to checkout"
                  accessibilityRole="button"
                >
                  <Text style={styles.checkoutButtonText}>
                    PROCEED TO CHECKOUT
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Clear Confirmation Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={clearConfirmationModalVisible}
          onRequestClose={() => setClearConfirmationModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Clear Cart</Text>
              <Text style={styles.modalText}>
                Are you sure you want to remove all items from your cart?
              </Text>
              <View style={styles.modalButtonsContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelClearCart}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmClearCart}
                >
                  <Text style={styles.confirmButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </StripeProvider>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: "black",
  },
  headerTitle: {
    color: "white",
    fontFamily,
    fontSize: 22,
    fontWeight: "600",
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    color: GlobalStyles.colors.red4,
    fontFamily,
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "black",
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
    paddingBottom: 100,
  },
  emptyCartText: {
    color: "white",
    fontFamily,
    fontSize: 18,
    fontWeight: "500",
    marginTop: 20,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  shopButtonText: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
  },
  cartItemCard: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  itemImage: {
    width: windowWidth * 0.3,
    height: "100%",
  },
  itemDetailsContainer: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  itemTitle: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  itemMetaContainer: {
    marginBottom: 8,
  },
  itemType: {
    color: GlobalStyles.colors.red4,
    fontFamily,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemMeta: {
    color: "#999",
    fontFamily,
    fontSize: 14,
    marginBottom: 2,
  },
  itemMetaValue: {
    color: "white",
    fontWeight: "500",
  },
  itemBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemPrice: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
  },
  removeButtonText: {
    color: GlobalStyles.colors.red4,
    fontFamily,
    fontSize: 12,
    fontWeight: "500",
  },
  orderSummaryContainer: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  orderSummaryTitle: {
    color: "white",
    fontFamily,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  orderSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderSummaryLabel: {
    color: "#999",
    fontFamily,
    fontSize: 14,
  },
  orderSummaryValue: {
    color: "white",
    fontFamily,
    fontSize: 14,
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  totalLabel: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
  },
  totalValue: {
    color: "white",
    fontFamily,
    fontSize: 18,
    fontWeight: "700",
  },
  checkoutButton: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    marginTop: 20,
    padding: 15,
    alignItems: "center",
  },
  checkoutButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    color: "white",
    fontFamily,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  modalText: {
    color: "white",
    fontFamily,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#333",
  },
  confirmButton: {
    backgroundColor: GlobalStyles.colors.red4,
  },
  cancelButtonText: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "500",
  },
  confirmButtonText: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
  },
});
