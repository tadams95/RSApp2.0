# CLAUDE.md - RAGESTATE Project Context

> This file provides Claude Code with essential context about the RAGESTATE codebase.

---

## Project Overview

RAGESTATE is a React Native mobile app for event discovery, ticketing, and social engagement. Users can browse events, purchase tickets, follow other users, create posts, and engage with content.

**App Store**: iOS and Android via Expo EAS

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React Native + Expo (SDK 52) |
| **Navigation** | Expo Router (file-based) |
| **State** | Redux Toolkit + React Query |
| **Backend** | Firebase (Auth, Firestore, Storage, Functions) |
| **Commerce** | Shopify Storefront API |
| **Analytics** | PostHog |
| **Push** | Expo Notifications + FCM |

---

## Project Structure

```
ragestate/
├── src/
│   ├── app/                    # Expo Router screens
│   │   ├── (app)/              # Authenticated routes
│   │   │   ├── (tabs)/         # Tab navigator screens
│   │   │   ├── profile/        # Profile screens
│   │   │   ├── events/         # Event screens
│   │   │   └── messages/       # Chat screens (planned)
│   │   └── (auth)/             # Auth screens (login, signup)
│   ├── components/             # Reusable components
│   │   ├── ui/                 # Primitives (LinkedText, ImageWithFallback)
│   │   ├── feed/               # Feed components (PostCard, PostActions)
│   │   ├── profile/            # Profile components
│   │   └── chat/               # Chat components (planned)
│   ├── services/               # Firebase/API operations
│   │   ├── feedService.ts      # Posts, reposts
│   │   ├── followService.ts    # Following/followers
│   │   ├── commentService.ts   # Comments
│   │   ├── notificationService.ts # Push notifications
│   │   └── userSearchService.ts # User search
│   ├── hooks/                  # Custom React hooks
│   │   ├── useThemedStyles.ts  # Memoized themed styles
│   │   ├── useFeed.ts          # Feed data hook
│   │   ├── useComments.ts      # Comments hook
│   │   └── useErrorHandler.ts  # Error handling
│   ├── store/redux/            # Redux slices
│   │   └── userSlice.tsx       # User state
│   ├── contexts/               # React contexts
│   │   └── ThemeContext.tsx    # Theme provider
│   ├── constants/              # App constants
│   │   └── themes.ts           # Theme definitions
│   ├── firebase/               # Firebase config
│   │   └── firebase.ts         # Firebase initialization
│   ├── analytics/              # PostHog analytics
│   │   └── PostHogProvider.tsx
│   └── config/
│       └── reactQuery.ts       # Query keys and options
├── functions/                  # Firebase Cloud Functions
│   ├── index.js                # Function exports
│   ├── notifications.js        # Notification triggers
│   └── admin.js                # Admin SDK setup
├── firestore.rules             # Security rules
└── docs/                       # Documentation
    ├── CHAT-IMPLEMENTATION-SPEC.md
    └── CLAUDE-CODE-GUIDE.md
```

---

## Key Patterns

### 1. Component Styling - ALWAYS use `useThemedStyles`

```tsx
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useTheme } from "@/contexts/ThemeContext";
import type { Theme } from "@/constants/themes";

const MyComponent = () => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return <View style={styles.container} />;
};

// Factory function OUTSIDE component
const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.bgElev1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
});
```

**Never hardcode colors or spacing values.**

### 2. Real-time Subscriptions - Return `Unsubscribe`

```typescript
// Service pattern from feedService.ts
export function subscribeToFeed(
  onUpdate: (posts: Post[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

  return onSnapshot(q,
    (snapshot) => onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
    (error) => onError(error)
  );
}

// Hook pattern - cleanup in useEffect
useEffect(() => {
  const unsubscribe = subscribeToFeed(setPosts, setError);
  return () => unsubscribe();
}, []);
```

### 3. Cloud Functions - Use v2 Syntax

```javascript
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

exports.onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const { postId } = event.params;
  const data = event.data?.data();

  // Use transactions for consistency
  await db.runTransaction(async (tx) => {
    // ... operations
  });

  logger.info("Post processed", { postId });
  return null;
});
```

### 4. User Data - Multi-Collection Pattern

User data spans multiple collections:
- `/customers/{userId}` - Commerce/account data
- `/profiles/{userId}` - Public profile (displayName, bio, photo)
- `/users/{userId}` - Private settings

```typescript
// Always check both collections for display info
const [customerDoc, profileDoc] = await Promise.all([
  getDoc(doc(db, "customers", userId)),
  getDoc(doc(db, "profiles", userId)),
]);

const displayName = profileDoc.data()?.displayName || customerDoc.data()?.displayName;
const photoURL = profileDoc.data()?.photoURL || customerDoc.data()?.profilePicture;
```

### 5. Error Handling - Use Hooks

```typescript
import { useErrorHandler } from "@/hooks/useErrorHandler";

const { error, setError, clearError } = useErrorHandler();

try {
  await someOperation();
} catch (err) {
  setError(err);
}
```

### 6. Analytics - snake_case Events

```typescript
import { usePostHog } from "@/analytics/PostHogProvider";

posthog.capture("post_liked", { post_id: postId, author_id: authorId });
posthog.capture("screen_viewed", { screen_name: "feed" });
```

---

## Theme Tokens Quick Reference

### Colors
```
theme.colors.bgRoot          # Main background
theme.colors.bgElev1         # Cards, elevated surfaces
theme.colors.bgElev2         # Modals
theme.colors.textPrimary     # Main text
theme.colors.textSecondary   # Subdued text
theme.colors.textTertiary    # Disabled/placeholder
theme.colors.accent          # Brand/action color
theme.colors.danger          # Errors
theme.colors.success         # Success states
theme.colors.borderSubtle    # Subtle borders
```

### Spacing
```
theme.spacing.xs   # 4px
theme.spacing.sm   # 8px
theme.spacing.md   # 16px
theme.spacing.lg   # 24px
theme.spacing.xl   # 32px
```

### Typography
```
theme.typography.sizes.display        # 32px
theme.typography.sizes.sectionHeading # 24px
theme.typography.sizes.body           # 15px
theme.typography.sizes.meta           # 13px
theme.typography.weights.semibold     # "600"
theme.typography.weights.bold         # "700"
```

---

## Common Commands

```bash
# Development
npm start                    # Start Expo
npm run ios                  # iOS simulator
npm run android              # Android emulator

# Cloud Functions
cd functions && npm run deploy      # Deploy all functions
firebase deploy --only functions:onMessageCreated  # Deploy single function

# Build
eas build --platform ios --profile preview    # TestFlight build
eas build --platform android --profile preview

# Firestore
firebase deploy --only firestore:rules
```

---

## Important Files

| File | Purpose |
|------|---------|
| `src/services/feedService.ts` | Reference for service patterns |
| `src/hooks/useThemedStyles.ts` | Styling hook |
| `src/components/feed/CommentInput.tsx` | Input component pattern |
| `src/hooks/useComments.ts` | Hook with pagination pattern |
| `functions/notifications.js` | Cloud Function trigger pattern |
| `firestore.rules` | Security rules |

---

## Copilot Skills Reference

Detailed patterns are documented in `.github/copilot-skills/`:

| Skill | Use For |
|-------|---------|
| `react-native-component.md` | Component structure, FlashList, expo-image |
| `theming-and-styling.md` | Complete theme token reference |
| `firebase-firestore.md` | Services, rules, Cloud Functions |
| `error-handling.md` | Error hooks and UI patterns |
| `analytics-posthog.md` | Event tracking conventions |

---

## DO's and DON'Ts

### DO
- Use `useThemedStyles` for all component styles
- Use theme tokens for colors, spacing, typography
- Return `Unsubscribe` from subscription services
- Use v2 Cloud Functions syntax
- Use transactions for multi-document updates
- Check both `customers` and `profiles` for user data
- Use FlashList for long lists
- Use expo-image for images
- Use snake_case for analytics events

### DON'T
- Hardcode colors (`#fff`, `"black"`)
- Hardcode spacing (`padding: 16`)
- Use `StyleSheet.create` without theme
- Use v1 Cloud Functions syntax
- Forget to unsubscribe from listeners
- Use `FlatList` for large datasets
- Use React Native `Image` (use expo-image)
- Use `any` types
- Track sensitive data in analytics

---

## Current Work

Check `docs/` for active specifications:
- `CHAT-IMPLEMENTATION-SPEC.md` - Event chat + DM feature

---

*Last updated: January 2026*
