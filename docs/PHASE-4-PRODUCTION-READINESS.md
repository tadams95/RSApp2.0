# Phase 4: Production Readiness

> **Timeline**: 1-2 weeks | **Priority**: 🟢 Medium  
> **Dependencies**: Phases 1-3 complete  
> **Outcome**: App Store/Play Store ready with security, performance, and polish

---

## Overview

Final phase to ensure the app is production-ready with proper security (App Check), deep linking across all routes, **comprehensive theming aligned with the web app's `social-ui-design-spec.md`**, and performance optimization.

### Design System Alignment

This phase includes migrating ~75 files from hardcoded dark-mode styling to a token-based theming system that:

- Matches the web app's CSS variables exactly
- Supports both Light and Dark modes
- Follows the typography, spacing, and shadow specifications
- Ensures WCAG AA contrast compliance

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

## 4.3 Light/Dark Mode & Design System (~4-5 days)

> **Goal**: Implement a comprehensive theming system that matches our web app's `social-ui-design-spec.md` with full light/dark mode support.

### 4.3.1 Design Token System (from social-ui-design-spec.md)

```typescript
// src/constants/themes.ts
// Aligned with web app CSS variables from social-ui-design-spec.md

export const darkTheme = {
  colors: {
    // Backgrounds (from --bg-*)
    bgRoot: "#050505",
    bgElev1: "#0d0d0f",
    bgElev2: "#16171a",
    bgReverse: "#ffffff",
    bgHover: "rgba(255, 255, 255, 0.05)",

    // Borders (from --border-*)
    borderSubtle: "#242528",
    borderStrong: "#34363a",

    // Text (from --text-*)
    textPrimary: "#f5f6f7",
    textSecondary: "#a1a5ab",
    textTertiary: "#5d6269",

    // Brand (from --accent*)
    accent: "#ff1f42", // RAGESTATE red
    accentGlow: "#ff415f",
    accentMuted: "rgba(255, 31, 66, 0.25)",
    focusRing: "#ff1f42",

    // Semantic
    success: "#3ddc85",
    warning: "#ffb347",
    danger: "#ff4d4d",

    // Reactions
    reactionFire: "#ff8a1f",
    reactionWow: "#ffd31f",
    reactionLike: "#3d8bff",

    // Presence
    presenceOnline: "#3ddc85",
    presenceIdle: "#ffb347",

    // Tab Bar
    tabBarBackground: "#0d0d0f",
    tabBarActive: "#ff1f42",
    tabBarInactive: "#5d6269",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 4,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 28,
      elevation: 8,
    },
    dropdown: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 4,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    cardPadding: 16,
    bubblePadding: 12,
    composerPadding: 16,
    listGutter: 8,
  },
  typography: {
    sizes: {
      display: 28, // Hero/optional
      sectionHeading: 20, // Feed heading
      author: 15, // Post author
      body: 15, // Body text
      meta: 12, // Timestamps/counters
      button: 13, // Button/Chip
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    letterSpacing: {
      display: -0.01,
      sectionHeading: -0.005,
      meta: 0.02,
      button: 0.02,
    },
  },
  radius: {
    card: 14,
    bubble: 18,
    composer: 20,
    reactionPicker: 16,
    button: 8,
    avatar: 999, // Fully round
  },
};

export const lightTheme: typeof darkTheme = {
  colors: {
    // Backgrounds
    bgRoot: "#fafafa",
    bgElev1: "#ffffff",
    bgElev2: "#f0f0f2",
    bgReverse: "#050505",
    bgHover: "rgba(0, 0, 0, 0.04)",

    // Borders
    borderSubtle: "#e0e0e3",
    borderStrong: "#c8c8cc",

    // Text
    textPrimary: "#111113",
    textSecondary: "#555555",
    textTertiary: "#888888",

    // Brand (preserved)
    accent: "#ff1f42",
    accentGlow: "#ff415f",
    accentMuted: "rgba(255, 31, 66, 0.25)",
    focusRing: "#ff1f42",

    // Semantic (adjusted for light)
    success: "#22a55a",
    warning: "#e6a020",
    danger: "#e53935",

    // Reactions (preserved)
    reactionFire: "#ff8a1f",
    reactionWow: "#ffd31f",
    reactionLike: "#3d8bff",

    // Presence (adjusted for light)
    presenceOnline: "#22a55a",
    presenceIdle: "#e6a020",

    // Tab Bar
    tabBarBackground: "#ffffff",
    tabBarActive: "#ff1f42",
    tabBarInactive: "#888888",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 28,
      elevation: 4,
    },
    dropdown: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 2,
    },
  },
  spacing: darkTheme.spacing,
  typography: darkTheme.typography,
  radius: darkTheme.radius,
};
```

### 4.3.2 Theme Context (unchanged)

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

## 4.3.3 File Audit: Screens & Components Requiring Updates

> **Objective**: Identify all files with hardcoded colors and migrate to themed styles matching `social-ui-design-spec.md`.

### PRIORITY 1: Core Layout & Navigation (Critical Path)

| File                          | Current Issues                            | Changes Required                                                    |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `src/app/_layout.tsx`         | App-level theme not applied               | Add ThemeProvider wrapper, set StatusBar based on theme             |
| `src/app/(app)/_layout.tsx`   | Hardcoded `#333` border, dark backgrounds | Use `theme.colors.borderSubtle`, `theme.colors.bgElev1` for tab bar |
| `src/app/(auth)/_layout.tsx`  | Fixed dark styling                        | Support light mode backgrounds                                      |
| `src/app/(guest)/_layout.tsx` | Fixed dark styling                        | Support light mode backgrounds                                      |

### PRIORITY 2: Authentication Screens (User First Impression)

| File                                            | Current Issues                                                                      | Changes Required                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/app/(auth)/login.tsx`                      | 20+ hardcoded colors (`#000`, `#111`, `#222`, `#666`, `#888`, `#fff`)               | Full migration to `useThemedStyles` with spec tokens |
| `src/app/(auth)/signup.tsx`                     | Similar hardcoded colors                                                            | Same migration pattern                               |
| `src/app/(auth)/forgotPassword.tsx`             | Hardcoded dark colors                                                               | Theme migration                                      |
| `src/app/(auth)/complete-profile.tsx`           | 15+ hardcoded colors (`#000`, `#0d0d0d`, `#111`, `#222`, `#666`, `#888`, `#e74c3c`) | Full theme migration                                 |
| `src/components/auth/PasswordStrengthMeter.tsx` | Fixed color indicators                                                              | Theme-aware strength colors                          |

**Specific Changes for Auth Screens:**

- `backgroundColor: "#000"` → `theme.colors.bgRoot`
- `backgroundColor: "#0d0d0d"` / `"#111"` → `theme.colors.bgElev1`
- `color: "#fff"` → `theme.colors.textPrimary`
- `color: "#888"` → `theme.colors.textSecondary`
- `color: "#666"` → `theme.colors.textTertiary`
- `borderColor: "#222"` / `"#333"` → `theme.colors.borderSubtle`
- `placeholderTextColor="#666"` → `theme.colors.textTertiary`

### PRIORITY 3: Feed Components (High Visibility)

| File                                   | Current Issues                         | Changes Required                         |
| -------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `src/components/feed/PostCard.tsx`     | Uses `GlobalStyles.colors` (dark-only) | Migrate to themed PostCard per spec §4.2 |
| `src/components/feed/PostActions.tsx`  | Hardcoded icon colors                  | Theme-aware action icons                 |
| `src/components/feed/PostComposer.tsx` | Fixed dark inputs                      | Theme inputs per spec §5                 |
| `src/components/feed/CommentInput.tsx` | Hardcoded styling                      | Theme-aware input                        |
| `src/components/feed/CommentsList.tsx` | Fixed dark backgrounds                 | Theme backgrounds                        |
| `src/components/feed/MediaGrid.tsx`    | May have hardcoded overlays            | Theme overlays                           |
| `src/app/(app)/home/index.tsx`         | Feed container styling                 | Theme container                          |
| `src/app/(app)/home/post/[postId].tsx` | 10+ hardcoded colors (`#000`, `#fff`)  | Full theme migration                     |

**PostCard Design Spec Alignment (§4.2):**

- Card background: `theme.colors.bgElev1`
- Card border: `1px solid theme.colors.borderSubtle`
- Card shadow: `theme.shadows.card`
- Card radius: `theme.radius.card` (14px)
- Author name: `theme.colors.textPrimary`, 15px, weight 600
- Timestamp: `theme.colors.textTertiary`, 12px
- Body text: `theme.colors.textPrimary`, 15px
- Truncate body > 300 chars with "See more"

### PRIORITY 4: Profile Components

| File                                              | Current Issues             | Changes Required              |
| ------------------------------------------------- | -------------------------- | ----------------------------- |
| `src/components/profile/ProfileHeader.tsx`        | Uses `GlobalStyles.colors` | Migrate to themed styles      |
| `src/components/profile/ProfileStats.tsx`         | Hardcoded colors           | Theme stats display           |
| `src/components/profile/FollowButton.tsx`         | Fixed button colors        | Theme-aware accent button     |
| `src/components/profile/UserCard.tsx`             | Fixed styling              | Theme card styling            |
| `src/components/profile/UserProfileView.tsx`      | Full profile view          | Comprehensive theme migration |
| `src/components/profile/ProfileSongCard.tsx`      | Music card styling         | Theme card                    |
| `src/components/profile/SocialLinksRow.tsx`       | Icon colors                | Theme icon colors             |
| `src/components/profile/SoundCloudMiniPlayer.tsx` | Player styling             | Theme player                  |
| `src/components/profile/PlatformBadge.tsx`        | Badge colors               | Theme badges                  |
| `src/app/(app)/profile/[userId].tsx`              | Profile screen             | Full theme migration          |

### PRIORITY 5: Events Components

| File                                        | Current Issues      | Changes Required     |
| ------------------------------------------- | ------------------- | -------------------- |
| `src/app/(app)/events/index.tsx`            | Event list styling  | Theme event cards    |
| `src/app/(app)/events/[id].tsx`             | Event detail page   | Full theme migration |
| `src/app/(app)/events/my-events.tsx`        | My events list      | Theme list items     |
| `src/app/(app)/events/paginated-events.tsx` | Paginated view      | Theme pagination     |
| `src/components/events/EventNotFound.tsx`   | Error state styling | Theme error states   |

### PRIORITY 6: Notifications

| File                                                  | Current Issues                                                                                   | Changes Required                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `src/app/(app)/notifications/index.tsx`               | Notification list                                                                                | Theme container                         |
| `src/app/(app)/account/notifications.tsx`             | 20+ hardcoded colors (`#000`, `#111`, `#222`, `#333`, `#444`, `#666`, `#999`, `#fff`, `#ff6b6b`) | Full theme migration                    |
| `src/components/notifications/NotificationCard.tsx`   | Hardcoded type colors (`#FF4757`, `#3498db`, `#2ecc71`, etc.)                                    | Keep semantic colors, theme backgrounds |
| `src/components/notifications/EmptyNotifications.tsx` | Empty state styling                                                                              | Theme empty state                       |

**Notification Type Colors (preserve semantic meaning):**

- `post_liked`: `theme.colors.reactionLike` or keep `#FF4757`
- `comment_added`: Keep `#3498db` (blue)
- `new_follower`: `theme.colors.success`
- `mention`: Keep `#9b59b6` (purple)
- `post_reposted`: Keep `#1abc9c` (teal)

### PRIORITY 7: Shop Components

| File                                    | Current Issues   | Changes Required    |
| --------------------------------------- | ---------------- | ------------------- |
| `src/app/(app)/shop/index.tsx`          | Shop grid        | Theme product cards |
| `src/app/(app)/shop/[handle].tsx`       | Collection page  | Theme collection    |
| `src/app/(app)/shop/ProductDetail.tsx`  | Product detail   | Theme product view  |
| `src/app/(app)/shop/ProductWrapper.tsx` | Product wrapper  | Theme wrapper       |
| `src/app/(app)/shop/paginated-shop.tsx` | Paginated shop   | Theme pagination    |
| `src/app/(app)/cart/`                   | Cart screens     | Theme cart UI       |
| `src/components/shopify/*.tsx`          | Error boundaries | Theme error states  |

**Commerce Card Spec (§4.10):**

- Product card: Compact horizontal layout
- Image left, Title + Price right
- "Shop" button with outline or subtle accent
- Background: `theme.colors.bgElev1`
- Border: `theme.colors.borderSubtle`

### PRIORITY 8: Transfer Components

| File                                               | Current Issues      | Changes Required |
| -------------------------------------------------- | ------------------- | ---------------- |
| `src/app/(app)/transfer/claim.tsx`                 | Transfer claim page | Theme form       |
| `src/app/(app)/transfer/pending.tsx`               | Pending transfers   | Theme list       |
| `src/components/transfer/EmailTransferForm.tsx`    | Form styling        | Theme inputs     |
| `src/components/transfer/UsernameTransferForm.tsx` | Form styling        | Theme inputs     |
| `src/components/transfer/PendingTransferCard.tsx`  | Card styling        | Theme card       |
| `src/components/transfer/RecipientPreview.tsx`     | Preview styling     | Theme preview    |
| `src/components/transfer/TransferMethodPicker.tsx` | Picker styling      | Theme picker     |

### PRIORITY 9: Account & Settings

| File                                      | Current Issues                   | Changes Required      |
| ----------------------------------------- | -------------------------------- | --------------------- |
| `src/app/(app)/account/index.tsx`         | Account screen                   | Theme menu items      |
| `src/app/(app)/account/notifications.tsx` | Already audited above            | -                     |
| `src/components/ui/SettingsSection.tsx`   | Hardcoded `#111`, `#333`, `#999` | Theme section styling |
| `src/components/ui/SettingsToggle.tsx`    | Hardcoded `#FFFFFF` thumb        | Theme toggle colors   |

### PRIORITY 10: Modal Components

| File                                       | Current Issues | Changes Required       |
| ------------------------------------------ | -------------- | ---------------------- |
| `src/components/modals/EditProfile.tsx`    | Form styling   | Theme inputs, buttons  |
| `src/components/modals/SettingsModal.tsx`  | Settings UI    | Theme settings         |
| `src/components/modals/QRModal.tsx`        | QR display     | Theme modal background |
| `src/components/modals/HistoryModal.tsx`   | History list   | Theme list items       |
| `src/components/modals/AdminModal.tsx`     | Admin controls | Theme controls         |
| `src/components/modals/EventAdminView.tsx` | Event admin    | Theme admin UI         |
| `src/components/modals/MyEvents.tsx`       | Events list    | Theme list             |

**Modal Spec (§3.4):**

- Background: `theme.colors.bgElev1`
- Border radius: `theme.radius.composer` (20px)
- Shadow: `theme.shadows.modal`
- Subtle border: `1px solid rgba(255,255,255,0.06)` (dark) or `theme.colors.borderSubtle` (light)

### PRIORITY 11: Shared UI Components

| File                                            | Current Issues                    | Changes Required    |
| ----------------------------------------------- | --------------------------------- | ------------------- |
| `src/components/ui/ContentContainer.tsx`        | Container styling                 | Theme container     |
| `src/components/ui/ScreenWrapper.tsx`           | Screen wrapper                    | Theme wrapper       |
| `src/components/ui/ProfileFormInput.tsx`        | Input styling with `#666`, `#555` | Theme input         |
| `src/components/ui/NetworkStatusBanner.tsx`     | Banner styling                    | Theme banner        |
| `src/components/ui/PaginatedList.tsx`           | List styling                      | Theme list          |
| `src/components/ui/LazyImage.tsx`               | Image placeholder                 | Theme placeholder   |
| `src/components/ui/ProgressiveImage.tsx`        | Image loading                     | Theme loading state |
| `src/components/ui/ImageWithFallback.tsx`       | Fallback styling                  | Theme fallback      |
| `src/components/ui/AppCarousel.tsx`             | Carousel styling                  | Theme carousel      |
| `src/components/ui/CompressedImageUploader.tsx` | Upload UI                         | Theme upload        |

### PRIORITY 12: Error & Status Components

| File                                                  | Current Issues   | Changes Required          |
| ----------------------------------------------------- | ---------------- | ------------------------- |
| `src/components/ErrorBoundary.tsx`                    | Error display    | Theme error UI            |
| `src/components/ErrorUI.tsx`                          | Error UI styling | Theme error state         |
| `src/components/LoadingOverlay.tsx`                   | Loading state    | Theme loading             |
| `src/components/LoginErrorNotice.tsx`                 | Error notice     | Theme notice              |
| `src/components/SignupErrorNotice.tsx`                | Error notice     | Theme notice              |
| `src/components/PasswordResetErrorNotice.tsx`         | Error notice     | Theme notice              |
| `src/components/ProfileUpdateErrorNotice.tsx`         | Uses `#FF6B6B`   | Use `theme.colors.danger` |
| `src/components/RealtimeDatabaseConnectionStatus.tsx` | Status indicator | Theme status              |

### PRIORITY 13: Debug Components (Lower Priority)

| File                                             | Current Issues                                             | Changes Required |
| ------------------------------------------------ | ---------------------------------------------------------- | ---------------- |
| `src/components/debug/ImageCacheMonitor.tsx`     | Debug UI with `#ccc`, `#333`                               | Theme debug UI   |
| `src/components/debug/NotificationTestPanel.tsx` | Test panel with `#f5f5f5`, `#333`, `#666`, `#007bff`, etc. | Theme test panel |

### PRIORITY 14: Constants & Styles Foundation

| File                            | Current Issues                             | Changes Required                                                                                           |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/constants/styles.ts`       | Current `GlobalStyles` object is dark-only | **Option A**: Keep for backwards compat, add `themes.ts` **Option B**: Deprecate in favor of theme context |
| `src/constants/themes.ts`       | Does not exist                             | **CREATE**: New file with light/dark themes per spec                                                       |
| `src/contexts/ThemeContext.tsx` | Does not exist                             | **CREATE**: Theme context and provider                                                                     |
| `src/hooks/useThemedStyles.ts`  | Does not exist                             | **CREATE**: Hook for themed StyleSheet                                                                     |

---

## 4.3.4 Migration Strategy

### Phase A: Foundation (Day 1)

1. Create `src/constants/themes.ts` with full token system
2. Create `src/contexts/ThemeContext.tsx`
3. Create `src/hooks/useThemedStyles.ts`
4. Wrap app in `ThemeProvider` in `src/app/_layout.tsx`
5. Add appearance settings in `src/app/(app)/account/`

### Phase B: Critical Screens (Days 2-3)

1. Tab bar and navigation (`_layout.tsx` files)
2. Auth screens (login, signup, complete-profile)
3. Home feed and PostCard components

### Phase C: Profile & Social (Day 3-4)

1. Profile components
2. Notification components
3. Comment components

### Phase D: Commerce & Transfer (Day 4)

1. Shop screens and components
2. Transfer components
3. Cart screens

### Phase E: Supporting Components (Day 5)

1. Modal components
2. UI components
3. Error/status components
4. Debug components (optional)

### Phase F: QA & Polish (Day 5)

1. Test all screens in both themes
2. Fix any contrast issues
3. Ensure StatusBar adapts
4. Verify shadows look good in both modes

---

## 4.3.5 Color Migration Reference

| Legacy Hardcoded Value                     | Dark Theme Token | Light Theme Token |
| ------------------------------------------ | ---------------- | ----------------- |
| `#000`, `#050505`                          | `bgRoot`         | `bgRoot`          |
| `#0d0d0d`, `#111`                          | `bgElev1`        | `bgElev1`         |
| `#16171a`, `#1a1a1c`, `#222`               | `bgElev2`        | `bgElev2`         |
| `#fff`, `#f5f6f7`                          | `textPrimary`    | `textPrimary`     |
| `#999`, `#a1a5ab`, `#888`                  | `textSecondary`  | `textSecondary`   |
| `#666`, `#5d6269`                          | `textTertiary`   | `textTertiary`    |
| `#333`, `#242528`                          | `borderSubtle`   | `borderSubtle`    |
| `#444`, `#34363a`                          | `borderStrong`   | `borderStrong`    |
| `#ff3c00`, `#FF0000`, `#ff1f42`            | `accent`         | `accent`          |
| `#ef4444`, `#ff6b6b`, `#e74c3c`, `#FF4D4D` | `danger`         | `danger`          |
| `#2ecc71`, `#34C759`, `#3ddc85`            | `success`        | `success`         |
| `#FF9500`, `#ffb347`                       | `warning`        | `warning`         |

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

### App Check & Security

- [ ] App Check enabled and enforced
- [ ] Debug tokens configured for development

### Deep Linking

- [ ] All deep links working (custom scheme + universal)
- [ ] apple-app-site-association hosted
- [ ] assetlinks.json hosted

### Theme System (Design Spec Alignment)

- [ ] Theme tokens match `social-ui-design-spec.md` exactly
- [ ] Light/Dark mode toggleable in settings
- [ ] System theme preference respected
- [ ] All 75+ files migrated to themed styles
- [ ] WCAG AA contrast compliance verified
- [ ] StatusBar adapts to theme
- [ ] Navigation bars themed correctly

### Component Spec Compliance

- [ ] PostCard matches spec §4.2 (radius, shadows, typography)
- [ ] PostComposer matches spec §5 (character limits, controls)
- [ ] Modals match spec §3.4 (radius 20px, shadows)
- [ ] All typography follows spec §3.2 scale
- [ ] All spacing follows spec §3.3 scale

### Performance

- [ ] Performance benchmarks met
- [ ] FlashList used for large lists
- [ ] expo-image used for images
- [ ] Skeleton loaders implemented

### Production Readiness

- [ ] Crash reporting active (Sentry)
- [ ] App Store listing complete
- [ ] Play Store listing complete
- [ ] All required assets uploaded
- [ ] Beta testing completed
- [ ] No hardcoded hex colors remaining
- [ ] Production build submitted

---

## Files to Create/Update

### New Files to Create

```
src/
├── constants/
│   └── themes.ts                # Light/Dark theme definitions (aligned with web spec)
├── contexts/
│   └── ThemeContext.tsx         # Theme provider and context
├── hooks/
│   ├── useDeepLinking.ts        # Deep link handler
│   └── useThemedStyles.ts       # StyleSheet factory hook
└── services/
    ├── appCheckService.ts       # Firebase App Check
    └── errorReporting.ts        # Sentry integration
```

### Files to Update (Theme Migration)

**Layout Files (4 files)**

```
src/app/
├── _layout.tsx                  # Add ThemeProvider, StatusBar
├── (app)/_layout.tsx            # Theme tab bar
├── (auth)/_layout.tsx           # Theme auth layout
└── (guest)/_layout.tsx          # Theme guest layout
```

**Auth Screens (5 files)**

```
src/app/(auth)/
├── login.tsx                    # ~20 hardcoded colors
├── signup.tsx                   # ~20 hardcoded colors
├── forgotPassword.tsx           # Theme migration
├── complete-profile.tsx         # ~15 hardcoded colors
└── index.tsx                    # Theme landing
```

**Feed Components (7 files)**

```
src/components/feed/
├── PostCard.tsx                 # Align with spec §4.2
├── PostActions.tsx              # Theme icons
├── PostComposer.tsx             # Align with spec §5
├── CommentInput.tsx             # Theme input
├── CommentsList.tsx             # Theme list
└── MediaGrid.tsx                # Theme overlays
src/app/(app)/home/
├── index.tsx                    # Theme container
└── post/[postId].tsx            # ~10 hardcoded colors
```

**Profile Components (10 files)**

```
src/components/profile/
├── ProfileHeader.tsx
├── ProfileStats.tsx
├── FollowButton.tsx
├── UserCard.tsx
├── UserProfileView.tsx
├── ProfileSongCard.tsx
├── SocialLinksRow.tsx
├── SoundCloudMiniPlayer.tsx
└── PlatformBadge.tsx
src/app/(app)/profile/
└── [userId].tsx
```

**Notification Components (4 files)**

```
src/components/notifications/
├── NotificationCard.tsx
└── EmptyNotifications.tsx
src/app/(app)/
├── notifications/index.tsx
└── account/notifications.tsx    # ~20 hardcoded colors
```

**Shop Components (6 files)**

```
src/app/(app)/shop/
├── index.tsx
├── [handle].tsx
├── ProductDetail.tsx
├── ProductWrapper.tsx
└── paginated-shop.tsx
src/app/(app)/cart/
└── (all cart files)
```

**Transfer Components (7 files)**

```
src/components/transfer/
├── EmailTransferForm.tsx
├── UsernameTransferForm.tsx
├── PendingTransferCard.tsx
├── RecipientPreview.tsx
└── TransferMethodPicker.tsx
src/app/(app)/transfer/
├── claim.tsx
└── pending.tsx
```

**Modal Components (7 files)**

```
src/components/modals/
├── EditProfile.tsx
├── SettingsModal.tsx
├── QRModal.tsx
├── HistoryModal.tsx
├── AdminModal.tsx
├── EventAdminView.tsx
└── MyEvents.tsx
```

**UI Components (12 files)**

```
src/components/ui/
├── ContentContainer.tsx
├── ScreenWrapper.tsx
├── ProfileFormInput.tsx
├── SettingsSection.tsx          # Hardcoded #111, #333, #999
├── SettingsToggle.tsx           # Hardcoded #FFFFFF
├── NetworkStatusBanner.tsx
├── PaginatedList.tsx
├── LazyImage.tsx
├── ProgressiveImage.tsx
├── ImageWithFallback.tsx
├── AppCarousel.tsx
└── CompressedImageUploader.tsx
```

**Error Components (8 files)**

```
src/components/
├── ErrorBoundary.tsx
├── ErrorUI.tsx
├── LoadingOverlay.tsx
├── LoginErrorNotice.tsx
├── SignupErrorNotice.tsx
├── PasswordResetErrorNotice.tsx
├── ProfileUpdateErrorNotice.tsx  # Uses #FF6B6B
└── RealtimeDatabaseConnectionStatus.tsx
```

**Events Files (5 files)**

```
src/app/(app)/events/
├── index.tsx
├── [id].tsx
├── my-events.tsx
└── paginated-events.tsx
src/components/events/
└── EventNotFound.tsx
```

### Total Files Requiring Changes: ~75 files

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

| Day   | Tasks                                         |
| ----- | --------------------------------------------- |
| 1-2   | App Check setup                               |
| 3-4   | Deep linking implementation                   |
| 5     | Theme foundation (tokens, context, hooks)     |
| 6-7   | Theme migration: Auth + Layout + Feed         |
| 8     | Theme migration: Profile + Notifications      |
| 9     | Theme migration: Shop + Transfer + Modals     |
| 10    | Theme migration: UI components + Error states |
| 11    | Performance optimization                      |
| 12    | Error tracking setup                          |
| 13-14 | App Store assets & listings                   |
| 15-16 | Beta testing                                  |
| 17    | Final fixes                                   |
| 18    | Submit to stores                              |

> **Note**: Timeline extended from 14 to 18 days to accommodate comprehensive theming migration (~75 files).
