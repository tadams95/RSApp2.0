import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { selectCartItemCount } from "../../store/redux/cartSlice";

interface CartIconBadgeProps {
  /** Icon size (default: 26) */
  size?: number;
  /** Custom color override (uses theme.colors.textPrimary by default) */
  color?: string;
  /** Custom onPress handler (navigates to /cart by default) */
  onPress?: () => void;
  /** Whether to show the badge when count is 0 (default: false) */
  showZeroBadge?: boolean;
}

export const CartIconBadge: React.FC<CartIconBadgeProps> = ({
  size = 26,
  color,
  onPress,
  showZeroBadge = false,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const cartItemCount = useSelector(selectCartItemCount);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push("/cart");
    }
  };

  const iconColor = color || theme.colors.textPrimary;
  const showBadge = showZeroBadge ? true : cartItemCount > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Shopping cart with ${cartItemCount} items`}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons
        name="cart-outline"
        size={size}
        color={iconColor}
      />
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {cartItemCount > 9 ? "9+" : cartItemCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const createStyles = (theme: Theme) => ({
  container: {
    padding: 4,
    position: "relative" as const,
  },
  badge: {
    position: "absolute" as const,
    top: -2,
    right: -4,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "bold" as const,
    fontFamily,
  },
});

export default CartIconBadge;
