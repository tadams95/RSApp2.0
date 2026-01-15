# Cart Navigation Improvement Specification

> **Purpose:** Improve cart accessibility from Events, reducing user friction after adding tickets  
> **Priority:** High (UX improvement)  
> **Estimated Effort:** 1-2 hours  
> **Last Updated:** January 15, 2026

---

## Problem Statement

**Current State:**

- Cart is only accessible from the Shop page header
- After adding an event ticket to cart, users see a modal with only an "OK" button
- Navigation flow: Events → Add to Cart → OK → Tab to Shop → Cart icon = **4+ taps**

**Desired State:**

- Users can navigate directly to cart after adding a ticket
- Consistent cart icon component across the app
- Navigation flow: Events → Add to Cart → View Cart = **2 taps**

---

## Solution Overview

Implement **Option B + C Combined**:

1. **Part 1:** Update the "Add to Cart" confirmation modal with "View Cart" and "Continue Shopping" buttons
2. **Part 2:** Create a reusable `CartIconBadge` component for future consistency

---

## Part 1: Update Confirmation Modal

### File to Modify

`src/app/(app)/events/[id].tsx`

### Current Implementation (Lines 420-438)

```tsx
{
  /* Add to Cart Confirmation Modal */
}
<Modal
  animationType="fade"
  transparent={true}
  visible={addToCartConfirmationVisible}
>
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Text style={styles.modalText}>Event successfully added to cart!</Text>
      <TouchableOpacity
        style={styles.modalButton}
        onPress={closeAddToCartConfirmation}
      >
        <Text style={styles.modalButtonText}>OK</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>;
```

### Target Implementation

```tsx
{
  /* Add to Cart Confirmation Modal */
}
<Modal
  animationType="fade"
  transparent={true}
  visible={addToCartConfirmationVisible}
>
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      {/* Success Icon */}
      <View style={styles.modalIconContainer}>
        <Ionicons
          name="checkmark-circle"
          size={48}
          color={theme.colors.success}
        />
      </View>

      <Text style={styles.modalText}>Event added to cart!</Text>

      {/* Button Row */}
      <View style={styles.modalButtonRow}>
        <TouchableOpacity
          style={styles.modalSecondaryButton}
          onPress={closeAddToCartConfirmation}
        >
          <Text style={styles.modalSecondaryButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modalPrimaryButton}
          onPress={handleViewCart}
        >
          <Text style={styles.modalPrimaryButtonText}>View Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>;
```

### Required Changes

#### 1. Add Handler Function (after `closeAddToCartConfirmation`)

```tsx
const handleViewCart = () => {
  setAddToCartConfirmationVisible(false);
  router.push("/cart");
};
```

#### 2. Add New Styles to `createStyles` Function

```tsx
modalIconContainer: {
  marginBottom: 12,
},
modalButtonRow: {
  flexDirection: "row",
  gap: 12,
  width: "100%",
},
modalSecondaryButton: {
  flex: 1,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 10,
  alignItems: "center",
},
modalSecondaryButtonText: {
  fontFamily,
  color: theme.colors.textPrimary,
  fontSize: 14,
  fontWeight: "600",
},
modalPrimaryButton: {
  flex: 1,
  backgroundColor: theme.colors.accent || "rgba(255, 255, 255, 0.15)",
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 10,
  alignItems: "center",
},
modalPrimaryButtonText: {
  fontFamily,
  fontWeight: "700",
  color: theme.colors.textPrimary,
  fontSize: 14,
  letterSpacing: 0.5,
},
```

#### 3. Update Existing Modal Styles

Update `modalContent` to accommodate the new layout:

```tsx
modalContent: {
  backgroundColor: "rgba(20, 20, 20, 0.95)",
  borderRadius: 16,
  padding: 24,
  alignItems: "center",
  width: "85%",
  maxWidth: 340,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.12)",
},
modalText: {
  fontFamily,
  fontSize: 18,
  fontWeight: "600",
  color: theme.colors.textPrimary,
  marginBottom: 20,
  textAlign: "center",
},
```

#### 4. Update Types Interface

Add to the `Styles` type at the top of the file:

```tsx
modalIconContainer: ViewStyle;
modalButtonRow: ViewStyle;
modalSecondaryButton: ViewStyle;
modalSecondaryButtonText: TextStyle;
modalPrimaryButton: ViewStyle;
modalPrimaryButtonText: TextStyle;
```

---

## Part 2: Create Reusable CartIconBadge Component

### File to Create

`src/components/ui/CartIconBadge.tsx`

### Implementation

```tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { selectCartItemCount } from "../../store/redux/cartSlice";
import { Theme } from "../../constants/themes";

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
```

### Update Barrel Export

Add to `src/components/ui/index.ts`:

```tsx
export {
  CartIconBadge,
  default as CartIconBadgeComponent,
} from "./CartIconBadge";
```

### Refactor Shop to Use New Component (Optional)

Update `src/app/(app)/shop/index.tsx`:

**Before:**

```tsx
import { selectCartItemCount } from "../../../store/redux/cartSlice";
// ... in component
const cartItemCount = useSelector(selectCartItemCount);
// ... in renderHeader
<TouchableOpacity
  style={styles.cartButton}
  onPress={() => router.push("/cart")}
  activeOpacity={0.7}
>
  <MaterialCommunityIcons
    name="cart-outline"
    size={26}
    color={theme.colors.textPrimary}
  />
  {cartItemCount > 0 && (
    <View style={styles.cartBadge}>
      <Text style={styles.cartBadgeText}>
        {cartItemCount > 9 ? "9+" : cartItemCount}
      </Text>
    </View>
  )}
</TouchableOpacity>;
```

**After:**

```tsx
import { CartIconBadge } from "../../../components/ui";
// ... in renderHeader
<CartIconBadge />;
```

---

## Implementation Checklist

### Part 1: Modal Update

- [x] Add `handleViewCart` function after `closeAddToCartConfirmation`
- [x] Update Modal JSX with new layout (icon, button row)
- [x] Add new style properties to `Styles` type interface
- [x] Add new styles to `createStyles` function
- [x] Update existing `modalContent` and `modalText` styles
- [ ] Test modal appearance and navigation

### Part 2: CartIconBadge Component

- [x] Create `src/components/ui/CartIconBadge.tsx`
- [x] Update `src/components/ui/index.ts` with export
- [x] (Optional) Refactor Shop to use new component
- [ ] Test component in isolation

### Testing

- [ ] Add event to cart → Modal shows with two buttons
- [ ] "Continue" button closes modal, stays on event page
- [ ] "View Cart" button closes modal, navigates to cart
- [ ] Cart badge shows correct count
- [ ] Styling matches the card design from events list

---

## Visual Reference

### Modal Design (Target)

```
┌────────────────────────────────────┐
│                                    │
│              ✓ (green)             │
│                                    │
│       Event added to cart!         │
│                                    │
│  ┌──────────┐    ┌──────────┐     │
│  │ Continue │    │View Cart │     │
│  └──────────┘    └──────────┘     │
│   (subtle bg)    (accent color)    │
│                                    │
└────────────────────────────────────┘
```

### Button Styling Consistency

| Element                     | Background              | Border | Text            |
| --------------------------- | ----------------------- | ------ | --------------- |
| Primary Button (View Cart)  | `theme.colors.accent`   | none   | White, bold     |
| Secondary Button (Continue) | `rgba(255,255,255,0.1)` | none   | White, semibold |

This matches the button styling already established in:

- Events list "VIEW EVENT" button
- Events detail "ADD TO CART" button

---

## Analytics Tracking (Optional Enhancement)

Consider adding PostHog tracking to the modal interactions:

```tsx
const handleViewCart = () => {
  posthog.capture("cart_modal_view_cart_tapped", {
    event_id: eventId,
    event_name: eventData?.name,
    source: "event_detail",
  });
  setAddToCartConfirmationVisible(false);
  router.push("/cart");
};

const closeAddToCartConfirmation = () => {
  posthog.capture("cart_modal_continue_tapped", {
    event_id: eventId,
    event_name: eventData?.name,
    source: "event_detail",
  });
  setAddToCartConfirmationVisible(false);
};
```

---

## Related Files Reference

| File                                                                | Purpose                        | Lines of Interest                        |
| ------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| [src/app/(app)/events/[id].tsx](<../src/app/(app)/events/[id].tsx>) | Event detail screen with modal | 420-438 (modal), 203-209 (close handler) |
| [src/app/(app)/shop/index.tsx](<../src/app/(app)/shop/index.tsx>)   | Shop with cart icon reference  | 236-254 (icon), 381-402 (styles)         |
| [src/store/redux/cartSlice.tsx](../src/store/redux/cartSlice.tsx)   | Cart state and selectors       | 109-127 (selectors)                      |
| [src/components/ui/index.ts](../src/components/ui/index.ts)         | UI component exports           | Full file                                |
| [src/constants/themes.ts](../src/constants/themes.ts)               | Theme tokens                   | colors.accent, colors.success            |

---

## Skills/Guides to Reference

- [theming-and-styling.md](../.github/copilot-skills/theming-and-styling.md) - Theme tokens and `useThemedStyles` pattern
- [react-native-component.md](../.github/copilot-skills/react-native-component.md) - Component structure and TypeScript patterns

---

## Success Criteria

1. ✅ User can tap "View Cart" after adding event → navigates to cart
2. ✅ User can tap "Continue" → stays on event detail page
3. ✅ Modal styling matches the card design from events list
4. ✅ CartIconBadge component is reusable and consistent
5. ✅ No TypeScript errors
6. ✅ Works on both iOS and Android
