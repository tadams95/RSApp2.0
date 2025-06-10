import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../../../constants/styles";

// Type for cart items that's compatible with both the app's interfaces
interface GenericCartItem {
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
  [key: string]: any; // Allow for any other properties
}

interface CartRecoveryModalProps {
  visible: boolean;
  onRestore: () => void;
  onDismiss: () => void;
  cartItems: GenericCartItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  timestamp?: number;
}

const CartRecoveryModal: React.FC<CartRecoveryModalProps> = ({
  visible,
  onRestore,
  onDismiss,
  cartItems,
  isLoading = false,
  errorMessage = null,
  timestamp,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Format the timestamp as a readable date/time
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleString()
    : "Unknown time";

  // Calculate the cart's item count
  const itemCount = cartItems.reduce(
    (count, item) => count + item.selectedQuantity,
    0
  );

  // Calculate total price
  const totalPrice = cartItems
    .reduce(
      (total, item) => total + item.price.amount * item.selectedQuantity,
      0
    )
    .toFixed(2);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Ionicons
            name="cart"
            size={40}
            color={GlobalStyles.colors.red4}
            style={styles.icon}
          />

          <Text style={styles.title}>Cart Recovery</Text>

          <Text style={styles.description}>
            We found your previous cart with {itemCount} item
            {itemCount !== 1 ? "s" : ""}
            from {formattedDate}.
          </Text>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorMessage}>
                Previous error: {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={styles.detailsToggleText}>
              {expanded ? "Hide details" : "Show details"}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={GlobalStyles.colors.grey3}
            />
          </TouchableOpacity>

          {expanded && (
            <View style={styles.itemsContainer}>
              {cartItems.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text
                    style={styles.itemName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.title || "Product"}
                  </Text>
                  <Text style={styles.itemQuantity}>
                    x{item.selectedQuantity}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ${(item.price.amount * item.selectedQuantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalPrice}>${totalPrice}</Text>
              </View>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonOutline]}
              onPress={onDismiss}
              disabled={isLoading}
            >
              <Text style={styles.buttonOutlineText}>Discard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonFilled]}
              onPress={onRestore}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonFilledText}>Restore Cart</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalView: {
    width: "85%",
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
  },
  icon: {
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    color: GlobalStyles.colors.grey3,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  errorMessage: {
    color: GlobalStyles.colors.red3,
    fontSize: 14,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  detailsToggleText: {
    color: GlobalStyles.colors.grey3,
    fontSize: 14,
    marginRight: 4,
  },
  itemsContainer: {
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  itemName: {
    color: GlobalStyles.colors.grey2,
    flex: 3,
    fontSize: 14,
  },
  itemQuantity: {
    color: GlobalStyles.colors.grey3,
    flex: 1,
    textAlign: "center",
    fontSize: 14,
  },
  itemPrice: {
    color: GlobalStyles.colors.grey2,
    flex: 1,
    textAlign: "right",
    fontSize: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  totalLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  totalPrice: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    borderRadius: 8,
    padding: 14,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey7,
    marginRight: 10,
  },
  buttonFilled: {
    backgroundColor: GlobalStyles.colors.red4,
    marginLeft: 10,
  },
  buttonOutlineText: {
    color: GlobalStyles.colors.grey3,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonFilledText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CartRecoveryModal;
