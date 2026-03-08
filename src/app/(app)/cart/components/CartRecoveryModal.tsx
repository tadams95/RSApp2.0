import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Theme } from "../../../../constants/themes";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
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
            color={theme.colors.danger}
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
              color={theme.colors.textSecondary}
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

const createStyles = (theme: Theme) =>
  ({
    centeredView: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.overlay,
    },
    modalView: {
      width: "85%" as const,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.card,
      padding: theme.spacing.xxl,
      ...theme.shadows.modal,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    icon: {
      alignSelf: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: theme.typography.weights.bold,
      textAlign: "center" as const,
      marginBottom: theme.spacing.md,
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      textAlign: "center" as const,
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    errorContainer: {
      backgroundColor: theme.colors.dangerMuted,
      padding: theme.spacing.md,
      borderRadius: theme.radius.button,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: "rgba(255, 59, 48, 0.3)",
    },
    errorMessage: {
      color: theme.colors.danger,
      fontSize: 14,
    },
    detailsToggle: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    detailsToggleText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginRight: theme.spacing.xs,
    },
    itemsContainer: {
      backgroundColor: theme.colors.bgElev2,
      borderRadius: theme.radius.button,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.xl,
      maxHeight: 200,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    itemRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      marginBottom: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    itemName: {
      color: theme.colors.textSecondary,
      flex: 3,
      fontSize: 14,
    },
    itemQuantity: {
      color: theme.colors.textSecondary,
      flex: 1,
      textAlign: "center" as const,
      fontSize: 14,
    },
    itemPrice: {
      color: theme.colors.textSecondary,
      flex: 1,
      textAlign: "right" as const,
      fontSize: 14,
    },
    totalRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      marginTop: theme.spacing.sm,
    },
    totalLabel: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.bold,
    },
    totalPrice: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.bold,
    },
    buttonContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
    },
    button: {
      borderRadius: theme.radius.button,
      padding: 14,
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    buttonOutline: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      marginRight: 10,
    },
    buttonFilled: {
      backgroundColor: theme.colors.danger,
      marginLeft: 10,
    },
    buttonOutlineText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: theme.typography.weights.semibold,
    },
    buttonFilledText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.semibold,
    },
  } as const);

export default CartRecoveryModal;
