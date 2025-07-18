/**
 * CartScreen Component
 *
 * Recent Enhancements:
 * - Added comprehensive cart validation before checkout
 * - Implemented field-level error reporting for validation issues
 * - Applied retryWithBackoff utility for order creation for better resilience
 * - Added visual indicators for validation errors in cart items
 */

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  AppState,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import {
  clearCart,
  CartItem as ReduxCartItem,
  removeFromCart,
  selectCartItems,
  selectCheckoutPrice,
  setCheckoutPrice,
  updateCartItems,
} from "../../../store/redux/cartSlice";

// Import our new offline cart sync utilities
import { useOfflineCartSync } from "../../../utils/offlineCartSync";

// Import notification manager for order status notifications
import { NotificationManager } from "../../../services/notificationManager";

// Import the actual CartItem type from the redux slice if available
// Or define a type that matches the structure in the Redux store
import {
  AddressDetails,
  AddressSheet,
  StripeProvider,
  useStripe,
} from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { getFirestore } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  CartOperationErrorBoundary,
  CheckoutPaymentErrorBoundary,
} from "../../../components/shopify";
import { GlobalStyles } from "../../../constants/styles";
import {
  selectExpoPushToken,
  selectLocalId,
  selectStripeCustomerId,
  selectUserEmail,
  selectUserName,
} from "../../../store/redux/userSlice";
import { CartItemMetadata, EventDetails } from "../../../types/cart";

// Import our new utility functions and components
import {
  clearCartState,
  clearCheckoutError,
  getCartState,
  getLastCheckoutError,
  hasRecentCheckoutError,
  isCartRecoverable,
  saveCartState,
  saveCheckoutError,
} from "../../../utils/cart/cartPersistence";
import {
  CartValidationErrors,
  getCartValidationErrorMessage,
  validateCart,
} from "../../../utils/cart/cartValidation";
import {
  isNetworkConnected,
  isNetworkError,
  retryWithBackoff,
} from "../../../utils/cart/networkErrorDetection";
import {
  attemptOrderRecovery,
  createOrderIdempotent,
  OrderData,
  reconcileOrder,
} from "../../../utils/cart/orderIdempotency";
import CartReconciliationHandler from "./components/CartReconciliationHandler";
import CartRecoveryModal from "./components/CartRecoveryModal";
import CartRecoveryTester from "./components/CartRecoveryTester";
import PaymentErrorHandler from "./components/PaymentErrorHandler";

// Define interfaces for TypeScript
interface CartItem {
  productId: string;
  title: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  selectedColor: string; // Match Redux type requirements
  selectedSize: string; // Match Redux type requirements
  selectedQuantity: number;
  image?: string;
  eventDetails?: EventDetails;
  id?: string; // Making id optional since it might not exist in the redux state
  metadata?: CartItemMetadata;
}

// Type for generic cart items
type GenericCartItem = {
  productId: string;
  title?: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  selectedColor?: string | null;
  selectedSize?: string | null;
  selectedQuantity: number;
  image?: string;
  eventDetails?: EventDetails;
  [key: string]: any;
};

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
  const posthog = usePostHog();
  const cartItems = useSelector(selectCartItems) as unknown as CartItem[];
  const [totalPrice, setTotalPrice] = useState<number>(0);
  // Only show order summary when actually checking out or when cart has items
  const [checkoutInProgress, setCheckoutInProgress] = useState<boolean>(false);
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
  const [paymentSheetInitialized, setPaymentSheetInitialized] =
    useState<boolean>(false);
  const [stripePaymentIntent, setStripePaymentIntent] = useState<string>("");
  const [showAddressSheet, setShowAddressSheet] = useState<boolean>(false);
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(
    null
  );
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);

  // New state for cart recovery, error handling, and validation
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveredCartItems, setRecoveredCartItems] = useState<
    GenericCartItem[]
  >([]);
  const [recoveredTimestamp, setRecoveredTimestamp] = useState<
    number | undefined
  >(undefined);
  const [recoveryLoading, setRecoveryLoading] = useState<boolean>(false);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] =
    useState<CartValidationErrors | null>(null);
  const [showPaymentErrorHandler, setShowPaymentErrorHandler] =
    useState<boolean>(false);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState<boolean>(true);

  // New state for order reconciliation
  const [isReconcilingOrder, setIsReconcilingOrder] = useState<boolean>(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(
    null
  );

  // Initialize offline cart sync utilities
  const offlineCartSync = useOfflineCartSync();

  // Cart abandonment tracking state
  const [cartSessionStartTime, setCartSessionStartTime] = useState<number>(
    Date.now()
  );
  const [lastInteractionTime, setLastInteractionTime] = useState<number>(
    Date.now()
  );
  const [checkoutStage, setCheckoutStage] = useState<string>("cart_view");
  const [hasAttemptedCheckout, setHasAttemptedCheckout] =
    useState<boolean>(false);
  const [abandonmentTracked, setAbandonmentTracked] = useState<boolean>(false);

  // Track screen view
  useScreenTracking("Cart Screen", {
    user_type: "authenticated",
    cart_item_count: cartItems.length,
    cart_is_empty: cartItems.length === 0,
    is_checking_recovery: isCheckingRecovery,
    show_recovery_modal: showRecoveryModal,
  });

  // Cart abandonment tracking functions
  const updateLastInteraction = () => {
    setLastInteractionTime(Date.now());
  };

  const trackCartAbandonment = async (
    abandonmentStage: string,
    reason: string
  ) => {
    if (abandonmentTracked || cartItems.length === 0) return;

    const sessionDuration = Date.now() - cartSessionStartTime;
    const timeSinceLastInteraction = Date.now() - lastInteractionTime;
    const cartValue = cartItems.reduce(
      (sum, item) => sum + item.price.amount * item.selectedQuantity,
      0
    );

    // Determine cart value segment
    let valueSegment = "low";
    if (cartValue >= 100) valueSegment = "high";
    else if (cartValue >= 50) valueSegment = "medium";

    posthog.track("cart_abandoned", {
      abandonment_stage: abandonmentStage,
      abandonment_reason: reason,
      cart_value: cartValue,
      cart_value_segment: valueSegment,
      item_count: cartItems.length,
      session_duration_seconds: Math.round(sessionDuration / 1000),
      time_since_last_interaction_seconds: Math.round(
        timeSinceLastInteraction / 1000
      ),
      had_attempted_checkout: hasAttemptedCheckout,
      checkout_stage: checkoutStage,
      has_clothing_items: cartItems.some((item) => !item.eventDetails),
      has_event_tickets: cartItems.some((item) => !!item.eventDetails),
      product_ids: cartItems.map((item) => item.productId).join(","),
      user_type: "authenticated",
    });

    // Schedule cart abandonment reminder notification for high-value carts or checkout attempts
    if ((cartValue >= 50 || hasAttemptedCheckout) && expoPushToken) {
      try {
        // Prepare top products for enhanced notifications
        const topProducts = cartItems
          .sort(
            (a, b) =>
              b.price.amount * b.selectedQuantity -
              a.price.amount * a.selectedQuantity
          )
          .slice(0, 3)
          .map((item) => ({
            title: item.title || "Product",
            price: item.price.amount,
          }));

        // Schedule enhanced cart abandonment reminder with product details
        await NotificationManager.sendEnhancedCartAbandonmentReminder(
          cartValue,
          cartItems.length,
          topProducts,
          60 // 1 hour delay for enhanced notification
        );

        // Schedule additional cart recovery with incentive for higher value carts
        if (cartValue >= 100) {
          await NotificationManager.sendCartRecoveryWithIncentive(
            cartValue,
            cartItems.length,
            "Free shipping on orders over $50",
            180 // 3 hours delay
          );
        }

        // Schedule final cart abandonment notification for very high value carts
        if (cartValue >= 200) {
          await NotificationManager.sendFinalCartAbandonmentNotification(
            cartValue,
            cartItems.length,
            24 // 24 hours left message
          );
        }

        console.log("Enhanced cart abandonment reminders scheduled");
      } catch (error) {
        console.error("Error scheduling cart abandonment reminders:", error);
      }
    }

    setAbandonmentTracked(true);
  };

  const trackCartRecoveryAttempt = (recoveryMethod: string) => {
    const cartValue = recoveredCartItems.reduce(
      (sum, item) => sum + item.price.amount * item.selectedQuantity,
      0
    );

    posthog.track("cart_recovery_attempt", {
      recovery_method: recoveryMethod,
      cart_value: cartValue,
      item_count: recoveredCartItems.length,
      time_since_abandonment: recoveredTimestamp
        ? Date.now() - recoveredTimestamp
        : null,
      user_type: "authenticated",
    });
  };

  const trackCheckoutError = (error: any, errorStage: string) => {
    const cartValue = cartItems.reduce(
      (sum, item) => sum + item.price.amount * item.selectedQuantity,
      0
    );

    posthog.track("checkout_error", {
      error_stage: errorStage,
      error_code: error?.code || "unknown",
      error_message: error?.message || "Unknown error",
      cart_value: cartValue,
      item_count: cartItems.length,
      checkout_stage: checkoutStage,
      user_type: "authenticated",
      retry_available: true,
    });
  };

  // Track cart abandonment when user navigates away or app goes to background
  useFocusEffect(
    React.useCallback(() => {
      // Reset abandonment tracking when screen is focused
      setAbandonmentTracked(false);
      setCartSessionStartTime(Date.now());
      setLastInteractionTime(Date.now());

      return () => {
        // Track abandonment when user navigates away
        if (cartItems.length > 0 && !abandonmentTracked) {
          trackCartAbandonment("navigation", "user_navigated_away");
        }
      };
    }, [cartItems.length, abandonmentTracked])
  );

  // Track app state changes for abandonment
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (
        nextAppState === "background" &&
        cartItems.length > 0 &&
        !abandonmentTracked
      ) {
        trackCartAbandonment("app_background", "app_backgrounded");
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [cartItems.length, abandonmentTracked]);

  // Update interaction time on any cart interaction
  useEffect(() => {
    updateLastInteraction();
  }, [cartItems]);

  // Check for recoverable cart or previous payment errors on component mount
  useEffect(() => {
    checkForRecoverableState();
  }, []);

  // Check for recoverable cart state or previous payment errors
  const checkForRecoverableState = async () => {
    try {
      setIsCheckingRecovery(true);

      // First check if the user already has items in their cart
      if (cartItems.length > 0) {
        setIsCheckingRecovery(false);
        return; // Don't show recovery if user already has items in cart
      }

      // Check if there was a recent payment error
      const hasError = await hasRecentCheckoutError();
      if (hasError) {
        const errorInfo = await getLastCheckoutError();
        if (errorInfo) {
          setLastErrorMessage(errorInfo.message);

          // Try to check if order was actually created despite the error
          if (firebaseId && errorInfo.paymentIntentId) {
            try {
              console.log(
                "Checking for completed order after previous error..."
              );
              const orderRecoveryResult = await attemptOrderRecovery(
                firestore,
                firebaseId,
                errorInfo.paymentIntentId
              );

              if (
                orderRecoveryResult.recovered &&
                orderRecoveryResult.orders.length > 0
              ) {
                // Order was actually created, clear error and cart state
                await clearCheckoutError();
                await clearCartState();

                Alert.alert(
                  "Order Found",
                  "We found that your previous order was actually processed successfully despite the error. Your order is confirmed!",
                  [
                    {
                      text: "View Orders",
                      onPress: () => router.navigate("/account"),
                    },
                  ]
                );
                return; // Exit early since order was found
              }
            } catch (reconcileError) {
              console.error("Error during order recovery:", reconcileError);
              // Continue with normal error handling
            }
          }

          // If no order found, show payment error handler
          setShowPaymentErrorHandler(true);
        }
      }

      // Check if there's a recoverable cart
      const isRecoverable = await isCartRecoverable();
      if (isRecoverable) {
        const savedCart = await getCartState();
        if (savedCart && savedCart.items && savedCart.items.length > 0) {
          setRecoveredCartItems(savedCart.items as GenericCartItem[]);
          setRecoveredTimestamp(savedCart.timestamp);
          setShowRecoveryModal(true);
        }
      }
    } catch (error) {
      console.error("Error checking for recoverable state:", error);
    } finally {
      setIsCheckingRecovery(false);
    }
  };

  // Restore cart from saved state
  const handleRestoreCart = () => {
    setRecoveryLoading(true);

    try {
      // Track cart recovery attempt
      trackCartRecoveryAttempt("cart_recovery_modal");

      // Update redux store with saved items - convert to the expected Redux format
      dispatch(
        updateCartItems(recoveredCartItems as unknown as ReduxCartItem[])
      );

      // Clear saved cart state after successful recovery
      clearCartState();

      // Hide the recovery modal
      setShowRecoveryModal(false);

      // Show order summary after cart restoration
      setCheckoutInProgress(true);

      // Reset abandonment tracking for new session
      setAbandonmentTracked(false);
      setCartSessionStartTime(Date.now());
      setLastInteractionTime(Date.now());

      // Show confirmation to user
      Alert.alert(
        "Cart Restored",
        "Your previous cart items have been restored successfully."
      );
    } catch (error) {
      console.error("Error restoring cart:", error);

      // Track recovery failure
      posthog.track("cart_recovery_failed", {
        recovery_method: "cart_recovery_modal",
        error_message: error instanceof Error ? error.message : "Unknown error",
        user_type: "authenticated",
      });

      Alert.alert(
        "Restore Failed",
        "There was a problem restoring your cart. Please try again."
      );
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Dismiss recovery modal
  const handleDismissRecovery = () => {
    // Track abandonment of recovery attempt
    posthog.track("cart_recovery_dismissed", {
      recovery_method: "cart_recovery_modal",
      cart_value: recoveredCartItems.reduce(
        (sum, item) => sum + item.price.amount * item.selectedQuantity,
        0
      ),
      item_count: recoveredCartItems.length,
      time_since_abandonment: recoveredTimestamp
        ? Date.now() - recoveredTimestamp
        : null,
      user_type: "authenticated",
    });

    clearCartState();
    setShowRecoveryModal(false);
  };

  // Handle retry of failed payment
  const handleRetryPayment = async () => {
    // Track checkout retry attempt
    posthog.track("checkout_retry_attempt", {
      retry_method: "payment_error_handler",
      checkout_stage: checkoutStage,
      cart_value: cartItems.reduce(
        (sum, item) => sum + item.price.amount * item.selectedQuantity,
        0
      ),
      item_count: cartItems.length,
      user_type: "authenticated",
    });

    setShowPaymentErrorHandler(false);
    await clearCheckoutError();

    // Small delay to ensure UI updates before retry
    setTimeout(() => {
      handleCheckout();
    }, 500);
  };

  // Handle cancellation of payment retry
  const handleCancelRetry = () => {
    // Track abandonment from payment error
    if (cartItems.length > 0) {
      trackCartAbandonment("payment_error", "user_cancelled_payment_retry");
    }

    clearCheckoutError();
    setShowPaymentErrorHandler(false);
  };

  // Debugging logs to track state changes
  useEffect(() => {
    // console.log("showAddressSheet state changed:", showAddressSheet);
    if (!showAddressSheet) {
      setLoading(false); // Ensure loading state is reset when sheet is closed
    }
  }, [showAddressSheet]);

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

    // Track cart viewed when cart has items
    if (cartItems.length > 0) {
      posthog.track("cart_viewed", {
        cart_value: newTotalPrice + shippingCost + calculatedTaxAmount,
        item_count: cartItems.length,
        currency: "USD",
        has_clothing_items: hasClothingItems,
        shipping_cost: shippingCost,
        tax_amount: calculatedTaxAmount,
      });
    }

    // Automatically show order summary when cart has items
    if (cartItems.length > 0) {
      setCheckoutInProgress(true);
    } else {
      setCheckoutInProgress(false);
    }

    // Update Redux store with checkout price
    dispatch(
      setCheckoutPrice(newTotalPrice + shippingCost + calculatedTaxAmount)
    );
  }, [cartItems, dispatch]);

  // Handle the checkout process
  const handleCheckout = async () => {
    // Update interaction tracking
    updateLastInteraction();

    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty.");
      return;
    }

    // Validate cart before proceeding
    const validationResult = validateCart(cartItems);
    if (!validationResult.isValid) {
      // Set validation errors to display in the UI
      setValidationErrors(validationResult.errors);

      // Show validation error message
      Alert.alert(
        "Cart Validation Error",
        getCartValidationErrorMessage(validationResult.errors)
      );
      return;
    }

    // Clear any previous validation errors
    setValidationErrors(null);

    // Check network connectivity before proceeding
    const isConnected = await isNetworkConnected();
    if (!isConnected) {
      Alert.alert(
        "Network Error",
        "You appear to be offline. Please check your connection and try again.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      setLoading(true);
      // Show order summary when checkout starts
      setCheckoutInProgress(true);

      // Update checkout stage
      setCheckoutStage("checkout_started");
      setHasAttemptedCheckout(true);

      // Track checkout started
      posthog.track("checkout_started", {
        cart_value: totalPrice,
        item_count: cartItems.length,
        currency: "USD",
        has_clothing_items: hasClothingItems,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        product_ids: cartItems.map((item) => item.productId).join(","),
        total_quantity: cartItems.reduce(
          (sum, item) => sum + item.selectedQuantity,
          0
        ),
        has_event_tickets: cartItems.some((item) => !!item.eventDetails),
      });

      // Save cart state before proceeding with checkout in case there's an error
      await saveCartState(cartItems as any[], totalPrice);

      // Reset payment state before starting checkout
      setPaymentSheetInitialized(false);
      setStripePaymentIntent("");

      if (hasClothingItems) {
        console.log("Physical items detected, opening address collection");
        setCheckoutStage("address_collection");
        setShowAddressSheet(true); // Show the address sheet
        // The payment flow continues in the AddressSheet.onSubmit handler
      } else {
        console.log("Digital items only, proceeding directly to payment");
        // For event tickets, go directly to payment
        setCheckoutStage("payment_initialization");
        const initialized = await initializePaymentSheet(null);
        if (initialized) {
          setCheckoutStage("payment_sheet");
          await openPaymentSheet("RS-EVENT", null);
        } else {
          // Payment initialization failed
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);

      // Track checkout error
      trackCheckoutError(error, "checkout_initialization");

      // Save error information for potential recovery
      if (error instanceof Error) {
        const errorInfo = {
          code: "CHECKOUT_ERROR",
          message: error.message,
        };
        await saveCheckoutError(errorInfo);
      }

      Alert.alert(
        "Checkout Error",
        `There was an issue with checkout: ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );

      // Reset checkout progress when an error occurs
      setCheckoutInProgress(false);
      setLoading(false);
    }
  };

  const handleRemoveFromCart = (
    productId: string,
    selectedColor?: string | null,
    selectedSize?: string | null
  ) => {
    // Update interaction tracking
    updateLastInteraction();

    // Find the item being removed for analytics
    const itemToRemove = cartItems.find(
      (item) =>
        item.productId === productId &&
        item.selectedColor === selectedColor &&
        item.selectedSize === selectedSize
    );

    // Track remove from cart
    if (itemToRemove) {
      posthog.track("remove_from_cart", {
        product_id: itemToRemove.productId,
        product_name: itemToRemove.title || "Unknown Product",
        price: itemToRemove.price.amount,
        currency: itemToRemove.price.currencyCode || "USD",
        quantity: itemToRemove.selectedQuantity,
        selected_color: itemToRemove.selectedColor,
        selected_size: itemToRemove.selectedSize,
        is_event_ticket: !!itemToRemove.eventDetails,
      });
    }

    // Clear validation errors for this product when removing it
    if (validationErrors?.items && validationErrors.items[productId]) {
      const updatedErrors = { ...validationErrors };
      if (updatedErrors.items) {
        delete updatedErrors.items[productId];

        // If no more item errors, clear all validation errors
        if (Object.keys(updatedErrors.items).length === 0) {
          setValidationErrors(null);
        } else {
          setValidationErrors(updatedErrors);
        }
      }
    }

    // Use type assertion to tell TypeScript we know what we're doing
    dispatch(
      removeFromCart({
        productId,
        selectedColor,
        selectedSize,
      } as any)
    );

    // Check if this was the last item in the cart
    // Need to handle this in the useEffect that monitors cartItems
  };

  const handleClearCart = () => {
    setClearConfirmationModalVisible(true);
  };

  const confirmClearCart = () => {
    // Track cart clearing as abandonment
    if (cartItems.length > 0) {
      trackCartAbandonment("cart_clear", "user_cleared_cart");
    }

    dispatch(clearCart());
    setClearConfirmationModalVisible(false);
    setCheckoutInProgress(false); // Hide order summary when cart is cleared
  };

  const cancelClearCart = () => {
    setClearConfirmationModalVisible(false);
  };

  const sendPurchaseNotification = async (
    orderId: string,
    orderTotal: number,
    orderItems: any[]
  ) => {
    if (!expoPushToken) {
      console.log("No push token available, skipping notification");
      return;
    }

    try {
      // Check if we have event tickets vs regular products
      const eventTickets = orderItems.filter((item) => !!item.eventDetails);
      const regularProducts = orderItems.filter((item) => !item.eventDetails);

      // Send event ticket purchase confirmations for each event
      for (const ticket of eventTickets) {
        const eventData = {
          eventId: ticket.productId,
          eventName: ticket.title,
          eventDate: ticket.eventDetails?.dateTime
            ? new Date(ticket.eventDetails.dateTime.seconds * 1000)
            : undefined,
          eventLocation: ticket.eventDetails?.location,
        };

        // Send ticket purchase confirmation
        await NotificationManager.sendEventTicketPurchaseConfirmation(
          eventData,
          ticket.selectedQuantity,
          ticket.price.amount * ticket.selectedQuantity
        );

        // Schedule event reminders (24hr and 1hr before event)
        if (eventData.eventDate) {
          const reminderResults =
            await NotificationManager.scheduleEventReminders(eventData);
          if (reminderResults.reminder24h || reminderResults.reminder1h) {
            console.log(
              `Event reminders scheduled for ${eventData.eventName}:`,
              reminderResults
            );
          }
        }
      }

      // Send regular order notifications only if we have non-event items
      if (regularProducts.length > 0) {
        // Send order confirmation notification
        await NotificationManager.sendOrderConfirmation(
          orderId,
          `$${orderTotal.toFixed(2)}`
        );

        // Send order processing notification immediately after
        const orderData = {
          orderId,
          orderTotal,
          orderItems: orderItems.map((item) => ({
            productId: item.productId,
            title: item.title,
            quantity: item.selectedQuantity,
            price: item.price.amount,
          })),
          shippingAddress: addressDetails,
          paymentMethod: "stripe",
          customerEmail: userEmail || undefined,
        };

        await NotificationManager.sendOrderProcessingNotification(
          orderId,
          orderData
        );
      }

      console.log("Order and event notifications sent successfully");
    } catch (error) {
      console.error("Error sending order notifications:", error);
    }
  };

  const fetchPaymentSheetParams = async (
    addressDetails: AddressDetails | null
  ) => {
    try {
      // Use the correct API endpoint for payment-sheet
      const apiEndpoint = `${API_URL}/payment-sheet`;

      console.log("Making API request to:", apiEndpoint);

      const requestBody = {
        userId: firebaseId,
        amount: Math.round(totalPrice * 100),
        customerEmail: userEmail,
        name: userName || "Unknown User",
        firebaseId: firebaseId, // Match the expected parameter in cloud function
        address: addressDetails || {},
      };

      console.log("Request payload:", JSON.stringify(requestBody));

      // Use retry with backoff for network resilience
      return await retryWithBackoff(async () => {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        // First check if response is ok (status in 200-299 range)
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error (${response.status}):`, errorText);
          throw new Error(
            `API returned error ${response.status}: ${response.statusText}`
          );
        }

        // Try to parse the JSON response
        let responseText;
        try {
          responseText = await response.text();

          // Debug the raw response
          console.log(
            "Raw API response:",
            responseText.substring(0, 200) +
              (responseText.length > 200 ? "..." : "")
          );

          const responseData = JSON.parse(responseText);
          const { paymentIntent, ephemeralKey, customer } = responseData;

          if (!paymentIntent || !ephemeralKey || !customer) {
            console.error(
              "Missing required fields in payment response:",
              responseData
            );
            throw new Error("Invalid payment response from server");
          }

          return { paymentIntent, ephemeralKey, customer };
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError);
          console.error("Response content:", responseText);
          throw new Error("Invalid response format from payment server");
        }
      });
    } catch (error) {
      console.error("Error fetching payment sheet params:", error);

      // Save the error information for recovery
      if (error instanceof Error) {
        await saveCheckoutError({
          code: "API_ERROR",
          message: error.message,
        });
      }

      Alert.alert(
        "Payment Setup Error",
        "Could not connect to payment server. Please try again later."
      );
      throw new Error("Failed to initiate payment process");
    }
  };

  const initializePaymentSheet = async (
    addressDetails: AddressDetails | null
  ) => {
    // Reset initialization state at the beginning
    setPaymentSheetInitialized(false);

    try {
      console.log("Starting payment sheet initialization");

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Payment initialization timed out")),
          15000
        );
      });

      // Fetch payment parameters with timeout protection
      const paramsPromise = fetchPaymentSheetParams(addressDetails);

      // @ts-ignore - TypeScript doesn't recognize Promise.race return type correctly
      const { paymentIntent, ephemeralKey, customer } = await Promise.race([
        paramsPromise,
        timeoutPromise,
      ]);

      console.log("Payment parameters obtained successfully");
      setStripePaymentIntent(paymentIntent);

      const initResult = await initPaymentSheet({
        merchantDisplayName: "RAGESTATE",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: false,
        returnURL: "ragestate://stripe-redirect", // For handling 3D Secure authentication returns
        defaultBillingDetails: {
          name: userName || "",
          email: userEmail || "",
        },
        // Add appearance option for consistent styling with address sheet
        appearance: {
          colors: {
            primary: GlobalStyles.colors.red4,
            background: "#000000",
            componentBackground: "#222222", // Match address sheet styling
            componentBorder: "#4a4a4c", // Match address sheet styling
            componentDivider: GlobalStyles.colors.grey7,
            primaryText: "#FFFFFF",
            secondaryText: "#FFFFFF", // Better visibility for all text
            componentText: "#FFFFFF", // Explicit setting for input text
            placeholderText: "#a0a0a8", // Lighter gray for better visibility
            icon: "#c0c0c8", // Brighter icons
            error: GlobalStyles.colors.redVivid4, // Brighter error color
          },
          font: {
            scale: 1.1, // Increased text size for better readability
          },
          shapes: {
            borderRadius: 8,
            borderWidth: 1.5, // Thicker borders for better definition
          },
        },
      });

      if (!initResult.error) {
        console.log("Payment sheet initialized successfully");
        setPaymentSheetInitialized(true);
        return true;
      } else {
        console.error("Error initializing payment sheet:", initResult.error);

        // Track payment initialization error
        trackCheckoutError(initResult.error, "payment_sheet_initialization");

        // Handle specific error codes
        if (initResult.error.code === "Failed") {
          Alert.alert(
            "Payment Setup Error",
            "Payment system is temporarily unavailable. Please try again later."
          );

          // Save error information
          await saveCheckoutError({
            code: initResult.error.code || "INIT_ERROR",
            message: initResult.error.message || "Failed to initialize payment",
          });
        } else {
          Alert.alert(
            "Payment Error",
            `Unable to initialize payment: ${
              initResult.error.localizedMessage ||
              initResult.error.message ||
              "Unknown error"
            }`
          );

          // Save error information
          await saveCheckoutError({
            code: initResult.error.code || "INIT_ERROR",
            message:
              initResult.error.localizedMessage ||
              initResult.error.message ||
              "Unknown initialization error",
          });
        }
        return false;
      }
    } catch (error) {
      console.error("Payment initialization error:", error);

      // Track payment initialization error
      trackCheckoutError(error, "payment_sheet_initialization_exception");

      // Save error for recovery
      if (error instanceof Error) {
        await saveCheckoutError({
          code: "INIT_ERROR",
          message: error.message,
        });
      }

      Alert.alert(
        "Payment Error",
        `Unable to initialize payment. ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openPaymentSheet = async (
    paymentIntentPrefix: string,
    addressDetails: AddressDetails | null
  ) => {
    try {
      setLoading(true);

      // Make sure we have a properly initialized payment sheet
      if (!paymentSheetInitialized) {
        console.log("Payment sheet not initialized, initializing now...");
        const initialized = await initializePaymentSheet(addressDetails);
        if (!initialized) {
          console.log("Failed to initialize payment sheet, aborting");
          setLoading(false);
          return;
        }
      }

      console.log("Presenting payment sheet to user");
      const { error } = await presentPaymentSheet();

      // Track payment info added (when payment sheet is presented)
      posthog.track("payment_info_added", {
        cart_value: totalPrice,
        item_count: cartItems.length,
        currency: "USD",
        has_clothing_items: hasClothingItems,
      });

      if (error) {
        console.error("Payment error:", error);

        // Track payment error
        trackCheckoutError(error, "payment_sheet_presentation");

        // Save error information for recovery
        await saveCheckoutError({
          code: error.code || "PAYMENT_ERROR",
          message: error.message || "Payment failed",
          paymentIntentId: stripePaymentIntent,
        });

        // Send payment failure notification (only for actual failures, not cancellations)
        if (error.code !== "Canceled" && expoPushToken) {
          try {
            const tempOrderId = `FAILED-${Date.now()}`;
            await NotificationManager.sendPaymentFailureNotification(
              tempOrderId,
              error.message || "Payment could not be processed"
            );
            console.log("Payment failure notification sent");
          } catch (notificationError) {
            console.error(
              "Error sending payment failure notification:",
              notificationError
            );
          }
        }

        // Handle different error types
        if (error.code === "Canceled") {
          console.log("User canceled the payment");
          // Track payment cancellation as abandonment
          if (cartItems.length > 0) {
            trackCartAbandonment("payment_sheet", "user_cancelled_payment");
          }
          // No need to show an alert for user-initiated cancellation
        } else if (
          error.code === "Failed" &&
          error.message.includes("initialize")
        ) {
          // Reset initialization state and try again
          setPaymentSheetInitialized(false);
          Alert.alert(
            "Payment Setup Error",
            "The payment couldn't be processed. Would you like to try again?",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Try Again",
                onPress: () => {
                  // Try again with a delay
                  setTimeout(() => {
                    openPaymentSheet(paymentIntentPrefix, addressDetails);
                  }, 1000);
                },
              },
            ]
          );
        } else if (isNetworkError(error)) {
          // Handle network-specific errors
          Alert.alert(
            "Network Error",
            "There was a problem with the network connection. Your cart has been saved and you can try again when your connection improves.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert("Payment Failed", error.message || "Please try again");
        }
      } else {
        // Payment successful, save order information
        try {
          console.log("Payment successful, saving order");
          setCheckoutStage("order_processing");

          const orderDetails: OrderDetails = {
            orderId: `${paymentIntentPrefix}-${Date.now()}`,
            orderItems: cartItems,
            orderTotal: totalPrice,
            shippingAddress: addressDetails,
            paymentIntentId: stripePaymentIntent,
            timestamp: Date.now(),
            status: "processing",
          };

          // Save to user's orders collection in Firestore using idempotent order creation
          if (!firebaseId) {
            throw new Error("User ID is required to save order");
          }

          // Use idempotent order creation to prevent duplicates
          console.log("Creating order in Firestore with idempotency...");
          await createOrderIdempotent(firestore, firebaseId, {
            ...orderDetails,
            userId: firebaseId,
            items: cartItems,
            totalPrice: totalPrice,
            paymentIntentId: stripePaymentIntent,
            createdAt: new Date(),
            status: "processing",
          } as OrderData);
          console.log("Order creation complete");

          // Track purchase completed with detailed ticket information
          const eventTickets = cartItems.filter((item) => !!item.eventDetails);
          const hasEventTickets = eventTickets.length > 0;

          posthog.track("purchase_completed", {
            order_id: orderDetails.orderId,
            revenue: totalPrice,
            currency: "USD",
            item_count: cartItems.length,
            payment_method: "stripe",
            has_clothing_items: hasClothingItems,
            shipping_cost: shippingCost,
            tax_amount: taxAmount,
            product_ids: cartItems.map((item) => item.productId).join(","),
            total_quantity: cartItems.reduce(
              (sum, item) => sum + item.selectedQuantity,
              0
            ),
            has_event_tickets: hasEventTickets,
            // Enhanced ticket-specific tracking
            ticket_count: eventTickets.length,
            total_ticket_quantity: eventTickets.reduce(
              (sum, item) => sum + item.selectedQuantity,
              0
            ),
            ticket_revenue: eventTickets.reduce(
              (sum, item) => sum + item.price.amount * item.selectedQuantity,
              0
            ),
            event_names: eventTickets.map((item) => item.title).join(","),
          });

          // Track specific ticket purchase completion for events
          if (hasEventTickets) {
            eventTickets.forEach((ticket) => {
              posthog.track("ticket_purchase_completed", {
                order_id: orderDetails.orderId,
                event_id: ticket.productId,
                event_name: ticket.title,
                event_date: ticket.eventDetails?.dateTime || null,
                event_location: ticket.eventDetails?.location || null,
                ticket_type: "general_admission",
                ticket_price: ticket.price.amount,
                ticket_quantity: ticket.selectedQuantity,
                payment_method: "stripe",
                transaction_total: totalPrice,
                purchase_timestamp: new Date().toISOString(),
              });
            });
          }

          // Send order status notifications
          await sendPurchaseNotification(
            orderDetails.orderId,
            totalPrice,
            cartItems
          );

          // Cancel any pending cart abandonment notifications since order is complete
          try {
            await NotificationManager.cancelCartNotifications();
            console.log("Cancelled pending cart abandonment notifications");
          } catch (error) {
            console.error("Error cancelling cart notifications:", error);
          }

          // Clear cart after successful purchase
          dispatch(clearCart());

          // Clear any saved cart state and errors since purchase was successful
          await clearCartState();
          await clearCheckoutError();

          // Reset payment state and update to completion stage
          setPaymentSheetInitialized(false);
          setCheckoutInProgress(false);
          setCheckoutStage("completed");
          setAbandonmentTracked(false); // Reset for next session

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
          Alert.alert(
            "Order Processing",
            "Your payment was successful, but we encountered an issue saving your order. Our team will contact you shortly."
          );
        }
      }
    } catch (error) {
      console.error("Error in payment process:", error);

      // Check if the order was actually created despite the error
      if (firebaseId && stripePaymentIntent) {
        try {
          console.log("Attempting order reconciliation check...");
          const reconciliationResult = await reconcileOrder(
            firestore,
            firebaseId,
            stripePaymentIntent
          );

          if (reconciliationResult.length > 0) {
            // Order was actually created successfully
            console.log(
              "Order was created despite payment error - reconciliation successful"
            );

            // Clear cart since order was actually created
            dispatch(clearCart());
            await clearCartState();

            Alert.alert(
              "Order Confirmed",
              "Despite the error message, your order was processed successfully.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    router.navigate("/home");
                  },
                },
              ]
            );
            return; // Exit early since we've handled the reconciliation
          } else {
            console.log("No existing order found during reconciliation check");
          }
        } catch (reconcileError) {
          console.error("Error during order reconciliation:", reconcileError);
          // Continue with normal error handling
        }
      }

      // Save error information for recovery
      if (error instanceof Error) {
        await saveCheckoutError({
          code: "PAYMENT_PROCESS_ERROR",
          message: error.message,
          paymentIntentId: stripePaymentIntent,
        });
      }

      Alert.alert(
        "Payment Error",
        "An unexpected error occurred. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  // We don't actually need a separate primaryAddyStyle variable since we're using
  // the appearance object to configure the AddressSheet styling completely

  // Address sheet appearance configuration - enhanced for dark theme text readability
  const addressSheetAppearance = {
    colors: {
      primary: GlobalStyles.colors.red4, // Brand color for buttons and accents
      background: "#000000", // Match app's dark background (fixed hex code)
      componentBackground: "#222222", // Slightly lighter than before for better contrast with white text
      componentBorder: "#4a4a4c", // More visible border for better field definition
      componentDivider: GlobalStyles.colors.grey7, // Slightly lighter divider for better visibility
      primaryText: "#FFFFFF", // Main text color - bright white
      secondaryText: "#FFFFFF", // Secondary text also white for maximum visibility
      componentText: "#FFFFFF", // User input text - white for maximum contrast
      placeholderText: "#a0a0a8", // Lighter gray placeholder for better visibility against dark background
      icon: "#c0c0c8", // Even brighter icon color for improved visibility
      error: GlobalStyles.colors.redVivid4, // Brighter error color for better visibility
    },
    fonts: {
      scale: 1.1, // Increased text size for enhanced readability
      family: "System",
    },
    shapes: {
      borderRadius: 8, // Consistent with app's rounded corners
      borderWidth: 1.5, // Thicker border for better field definition
    },
  };

  const handleAddressSheetError = (error: any) => {
    // Only log actual errors, not cancellations
    if (error.code !== "Canceled" && error.code !== "Cancelled") {
      console.error("Address sheet error:", error);

      // Track address sheet error
      trackCheckoutError(error, "address_sheet");

      // Save error info for potential recovery
      saveCheckoutError({
        code: "ADDRESS_ERROR",
        message: error.message || "Address validation failed",
      });

      Alert.alert(
        "Address Error",
        "Could not validate address. Please try again."
      );
    } else {
      // Handle cancellation as abandonment
      if (cartItems.length > 0) {
        trackCartAbandonment("address_sheet", "user_cancelled_address_entry");
      }
      // console.log("AddressSheet flow canceled by user - this is normal behavior");
    }

    // In all cases, clean up the UI state
    setShowAddressSheet(false);
    setLoading(false);
  };

  // If the component is still checking for cart recovery, show a minimal loading state
  if (isCheckingRecovery) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading cart...</Text>
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey="pk_live_51NFhuOHnXmOBmfaDu16tJEuppfYKPUivMapB9XLXaBpiOLqiPRz2uoPAiifxqiLT49dyPCHOSKs74wjBspzJ8zo600yGYluqUe"
      merchantIdentifier="merchant.com.ragestate.app" // iOS Apple Pay integration
      urlScheme="ragestate" // For return URL handling
    >
      <View style={styles.rootContainer}>
        <StatusBar style="light" />
        <View style={styles.header}>
          {/* <Text style={styles.headerTitle}>Cart</Text> */}
          {cartItems.length > 0 && (
            <CartOperationErrorBoundary>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearCart}
                accessible={true}
                accessibilityLabel="Clear cart"
                accessibilityRole="button"
              >
                <Text style={styles.clearButtonText}>Clear Cart</Text>
              </TouchableOpacity>
            </CartOperationErrorBoundary>
          )}
        </View>

        {/* General validation error message */}
        {validationErrors?.general && (
          <View style={styles.generalErrorContainer}>
            <Text style={styles.errorText}>{validationErrors.general}</Text>
          </View>
        )}

        {/* Order reconciliation handler */}
        <CartReconciliationHandler
          isReconciling={isReconcilingOrder}
          error={reconciliationError}
          onRetry={() => {
            if (firebaseId && stripePaymentIntent) {
              setReconciliationError(null);
              setIsReconcilingOrder(true);
              reconcileOrder(firestore, firebaseId, stripePaymentIntent)
                .then((results) => {
                  if (results.length > 0) {
                    Alert.alert(
                      "Order Found",
                      "Your order was processed successfully!"
                    );
                    // Clear cart and error states
                    dispatch(clearCart());
                    clearCartState();
                    clearCheckoutError();
                  } else {
                    setReconciliationError("No existing order was found.");
                  }
                })
                .catch((error) => {
                  setReconciliationError(
                    "Failed to check order status: " +
                      (error.message || String(error))
                  );
                })
                .finally(() => {
                  setIsReconcilingOrder(false);
                });
            }
          }}
          onDismiss={() => {
            setReconciliationError(null);
          }}
        />

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
                <View
                  key={index}
                  style={[
                    styles.cartItemCard,
                    validationErrors?.items &&
                    validationErrors.items[item.productId]
                      ? styles.cartItemWithError
                      : {},
                  ]}
                >
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
                      {validationErrors?.items &&
                        validationErrors.items[item.productId]?.general && (
                          <Text style={styles.errorText}>
                            {validationErrors.items[item.productId].general}
                          </Text>
                        )}
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
                          <View>
                            <Text
                              style={[
                                styles.itemMeta,
                                validationErrors?.items &&
                                validationErrors.items[item.productId]?.color
                                  ? styles.errorText
                                  : {},
                              ]}
                            >
                              Color:{" "}
                              <Text style={styles.itemMetaValue}>
                                {item.selectedColor}
                              </Text>
                            </Text>
                            {validationErrors?.items &&
                              validationErrors.items[item.productId]?.color && (
                                <Text style={styles.errorText}>
                                  {validationErrors.items[item.productId].color}
                                </Text>
                              )}
                          </View>
                        )}
                        {item.selectedSize && (
                          <View>
                            <Text
                              style={[
                                styles.itemMeta,
                                validationErrors?.items &&
                                validationErrors.items[item.productId]?.size
                                  ? styles.errorText
                                  : {},
                              ]}
                            >
                              Size:{" "}
                              <Text style={styles.itemMetaValue}>
                                {item.selectedSize}
                              </Text>
                            </Text>
                            {validationErrors?.items &&
                              validationErrors.items[item.productId]?.size && (
                                <Text style={styles.errorText}>
                                  {validationErrors.items[item.productId].size}
                                </Text>
                              )}
                          </View>
                        )}
                        <View>
                          <Text
                            style={[
                              styles.itemMeta,
                              validationErrors?.items &&
                              validationErrors.items[item.productId]?.quantity
                                ? styles.errorText
                                : {},
                            ]}
                          >
                            Quantity:{" "}
                            <Text style={styles.itemMetaValue}>
                              {item.selectedQuantity}
                            </Text>
                          </Text>
                          {validationErrors?.items &&
                            validationErrors.items[item.productId]
                              ?.quantity && (
                              <Text style={styles.errorText}>
                                {
                                  validationErrors.items[item.productId]
                                    .quantity
                                }
                              </Text>
                            )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.itemBottomRow}>
                      <Text style={styles.itemPrice}>
                        $
                        {(item.price.amount * item.selectedQuantity).toFixed(2)}
                      </Text>
                      <CartOperationErrorBoundary>
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
                      </CartOperationErrorBoundary>
                    </View>
                  </View>
                </View>
              ))}
              <View style={{ height: 200 }} />
            </ScrollView>

            <AddressSheet
              appearance={addressSheetAppearance}
              defaultValues={{
                name: userName || "",
                phone: "",
                address: {
                  country: "US",
                },
              }}
              onSubmit={async (addressDetails) => {
                console.log(
                  "Address submission successful, proceeding with payment"
                );
                setAddressDetails(addressDetails);
                setCheckoutStage("address_completed");
                setShowAddressSheet(false);

                // Ensure we set a small delay before proceeding with payment
                // to allow the AddressSheet to properly dismiss
                setTimeout(async () => {
                  try {
                    setCheckoutStage("payment_initialization");
                    const initialized = await initializePaymentSheet(
                      addressDetails
                    );
                    if (initialized) {
                      setCheckoutStage("payment_sheet");
                      await openPaymentSheet("RS-MERCH", addressDetails);
                    }
                    // If initialization failed, the function already shows an error message
                  } catch (error) {
                    console.error("Error in address-to-payment flow:", error);

                    // Track checkout error in address-to-payment flow
                    trackCheckoutError(error, "address_to_payment_flow");

                    // Save error information
                    if (error instanceof Error) {
                      await saveCheckoutError({
                        code: "ADDRESS_PAYMENT_FLOW_ERROR",
                        message: error.message,
                      });
                    }

                    Alert.alert(
                      "Payment Error",
                      "There was a problem proceeding to payment. Please try again."
                    );
                    setLoading(false);
                  }
                }, 500);
              }}
              onError={handleAddressSheetError}
              sheetTitle={"SHIPPING ADDRESS"}
              primaryButtonTitle={"CONTINUE TO PAYMENT"}
              presentationStyle="fullscreen"
              visible={showAddressSheet}
            />

            {/* Order summary section */}
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

                {/* Checkout button removed from here - using only the one at bottom of screen */}
              </View>
            )}

            <View
              style={[
                styles.checkoutContainer,
                checkoutInProgress && { borderTopWidth: 0, paddingTop: 0 },
              ]}
            >
              <CheckoutPaymentErrorBoundary>
                <TouchableOpacity
                  style={[
                    styles.checkoutButton,
                    {
                      backgroundColor: GlobalStyles.colors.red4,
                      flex: 1,
                      marginLeft: 0,
                      borderWidth: 0,
                    },
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleCheckout}
                  disabled={loading || cartItems.length === 0}
                  accessible={true}
                  accessibilityLabel={`Proceed to checkout. Total amount ${totalPrice.toFixed(
                    2
                  )} dollars`}
                  accessibilityRole="button"
                  accessibilityHint="Completes your purchase and proceeds to payment"
                >
                  <Text
                    style={[styles.checkoutButtonText, { fontWeight: "600" }]}
                  >
                    {loading
                      ? "Processing..."
                      : `Check Out • $${totalPrice.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>
              </CheckoutPaymentErrorBoundary>
            </View>
          </>
        )}

        {/* Clear cart confirmation modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={clearConfirmationModalVisible}
          onRequestClose={cancelClearCart}
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

        {/* Cart Recovery Modal */}
        <CartRecoveryModal
          visible={showRecoveryModal}
          onRestore={handleRestoreCart}
          onDismiss={handleDismissRecovery}
          cartItems={recoveredCartItems}
          isLoading={recoveryLoading}
          errorMessage={lastErrorMessage}
          timestamp={recoveredTimestamp}
        />

        {/* Payment Error Handler */}
        {showPaymentErrorHandler && (
          <PaymentErrorHandler
            onRetry={handleRetryPayment}
            onCancel={handleCancelRetry}
          />
        )}

        {/* Development Testing Tool - only visible in development */}
        {process.env.NODE_ENV !== "production" && <CartRecoveryTester />}
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
    paddingTop: 10,
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
  totalPrice: {
    color: "white",
    fontFamily,
    fontSize: 18,
    fontWeight: "700",
  },
  checkoutContainer: {
    backgroundColor: "#111",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  priceContainer: {
    flexDirection: "column",
  },
  checkoutButton: {
    backgroundColor: GlobalStyles.colors.red4,
    borderWidth: 0,
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    flex: 1,
    marginLeft: 0, // No margin needed now that it takes full width
  },
  checkoutButtonText: {
    color: "white",
    fontFamily,
    fontSize: 16,
    fontWeight: "600",
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
  cartItemWithError: {
    borderColor: GlobalStyles.colors.red4,
    borderWidth: 1,
  },
  errorText: {
    color: GlobalStyles.colors.red4,
    fontFamily,
    fontSize: 14,
    marginVertical: 4,
  },
  generalErrorContainer: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.red4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
