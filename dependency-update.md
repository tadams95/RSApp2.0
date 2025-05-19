# Dependency Update Plan for Rage State App

This document outlines the strategy for updating and replacing unmaintained dependencies in the Rage State app as part of the migration to Expo Router and TypeScript.

## Package Issues Identified by expo-doctor

The following issues were identified by running `npx expo-doctor`:

```
✖ Validate packages against React Native Directory package metadata
The following issues were found when validating your dependencies against React Native Directory:
  Unmaintained: @rneui/base, @rneui/themed, react-native-swiper
  No metadata available: @babel/helper-create-class-features-plugin, @shopify/storefront-api-client, firebase, fs-extra, shopify-buy
```

## Detailed Analysis and Migration Plan

### 1. Unmaintained Packages

#### 1.1 React Native Elements (@rneui/base and @rneui/themed)

**Current Status:** Unmaintained  
**Impact Level:** High (UI components are used throughout the application)

**Replacement Options:**

##### Option 1: React Native Paper (Recommended)

React Native Paper is a comprehensive Material Design UI library for React Native with excellent TypeScript support, active maintenance, and a rich ecosystem.

**Installation:**

```bash
npm install react-native-paper react-native-vector-icons react-native-safe-area-context
```

**Setup:**

```tsx
// src/app/_layout.tsx
import { PaperProvider, MD3LightTheme } from "react-native-paper";

// Create a custom theme based on brand colors
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#ff3c00", // RAGESTATE brand color
    secondary: "#222222",
    // Define other brand colors here
  },
};

// Wrap your app with PaperProvider
export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>{/* Your existing providers */}</PaperProvider>
  );
}
```

**Component Migration Map:**

| React Native Elements Component | React Native Paper Equivalent | Notes                                                    |
| ------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `Button`                        | `Button`                      | Paper uses `mode` prop ("contained", "outlined", "text") |
| `Card`                          | `Card`                        | Similar API, but with more composable parts              |
| `Icon`                          | `Icon`                        | Similar API                                              |
| `Input`                         | `TextInput`                   | Different API structure                                  |
| `ListItem`                      | `List.Item`                   | Different structure                                      |
| `Overlay`                       | `Modal`                       | Different API                                            |
| `Avatar`                        | `Avatar`                      | Similar API                                              |
| `Badge`                         | `Badge`                       | Similar API                                              |
| `BottomSheet`                   | `BottomSheet`                 | From `@gorhom/bottom-sheet` (recommended add-on)         |

##### Option 2: React Native UI Lib

React Native UI Lib by Wix offers a rich set of customizable components with a strong focus on design.

**Installation:**

```bash
npm install react-native-ui-lib
```

#### 1.2 React Native Swiper

**Current Status:** Unmaintained  
**Impact Level:** Medium (Used for carousel/slider functionality)

**Replacement Options:**

##### Option 1: React Native Reanimated Carousel (Recommended)

A modern, high-performance carousel built with React Native Reanimated 2.

**Installation:**

```bash
npm install react-native-reanimated-carousel react-native-reanimated react-native-gesture-handler
```

**Configuration:**

1. Update babel.config.js to include the Reanimated plugin:

```js
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: ["react-native-reanimated/plugin"],
};
```

2. Restart Metro bundler with cache cleared:

```bash
npm start -- --reset-cache
```

##### Option 2: React Native Snap Carousel

Another popular carousel component with good documentation, although less modern than Reanimated Carousel.

**Installation:**

```bash
npm install react-native-snap-carousel
```

### 2. Packages with No Metadata

#### 2.1 @babel/helper-create-class-features-plugin

**Current Status:** No metadata available in React Native Directory  
**Impact Level:** Low (Babel helper package)

**Recommendation:**
This is likely a transitive dependency pulled in by Babel. It's used for class features processing during transpilation and should be safe to keep as it's maintained as part of the Babel ecosystem.

**Action items:**

1. Check if it's a direct dependency in package.json
2. If direct, verify if it can be removed by temporarily removing it and testing the build
3. If it causes issues, restore the dependency

#### 2.2 Firebase SDK

**Current Status:** No metadata available in React Native Directory  
**Impact Level:** High (Core functionality depends on Firebase)

**Recommendation:**
The Firebase SDK is well-maintained by Google, even if not listed in the React Native Directory. Ensure you're using the latest version compatible with your Expo SDK version.

**Action items:**

1. Check current Firebase version: `npm list firebase`
2. Check compatibility with current Expo version
3. Update if necessary: `npm install firebase@latest`
4. Update any deprecated methods according to Firebase migration guides
5. Test all Firebase functionality after updating

#### 2.3 fs-extra

**Current Status:** No metadata available in React Native Directory  
**Impact Level:** Low (Node.js utility, not typically used in React Native runtime)

**Recommendation:**
This is likely used in build scripts rather than at runtime. If so, it can be moved to devDependencies.

**Action items:**

1. Identify where it's being used in the project
2. If only used in build scripts, move to devDependencies
3. If not used at all, remove the dependency

#### 2.4 Shopify SDKs (@shopify/storefront-api-client and shopify-buy)

**Current Status:** No metadata available in React Native Directory  
**Impact Level:** High (E-commerce functionality depends on these)

**Recommendation:**
You have both the newer @shopify/storefront-api-client and the older shopify-buy SDK. Consider consolidating to just the newer SDK for better long-term support.

**Action items:**

1. Review which Shopify SDK functionalities you're using
2. Create a migration plan from shopify-buy to @shopify/storefront-api-client
3. Update the shopifyService.tsx file to use the newer API client
4. Test all e-commerce functionality thoroughly

## Detailed Migration Process

### Phase 1: React Native Swiper Replacement (1-2 days)

1. **Inventory Current Usage:**

   - Search codebase for all instances of 'react-native-swiper'
   - Document component props and usage patterns

2. **Create Wrapper Component:**

   ```tsx
   // src/components/ui/Carousel.tsx
   import React from "react";
   import Carousel from "react-native-reanimated-carousel";
   import { Dimensions, ViewStyle } from "react-native";

   interface CarouselProps {
     data: any[];
     renderItem: ({
       item,
       index,
     }: {
       item: any;
       index: number;
     }) => React.ReactNode;
     height: number;
     autoPlay?: boolean;
     loop?: boolean;
     showsButtons?: boolean;
     showsPagination?: boolean;
     containerStyle?: ViewStyle;
     // Add any other props you commonly use
   }

   const AppCarousel: React.FC<CarouselProps> = ({
     data,
     renderItem,
     height,
     autoPlay = false,
     loop = true,
     showsPagination = true,
     containerStyle,
     ...rest
   }) => {
     const width = Dimensions.get("window").width;

     return (
       <Carousel
         width={width}
         height={height}
         data={data}
         renderItem={renderItem}
         loop={loop}
         autoPlay={autoPlay}
         // Map other props as needed
         style={containerStyle}
         {...rest}
       />
     );
   };

   export default AppCarousel;
   ```

3. **Replace Usage One By One:**
   - Start with simpler components
   - Test thoroughly after each replacement
   - Update styling as needed

### Phase 2: React Native Elements Replacement (1-2 weeks)

1. **Component Inventory:**

   - Create a spreadsheet of all RNE components used in the app
   - Document component props and usage patterns
   - Prioritize components by usage frequency

2. **Create Theme Configuration:**

   ```tsx
   // src/theme/paper-theme.ts
   import { MD3LightTheme } from "react-native-paper";

   export const paperTheme = {
     ...MD3LightTheme,
     colors: {
       ...MD3LightTheme.colors,
       primary: "#ff3c00",
       secondary: "#222222",
       background: "#000000",
       surface: "#111111",
       text: "#ffffff",
       // Add other colors based on your app's design system
     },
     // Customize other theme properties as needed
   };
   ```

3. **Create Component Mapping Utilities:**

   ```tsx
   // src/components/ui/Button.tsx
   import React from "react";
   import { Button as PaperButton } from "react-native-paper";
   import { StyleProp, ViewStyle } from "react-native";

   interface ButtonProps {
     title: string;
     onPress: () => void;
     mode?: "contained" | "outlined" | "text";
     buttonStyle?: StyleProp<ViewStyle>;
     disabled?: boolean;
     loading?: boolean;
     // Add other props as needed
   }

   const Button: React.FC<ButtonProps> = ({
     title,
     onPress,
     mode = "contained",
     buttonStyle,
     disabled,
     loading,
     ...rest
   }) => {
     return (
       <PaperButton
         mode={mode}
         onPress={onPress}
         disabled={disabled}
         loading={loading}
         style={buttonStyle}
         {...rest}
       >
         {title}
       </PaperButton>
     );
   };

   export default Button;
   ```

4. **Migration Strategy:**
   - Migrate components by type (buttons first, then inputs, then cards, etc.)
   - Start with less complex screens
   - Test thoroughly after each component type
   - Update styles and fix layout issues as they arise

### Phase 3: Clean Up Other Dependencies (2-3 days)

1. **Shopify SDK Consolidation:**

   - Review current usage in shopifyService.tsx
   - Research equivalent methods in @shopify/storefront-api-client
   - Create a migration plan
   - Implement and test changes

2. **Firebase SDK Update:**

   - Check for deprecated methods
   - Implement recommended replacements
   - Test all Firebase functionality

3. **fs-extra Evaluation:**
   - Identify usage points
   - Determine if it can be moved to devDependencies or removed
   - Make changes and test build process

## Testing Strategy

### 1. Component Testing

For each migrated component, test:

- Visual appearance
- Functionality
- Edge cases
- Accessibility

### 2. Screen Testing

For each screen with migrated components, test:

- Complete user flows
- Performance
- Layout across different device sizes

### 3. Cross-Platform Testing

Test all changes on:

- iOS simulator
- Android emulator
- Physical iOS device (if available)
- Physical Android device (if available)

### 4. Regression Testing

After all migrations are complete:

- Run through all major app features
- Verify core functionality
- Check performance metrics
- Validate accessibility

## Implementation Timeline

| Phase | Task                                           | Timeline                      | Priority |
| ----- | ---------------------------------------------- | ----------------------------- | -------- |
| 1     | Replace react-native-swiper                    | Week 1                        | Medium   |
| 2     | Migrate buttons from RNE to Paper              | Week 2, Days 1-2              | High     |
| 2     | Migrate form inputs from RNE to Paper          | Week 2, Days 3-5              | High     |
| 2     | Migrate cards and list items from RNE to Paper | Week 3, Days 1-3              | High     |
| 2     | Migrate remaining RNE components               | Week 3, Days 4-5              | Medium   |
| 3     | Shopify SDK consolidation                      | Week 4, Days 1-2              | Medium   |
| 3     | Firebase SDK update                            | Week 4, Day 3                 | Medium   |
| 3     | fs-extra evaluation                            | Week 4, Day 4                 | Low      |
| 4     | Comprehensive testing                          | Week 4, Day 5 - Week 5, Day 2 | Critical |
| 5     | Bug fixes and refinements                      | Week 5, Days 3-5              | High     |

## Common Migration Patterns

### React Native Elements to React Native Paper

#### Button Migration:

```tsx
// Before (RNE)
<Button
  title="Submit"
  buttonStyle={{ backgroundColor: '#ff3c00', borderRadius: 8 }}
  titleStyle={{ fontFamily: 'ProximaNova', fontSize: 16 }}
  onPress={handleSubmit}
  loading={isSubmitting}
/>

// After (Paper)
<Button
  mode="contained"
  buttonColor="#ff3c00"
  style={{ borderRadius: 8 }}
  labelStyle={{ fontFamily: 'ProximaNova', fontSize: 16 }}
  onPress={handleSubmit}
  loading={isSubmitting}
>
  Submit
</Button>
```

#### Input Migration:

```tsx
// Before (RNE)
<Input
  placeholder="Email"
  leftIcon={{ type: 'material', name: 'email' }}
  value={email}
  onChangeText={setEmail}
  errorMessage={errors.email}
  inputStyle={{ color: 'white' }}
  placeholderTextColor="#999"
/>

// After (Paper)
<TextInput
  label="Email"
  placeholder="Email"
  left={<TextInput.Icon icon="email" />}
  value={email}
  onChangeText={setEmail}
  error={!!errors.email}
  helperText={errors.email}
  style={{ backgroundColor: 'transparent' }}
  textColor="white"
  placeholderTextColor="#999"
/>
```

#### Card Migration:

```tsx
// Before (RNE)
<Card containerStyle={{ backgroundColor: '#222', borderRadius: 10 }}>
  <Card.Title style={{ color: 'white' }}>Card Title</Card.Title>
  <Card.Divider />
  <Text style={{ color: 'white' }}>Card content goes here</Text>
  <Button title="Action" buttonStyle={{ marginTop: 10 }} />
</Card>

// After (Paper)
<Card style={{ backgroundColor: '#222', borderRadius: 10 }}>
  <Card.Title title="Card Title" titleStyle={{ color: 'white' }} />
  <Card.Content>
    <Text style={{ color: 'white' }}>Card content goes here</Text>
  </Card.Content>
  <Card.Actions>
    <Button mode="contained" style={{ marginTop: 10 }}>Action</Button>
  </Card.Actions>
</Card>
```

### React Native Swiper to Reanimated Carousel

```tsx
// Before (Swiper)
<Swiper
  autoplay
  height={300}
  showsButtons={true}
  showsPagination={true}
  paginationStyle={{ bottom: 10 }}
>
  {images.map((image, index) => (
    <View key={index} style={styles.slide}>
      <Image source={{ uri: image }} style={styles.image} />
    </View>
  ))}
</Swiper>

// After (Reanimated Carousel)
<Carousel
  width={Dimensions.get('window').width}
  height={300}
  data={images}
  autoPlay={true}
  loop
  renderItem={({ item, index }) => (
    <View key={index} style={styles.slide}>
      <Image source={{ uri: item }} style={styles.image} />
    </View>
  )}
  panGestureHandlerProps={{ activeOffsetX: [-10, 10] }}
/>
```

## Affected Components Analysis

Based on a thorough code review, the following components will be affected by the dependency updates:

### 1. React Native Swiper Migration Impact

| File Path                                 | Component Usage                   | Migration Complexity         |
| ----------------------------------------- | --------------------------------- | ---------------------------- |
| `/src/app/(guest)/shop/[id].tsx`          | Image carousel using Swiper       | Medium                       |
| `/screens/guest/GuestProductDetail.js`    | Legacy product detail with Swiper | Low (already migrated to TS) |
| `/screens/product/ProductDetailScreen.js` | Legacy product detail with Swiper | Low (already migrated to TS) |

**Notes:**

- The migrated `src/app/(app)/shop/[handle].tsx` file has already commented out the import of `react-native-swiper` and is prepared for replacement
- The image carousel functionality is central to the product detail pages
- Key Swiper features used: pagination dots, image sliding, index tracking

### 2. React Native Elements Migration Impact

| File Path                              | Component Usage    | Migration Complexity |
| -------------------------------------- | ------------------ | -------------------- |
| `/screens/authScreens/LoginScreen2.js` | CheckBox component | Low                  |

**Notes:**

- Very minimal usage of React Native Elements in the codebase
- Only one component (CheckBox) found in a legacy screen that will be replaced by the migrated TypeScript version
- The migrated auth screens already use native React Native components instead of RNE

### 3. Migration Priority Assessment

1. **High Priority:**

   - `src/app/(guest)/shop/[id].tsx` - This is an actively used file in the new app structure that still relies on react-native-swiper

2. **Medium Priority:**

   - Legacy screens that will eventually be completely replaced by their TypeScript equivalents

3. **Low Priority:**
   - React Native Elements usage in legacy screens

### 4. Implementation Approach

1. **React Native Swiper Replacement:**

   - Start with creating the `AppCarousel` wrapper component as outlined in the migration plan
   - First refactor `src/app/(guest)/shop/[id].tsx` which is in the new app structure
   - Test thoroughly with various image counts and screen sizes
   - Apply the same pattern to any other places that require carousels

2. **React Native Elements Replacement:**
   - Since usage is minimal, focus on completing the TypeScript migrations rather than trying to replace RNE components in legacy files

## Rollback Plan

In case of critical issues during migration:

1. **Component-Level Rollback:**

   - Keep old implementations alongside new ones
   - Use feature flags to switch between implementations
   - Roll back problematic components individually

2. **Complete Rollback:**
   - Maintain a version branch before starting migration
   - If needed, revert to the pre-migration state

## Conclusion

This dependency update plan provides a structured approach to replacing unmaintained packages in the Rage State app. By following this plan, we'll ensure a smooth migration to modern, well-maintained libraries while minimizing disruption to the app's functionality.

Regular progress tracking and thorough testing will be crucial to the success of this migration. The outlined approach allows for incremental changes, making it easier to identify and fix issues as they arise.

Remember to update this document as you make progress or if you encounter any unexpected challenges during the migration process.
