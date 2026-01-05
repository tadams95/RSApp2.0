# Phase 4: Production Readiness

> **Timeline**: 1-2 weeks | **Priority**: 🟢 Medium  
> **Dependencies**: Phases 1-3 complete  
> **Outcome**: App Store/Play Store ready with security, performance, and polish

---

## Overview

Final phase to ensure the app is production-ready with proper security (App Check), deep linking across all routes, theming support, and performance optimization.

---

## Current State

**What Works:**

- Basic app builds for iOS/Android via EAS
- Development environment functional
- Core features implemented

**What's Missing:**

- Firebase App Check
- Universal/App Links
- Light/Dark mode theming
- Performance optimization
- Crash reporting
- App Store assets

---

## 4.1 Firebase App Check (~2-3 days)

### Purpose

App Check ensures only your genuine app can access Firebase services, protecting against:

- API abuse
- Fake clients
- Replay attacks

### Installation

```bash
npx expo install @react-native-firebase/app-check expo-build-properties
```

### iOS Setup (DeviceCheck)

```json
// app.json additions
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
}
```

### Android Setup (Play Integrity)

```json
// app.json additions
{
  "expo": {
    "android": {
      "playIntegrity": {
        "cloudProjectNumber": "YOUR_PROJECT_NUMBER"
      }
    }
  }
}
```

### App Check Initialization

```typescript
// src/services/appCheckService.ts
import appCheck from "@react-native-firebase/app-check";

export async function initializeAppCheck(): Promise<void> {
  const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

  provider.configure({
    android: {
      provider: __DEV__ ? "debug" : "playIntegrity",
      debugToken: __DEV__ ? "YOUR_DEBUG_TOKEN" : undefined,
    },
    apple: {
      provider: __DEV__ ? "debug" : "deviceCheck",
      debugToken: __DEV__ ? "YOUR_DEBUG_TOKEN" : undefined,
    },
  });

  await appCheck().initializeAppCheck({
    provider,
    isTokenAutoRefreshEnabled: true,
  });
}
```

### App Integration

```typescript
// src/app/_layout.tsx
import { initializeAppCheck } from "../services/appCheckService";

export default function RootLayout() {
  useEffect(() => {
    initializeAppCheck().catch(console.error);
  }, []);

  // ...
}
```

### Firebase Console Setup

1. Go to Firebase Console > App Check
2. Register iOS app with DeviceCheck
3. Register Android app with Play Integrity
4. Enable enforcement on:
   - Cloud Firestore
   - Realtime Database
   - Cloud Storage
   - Cloud Functions

### Implementation Checklist

- [ ] Install `@react-native-firebase/app-check`
- [ ] Configure iOS DeviceCheck
- [ ] Configure Android Play Integrity
- [ ] Add debug tokens for development
- [ ] Initialize App Check in `_layout.tsx`
- [ ] Enable enforcement in Firebase Console
- [ ] Test with real devices
- [ ] Verify Cloud Functions accept tokens

---

## 4.2 Deep Linking & Universal Links (~3-4 days)

### Link Types

| Type            | iOS               | Android           | Use Case     |
| --------------- | ----------------- | ----------------- | ------------ |
| Custom Scheme   | `ragestate://`    | `ragestate://`    | App-to-app   |
| Universal Links | `ragestate.com/*` | -                 | Web fallback |
| App Links       | -                 | `ragestate.com/*` | Web fallback |

### Expo Config

```json
// app.json
{
  "expo": {
    "scheme": "ragestate",
    "ios": {
      "associatedDomains": [
        "applinks:ragestate.com",
        "webcredentials:ragestate.com"
      ]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "ragestate.com",
              "pathPrefix": "/events"
            },
            {
              "scheme": "https",
              "host": "ragestate.com",
              "pathPrefix": "/user"
            },
            {
              "scheme": "https",
              "host": "ragestate.com",
              "pathPrefix": "/transfer"
            },
            {
              "scheme": "https",
              "host": "ragestate.com",
              "pathPrefix": "/post"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### Route Mapping

| URL                                         | Mobile Route                      |
| ------------------------------------------- | --------------------------------- |
| `ragestate.com/events/{id}`                 | `/(app)/events/[id]`              |
| `ragestate.com/user/{username}`             | `/(app)/profile/[username]`       |
| `ragestate.com/post/{id}`                   | `/(app)/feed/post/[id]`           |
| `ragestate.com/transfer/claim?id=X&token=Y` | `/(app)/transfer/claim`           |
| `ragestate.com/shop/product/{id}`           | `/(app)/shop/product/[id]`        |
| `ragestate.com/shop/collection/{handle}`    | `/(app)/shop/collection/[handle]` |

### Link Handler

```typescript
// src/hooks/useDeepLinking.ts
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";

const ROUTE_MAPPING: Record<
  string,
  (params: Record<string, string>) => string
> = {
  "/events/(.*)": (p) => `/(app)/events/${p[1]}`,
  "/user/(.*)": (p) => `/(app)/profile/${p[1]}`,
  "/post/(.*)": (p) => `/(app)/feed/post/${p[1]}`,
  "/transfer/claim": (p) => `/(app)/transfer/claim`,
  "/shop/product/(.*)": (p) => `/(app)/shop/product/${p[1]}`,
  "/shop/collection/(.*)": (p) => `/(app)/shop/collection/${p[1]}`,
};

export function useDeepLinking() {
  const router = useRouter();

  const handleURL = (url: string) => {
    const parsed = Linking.parse(url);
    const path = parsed.path || "";

    for (const [pattern, getRoute] of Object.entries(ROUTE_MAPPING)) {
      const regex = new RegExp(`^${pattern}$`);
      const match = path.match(regex);

      if (match) {
        const route = getRoute(match);
        router.push({
          pathname: route,
          params: parsed.queryParams,
        });
        return true;
      }
    }

    // Default fallback
    console.log("Unhandled deep link:", url);
    return false;
  };

  useEffect(() => {
    // Handle URL that opened app
    Linking.getInitialURL().then((url) => {
      if (url) handleURL(url);
    });

    // Handle URLs while app is open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleURL(url);
    });

    return () => subscription.remove();
  }, []);
}
```

### Apple App Site Association

Host at `https://ragestate.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.tyrelle.ragestateapp",
        "paths": ["/events/*", "/user/*", "/post/*", "/transfer/*", "/shop/*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.com.tyrelle.ragestateapp"]
  }
}
```

### Android Asset Links

Host at `https://ragestate.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tyrelle.ragestate",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

### Implementation Checklist

- [ ] Configure app.json with schemes and domains
- [ ] Create `useDeepLinking` hook
- [ ] Implement route mapping
- [ ] Host apple-app-site-association
- [ ] Host assetlinks.json
- [ ] Test custom scheme links
- [ ] Test Universal Links (iOS)
- [ ] Test App Links (Android)
- [ ] Add deferred deep linking for non-installed users

---

## 4.3 Light/Dark Mode (~2-3 days)

### Theme System

```typescript
// src/constants/themes.ts
export const lightTheme = {
  colors: {
    // Backgrounds
    background: "#FFFFFF",
    surface: "#F5F5F5",
    elevated: "#FFFFFF",

    // Text
    textPrimary: "#000000",
    textSecondary: "#666666",
    textMuted: "#999999",

    // Brand
    primary: "#FF0000", // RageState Red
    secondary: "#000000",

    // Semantic
    success: "#34C759",
    warning: "#FF9500",
    error: "#FF3B30",

    // Borders
    border: "#E5E5E5",
    borderFocused: "#FF0000",

    // Tab Bar
    tabBarBackground: "#FFFFFF",
    tabBarActive: "#FF0000",
    tabBarInactive: "#999999",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    fontFamily: {
      regular: "System",
      medium: "System",
      bold: "System",
    },
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
    },
  },
  shadows: {
    small: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  },
};

export const darkTheme: typeof lightTheme = {
  colors: {
    background: "#000000",
    surface: "#1C1C1E",
    elevated: "#2C2C2E",

    textPrimary: "#FFFFFF",
    textSecondary: "#AEAEB2",
    textMuted: "#636366",

    primary: "#FF3B30",
    secondary: "#FFFFFF",

    success: "#30D158",
    warning: "#FF9F0A",
    error: "#FF453A",

    border: "#38383A",
    borderFocused: "#FF3B30",

    tabBarBackground: "#1C1C1E",
    tabBarActive: "#FF3B30",
    tabBarInactive: "#636366",
  },
  spacing: lightTheme.spacing,
  typography: lightTheme.typography,
  shadows: {
    small: {
      ...lightTheme.shadows.small,
      shadowOpacity: 0.3,
    },
    medium: {
      ...lightTheme.shadows.medium,
      shadowOpacity: 0.4,
    },
  },
};
```

### Theme Context

```typescript
// src/contexts/ThemeContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightTheme, darkTheme } from "../constants/themes";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: typeof lightTheme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem("themeMode").then((stored) => {
      if (stored) setModeState(stored as ThemeMode);
    });
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem("themeMode", newMode);
  };

  const isDark =
    mode === "dark" || (mode === "system" && systemColorScheme === "dark");
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
```

### Styled Components Helper

```typescript
// src/hooks/useThemedStyles.ts
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

type StyleFactory<T extends StyleSheet.NamedStyles<T>> = (
  theme: typeof lightTheme
) => T;

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): T {
  const { theme } = useTheme();

  return useMemo(() => {
    const styles = styleFactory(theme);
    return StyleSheet.create(styles);
  }, [theme]);
}
```

### Usage Example

```typescript
// src/components/EventCard.tsx
import { useThemedStyles } from "../hooks/useThemedStyles";

export function EventCard({ event }) {
  const styles = useThemedStyles((theme) => ({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: theme.spacing.md,
      ...theme.shadows.small,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.lg,
      fontWeight: "bold",
    },
    date: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.sm,
    },
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{event.name}</Text>
      <Text style={styles.date}>{event.date}</Text>
    </View>
  );
}
```

### Settings Screen

```typescript
// src/app/(app)/account/appearance.tsx
export default function AppearanceSettings() {
  const { mode, setMode } = useTheme();

  return (
    <View>
      <SettingsOption
        label="Light"
        selected={mode === "light"}
        onPress={() => setMode("light")}
      />
      <SettingsOption
        label="Dark"
        selected={mode === "dark"}
        onPress={() => setMode("dark")}
      />
      <SettingsOption
        label="System"
        selected={mode === "system"}
        onPress={() => setMode("system")}
      />
    </View>
  );
}
```

### Implementation Checklist

- [ ] Create theme definitions (light/dark)
- [ ] Create ThemeContext and ThemeProvider
- [ ] Create `useThemedStyles` hook
- [ ] Migrate existing components to themed styles
- [ ] Add appearance settings screen
- [ ] Update StatusBar based on theme
- [ ] Update navigation bar colors
- [ ] Test all screens in both modes

---

## 4.4 Performance Optimization (~2-3 days)

### Image Optimization

```typescript
// Use expo-image for better caching
import { Image } from "expo-image";

<Image
  source={{ uri: imageUrl }}
  style={styles.image}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
  placeholder={blurhash}
/>;
```

### List Optimization

```typescript
// Use FlashList for large lists
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={events}
  renderItem={renderEvent}
  estimatedItemSize={200}
  getItemType={(item) => item.type}
/>;
```

### Bundle Size

```bash
# Analyze bundle
npx expo export --platform ios --analyze
npx expo export --platform android --analyze
```

### Common Optimizations

- [ ] Replace FlatList with FlashList for large lists
- [ ] Use expo-image instead of React Native Image
- [ ] Implement list virtualization
- [ ] Add skeleton loaders for perceived performance
- [ ] Lazy load screens with React.lazy
- [ ] Optimize re-renders with memo/useMemo
- [ ] Profile with React DevTools Profiler

---

## 4.5 Error Tracking & Crash Reporting (~1-2 days)

### Sentry Setup

```bash
npx expo install sentry-expo @sentry/react-native
```

```typescript
// src/services/errorReporting.ts
import * as Sentry from "@sentry/react-native";

export function initializeErrorReporting() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: 0.2,
    attachScreenshot: true,
    enableAutoSessionTracking: true,
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

export function setUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}
```

### Error Boundary Updates

```typescript
// src/components/ErrorBoundary.tsx
import { captureException } from "../services/errorReporting";

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureException(error, {
      componentStack: errorInfo.componentStack,
    });
  }
  // ...
}
```

---

## 4.6 App Store Preparation (~2-3 days)

### Required Assets

| Asset            | iOS Size         | Android Size      |
| ---------------- | ---------------- | ----------------- |
| App Icon         | 1024x1024        | 512x512           |
| Screenshots      | 6.5" (1284x2778) | Phone (1080x1920) |
| Feature Graphic  | -                | 1024x500          |
| Privacy Policy   | URL              | URL               |
| Terms of Service | URL              | URL               |

### App Store Listing

- [ ] App name and subtitle
- [ ] App description (4000 chars)
- [ ] Keywords (100 chars)
- [ ] Screenshots for all device sizes
- [ ] App preview video (optional)
- [ ] Category selection
- [ ] Age rating questionnaire
- [ ] Privacy policy URL
- [ ] Support URL

### Play Store Listing

- [ ] App title (30 chars)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Screenshots (min 2)
- [ ] Feature graphic
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience

### Pre-Launch Checklist

- [ ] Remove all console.log statements
- [ ] Disable debug modes
- [ ] Verify environment variables
- [ ] Test on multiple devices
- [ ] Run accessibility audit
- [ ] Test offline behavior
- [ ] Verify analytics events
- [ ] Test in-app purchases (if any)
- [ ] Check all deep links
- [ ] Verify push notifications

---

## Success Criteria

- [ ] App Check enabled and enforced
- [ ] All deep links working (custom scheme + universal)
- [ ] Light/Dark mode toggleable
- [ ] System theme respected
- [ ] Performance benchmarks met
- [ ] Crash reporting active
- [ ] App Store listing complete
- [ ] Play Store listing complete
- [ ] All required assets uploaded
- [ ] Beta testing completed
- [ ] Production build submitted

---

## Files to Create/Update

```
src/
├── app/_layout.tsx              # Add App Check, deep linking
├── contexts/
│   └── ThemeContext.tsx
├── constants/
│   └── themes.ts
├── hooks/
│   ├── useDeepLinking.ts
│   └── useThemedStyles.ts
├── services/
│   ├── appCheckService.ts
│   └── errorReporting.ts
└── (all components)             # Migrate to themed styles
```

---

## EAS Build Configuration

```json
// eas.json updates
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "production"
      }
    }
  }
}
```

---

## Launch Timeline

| Day   | Tasks                       |
| ----- | --------------------------- |
| 1-2   | App Check setup             |
| 3-4   | Deep linking implementation |
| 5-6   | Theme system migration      |
| 7     | Performance optimization    |
| 8     | Error tracking setup        |
| 9-10  | App Store assets & listings |
| 11-12 | Beta testing                |
| 13    | Final fixes                 |
| 14    | Submit to stores            |
