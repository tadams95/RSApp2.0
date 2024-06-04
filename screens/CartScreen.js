import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";

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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { GlobalStyles } from "../constants/styles";

export default function CartScreen() {
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

  const API_URL =
    "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

  useEffect(() => {
    // Calculate total price and update checkout price
    const newTotalPrice = cartItems.reduce((accumulator, item) => {
      const itemPrice = item.price.amount * item.selectedQuantity;
      return accumulator + itemPrice;
    }, 0);
    setTotalPrice(newTotalPrice);
    dispatch(setCheckoutPrice(newTotalPrice * 100)); // Convert to cents and update checkout price
  }, [cartItems, dispatch]);

  useEffect(() => {}, [stripePaymentIntent]);

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

  const handleCheckout = async () => {
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

  // Function to check if there are clothing items in the cart
  const hasClothingItems = cartItems.some((item) => !item.eventDetails);

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

  return (
    <StripeProvider
      publishableKey={
        "pk_live_51NFhuOHnXmOBmfaDu16tJEuppfYKPUivMapB9XLXaBpiOLqiPRz2uoPAiifxqiLT49dyPCHOSKs74wjBspzJ8zo600yGYluqUe"
      }
      merchantIdentifier="merchant.com.tyrelle.ragestate-beta"
    >
      <View style={styles.container}>
        {cartItems.length === 0 ? (
          <View style={styles.emptyCartContainer}>
            <Text style={styles.subtitle2}>Your Cart is currently empty</Text>

            {/* <MaterialCommunityIcons
              name="cart-arrow-down"
              color={"white"}
              size={40}
            /> */}
          </View>
        ) : (
          <>
            {checkoutInProgress && (
              <ScrollView
                style={{ marginBottom: 30, backgroundColor: "black" }}
              >
                {/* Display cart items */}
                {cartItems.map((item, index) => {
                  return (
                    <View
                      style={styles.productContainer}
                      key={`${item.productId}-${item.selectedColor}-${item.selectedSize}-${index}`}
                    >
                      <Image
                        source={{ uri: item.images[0].src }} // Use the imgURL directly
                        style={styles.image}
                      />

                      <View style={styles.detailsContainer}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.subtitle}>
                          {item.eventDetails
                            ? "Event"
                            : `Color: ${item.selectedColor}`}
                        </Text>
                        {item.selectedSize && (
                          <Text style={styles.subtitle}>
                            Size: {item.selectedSize}
                          </Text>
                        )}
                        <Text style={styles.subtitle}>
                          Quantity: {item.selectedQuantity}
                        </Text>
                        <Text style={styles.price}>
                          ${`${item.price.amount} ${item.price.currencyCode}`}
                        </Text>
                        <View style={styles.buttonsContainer}>
                          <Pressable
                            style={styles.button}
                            onPress={() =>
                              handleRemoveFromCart(
                                item.productId,
                                item.selectedColor,
                                item.selectedSize
                              )
                            }
                          >
                            <Text style={styles.buttonText}>Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {checkoutInProgress &&
              hasClothingItems && ( // Show AddressSheet only if there are clothing items
                <AddressSheet
                  visible={showAddressSheet}
                  onSubmit={async (addressDetails) => {
                    // Make sure to set `visible` back to false to dismiss the address element.
                    setShowAddressSheet(false);
                    // console.log(addressDetails);

                    // Handle result and update your UI
                    onSubmitAddressSheet(addressDetails); // Resolve the promise to continue with checkout
                  }}
                  onError={
                    (error) => {
                      // Alert.alert(
                      //   "There was an error.",
                      //   "Check the logs for details."
                      // );
                      console.log(error);
                    }
                    // Make sure to set `visible` back to false to dismiss the address element.
                  }
                  appearance={{
                    colors: {
                      primary: { primaryAddyStyle },
                      background: { backgroundAddyStyle },
                      secondaryText: "#000000",
                      primaryText: { primaryText },
                    },
                  }}
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
                  primaryButtonTitle={"Use this address"}
                  sheetTitle={"Shipping Address"}
                />
              )}

            {checkoutInProgress && (
              <View style={styles.bottomButtonContainer}>
                <Pressable style={styles.clearButton} onPress={handleClearCart}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    color={GlobalStyles.colors.redVivid4}
                    size={30}
                  />
                </Pressable>
                {/* Display total price */}
                <View>
                  <Text style={styles.totalPriceContainer}>
                    ${totalPrice.toFixed(2)}
                  </Text>
                </View>

                {/* Checkout Button */}
                <Pressable
                  style={styles.checkoutButton}
                  onPress={handleCheckout}
                >
                  <MaterialCommunityIcons
                    name="cart-arrow-right"
                    color="white"
                    size={30}
                  />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Clear Confirmation Modal */}
        <Modal
          animationType="none"
          transparent={true}
          visible={clearConfirmationModalVisible}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
                Are you sure you want to clear your cart?
              </Text>
              <View style={styles.modalButtonsContainer}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelClearCart}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmClearCart}
                >
                  <Text style={styles.modalButtonText}>Clear</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </StripeProvider>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16,
  },
  emptyCartContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: Dimensions.get("window").height * 0.333,
  },
  productContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  image: {
    height: 145,
    width: Dimensions.get("window").width * 0.4, // Adjust as needed based on your layout
    aspectRatio: 1, // Maintain aspect ratio

    borderRadius: 8,

    marginRight: 16,
    padding: 10,
  },
  detailsContainer: {
    flex: 1, // Occupy remaining space
    marginLeft: Dimensions.get("window").width * 0.15, // Add some left margin for spacing
    justifyContent: "flex-start", // Align contents to the start (top) of the container
  },
  title: {
    fontFamily,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
    color: "white",
  },
  subtitle: {
    fontFamily,
    fontSize: 14,
    marginBottom: 4,
    color: "white",
  },
  price: {
    fontFamily,
    fontSize: 16,
    color: "white",
  },
  subtitle2: {
    fontFamily,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 8,
    alignItems: "center",
    color: "white",
    textTransform: "uppercase",
    fontSize: 16,
  },
  buttonsContainer: {
    flexDirection: "row",
    marginTop: 8,
  },

  button: {
    backgroundColor: "white",
    // borderWidth: 2,
    padding: 8,
    borderRadius: 8,
    marginRight: 25,
  },

  buttonText: {
    fontFamily,
    fontSize: 12,
  },

  clearButton: {
    alignItems: "center",
    marginLeft: 15,
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },

  modalText: {
    fontFamily,
    fontSize: 18,
    marginBottom: 15,
    textAlign: "center",
    fontWeight: "500",
  },

  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: "48%",
    alignItems: "center",
  },

  cancelButton: {
    backgroundColor: GlobalStyles.colors.grey3,
  },

  confirmButton: {
    backgroundColor: "black",
  },

  modalButtonText: {
    fontFamily,
    color: "white",
    fontWeight: "500",
  },
  bottomButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "black",
    padding: 10,
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: GlobalStyles.colors.grey0,
  },
  totalPriceContainer: {
    flex: 1,
    alignItems: "center",
    fontFamily,
    paddingTop: 5,
    fontSize: 18,
    color: "white",
  },
  checkoutButton: {
    marginRight: 15,
  },
  webView: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    marginTop: 5,
  },
});
