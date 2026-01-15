# Technical Improvements for Rage State App

This document outlines specific technical improvements and modern practices that can be incorporated during the migration to Expo Router.

## 1. TypeScript Migration

### Benefits

- Type safety for components, props, and state
- Improved developer experience with autocompletion
- Better documentation through type definitions
- Easier refactoring and maintenance

### Implementation Steps

1. **Setup TypeScript**

   ```bash
   npx expo install typescript @types/react @types/react-native
   ```

2. **Create tsconfig.json**

   ```json
   {
     "extends": "expo/tsconfig.base",
     "compilerOptions": {
       "strict": true,
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     },
     "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
   }
   ```

3. **Incremental File Migration**
   - Start with shared utilities and hooks
   - Then move to components
   - Finally convert screens

## 2. State Management Improvements

### React Query for Server State

```typescript
// src/hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const querySnapshot = await getDocs(collection(db, "products"));
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },
  });
}

export function useProduct(productId) {
  return useQuery({
    queryKey: ["products", productId],
    queryFn: async () => {
      if (!productId) return null;
      const docRef = doc(db, "products", productId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
      }
      return null;
    },
    enabled: !!productId,
  });
}
```

### Zustand for Client State

```typescript
// src/store/authStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

## 3. Performance Optimizations

### Virtualized Lists

```tsx
// src/components/ProductList.tsx
import { FlashList } from "@shopify/flash-list";

export function ProductList({ products, onSelectProduct }) {
  const renderItem = useCallback(
    ({ item }) => (
      <ProductCard product={item} onPress={() => onSelectProduct(item.id)} />
    ),
    [onSelectProduct]
  );

  return (
    <FlashList
      data={products}
      renderItem={renderItem}
      estimatedItemSize={200}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.1}
      onEndReached={loadMore}
    />
  );
}
```

### Image Optimization

```tsx
// src/components/OptimizedImage.tsx
import { Image } from "expo-image";

export function OptimizedImage({ source, style }) {
  return (
    <Image
      source={source}
      style={style}
      contentFit="cover"
      transition={200}
      placeholder={blurhash}
      cachePolicy="memory-disk"
    />
  );
}
```

## 4. UI/UX Improvements

### Skeleton Loading Screens

```tsx
// src/components/SkeletonLoader.tsx
import { MotiView } from "moti";
import { View, StyleSheet } from "react-native";

export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <MotiView
        from={{ opacity: 0.6 }}
        animate={{ opacity: 0.8 }}
        transition={{
          type: "timing",
          duration: 1000,
          loop: true,
          repeatReverse: true,
        }}
        style={styles.image}
      />
      <View style={styles.content}>
        <MotiView
          from={{ opacity: 0.6 }}
          animate={{ opacity: 0.8 }}
          transition={{
            type: "timing",
            duration: 1000,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.text, { width: "70%" }]}
        />
        <MotiView
          from={{ opacity: 0.6 }}
          animate={{ opacity: 0.8 }}
          transition={{
            type: "timing",
            duration: 1000,
            loop: true,
            repeatReverse: true,
          }}
          style={[styles.text, { width: "40%" }]}
        />
      </View>
    </View>
  );
}
```

### Animated Transitions

```tsx
// src/components/AnimatedScreen.tsx
import { Animated, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";

export function AnimatedScreen({ children }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
}
```

## 5. Testing Strategy

### Unit Testing with Jest

```typescript
// src/utils/formatters.test.ts
import { formatCurrency, formatDate } from "./formatters";

describe("formatCurrency", () => {
  it("formats USD correctly", () => {
    expect(formatCurrency(12.99)).toBe("$12.99");
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("handles zero values", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
```

### Component Testing with React Native Testing Library

```typescript
// src/components/Button.test.tsx
import { render, fireEvent } from "@testing-library/react-native";
import Button from "./Button";

describe("Button", () => {
  it("renders correctly", () => {
    const { getByText } = render(<Button label="Press me" />);
    expect(getByText("Press me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Press me" onPress={onPress} />);
    fireEvent.press(getByText("Press me"));
    expect(onPress).toHaveBeenCalled();
  });
});
```

## 6. Error Handling

### Global Error Boundary

```tsx
// src/components/ErrorBoundary.tsx
import React, { Component } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import * as Sentry from "@sentry/react-native";

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { extra: errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <Button title="Try Again" onPress={this.resetError} />
        </View>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
// src/utils/api.ts
import axios from "axios";
import { Alert } from "react-native";

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: "https://api.example.com",
  timeout: 10000,
});

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    if (!response) {
      // Network error
      Alert.alert("Connection Error", "Please check your internet connection");
    } else if (response.status === 401) {
      // Authentication error
      Alert.alert("Session Expired", "Please login again");
      // Handle logout or refresh token
    } else if (response.status >= 500) {
      // Server error
      Alert.alert("Server Error", "Please try again later");
    }

    return Promise.reject(error);
  }
);
```

## 7. Offline Support

### Offline-First Architecture

```typescript
// src/hooks/useOfflineData.ts
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function useOfflineData(key, fetchData) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to load from cache first
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          setData(JSON.parse(cachedData));
        }

        // Check network status
        const networkState = await NetInfo.fetch();
        setIsConnected(networkState.isConnected);

        if (networkState.isConnected) {
          // Fetch fresh data if online
          const freshData = await fetchData();
          setData(freshData);
          await AsyncStorage.setItem(key, JSON.stringify(freshData));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, [key, fetchData]);

  return { data, isLoading, isConnected };
}
```

## 8. Security Improvements

### Secure Storage

```typescript
// src/utils/secureStorage.ts
import * as SecureStore from "expo-secure-store";

export async function saveSecureItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (error) {
    console.error("Error saving secure item:", error);
    return false;
  }
}

export async function getSecureItem(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error("Error retrieving secure item:", error);
    return null;
  }
}

export async function deleteSecureItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (error) {
    console.error("Error deleting secure item:", error);
    return false;
  }
}
```

### Firebase Rules Optimization

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Basic auth check
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if user owns document
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // User profiles
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);

      // User's private data
      match /private/{document=**} {
        allow read, write: if isOwner(userId);
      }
    }

    // Products are public
    match /products/{productId} {
      allow read: if true;
      allow write: if false; // Only admin can write via functions
    }

    // Orders require authentication
    match /orders/{orderId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow update: if false; // Only admin can update via functions
    }
  }
}
```

## 9. Accessibility Improvements

### Screen Reader Support

```tsx
// src/components/AccessibleButton.tsx
import { Pressable, Text, StyleSheet } from "react-native";

export function AccessibleButton({ label, onPress, hint }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}
```

### Focus Management

```tsx
// src/screens/forms/LoginForm.tsx
import { useRef } from "react";
import { TextInput, View } from "react-native";
import { AccessibleButton } from "../../components/AccessibleButton";

export function LoginForm() {
  const passwordRef = useRef(null);

  return (
    <View>
      <TextInput
        placeholder="Email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current.focus()}
        blurOnSubmit={false}
      />
      <TextInput
        ref={passwordRef}
        placeholder="Password"
        secureTextEntry
        returnKeyType="done"
      />
      <AccessibleButton
        label="Sign In"
        hint="Signs you in to your account"
        onPress={handleLogin}
      />
    </View>
  );
}
```

## 10. Advanced Features

### Push Notification Improvements

```typescript
// src/notifications/NotificationManager.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export class NotificationManager {
  static async registerForPushNotifications(userId) {
    if (!Device.isDevice) {
      // Can't register on simulator
      return false;
    }

    // Check permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return false;
    }

    // Get Expo push token
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "your-project-id",
      })
    ).data;

    // Update user document with token
    if (userId) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        expoPushToken: token,
        deviceType: Platform.OS,
      });
    }

    // Configure notification handler for Android
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    // Return token
    return token;
  }

  static setNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
}
```

### Analytics Integration

```typescript
// src/analytics/Analytics.ts
import * as Analytics from "expo-firebase-analytics";

export class EventTracker {
  static async logScreenView(screenName, screenClass) {
    await Analytics.logEvent("screen_view", {
      screen_name: screenName,
      screen_class: screenClass,
    });
  }

  static async logAddToCart(item, value) {
    await Analytics.logEvent("add_to_cart", {
      items: [item],
      value,
      currency: "USD",
    });
  }

  static async logPurchase(transactionId, value, items) {
    await Analytics.logEvent("purchase", {
      transaction_id: transactionId,
      value,
      currency: "USD",
      items,
    });
  }
}
```

These implementations provide a solid foundation for modernizing the Rage State app while migrating to Expo Router's file-based architecture.
