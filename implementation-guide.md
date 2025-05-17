# Implementation Guide: Migrating to Expo Router

This guide provides concrete code examples and step-by-step instructions for migrating the Rage State app to Expo Router structure.

## Initial Setup

### 1. Install Required Dependencies

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

### 2. Update Configuration Files

#### package.json

```json
{
  "main": "expo-router/entry"
}
```

#### app.json

```json
{
  "expo": {
    "scheme": "ragestate",
    "web": {
      "bundler": "metro"
    }
  }
}
```

## Core Structure Implementation

### 1. Root Layout (`src/app/_layout.tsx`)

This file replaces the App.js and handles authentication state:

```tsx
import React, { useEffect } from "react";
import { Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Provider } from "react-redux";
import { store } from "../store/redux/store";
import * as Updates from "expo-updates";
import { Alert, AppState } from "react-native";
import { AuthProvider } from "../hooks/AuthContext";

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a timeout
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      checkForUpdates();

      // Check for updates when app returns to foreground
      const subscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            checkForUpdates();
          }
        }
      );

      return () => subscription.remove();
    }
  }, []);

  async function checkForUpdates() {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Alert.alert(
          "Update Available",
          "A new version is available. Would you like to update now?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Update",
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (error) {
                  console.log("Error fetching or reloading update:", error);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.log("Error checking for updates:", error);
    }
  }

  return (
    <Provider store={store}>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <Slot />
        </View>
      </AuthProvider>
    </Provider>
  );
}
```

### 2. Authentication Context (`src/hooks/AuthContext.tsx`)

Create a dedicated context for authentication:

```tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { loginUser } from "../util/auth";
import { useDispatch } from "react-redux";
import {
  setLocalId,
  setUserEmail,
  setStripeCustomerId,
} from "../store/redux/userSlice";
import { useSegments, useRouter } from "expo-router";

// Define the context type
type AuthContextType = {
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  isLoading: boolean;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  setAuthenticated: () => {},
  isLoading: true,
});

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check if user has selected "stay logged in" option
    const checkStayLoggedIn = async () => {
      try {
        const [stayLoggedInValue, savedEmail, savedPassword] =
          await Promise.all([
            AsyncStorage.getItem("stayLoggedIn"),
            AsyncStorage.getItem("email"),
            AsyncStorage.getItem("password"),
          ]);

        if (stayLoggedInValue && JSON.parse(stayLoggedInValue)) {
          if (savedEmail && savedPassword) {
            await loginUser(savedEmail, savedPassword);
            setAuthenticated(true);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error retrieving stayLoggedIn state:", error);
        setIsLoading(false);
      }
    };

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setLocalId(user.uid));
        dispatch(setUserEmail(user.email || ""));
        setAuthenticated(true);
      } else {
        checkStayLoggedIn();
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  // Handle routing based on authentication state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inGuestGroup = segments[0] === "(guest)";

    if (authenticated && inAuthGroup) {
      // Redirect to app home if user is authenticated but on auth screens
      router.replace("/(app)/home");
    } else if (!authenticated && !inAuthGroup && !inGuestGroup) {
      // Redirect to login if user is not authenticated and not in guest mode
      router.replace("/(auth)/");
    }
  }, [authenticated, segments, isLoading, router]);

  return (
    <AuthContext.Provider
      value={{ authenticated, setAuthenticated, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
```

## 3. Route Group Structure

### Auth Group Layout (`src/app/(auth)/_layout.tsx`)

```tsx
import { Stack } from "expo-router";
import { useAuth } from "../../hooks/AuthContext";
import LoadingOverlay from "../../ui/LoadingOverlay";

export default function AuthLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay message="Authenticating..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
  );
}
```

### App Group Layout (`src/app/(app)/_layout.tsx`)

```tsx
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { useAuth } from "../../hooks/AuthContext";
import { Redirect } from "expo-router";

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

export default function AppLayout() {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();

  // If not authenticated, redirect to auth flow
  if (!authenticated && !isLoading) {
    return <Redirect href="/(auth)/" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveBackgroundColor: "white",
        tabBarInactiveBackgroundColor: "black",
        headerTitleAlign: "center",
        headerTitleStyle: {
          fontFamily,
        },
        tabBarStyle: {
          backgroundColor: "black",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="home"
              color={focused ? "black" : "white"}
              size={20}
            />
          ),
          tabBarLabel: () => null,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
      <Tabs.Screen
        name="shop/index"
        options={{
          title: "Shop",
          headerLeft: () => (
            <Pressable
              onPress={() => router.navigate("/(app)/home")}
              style={{ paddingLeft: 20 }}
            >
              <MaterialCommunityIcons name="home" size={20} color="white" />
            </Pressable>
          ),
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="shopping"
              color={focused ? "black" : "white"}
              size={20}
            />
          ),
          tabBarLabel: () => null,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
      <Tabs.Screen
        name="events/index"
        options={{
          title: "Events",
          headerLeft: () => (
            <Pressable
              onPress={() => router.navigate("/(app)/home")}
              style={{ paddingLeft: 20 }}
            >
              <MaterialCommunityIcons name="home" size={20} color="white" />
            </Pressable>
          ),
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="ticket-percent"
              color={focused ? "black" : "white"}
              size={20}
            />
          ),
          tabBarLabel: () => null,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
      <Tabs.Screen
        name="cart/index"
        options={{
          title: "Cart",
          headerLeft: () => (
            <Pressable
              onPress={() => router.navigate("/(app)/home")}
              style={{ paddingLeft: 20 }}
            >
              <MaterialCommunityIcons name="home" size={20} color="white" />
            </Pressable>
          ),
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="cart"
              color={focused ? "black" : "white"}
              size={20}
            />
          ),
          tabBarLabel: () => null,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
      <Tabs.Screen
        name="account/index"
        options={{
          title: "Account",
          headerLeft: () => (
            <Pressable
              onPress={() => router.navigate("/(app)/home")}
              style={{ paddingLeft: 20 }}
            >
              <MaterialCommunityIcons name="home" size={20} color="white" />
            </Pressable>
          ),
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="account"
              color={focused ? "black" : "white"}
              size={20}
            />
          ),
          tabBarLabel: () => null,
          headerStyle: {
            backgroundColor: "black",
          },
          headerTintColor: "white",
        }}
      />
    </Tabs>
  );
}
```

## 4. Page Implementations

### Entry Point (`src/app/(auth)/index.tsx`)

```tsx
import React from "react";
import WelcomeScreen from "../../screens/authScreens/WelcomeScreen";
import { useAuth } from "../../hooks/AuthContext";

export default function Index() {
  const { setAuthenticated } = useAuth();

  // Pass setAuthenticated to WelcomeScreen component
  return <WelcomeScreen setAuthenticated={setAuthenticated} />;
}
```

### Login Screen (`src/app/(auth)/login.tsx`)

```tsx
import React from "react";
import LoginScreen2 from "../../screens/authScreens/LoginScreen2";
import { useAuth } from "../../hooks/AuthContext";

export default function Login() {
  const { setAuthenticated } = useAuth();

  return <LoginScreen2 setAuthenticated={setAuthenticated} />;
}
```

### Home Screen (`src/app/(app)/home/index.tsx`)

```tsx
import React from "react";
import HomeScreenComponent from "../../../screens/HomeScreen";

export default function Home() {
  return <HomeScreenComponent />;
}
```

### Shop Screen (`src/app/(app)/shop/index.tsx`)

```tsx
import React from "react";
import ShopScreenComponent from "../../../screens/ShopScreen";

export default function Shop() {
  return <ShopScreenComponent />;
}
```

### Dynamic Product Detail Page (`src/app/(app)/shop/[id].tsx`)

```tsx
import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import ProductDetailScreen from "../../../screens/product/ProductDetailScreen";

export default function ProductDetail() {
  const { id } = useLocalSearchParams();

  return <ProductDetailScreen productId={id} />;
}
```

## 5. Navigation Changes

### Updating the Navigation Functions

Create a new file `src/utils/navigation.ts`:

```typescript
import { router } from "expo-router";

// Navigation helper functions
export const navigate = (path) => {
  router.navigate(path);
};

export const navigateToProduct = (productId) => {
  router.navigate(`/(app)/shop/${productId}`);
};

export const navigateToEvent = (eventId) => {
  router.navigate(`/(app)/events/${eventId}`);
};

export const goBack = () => {
  router.back();
};

export const logout = () => {
  router.replace("/(auth)/");
};
```

## 6. Adapting Components

### Update Account Screen for Logout

Update the account screen to use the new navigation utilities:

```tsx
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useDispatch } from "react-redux";
import { auth } from "../../firebase/firebase";
import { signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../hooks/AuthContext";
import { useRouter } from "expo-router";

export default function AccountScreen() {
  const { setAuthenticated } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();

  async function logoutHandler() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Yes",
        onPress: async () => {
          try {
            await signOut(auth);
            await AsyncStorage.removeItem("stayLoggedIn");
            setAuthenticated(false);
            router.replace("/(auth)/");
          } catch (error) {
            console.error("Error signing out:", error);
          }
        },
      },
    ]);
  }

  // Rest of the component...
}
```

## 7. Additional Considerations

### Deep Linking Configuration

Update the deep linking configuration in `app.json`:

```json
{
  "expo": {
    "scheme": "ragestate",
    "ios": {
      "associatedDomains": ["applinks:yourapp.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "*.yourapp.com",
              "pathPrefix": "/"
            },
            {
              "scheme": "ragestate"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### Static Asset Handling

Move static assets to proper locations:

```
src/
└── assets/
    ├── images/
    └── fonts/
```

And update the loading in app.json:

```json
{
  "expo": {
    "assetBundlePatterns": ["**/*", "src/assets/**/*"]
  }
}
```

## Testing the Migration

Once the basic structure is in place, test each feature in this order:

1. Authentication flow (login, signup, stay logged in)
2. Navigation between screens
3. Product and event details with dynamic routing
4. Cart functionality
5. Account management
6. Guest mode

This incremental testing approach will help identify and fix issues early in the migration process.
