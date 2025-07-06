# PostHog Analytics Setup Guide

## Overview

PostHog analytics has been successfully integrated into the React Native app with robust error handling, offline event queuing, and Expo Go compatibility. This guide explains how to complete the setup with your actual PostHog credentials.

## Phase 1: Installation and Basic Setup ✅ COMPLETED

### Dependencies Installed

- `posthog-react-native`: ^4.1.4
- `expo-application`: ~6.1.5
- `expo-device`: ~7.1.4
- `expo-file-system`: ~18.1.11
- `expo-localization`: ~16.1.6
- `@react-native-community/netinfo`: ^11.4.1
- `@react-native-async-storage/async-storage`: 2.1.2

### Features Implemented

- ✅ PostHog provider with enhanced functionality
- ✅ Offline event queuing with AsyncStorage
- ✅ Device context automatic collection
- ✅ Network state monitoring
- ✅ Type-safe analytics interface
- ✅ Error boundaries and robust error handling
- ✅ Integration with app layout and auth flow

## Configuration

### 1. Get Your PostHog API Keys

1. Sign up for PostHog at [https://posthog.com](https://posthog.com)
2. Create a new project
3. Get your project API key from the Settings page

### 2. Update API Keys

Edit `/src/analytics/PostHogProvider.tsx` and replace the placeholder API keys:

```typescript
const config: PostHogConfig = {
  apiKey: isDevelopment
    ? "phc_YOUR_DEVELOPMENT_KEY_HERE" // Replace with your development key
    : "phc_YOUR_PRODUCTION_KEY_HERE", // Replace with your production key
  host: "https://us.i.posthog.com", // or 'https://eu.i.posthog.com' for EU
  enableDebug: isDevelopment,
  captureAppLifecycleEvents: true,
  captureScreenViews: false, // Manual screen tracking for better control
  enableSessionRecording: !isDevelopment, // Only in production
};
```

### 3. Environment-Based Configuration (Recommended)

For better security, use environment variables:

1. Create a `.env` file (not committed to git):

```bash
EXPO_PUBLIC_POSTHOG_API_KEY_DEV=phc_your_dev_key_here
EXPO_PUBLIC_POSTHOG_API_KEY_PROD=phc_your_prod_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

2. Update the config function:

```typescript
const config: PostHogConfig = {
  apiKey: isDevelopment
    ? process.env.EXPO_PUBLIC_POSTHOG_API_KEY_DEV!
    : process.env.EXPO_PUBLIC_POSTHOG_API_KEY_PROD!,
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  // ... rest of config
};
```

## Usage Examples

### Basic Event Tracking

```typescript
import { usePostHog } from "../analytics/PostHogProvider";

function MyComponent() {
  const { track } = usePostHog();

  const handleButtonPress = async () => {
    await track("button_clicked", {
      button_name: "submit",
      screen: "checkout",
    });
  };
}
```

### Screen Tracking

```typescript
import { useScreenTracking } from "../analytics/PostHogProvider";

function MyScreen() {
  // Automatically tracks screen view
  useScreenTracking("Product Details", {
    product_id: "123",
    category: "electronics",
  });

  return <View>...</View>;
}
```

### User Identification

```typescript
const { identify } = usePostHog();

// When user logs in
await identify(user.id, {
  email: user.email,
  plan: "premium",
  signup_date: user.createdAt,
});
```

## Current Implementation Status

### ✅ Completed Features

- PostHog provider with offline support
- Authentication flow tracking
- Screen view tracking
- Error handling and validation
- Type-safe interfaces
- Network state monitoring
- Device context collection

### 🔄 Integration Points

- Login/logout events tracked in AuthContext
- Screen tracking in login screen
- User identification on authentication

### 📋 Next Steps (Phase 2)

1. Add API keys from your PostHog project
2. Test analytics in development
3. Add tracking to key user actions:
   - Product views
   - Cart operations
   - Purchase events
   - Error events
4. Set up custom properties for better segmentation

## Testing

### Development Testing

1. Update API keys
2. Run the app in development
3. Check the console for PostHog debug messages
4. Verify events appear in your PostHog dashboard

### Debugging

- Set `enableDebug: true` in development
- Check network connectivity for offline events
- Monitor console logs for PostHog operations

## Best Practices

1. **Event Naming**: Use consistent `object_verb` format (e.g., `product_viewed`, `cart_item_added`)
2. **Properties**: Keep properties consistent and meaningful
3. **User Privacy**: Respect user opt-out preferences
4. **Performance**: Use the offline queue for non-critical events
5. **Testing**: Always test analytics in development before production

## Security Notes

- API keys are exposed in the client (this is normal for PostHog)
- Use different keys for development and production
- Consider using PostHog's proxy feature for additional security
- Never include sensitive user data in event properties

## Support

- PostHog Documentation: [https://posthog.com/docs/libraries/react-native](https://posthog.com/docs/libraries/react-native)
- Expo Documentation: [https://docs.expo.dev](https://docs.expo.dev)
- For issues, check the console logs and PostHog debug output
