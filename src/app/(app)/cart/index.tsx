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
  TouchableOpacity,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import {
  selectCartItems,
  removeFromCart,
  clearCart,
  setCheckoutPrice,
  selectCheckoutPrice,
} from "../../../store/redux/cartSlice";

// Import the actual CartItem type from the redux slice if available
// Or define a type that matches the structure in the Redux store
import {
  selectUserEmail,
  selectLocalId,
  selectUserName,
  selectStripeCustomerId,
  selectExpoPushToken,
} from "../../../store/redux/userSlice";
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
  AddressDetails,
} from "@stripe/stripe-react-native";
import { useState, useEffect } from "react";
import { GlobalStyles } from "../../../constants/styles";
import { router } from "expo-router";
import { CartItemMetadata, EventDetails } from "../../../types/cart";

// Define interfaces for TypeScript
interface CartItem {
  productId: string;
  title: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  selectedColor?: string | null;
  selectedSize?: string | null;
  selectedQuantity: number;
  image?: string;
  eventDetails?: EventDetails;
  id?: string; // Making id optional since it might not exist in the redux state
}

interface OrderDetails {
  orderId: string;
  orderItems: CartItem[];
  orderTotal: number;
  shippingAddress: AddressDetails | null;
  paymentIntentId: string;
  timestamp: number;
  status: string;
}

export default function CartScreen() {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems) as unknown as CartItem[];
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [checkoutInProgress, setCheckoutInProgress] = useState<boolean>(true);
  const [clearConfirmationModalVisible, setClearConfirmationModalVisible] =
    useState<boolean>(false);
  const userEmail = useSelector(selectUserEmail);
  const firebaseId = useSelector(selectLocalId);
  const amount = useSelector(selectCheckoutPrice);
  const userName = useSelector(selectUserName);
  const stripeCustomerId = useSelector(selectStripeCustomerId);
  const expoPushToken = useSelector(selectExpoPushToken);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const firestore = getFirestore();
  const [loading, setLoading] = useState<boolean>(false);
  const [paymentSheetInitialized, setPaymentSheetInitialized] = useState<boolean>(false);
  const [stripePaymentIntent, setStripePaymentIntent] = useState<string>("");
  const [showAddressSheet, setShowAddressSheet] = useState<boolean>(false);
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);

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

    // Add shipping cost for physical items
    let shippingCost = 0;
    if (hasClothingItems) {
      shippingCost = 4.99;
    }

    // Calculate approximate tax (for example, 8%)
    const subtotal = newTotalPrice;
    const calculatedTaxAmount = subtotal * 0.08;

    setShippingCost(shippingCost);
    setTaxAmount(calculatedTaxAmount);
    setTotalPrice(newTotalPrice + shippingCost + calculatedTaxAmount);

    // Update Redux store with checkout price
    dispatch(setCheckoutPrice(newTotalPrice + shippingCost + calculatedTaxAmount));
  }, [cartItems, dispatch]);

  // Handle the checkout process
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty.");
      return;
    }

    try {
      setLoading(true);

      // Show the address sheet for shipping information
      if (hasClothingItems) {
        setShowAddressSheet(true);
      } else {
        // If only digital items, proceed directly to payment
        await initializePaymentSheet(null);
        await openPaymentSheet("RS-EVENT", null);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      Alert.alert("Checkout Error", "There was an issue with checkout. Please try again.");
      setLoading(false);
    }
  };

  const handleRemoveFromCart = (productId: string, selectedColor?: string | null, selectedSize?: string | null) => {
    // Use type assertion to tell TypeScript we know what we're doing
    dispatch(removeFromCart({ 
      productId, 
      selectedColor, 
      selectedSize 
    } as any));
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
    if (!expoPushToken) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Purchase Successful",
          body: `Thank you for your purchase of $${totalPrice.toFixed(
            2
          )}. Your order is being processed.`,
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const fetchPaymentSheetParams = async (addressDetails: AddressDetails | null) => {
    try {
      const response = await fetch(`${API_URL}?amount=${Math.round(totalPrice * 100)}&customerEmail=${userEmail}&customerId=${stripeCustomerId || ""}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: firebaseId,
          amount: Math.round(totalPrice * 100),
          customerEmail: userEmail,
          isExistingCustomer: !!stripeCustomerId,
          customerId: stripeCustomerId || "",
          address: addressDetails || {},
        }),
      });

      const { paymentIntent, ephemeralKey, customer } = await response.json();
      return { paymentIntent, ephemeralKey, customer };
    } catch (error) {
      console.error("Error fetching payment sheet params:", error);
      throw new Error("Failed to initiate payment process");
    }
  };

  const initializePaymentSheet = async (addressDetails: AddressDetails | null) => {
    try {
      const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams(addressDetails);
      setStripePaymentIntent(paymentIntent);
      
      const { error } = await initPaymentSheet({
        merchantDisplayName: "RAGESTATE",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: userName || "",
          email: userEmail || "",
        },
      });

      if (!error) {
        setPaymentSheetInitialized(true);
      } else {
        console.error("Error initializing payment sheet:", error);
        Alert.alert("Payment Error", "Unable to initialize payment. Please try again.");
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      Alert.alert("Payment Error", "Unable to initialize payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openPaymentSheet = async (paymentIntentPrefix: string, addressDetails: AddressDetails | null) => {
    try {
      if (!paymentSheetInitialized) {
        await initializePaymentSheet(addressDetails);
      }

      const { error } = await presentPaymentSheet();

      if (error) {
        console.error("Payment error:", error);
        Alert.alert("Payment Failed", error.message);
      } else {
        // Payment successful, save order information
        try {
          const orderDetails: OrderDetails = {
            orderId: `${paymentIntentPrefix}-${Date.now()}`,
            orderItems: cartItems,
            orderTotal: totalPrice,
            shippingAddress: addressDetails,
            paymentIntentId: stripePaymentIntent,
            timestamp: Date.now(),
            status: "processing",
          };

          // Save to user's orders collection in Firestore
          if (!firebaseId) {
            throw new Error("User ID is required to save order");
          }
          const ordersRef = collection(firestore, "users", firebaseId, "orders");
          await addDoc(ordersRef, orderDetails);

          // Send notification
          await sendPurchaseNotification();

          // Clear cart after successful purchase
          dispatch(clearCart());
          
          Alert.alert(
            "Payment Successful!",
            "Your order has been placed successfully.",
            [
              {
                text: "OK",
                onPress: () => {
                  router.navigate("/home");
                },
              },
            ]
          );
        } catch (error) {
          console.error("Error saving order:", error);
        }
      }
    } catch (error) {
      console.error("Error in payment process:", error);
    } finally {
      setLoading(false);
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
      primary: "#ff3c00",
      background: "#111111",
      componentBackground: "#222222",
      componentBorder: "#444444",
      componentDivider: "#333333",
      componentText: "#FFFFFF",
      secondaryText: "#AAAAAA",
      placeholderText: "#777777",
      icon: "#CCCCCC",
      error: "#FF5555",
    },
    fonts: {
      scale: 1.0,
      family: fontFamily,
    },
    shapes: {
      borderRadius: 8,
      borderWidth: 1,
    }
  };

  return (
    <StripeProvider
      publishableKey="pk_test_51KKkvnDcnPBRlCcSHabYQ8vdzxj2Rxla6Qek3YpKXhsirsJ7JkXHxZDsZLQYJnwY6wOJqy8B4jgyLpS5W1BYEfYY00XSeLDFDw"
    >
      <View style={styles.rootContainer}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cart</Text>
          {cartItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearCart}
              accessible={true}
              accessibilityLabel="Clear cart"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>Clear Cart</Text>
            </TouchableOpacity>
          )}
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyCartContainer}>
            <Ionicons name="cart-outline" size={80} color="white" />
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.navigate("/shop")}
              accessible={true}
              accessibilityLabel="Start shopping"
              accessibilityRole="button"
            >
              <Text style={styles.shopButtonText}>START SHOPPING</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              {cartItems.map((item, index) => (
                <View key={index} style={styles.cartItemCard}>
                  {item.image && (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.itemDetailsContainer}>
                    <View>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <View style={styles.itemMetaContainer}>
                        <Text style={styles.itemType}>
                          {item.eventDetails ? "Event Ticket" : "Apparel"}
                        </Text>
                        {item.eventDetails && (
                          <>
                            <Text style={styles.itemMeta}>
                              Date:{" "}
                              <Text style={styles.itemMetaValue}>
                                {item.eventDetails.dateTime}
                              </Text>
                            </Text>
                            <Text style={styles.itemMeta}>
                              Location:{" "}
                              <Text style={styles.itemMetaValue}>
                                {item.eventDetails.location}
                              </Text>
                            </Text>
                          </>
                        )}
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
                        <Text style={styles.itemMeta}>
                          Quantity:{" "}
                          <Text style={styles.itemMetaValue}>
                            {item.selectedQuantity}
                          </Text>
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemBottomRow}>
                      <Text style={styles.itemPrice}>
                        ${(item.price.amount * item.selectedQuantity).toFixed(2)}
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
                        accessible={true}
                        accessibilityLabel="Remove from cart"
                        accessibilityRole="button"
                      >
                        <Text style={styles.removeButtonText}>REMOVE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              <View style={{ height: 200 }} />
            </ScrollView>

            {showAddressSheet && (
              <AddressSheet
                appearance={addressSheetAppearance}
                defaultValues={{
                  name: userName || "",
                  phone: "",
                  address: {
                    country: "US",
                  },
                }}
                onSubmit={(addressDetails) => {
                  setAddressDetails(addressDetails);
                  setShowAddressSheet(false);
                  initializePaymentSheet(addressDetails);
                  openPaymentSheet("RS-MERCH", addressDetails);
                }}
                onError={(error) => {
                  console.error("Address sheet error:", error);
                  Alert.alert("Address Error", "Could not validate address. Please try again.");
                  setLoading(false);
                }}
                sheetTitle={"Shipping Address"}
                primaryButtonTitle={"Continue to Payment"}
                presentationStyle="fullscreen"
                visible={showAddressSheet}
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
