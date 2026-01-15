# Analytics & PostHog Skill

> **Purpose:** Consistent event tracking and analytics implementation across RAGESTATE  
> **Applies to:** All user interactions, feature usage, and key business metrics  
> **Last Updated:** January 14, 2026

---

## Core Principles

1. **Track meaningful interactions** - Focus on user behavior, not technical events
2. **Consistent naming** - Use snake_case for event names and properties
3. **Privacy first** - Never track sensitive data (passwords, emails, PII)
4. **Type-safe events** - Use TypeScript for event names and properties
5. **Contextual data** - Include relevant context with each event

---

## PostHog Architecture

```
Setup:
├── src/analytics/PostHogProvider.tsx    # PostHog initialization & provider
├── src/analytics/analyticsHooks.ts      # Typed hooks for tracking
└── docs/posthog-setup.md                # Setup documentation

Usage Pattern:
1. Wrap app with PostHogProvider
2. Use hooks (usePostHog, useAnalyticsTracker) in components
3. Fire events on user interactions
4. Identify users on auth
```

---

## PostHog Setup

### 1. Provider Initialization

```tsx
// App.tsx or _layout.tsx
import { PostHogProvider } from "@/analytics/PostHogProvider";

function App() {
  return <PostHogProvider>{/* Your app */}</PostHogProvider>;
}
```

The provider handles:

- PostHog SDK initialization
- Auto-capture configuration
- Session persistence
- User identification

### 2. Environment Configuration

```typescript
// In PostHogProvider.tsx
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = "https://us.i.posthog.com"; // or your instance

posthog.init(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
  enableSessionReplay: false, // Set true for session replay
  captureNativeAppLifecycleEvents: true,
  captureDeepLinks: true,
});
```

---

## Event Tracking Patterns

### 1. Basic Event Tracking

```tsx
import { usePostHog } from "@/analytics/PostHogProvider";

const MyComponent = () => {
  const posthog = usePostHog();

  const handleButtonClick = () => {
    posthog.capture("button_clicked", {
      button_name: "submit_post",
      screen: "create_post",
    });
  };

  return <Button onPress={handleButtonClick} title="Post" />;
};
```

### 2. Using Analytics Hooks

```tsx
import { useAnalyticsTracker } from "@/analytics/analyticsHooks";

const ProfileScreen = () => {
  const { trackEvent, trackScreenView } = useAnalyticsTracker();

  // Track screen view on mount
  useEffect(() => {
    trackScreenView("profile_screen");
  }, []);

  const handleEditProfile = () => {
    trackEvent("edit_profile_clicked", {
      user_id: currentUser.uid,
      has_bio: !!currentUser.bio,
    });
  };

  return <View>{/* Profile UI */}</View>;
};
```

---

## Event Naming Convention

### Format: `object_action` or `action_context`

✅ **CORRECT:**

```typescript
// Social interactions
posthog.capture("post_liked", { post_id, author_id });
posthog.capture("post_created", { has_media, content_length });
posthog.capture("comment_added", { post_id, comment_length });
posthog.capture("user_followed", { target_user_id });
posthog.capture("message_sent", { recipient_id, has_media });

// Navigation
posthog.capture("screen_viewed", { screen_name: "feed" });
posthog.capture("tab_switched", { tab: "notifications" });

// Feature usage
posthog.capture("search_performed", { query_length, results_count });
posthog.capture("filter_applied", { filter_type: "following_only" });
posthog.capture("theme_changed", { theme: "dark" });

// Errors
posthog.capture("error_occurred", {
  error_type: "network_failure",
  screen: "feed",
});
```

❌ **WRONG:**

```typescript
// Inconsistent naming
posthog.capture("PostLiked"); // Use snake_case
posthog.capture("like"); // Too vague
posthog.capture("user_clicked_the_like_button"); // Too verbose
posthog.capture("ERROR"); // All caps
```

---

## Event Categories

### 1. User Authentication

```typescript
// Signup
posthog.capture("signup_started", {
  method: "email" | "google",
});

posthog.capture("signup_completed", {
  method: "email" | "google",
  user_id: uid,
});

// Login
posthog.capture("login_started", {
  method: "email" | "google",
});

posthog.capture("login_completed", {
  method: "email" | "google",
  user_id: uid,
});

// Logout
posthog.capture("logout_clicked");
```

### 2. Social Interactions

```typescript
// Posts
posthog.capture("post_created", {
  post_id: string,
  has_media: boolean,
  media_count: number,
  content_length: number,
});

posthog.capture("post_viewed", {
  post_id: string,
  author_id: string,
});

posthog.capture("post_liked", {
  post_id: string,
  author_id: string,
});

posthog.capture("post_unliked", {
  post_id: string,
});

posthog.capture("post_shared", {
  post_id: string,
  share_method: "link" | "native",
});

// Comments
posthog.capture("comment_added", {
  post_id: string,
  comment_id: string,
  comment_length: number,
});

// Reposts
posthog.capture("post_reposted", {
  post_id: string,
  is_quote_repost: boolean,
});

// Follows
posthog.capture("user_followed", {
  target_user_id: string,
});

posthog.capture("user_unfollowed", {
  target_user_id: string,
});
```

### 3. Profile & Settings

```typescript
posthog.capture("profile_viewed", {
  profile_user_id: string,
  is_own_profile: boolean,
});

posthog.capture("profile_updated", {
  fields_changed: string[], // ["bio", "profile_picture"]
});

posthog.capture("settings_changed", {
  setting: string,
  new_value: any, // Don't include sensitive data
});

posthog.capture("notification_settings_updated", {
  likes_enabled: boolean,
  comments_enabled: boolean,
  follows_enabled: boolean,
});
```

### 4. Navigation & Screens

```typescript
posthog.capture("screen_viewed", {
  screen_name: string,
  previous_screen: string,
});

posthog.capture("tab_switched", {
  tab: "feed" | "explore" | "notifications" | "profile",
  previous_tab: string,
});

posthog.capture("deep_link_opened", {
  url: string,
  source: "notification" | "share" | "other",
});
```

### 5. Media & Content

```typescript
posthog.capture("media_uploaded", {
  media_type: "image" | "video",
  file_size: number,
  source: "camera" | "library",
});

posthog.capture("media_compressed", {
  original_size: number,
  compressed_size: number,
  compression_ratio: number,
});

posthog.capture("video_played", {
  post_id: string,
  duration: number,
});

posthog.capture("music_player_opened", {
  song_url: string,
  source: "profile" | "post",
});
```

### 6. Search & Discovery

```typescript
posthog.capture("search_performed", {
  query: string, // Consider privacy - maybe just query_length
  query_length: number,
  results_count: number,
  search_type: "users" | "posts",
});

posthog.capture("search_result_clicked", {
  result_type: "user" | "post",
  result_position: number,
});

posthog.capture("hashtag_clicked", {
  hashtag: string,
});
```

### 7. Notifications

```typescript
posthog.capture("notification_received", {
  notification_type: string,
  is_background: boolean,
});

posthog.capture("notification_opened", {
  notification_type: string,
  notification_id: string,
});

posthog.capture("push_permission_requested");

posthog.capture("push_permission_granted", {
  granted: boolean,
});
```

### 8. E-commerce (if applicable)

```typescript
posthog.capture("product_viewed", {
  product_id: string,
  product_name: string,
  price: number,
});

posthog.capture("add_to_cart", {
  product_id: string,
  quantity: number,
});

posthog.capture("checkout_started", {
  cart_value: number,
  item_count: number,
});

posthog.capture("purchase_completed", {
  transaction_id: string,
  revenue: number,
  items: number,
});
```

---

## User Identification

### On Login/Signup

```tsx
import { usePostHog } from "@/analytics/PostHogProvider";

const AuthScreen = () => {
  const posthog = usePostHog();

  const handleSuccessfulLogin = async (user: User) => {
    // Identify user
    posthog.identify(user.uid, {
      email: user.email,
      display_name: user.displayName,
      username: user.usernameLower,
      is_verified: user.isVerified || false,
      created_at: user.createdAt,
    });

    // Track login event
    posthog.capture("login_completed", {
      method: "email",
    });
  };
};
```

### User Properties

```tsx
// Set user properties at any time
posthog.setPersonProperties({
  plan: "premium",
  follower_count: 150,
  following_count: 200,
  post_count: 45,
  account_age_days: 30,
});

// Increment numeric properties
posthog.setPersonProperties({
  post_count: "$increment",
});
```

### On Logout

```tsx
const handleLogout = async () => {
  posthog.capture("logout_clicked");
  posthog.reset(); // Clear user identity
  await signOut(auth);
};
```

---

## Feature Flags

### Check Feature Flag

```tsx
import { usePostHog } from "@/analytics/PostHogProvider";

const MyComponent = () => {
  const posthog = usePostHog();

  const showNewFeature = posthog.isFeatureEnabled("new_feed_algorithm");

  return <View>{showNewFeature ? <NewFeedUI /> : <OldFeedUI />}</View>;
};
```

### Feature Flag with Payload

```tsx
const featureConfig = posthog.getFeatureFlag("feed_pagination_size");
const pageSize = featureConfig?.payload?.size || 20;
```

---

## Real-World Examples

### Example 1: Post Creation Flow

```tsx
const CreatePostScreen = () => {
  const posthog = usePostHog();

  const handleCreatePost = async (content: string, mediaUrls: string[]) => {
    // Track start
    posthog.capture("post_creation_started", {
      has_media: mediaUrls.length > 0,
      media_count: mediaUrls.length,
    });

    try {
      const postId = await createPost(content, mediaUrls);

      // Track success
      posthog.capture("post_created", {
        post_id: postId,
        content_length: content.length,
        has_media: mediaUrls.length > 0,
        media_count: mediaUrls.length,
      });

      // Navigate
      router.push("/feed");
    } catch (error) {
      // Track error
      posthog.capture("post_creation_failed", {
        error_message: error.message,
        had_media: mediaUrls.length > 0,
      });
    }
  };
};
```

### Example 2: Like Button Interaction

```tsx
const LikeButton = ({ post, isLiked, onLike }: LikeButtonProps) => {
  const posthog = usePostHog();

  const handlePress = async () => {
    const action = isLiked ? "unliked" : "liked";

    posthog.capture(`post_${action}`, {
      post_id: post.id,
      author_id: post.userId,
      post_age_hours: getHoursSincePost(post.timestamp),
    });

    await onLike(post.id);
  };

  return (
    <TouchableOpacity onPress={handlePress}>{/* Icon */}</TouchableOpacity>
  );
};
```

### Example 3: Screen Tracking with Navigation

```tsx
// In _layout.tsx or navigation setup
import { useSegments, usePathname } from "expo-router";

function useAnalyticsScreenTracking() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    if (pathname) {
      posthog.capture("screen_viewed", {
        screen_name: pathname,
        segments: segments.join("/"),
      });
    }
  }, [pathname]);
}
```

### Example 4: Social Link Tracking

```tsx
// From ProfileHeader example
const SocialLinksRow = ({ links }: SocialLinksRowProps) => {
  const posthog = usePostHog();

  const handleLinkPress = (platform: string, url: string) => {
    posthog.capture("social_link_tapped", {
      platform,
      profile_user_id: userId,
    });

    Linking.openURL(url);
  };

  return (
    <View>
      {links.twitter && (
        <TouchableOpacity
          onPress={() => handleLinkPress("twitter", links.twitter)}
        >
          <MaterialCommunityIcons name="twitter" />
        </TouchableOpacity>
      )}
    </View>
  );
};
```

---

## Analytics Hooks Reference

### useAnalyticsTracker

```tsx
interface AnalyticsTracker {
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackScreenView: (
    screenName: string,
    properties?: Record<string, any>
  ) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
}

// Usage
const { trackEvent, trackScreenView, trackError } = useAnalyticsTracker();

trackEvent("button_clicked", { button_id: "submit" });
trackScreenView("feed");
trackError(new Error("Failed to load"), { screen: "profile" });
```

---

## Privacy Considerations

### ✅ DO Track

- User actions (likes, follows, posts)
- Feature usage
- Navigation patterns
- Performance metrics
- Error occurrences
- App configuration (theme, language)
- Aggregate statistics

### ❌ DON'T Track

- Passwords or credentials
- Email addresses in properties (use in `identify` only)
- Private messages content
- Personal identifiable information (PII)
- Credit card numbers
- Health information
- Precise location without consent

### Sanitize Sensitive Data

```tsx
// Good - track query length, not content
posthog.capture("search_performed", {
  query_length: query.length,
  results_count: results.length,
});

// Avoid - don't track full query if it could contain PII
posthog.capture("search_performed", {
  query: query, // Could contain names, emails, etc.
});
```

---

## DO's and DON'Ts

### ✅ DO

- Use snake_case for all event names
- Include relevant context with events
- Track both success and failure states
- Identify users on login
- Reset PostHog on logout
- Use TypeScript for type safety
- Document custom events
- Track screen views automatically
- Use feature flags for A/B testing
- Test events in development mode

### ❌ DON'T

- Track sensitive user data (passwords, PII)
- Use inconsistent naming (camelCase, PascalCase)
- Over-track (thousands of events per session)
- Include personally identifiable information
- Forget to call `posthog.reset()` on logout
- Use magic strings (create constants)
- Track in tight loops (can impact performance)
- Ignore privacy regulations (GDPR, CCPA)
- Track before user consent (if required)

---

## Testing Analytics

### Development Mode

```tsx
// Enable debug logging
if (__DEV__) {
  posthog.debug(true);
}

// Check if events are firing
posthog.capture("test_event", { test: true });
console.log("Event captured");
```

### Verify in PostHog Dashboard

1. Go to PostHog dashboard → Live Events
2. Perform action in app
3. Verify event appears with correct properties
4. Check user identification worked
5. Verify feature flags are working

---

## Performance Tips

1. **Batch events** - PostHog automatically batches, but avoid loops
2. **Async tracking** - Events don't block UI
3. **Sample high-volume events** - For very frequent events, sample a percentage
4. **Debounce rapid events** - Don't track every keystroke

```tsx
// Debounce example
const debouncedTrack = debounce((query: string) => {
  posthog.capture("search_typed", { query_length: query.length });
}, 500);
```

---

## Additional Resources

- `src/analytics/PostHogProvider.tsx` - Provider implementation
- `src/analytics/analyticsHooks.ts` - Custom hooks
- `docs/posthog-setup.md` - Setup guide
- PostHog Docs: https://posthog.com/docs
- PostHog React Native: https://posthog.com/docs/libraries/react-native
