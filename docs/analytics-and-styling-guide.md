# Analytics and Styling Implementation Guide

This guide provides detailed implementation instructions for integrating Firebase Analytics and NativeWind styling into the Rage State app.

## Part 1: Firebase Analytics Implementation

### 1. Installation

```bash
# Install Firebase Analytics and required dependencies
npx expo install @react-native-firebase/app @react-native-firebase/analytics expo-dev-client
```

### 2. Configuration

#### Update app.json

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/analytics"
    ],
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### 3. Analytics Provider

Create a wrapper to provide analytics functionality throughout the app:

```tsx
// src/analytics/AnalyticsProvider.tsx
import React, { createContext, useContext, ReactNode } from "react";
import analytics from "@react-native-firebase/analytics";

type EventParams = Record<string, any>;

interface AnalyticsContextType {
  logEvent: (name: string, params?: EventParams) => Promise<void>;
  logScreenView: (screenName: string, screenClass?: string) => Promise<void>;
  logPurchase: (params: {
    transactionId: string;
    value: number;
    currency: string;
    items: any[];
  }) => Promise<void>;
  logAddToCart: (params: {
    itemId: string;
    itemName: string;
    itemCategory: string;
    price: number;
    quantity?: number;
    currency?: string;
  }) => Promise<void>;
  setUserProperty: (name: string, value: string) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined
);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
}

export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const logEvent = async (name: string, params?: EventParams) => {
    try {
      await analytics().logEvent(name, params);
    } catch (error) {
      console.error("Analytics error:", error);
    }
  };

  const logScreenView = async (screenName: string, screenClass?: string) => {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error("Screen view log error:", error);
    }
  };

  const logPurchase = async (params: {
    transactionId: string;
    value: number;
    currency: string;
    items: any[];
  }) => {
    try {
      await analytics().logPurchase({
        transaction_id: params.transactionId,
        value: params.value,
        currency: params.currency,
        items: params.items,
      });
    } catch (error) {
      console.error("Purchase log error:", error);
    }
  };

  const logAddToCart = async (params: {
    itemId: string;
    itemName: string;
    itemCategory: string;
    price: number;
    quantity?: number;
    currency?: string;
  }) => {
    try {
      await analytics().logAddToCart({
        item_id: params.itemId,
        item_name: params.itemName,
        item_category: params.itemCategory,
        price: params.price,
        quantity: params.quantity || 1,
        currency: params.currency || "USD",
      });
    } catch (error) {
      console.error("Add to cart log error:", error);
    }
  };

  const setUserProperty = async (name: string, value: string) => {
    try {
      await analytics().setUserProperty(name, value);
    } catch (error) {
      console.error("Set user property error:", error);
    }
  };

  const setUserId = async (id: string | null) => {
    try {
      await analytics().setUserId(id);
    } catch (error) {
      console.error("Set user ID error:", error);
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        logEvent,
        logScreenView,
        logPurchase,
        logAddToCart,
        setUserProperty,
        setUserId,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};
```

### 4. Integration with Root Layout

Add the Analytics Provider to the app's root layout:

```tsx
// src/app/_layout.tsx
import React, { useEffect } from "react";
import { Slot, SplashScreen, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Provider } from "react-redux";
import { store } from "../store/redux/store";
import { AuthProvider } from "../hooks/AuthContext";
import { AnalyticsProvider } from "../analytics/AnalyticsProvider";

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Existing code...

  return (
    <Provider store={store}>
      <AuthProvider>
        <AnalyticsProvider>
          <View style={{ flex: 1 }}>
            <StatusBar style="auto" />
            <Slot />
          </View>
        </AnalyticsProvider>
      </AuthProvider>
    </Provider>
  );
}
```

### 5. Screen Tracking Hook

Create a custom hook to automatically track screen views:

```tsx
// src/hooks/useScreenTracking.tsx
import { useEffect } from "react";
import { usePathname } from "expo-router";
import { useAnalytics } from "../analytics/AnalyticsProvider";

export function useScreenTracking() {
  const pathname = usePathname();
  const { logScreenView } = useAnalytics();

  useEffect(() => {
    if (pathname) {
      // Convert pathname to a readable screen name
      // e.g., "/(app)/shop/[id]" -> "Product Detail"
      const screenName = getScreenNameFromPath(pathname);

      // Log screen view
      logScreenView(screenName);
    }
  }, [pathname, logScreenView]);
}

function getScreenNameFromPath(path: string): string {
  // Extract screen name from path
  // This is a simple implementation - enhance as needed
  const segments = path.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) return "Home";

  // Handle dynamic routes
  if (lastSegment.startsWith("[") && lastSegment.endsWith("]")) {
    const paramName = lastSegment.replace("[", "").replace("]", "");
    if (paramName === "id") {
      const routeBase = segments[segments.length - 2] || "";
      if (routeBase === "shop") return "Product Detail";
      if (routeBase === "events") return "Event Detail";
      return "Detail Page";
    }
    return "Dynamic Page";
  }

  // Convert to title case
  return (
    lastSegment.charAt(0).toUpperCase() +
    lastSegment
      .slice(1)
      .replace(/([A-Z])/g, " $1")
      .trim()
  );
}
```

### 6. Example Usage

Here's how to use analytics in your components:

```tsx
// src/app/(app)/shop/[id].tsx
import React, { useEffect } from "react";
import { View, Text, Button } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAnalytics } from "../../../analytics/AnalyticsProvider";
import ProductDetailScreen from "../../../screens/product/ProductDetailScreen";

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const { logEvent, logAddToCart } = useAnalytics();

  // Track product view
  useEffect(() => {
    if (id) {
      logEvent("product_view", { product_id: id });
    }
  }, [id, logEvent]);

  // Example add to cart handler
  const handleAddToCart = (product) => {
    // Existing cart logic

    // Log add to cart event
    logAddToCart({
      itemId: product.id,
      itemName: product.title,
      itemCategory: product.category,
      price: product.price,
    });
  };

  return <ProductDetailScreen productId={id} onAddToCart={handleAddToCart} />;
}
```

### 7. Key Events to Track

Consider tracking these essential events in your e-commerce app:

1. **User Authentication**

   - `login` - User logs in
   - `sign_up` - User creates account

2. **Product Interactions**

   - `product_view` - User views a product
   - `add_to_cart` - User adds item to cart
   - `remove_from_cart` - User removes item from cart
   - `add_to_wishlist` - User saves item for later

3. **Purchase Flow**

   - `begin_checkout` - User starts checkout process
   - `add_payment_info` - User adds payment info
   - `purchase` - User completes purchase

4. **User Engagement**

   - `share` - User shares content
   - `search` - User performs search
   - `view_promotion` - User sees a promotional banner
   - `select_promotion` - User clicks a promotional banner

5. **Event Ticket Actions**
   - `view_event` - User views event details
   - `purchase_ticket` - User buys event ticket
   - `transfer_ticket` - User transfers a ticket
   - `scan_ticket` - User scans a ticket

## Part 2: NativeWind Implementation

### 1. Installation

```bash
# Install NativeWind and its dependencies
npm install nativewind
npm install --save-dev tailwindcss@3.3.2 postcss autoprefixer
```

### 2. Create Configuration Files

Create a `tailwind.config.js` file in the project root:

```js
// tailwind.config.js
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/screens/**/*.{js,jsx,ts,tsx}",
    "./src/ui/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "rs-black": "#000000",
        "rs-white": "#FFFFFF",
        "rs-primary": "#FF3131", // Add your brand color here
        "rs-secondary": "#333333",
        "rs-gray": "#888888",
      },
      fontFamily: {
        futura: ["futura"],
        futuraBold: ["futuraBold"],
        proximaNova: ["ProximaNova"],
        proximaNovaBold: ["ProximaNovaBold"],
        proximaNovaBlack: ["ProximaNovaBlack"],
      },
    },
  },
  plugins: [],
};
```

### 3. Update Babel Configuration

Update the `babel.config.js` file:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "nativewind/babel",
      // Add any other plugins you need
    ],
  };
};
```

### 4. Create TypeScript Types for NativeWind

Create a new file `src/types/nativewind.d.ts`:

```ts
// src/types/nativewind.d.ts
/// <reference types="nativewind/types" />
```

Update `tsconfig.json` to include this file:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    // Other options...
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "src/types/nativewind.d.ts"
  ]
}
```

### 5. NativeWind Theme Provider

Create a theme provider for handling dark/light mode:

```tsx
// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    // Load saved theme mode on startup
    const loadThemeMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem("themeMode");
        if (
          savedMode &&
          (savedMode === "light" ||
            savedMode === "dark" ||
            savedMode === "system")
        ) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error("Failed to load theme mode:", error);
      }
    };

    loadThemeMode();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem("themeMode", mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Failed to save theme mode:", error);
    }
  };

  // Determine if dark mode is active
  const isDarkMode =
    themeMode === "system"
      ? systemColorScheme === "dark"
      : themeMode === "dark";

  return (
    <ThemeContext.Provider value={{ themeMode, isDarkMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### 6. Integrate Theme Provider in Root Layout

Update the root layout to include the theme provider:

```tsx
// src/app/_layout.tsx
import React, { useEffect } from "react";
import { Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Provider } from "react-redux";
import { store } from "../store/redux/store";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AuthProvider } from "../hooks/AuthContext";
import { AnalyticsProvider } from "../analytics/AnalyticsProvider";

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Existing code...

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <View style={{ flex: 1 }} className="bg-white dark:bg-rs-black">
              <StatusBar style="auto" />
              <Slot />
            </View>
          </AnalyticsProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
```

### 7. Example: Converted Button Component

Here's an example of converting a standard button component to use NativeWind:

```tsx
// src/components/ui/Button.tsx
import React from "react";
import { Text, Pressable } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  className = "",
  textClassName = "",
}: ButtonProps) {
  const { isDarkMode } = useTheme();

  // Generate classes based on props
  const baseButtonClasses = "rounded-md justify-center items-center";
  const fullWidthClasses = fullWidth ? "w-full" : "";

  // Size classes
  const sizeClasses = {
    sm: "py-1.5 px-3",
    md: "py-2.5 px-4",
    lg: "py-3.5 px-6",
  }[size];

  // Variant classes
  const variantClasses = {
    primary: `bg-rs-primary ${disabled ? "opacity-50" : "active:opacity-80"}`,
    secondary: `bg-rs-secondary ${
      disabled ? "opacity-50" : "active:opacity-80"
    }`,
    outline: `border border-rs-primary bg-transparent ${
      disabled ? "opacity-50" : "active:opacity-80"
    }`,
  }[variant];

  // Text color based on variant and theme
  const textColorClasses = {
    primary: "text-white",
    secondary: "text-white",
    outline: isDarkMode ? "text-white" : "text-rs-primary",
  }[variant];

  // Text size based on button size
  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  }[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`${baseButtonClasses} ${sizeClasses} ${variantClasses} ${fullWidthClasses} ${className}`}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text
        className={`font-proximaNovaBold ${textColorClasses} ${textSizeClasses} ${textClassName}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

### 8. Example: Converted Screen

Here's an example of a screen using NativeWind:

```tsx
// src/app/(auth)/login.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/AuthContext";
import { useAnalytics } from "../../analytics/AnalyticsProvider";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { setAuthenticated } = useAuth();
  const { logEvent } = useAnalytics();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Login logic here

      // Log successful login
      logEvent("login", { method: "email" });

      // Set authenticated
      setAuthenticated(true);

      // Navigate to app
      router.replace("/(app)/home");
    } catch (err) {
      setError("Invalid email or password");
      logEvent("login_error", { error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-rs-black p-6">
      <View className="mt-10">
        <Text className="text-3xl font-futuraBold text-rs-black dark:text-white mb-6">
          Login
        </Text>

        {error ? <Text className="text-red-500 mb-4">{error}</Text> : null}

        <View className="mb-4">
          <Text className="text-gray-600 dark:text-gray-300 mb-2 font-proximaNova">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md p-3 text-black dark:text-white font-proximaNova"
          />
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 dark:text-gray-300 mb-2 font-proximaNova">
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md p-3 text-black dark:text-white font-proximaNova"
          />
        </View>

        <Button
          label={isLoading ? "Logging In..." : "Login"}
          onPress={handleLogin}
          disabled={isLoading}
          fullWidth
        />

        <TouchableOpacity
          onPress={() => router.push("/(auth)/forgot-password")}
          className="mt-4"
        >
          <Text className="text-center text-rs-primary font-proximaNova">
            Forgot Password?
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-8">
          <Text className="text-gray-600 dark:text-gray-300 font-proximaNova">
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
            <Text className="text-rs-primary font-proximaNovaBold">
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

### 9. Tips for Working with NativeWind

1. **Use Responsive Classes Sparingly**:
   Not all Tailwind responsive classes work in React Native. Stick to basic layout and styling classes.

2. **Leverage Custom Theme**:
   Extend the theme with your brand colors and reuse them consistently.

3. **Dark Mode Support**:
   Use `dark:` variants to support dark mode, and connect it to the system theme.

4. **Debugging**:
   If styles aren't working as expected, try moving them to inline styles temporarily to debug.

5. **Typography Guidelines**:
   Create consistent typography classes for different text styles (headings, body, captions).

6. **Component Library**:
   Build a collection of reusable NativeWind components for consistent design.

7. **Simplify Transitions**:
   While web-style transitions aren't available, use React Native's Animated API alongside NativeWind classes.

## Conclusion

By implementing Firebase Analytics and NativeWind, the Rage State app will have robust analytics tracking and a consistent, maintainable styling system. This modern approach will make the codebase more maintainable, improve the developer experience, and provide valuable insights into user behavior.
