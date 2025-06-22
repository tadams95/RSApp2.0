# RAGE STATE Style Guide Inconsistencies

This document identifies stylistic inconsistencies across the RAGE STATE React Native Expo app that should be addressed to create a more cohesive user interface.

## Table of Contents
1. [Color Inconsistencies](#color-inconsistencies)
2. [Typography Inconsistencies](#typography-inconsistencies)
3. [Button Inconsistencies](#button-inconsistencies)
4. [Layout & Spacing Inconsistencies](#layout--spacing-inconsistencies)
5. [Component Style Inconsistencies](#component-style-inconsistencies)
6. [Recommendations](#recommendations)

## Color Inconsistencies

### Primary Red Color Usage
The app appears to use multiple red shades as primary accent colors:

- `GlobalStyles.colors.red7` (#911111) is used in many screens including:
  - Auth index screen button background and shadow
  - Login screen buttons
  - Guest product detail button
  - Shop product price text

- `GlobalStyles.colors.redVivid5` (#E12D39) is used in:
  - Main index screen primary button

- Hardcoded `#ff3b30` is used in:
  - Home screen info card title

- `GlobalStyles.colors.red4` (#D64545) is used in:
  - Cart screen confirm button
  - Address sheet primary color
  - Cart screen item type text
  - Clear button text

### Background Colors
Inconsistent background colors for similar UI elements:

- Card backgrounds use various colors:
  - `#111` (Events, EventAdminView, Cart)
  - `#1a1a1a` (MyEvents modal)
  - `#0d0d0d` (Login form container, Product info)
  - `#121212` (Signup form container)
  - `#222` (Benefit items, Modal content)

- Modal backgrounds:
  - `#1a1a1a`
  - `#111`
  - `#222`

### Button Colors
Various button background colors across screens:

- Action buttons:
  - `GlobalStyles.colors.red7` (#911111)
  - `GlobalStyles.colors.redVivid5` (#E12D39)
  - `#ff3b30`
  - `GlobalStyles.colors.red4` (#D64545)
  - `#222` (Shop button, Action buttons)
  - `#333` (Cancel buttons, Guest buttons)
  - `transparent` (Secondary buttons)

## Typography Inconsistencies

### Font Family Definition
Font family is defined inconsistently across files:

1. **Inline Definition** - Most files define font family within the component:
   ```tsx
   const fontFamily = Platform.select({
     ios: "Helvetica Neue",
     android: "Roboto",
     default: "system",
   });
   ```

2. **With Fallback** - Some files add extra fallback:
   ```tsx
   const fontFamily: string =
     Platform.select({
       ios: "Helvetica Neue",
       android: "Roboto",
       default: "system",
     }) || "system"; // Provide fallback for null/undefined cases
   ```

3. **Missing from GlobalStyles** - Font family isn't defined in the global styles object where it would be most appropriate

### Font Size Inconsistencies
Various font sizes used for similar UI elements:

- Headings range from 16-32px
- Button text ranges from 12-18px
- Form labels range from 14-16px

### Font Weight Inconsistencies
Inconsistent font weight values for similar elements:

- Buttons: "600", "bold", "700"
- Headings: "700", "bold"
- Labels: "500", "600"

## Button Inconsistencies

### Button Shape & Size
Various button shapes and sizes:

- Border radius: 4px, 5px, 8px, 12px, 20px, 28px
- Padding: Inconsistent padding values across app

### Button Style Definition
Different approaches to defining button styles:

1. **Direct Style Object**:
   ```tsx
   <TouchableOpacity style={[styles.button, styles.primaryButton]}>
   ```

2. **Inline Styles**:
   ```tsx
   <TouchableOpacity style={{
     backgroundColor: "#333",
     padding: 10,
   }}>
   ```

3. **Compound Button Styles**:
   ```tsx
   <Pressable style={[styles.actionButton, disabled && styles.disabledButton]}>
   ```

### Button Text Style
Inconsistent button text styling:

- Font weights: "bold", "600", "700"
- Text transform: no transform in some places, "uppercase" in others
- Letter spacing: 0, 1, 1.5, etc.

## Layout & Spacing Inconsistencies

### Screen Padding
- Varying horizontal padding across screens: 10px, 16px, 20px, 24px
- Inconsistent top padding for headers: 
  - iOS values: 50px, 60px
  - Android values: 20px, 30px, 40px

### Margin Usage
- Inconsistent vertical spacing between elements
- Various margin values for similar components

### Border Radius
Inconsistent border radius across UI elements:
- Cards: 8px, 10px, 12px, 16px
- Buttons: 4px, 5px, 8px, 12px, 20px, 28px
- Input fields: 5px, 8px

## Component Style Inconsistencies

### Card Components
Card components have inconsistent styling:
- Border colors: "#333", "#444", "#555"
- Background colors: "#111", "#1a1a1a", "#222"
- Shadow implementation (some with, some without)

### Form Inputs
Form inputs vary in style:
- Some have borders, some don't
- Different background colors: "#111", "#1a1a1a", "#222", "#1e1e1e"
- Inconsistent padding and height

### Modal Components
Modal styling varies across the app:
- Different background colors
- Various border radius values
- Inconsistent padding

### Status Indicators
Inconsistent implementation of status indicators:
- Some use custom colors
- Inconsistent badge styling

## Recommendations

### 1. Standardize Color System
- Define a clear color palette in `GlobalStyles.colors`:
  - **Primary**: Standardize on ONE primary red (`GlobalStyles.colors.red7`)
  - **Secondary**: Define a consistent secondary color
  - **Neutral/Gray Scale**: Use existing gray scale consistently
  - **Status Colors**: Define consistent colors for success, error, warning, info

### 2. Create Typography System
- Define a typography system in `GlobalStyles.typography`:
  ```typescript
  typography: {
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "system",
    }),
    headingLarge: {
      fontSize: 32,
      fontWeight: "700",
      lineHeight: 40,
    },
    headingMedium: {
      fontSize: 24,
      fontWeight: "700", 
      lineHeight: 32,
    },
    // ...other type styles
  }
  ```

### 3. Create Reusable UI Components
- Develop shared components in `/components/ui/`:
  - `Button.tsx` - with variants for primary, secondary, ghost
  - `Card.tsx` - standardized card component
  - `Input.tsx` - consistent form inputs
  - `Modal.tsx` - base modal component
  - `Badge.tsx` - for status indicators

### 4. Standardize Layout System
- Create a consistent spacing system:
  ```typescript
  spacing: {
    xs: 4,
    sm: 8, 
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  }
  ```
- Standard border radius values
- Consistent screen padding/margins

### 5. Future Implementation: NativeWind
As suggested in the `analytics-and-styling-guide.md` file, NativeWind is planned to be implemented. This will allow for:
- Consistent styling through utility classes
- Theme-aware components
- Reduced style duplication

### 6. Migration Strategy
1. Update `GlobalStyles` with comprehensive style system
2. Create shared UI components
3. Gradually refactor each screen to use the shared components
4. Document the style system for future development consistency

---

## Implementation Priority

1. **High Priority**:
   - Standardize primary color usage
   - Unify font family definitions
   - Create base button component

2. **Medium Priority**:
   - Standardize background colors
   - Unify border radius values
   - Create card and input components

3. **Low Priority**:
   - Implement spacing system
   - Full NativeWind migration
   - Enhanced theming support
