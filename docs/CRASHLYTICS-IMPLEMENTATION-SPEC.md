# Firebase Crashlytics Implementation Spec

> **Timeline**: 1-2 days | **Priority**: 🟡 High  
> **Dependencies**: Firebase already integrated | **Outcome**: Free production crash reporting  
> **Cost**: 🆓 **FREE** (unlimited crashes, no limits)

---

## Overview

Implement Firebase Crashlytics for crash reporting and error tracking. Since Firebase is already integrated in the project, Crashlytics is the natural choice:

- ✅ **Completely free** — No limits on crash reports
- ✅ **Already have Firebase** — Same dashboard, same project
- ✅ **Real-time crash alerts** — Know immediately when users hit errors
- ✅ **Stack traces** — Debug production errors with context
- ✅ **User context** — See which users are affected
- ✅ **Release tracking** — Correlate errors to specific app versions

---

## Current State Analysis

### Existing Error Handling Infrastructure

| Component              | Location                                                                                              | Current Behavior           |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `ErrorBoundary`        | [src/components/ErrorBoundary.tsx](../src/components/ErrorBoundary.tsx)                               | ✅ Uses `captureException` |
| `AccountErrorBoundary` | [src/components/account/AccountErrorBoundary.tsx](../src/components/account/AccountErrorBoundary.tsx) | ✅ Uses `logError()`       |
| `ShopifyErrorBoundary` | [src/components/shopify/ShopifyErrorBoundary.tsx](../src/components/shopify/ShopifyErrorBoundary.tsx) | ✅ Uses `logError()`       |
| `logError()` utility   | [src/utils/logError.ts](../src/utils/logError.ts)                                                     | ✅ Uses `captureException` |
| `errorReporting.ts`    | [src/services/errorReporting.ts](../src/services/errorReporting.ts)                                   | ✅ Crashlytics service     |

### Error Boundaries Already in Place

```
src/components/
├── ErrorBoundary.tsx              # Global error boundary (wraps app)
├── account/
│   ├── AccountErrorBoundary.tsx   # Account-specific errors
│   ├── EditProfileErrorBoundary.tsx
│   ├── ProfilePictureErrorBoundary.tsx
│   └── ProfileSyncErrorBoundary.tsx
└── shopify/
    └── ShopifyErrorBoundary.tsx   # Shop/cart errors
```

---

## Implementation Status

### ✅ COMPLETE: Core Setup

| Task                                         | Status | Notes                         |
| -------------------------------------------- | ------ | ----------------------------- |
| Install `@react-native-firebase/crashlytics` | ✅     | Installed via expo            |
| Create `src/services/errorReporting.ts`      | ✅     | Crashlytics wrapper           |
| Initialize Crashlytics in `_layout.tsx`      | ✅     | `initializeErrorReporting()`  |
| Update `ErrorBoundary.tsx` with capture      | ✅     | `captureException()`          |
| Update `logError.ts` to use Crashlytics      | ✅     | All 20+ call sites now report |

### ⏳ OPTIONAL: Enhanced Integration

| Task                                      | Status | Notes                        |
| ----------------------------------------- | ------ | ---------------------------- |
| Update `AuthContext.tsx` for user context | ⏳     | Associate crashes with users |
| Test crash reporting                      | ⏳     | Trigger test crash           |
| Verify in Firebase Console                | ⏳     | Check Crashlytics dashboard  |

---

## Error Reporting Service

**File**: `src/services/errorReporting.ts`

```typescript
import crashlytics from "@react-native-firebase/crashlytics";

/**
 * Initialize Crashlytics error reporting
 */
export function initializeErrorReporting(): void {
  crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
}

/**
 * Capture an exception and send to Crashlytics
 */
export function captureException(
  error: Error,
  context?: Record<string, any>,
): void {
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      crashlytics().setAttribute(key, String(value));
    });
  }
  crashlytics().recordError(error);
}

/**
 * Log a message (appears in crash reports)
 */
export function captureMessage(message: string): void {
  crashlytics().log(message);
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string | null, email?: string): void {
  if (userId) {
    crashlytics().setUserId(userId);
    if (email) crashlytics().setAttribute("email", email);
  } else {
    crashlytics().setUserId("");
  }
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, any>,
): void {
  const logMessage = category ? `[${category}] ${message}` : message;
  crashlytics().log(logMessage);
}
```

---

## Files Modified

| File                               | Action      | Changes                                    |
| ---------------------------------- | ----------- | ------------------------------------------ |
| `src/services/errorReporting.ts`   | ✅ UPDATED  | Switched from Sentry to Crashlytics        |
| `src/app/_layout.tsx`              | ✅ DONE     | Already calls `initializeErrorReporting()` |
| `src/components/ErrorBoundary.tsx` | ✅ DONE     | Already uses `captureException()`          |
| `src/utils/logError.ts`            | ✅ DONE     | Already uses `captureException()`          |
| `src/hooks/AuthContext.tsx`        | ⏳ OPTIONAL | Add user context on login/logout           |

---

## Optional: Add User Context

To associate crashes with specific users, add to `AuthContext.tsx`:

```typescript
import { setUser as setCrashlyticsUser } from "../services/errorReporting";

// After successful login:
setCrashlyticsUser(user.uid, user.email || undefined);

// After logout:
setCrashlyticsUser(null);
```

---

## Testing Crashlytics

### Force a Test Crash

Add a temporary button to trigger a crash:

```typescript
import crashlytics from "@react-native-firebase/crashlytics";

// Test crash (remove after testing!)
<Button onPress={() => crashlytics().crash()} title="Test Crash" />
```

### Verify in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Crashlytics** in the left sidebar
4. Wait 5-10 minutes after a crash for it to appear

**Note**: Requires a **development build** (Expo Go doesn't support native Firebase modules)

---

## Crashlytics vs Sentry Comparison

| Feature           | Crashlytics              | Sentry             |
| ----------------- | ------------------------ | ------------------ |
| **Price**         | 🆓 FREE                  | $29+/month         |
| **Crash Reports** | Unlimited                | Limited by plan    |
| **Setup**         | Already have Firebase    | New service        |
| **Dashboard**     | Firebase Console         | Separate dashboard |
| **Source Maps**   | Automatic with EAS       | Requires config    |
| **User Context**  | ✅                       | ✅                 |
| **Breadcrumbs**   | ✅ (logs)                | ✅                 |
| **Performance**   | Via Firebase Performance | Built-in           |

---

## Error Categories Tracked

| Category            | Source               | Crashlytics Attribute                |
| ------------------- | -------------------- | ------------------------------------ |
| React Render Errors | ErrorBoundary        | `errorBoundary: GlobalErrorBoundary` |
| Account Errors      | AccountErrorBoundary | `errorBoundary: account`             |
| Shop/Cart Errors    | ShopifyErrorBoundary | `errorBoundary: shopify`             |
| Firebase Errors     | logError()           | `errorCode: <firebase-code>`         |
| Network Errors      | Fetch/API calls      | `context: <operation>`               |

---

## Success Criteria

- [x] Crashlytics package installed
- [x] Error reporting service created
- [x] ErrorBoundary captures exceptions
- [x] logError() sends to Crashlytics
- [ ] Test crash appears in Firebase Console
- [ ] User ID attached to error reports (optional)

---

## Next Steps

1. **Create a development build** to test Crashlytics (Expo Go doesn't support native modules)
2. **Trigger a test crash** to verify the integration
3. **Check Firebase Console** → Crashlytics to see the crash report
4. **Optionally** add user context in AuthContext for better crash attribution
