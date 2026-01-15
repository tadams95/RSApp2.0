# Error Handling Skill

> **Purpose:** Unified error handling patterns across RAGESTATE for consistent UX  
> **Applies to:** All components with async operations, API calls, and user interactions  
> **Last Updated:** January 14, 2026

---

## Core Principles

1. **Graceful degradation** - App should never crash, always show helpful feedback
2. **Consistent UX** - Use established error UI patterns (notices, boundaries, messages)
3. **Type-safe errors** - Convert all errors to proper Error objects
4. **Centralized handling** - Use shared hooks and utilities
5. **User-friendly messages** - Transform technical errors into readable text

---

## Error Handling Architecture

```
Hooks:
├── useErrorHandler.tsx           # Base error handler
├── useLoginErrorHandler.tsx      # Login-specific errors
├── useSignupErrorHandler.tsx     # Signup-specific errors
└── useProfileUpdateErrorHandler.tsx  # Profile update errors

Components:
├── ErrorBoundary.tsx             # Catches React errors
├── ErrorUI.tsx                   # Generic error display
├── LoginErrorNotice.tsx          # Login error notices
├── SignupErrorNotice.tsx         # Signup error notices
└── ProfileUpdateErrorNotice.tsx  # Profile error notices

Utilities:
└── src/utils/errorMessages.ts    # Error message mapping (if exists)
```

---

## Base Error Handler Hook

### useErrorHandler Pattern

```tsx
import { useErrorHandler } from "@/hooks/useErrorHandler";

function MyComponent() {
  const { error, setError, clearError, getErrorMessage, handleApiError } =
    useErrorHandler();

  const fetchData = async () => {
    // Method 1: Try-catch pattern
    try {
      const data = await someAsyncOperation();
      // Success handling
    } catch (err) {
      setError(err); // Converts to Error object automatically
    }
  };

  const saveData = async () => {
    // Method 2: Tuple pattern (no try-catch needed)
    const [result, error] = await handleApiError(someAsyncOperation());

    if (error) {
      // Handle error
      console.error("Save failed:", getErrorMessage(error));
      return;
    }

    // Success - result is available
    console.log("Saved:", result);
  };

  return (
    <View>
      {error && <Text style={styles.error}>{getErrorMessage(error)}</Text>}
      <Button title="Clear" onPress={clearError} />
    </View>
  );
}
```

### Hook API

```typescript
interface UseErrorHandlerResult {
  error: Error | null; // Current error state
  setError: (err: unknown) => void; // Set error from any type
  clearError: () => void; // Clear error state
  getErrorMessage: (err: unknown) => string; // Extract message
  handleApiError: <T>(promise: Promise<T>) => Promise<[T | null, Error | null]>; // Tuple pattern
}
```

---

## Specialized Error Handlers

### 1. Login Error Handler

```tsx
import { useLoginErrorHandler } from "@/hooks/useLoginErrorHandler";

const LoginScreen = () => {
  const { loginError, setLoginError, clearLoginError } = useLoginErrorHandler();

  const handleLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoginError(error); // Specialized handling for auth errors
    }
  };

  return (
    <View>
      {loginError && (
        <LoginErrorNotice error={loginError} onDismiss={clearLoginError} />
      )}
      {/* Login form */}
    </View>
  );
};
```

**Key features:**

- Translates Firebase auth errors to user-friendly messages
- Specialized error codes (wrong-password, user-not-found, etc.)
- Integration with `LoginErrorNotice` component

### 2. Signup Error Handler

```tsx
import { useSignupErrorHandler } from "@/hooks/useSignupErrorHandler";

const SignupScreen = () => {
  const { signupError, setSignupError, clearSignupError } =
    useSignupErrorHandler();

  const handleSignup = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setSignupError(error); // Handles signup-specific errors
    }
  };

  return (
    <View>
      <SignupErrorNotice error={signupError} onDismiss={clearSignupError} />
      {/* Signup form */}
    </View>
  );
};
```

**Handles:**

- `email-already-in-use`
- `weak-password`
- `invalid-email`
- Network errors

### 3. Profile Update Error Handler

```tsx
import { useProfileUpdateErrorHandler } from "@/hooks/useProfileUpdateErrorHandler";

const EditProfileScreen = () => {
  const { profileError, setProfileError, clearProfileError } =
    useProfileUpdateErrorHandler();

  const handleSave = async (profileData: ProfileData) => {
    try {
      await updateProfile(profileData);
    } catch (error) {
      setProfileError(error);
    }
  };

  return (
    <View>
      <ProfileUpdateErrorNotice
        error={profileError}
        onDismiss={clearProfileError}
      />
      {/* Profile form */}
    </View>
  );
};
```

---

## Error UI Components

### 1. Error Boundary (React Error Catching)

```tsx
import ErrorBoundary from "@/components/ErrorBoundary";

// Wrap error-prone screens/components
function App() {
  return (
    <ErrorBoundary>
      <FeedScreen />
    </ErrorBoundary>
  );
}
```

**What it catches:**

- React rendering errors
- Lifecycle method errors
- Constructor errors
- Event handler errors (if wrapped in boundary)

**What it doesn't catch:**

- Async errors (use hooks for those)
- Event handlers (use try-catch)
- Server-side rendering errors

### 2. Error Notices (User-Facing Alerts)

```tsx
// Pattern from LoginErrorNotice.tsx
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface ErrorNoticeProps {
  error: Error | null;
  onDismiss: () => void;
}

export const ErrorNotice: React.FC<ErrorNoticeProps> = ({
  error,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!error) return null;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="alert-circle"
        size={20}
        color={theme.colors.danger}
      />
      <Text style={styles.message}>{error.message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <MaterialCommunityIcons
          name="close"
          size={20}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.dangerMuted,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  message: {
    flex: 1,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.danger,
    fontWeight: theme.typography.weights.medium,
  },
});
```

---

## Firebase Error Translation

### Common Firebase Auth Errors

```typescript
// Error code mapping (implement in errorMessages.ts)
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use":
    "This email is already registered. Try logging in instead.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many failed attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/operation-not-allowed": "This sign-in method is not enabled.",
};

// Usage in error handler
function getFirebaseErrorMessage(error: any): string {
  if (error?.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return error?.message || "An unexpected error occurred.";
}
```

### Firestore Errors

```typescript
const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  "permission-denied": "You don't have permission to access this resource.",
  "not-found": "The requested resource was not found.",
  "already-exists": "This resource already exists.",
  "resource-exhausted": "Too many requests. Please try again later.",
  "failed-precondition": "Operation cannot be performed in current state.",
  aborted: "Operation was aborted. Please try again.",
  "out-of-range": "Invalid value provided.",
  unimplemented: "This feature is not available yet.",
  internal: "Server error. Please try again.",
  unavailable: "Service temporarily unavailable.",
  "data-loss": "Data may have been lost. Please contact support.",
};
```

---

## Error Handling Patterns

### Pattern 1: Async Operation with Loading State

```tsx
const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { error, setError, clearError } = useErrorHandler();

  const handleSubmit = async () => {
    setIsLoading(true);
    clearError(); // Clear previous errors

    try {
      await performOperation();
      // Success handling
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View>
      {error && <ErrorNotice error={error} onDismiss={clearError} />}
      <Button title="Submit" onPress={handleSubmit} disabled={isLoading} />
      {isLoading && <LoadingOverlay visible={true} />}
    </View>
  );
};
```

### Pattern 2: Form Validation Errors

```tsx
interface ValidationErrors {
  email?: string;
  password?: string;
  username?: string;
}

const FormComponent = () => {
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );

  const validateForm = (data: FormData): boolean => {
    const errors: ValidationErrors = {};

    if (!data.email) {
      errors.email = "Email is required";
    } else if (!isValidEmail(data.email)) {
      errors.email = "Invalid email format";
    }

    if (!data.password || data.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return (
    <View>
      <TextInput placeholder="Email" error={validationErrors.email} />
      {validationErrors.email && (
        <Text style={styles.errorText}>{validationErrors.email}</Text>
      )}
    </View>
  );
};
```

### Pattern 3: Network Error Retry

```tsx
const DataFetchingComponent = () => {
  const [retryCount, setRetryCount] = useState(0);
  const { error, setError, clearError } = useErrorHandler();

  const fetchData = async () => {
    try {
      const data = await apiCall();
      return data;
    } catch (err: any) {
      if (err.code === "network-request-failed" && retryCount < 3) {
        setRetryCount((prev) => prev + 1);
        // Exponential backoff
        setTimeout(() => fetchData(), 1000 * Math.pow(2, retryCount));
      } else {
        setError(err);
      }
    }
  };

  return (
    <View>
      {error && (
        <View>
          <ErrorNotice error={error} onDismiss={clearError} />
          <Button
            title="Retry"
            onPress={() => {
              clearError();
              setRetryCount(0);
              fetchData();
            }}
          />
        </View>
      )}
    </View>
  );
};
```

### Pattern 4: Multiple Error Sources

```tsx
const ComplexComponent = () => {
  const { error: apiError, setError: setApiError } = useErrorHandler();
  const { error: uploadError, setError: setUploadError } = useErrorHandler();

  const hasAnyError = apiError || uploadError;

  return (
    <View>
      {apiError && (
        <ErrorNotice error={apiError} onDismiss={() => setApiError(null)} />
      )}
      {uploadError && (
        <ErrorNotice
          error={uploadError}
          onDismiss={() => setUploadError(null)}
        />
      )}
      {/* Component content */}
    </View>
  );
};
```

---

## Error Logging & Analytics

### Development Logging

```tsx
if (__DEV__) {
  console.error("Error details:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
}
```

### Production Analytics

```tsx
import { posthog } from "@/analytics/PostHogProvider";

const logError = (error: Error, context?: Record<string, any>) => {
  if (__DEV__) {
    console.error(error);
  } else {
    posthog.capture("error_occurred", {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });
  }
};

// Usage
try {
  await riskyOperation();
} catch (error) {
  logError(error, {
    operation: "user_profile_update",
    userId: currentUser.uid,
  });
  setError(error);
}
```

---

## DO's and DON'Ts

### ✅ DO

- Use `useErrorHandler` hook for async operations
- Display user-friendly error messages
- Clear errors when retrying operations
- Wrap screens with `ErrorBoundary`
- Log errors in development mode
- Convert all errors to Error objects
- Show error notices with dismiss option
- Implement loading states during async operations
- Validate forms before submission
- Use specialized handlers for auth, profile, etc.
- Provide retry mechanisms for network errors

### ❌ DON'T

- Let app crash without error boundaries
- Show technical error messages to users
- Forget to clear error state
- Use `any` type for errors
- Ignore errors silently
- Show multiple error notices at once (prioritize)
- Block UI indefinitely on errors
- Assume all errors have `.message`
- Forget finally blocks for cleanup
- Skip error handling for "unlikely" scenarios

---

## Testing Error Scenarios

### Manual Testing Checklist

- [ ] Test with airplane mode (network errors)
- [ ] Test with invalid credentials (auth errors)
- [ ] Test with expired tokens (session errors)
- [ ] Test with missing data (validation errors)
- [ ] Test with rate limits (too many requests)
- [ ] Test error dismissal
- [ ] Test retry functionality
- [ ] Verify error messages are user-friendly
- [ ] Check error boundary catches render errors
- [ ] Test multiple simultaneous errors

### Unit Testing Errors

```typescript
// Example test
import { renderHook, act } from "@testing-library/react-native";
import { useErrorHandler } from "@/hooks/useErrorHandler";

describe("useErrorHandler", () => {
  it("should set and clear errors", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError(new Error("Test error"));
    });

    expect(result.current.error?.message).toBe("Test error");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("should handle API errors as tuple", async () => {
    const { result } = renderHook(() => useErrorHandler());

    const failingPromise = Promise.reject(new Error("API failed"));

    const [data, error] = await result.current.handleApiError(failingPromise);

    expect(data).toBeNull();
    expect(error?.message).toBe("API failed");
  });
});
```

---

## Error Message Style Guide

**✅ Good Error Messages:**

- "Email is required" (clear, actionable)
- "Password must be at least 6 characters" (specific requirement)
- "No account found with this email" (helpful context)
- "Network error. Check your connection and try again." (actionable)

**❌ Bad Error Messages:**

- "Error" (too vague)
- "Something went wrong" (not helpful)
- "Firebase error: auth/invalid-credential" (too technical)
- "ERR_NETWORK_FAILED: 0x8007" (error codes)

---

## Additional Resources

- `src/hooks/useErrorHandler.tsx` - Base error handler implementation
- `src/hooks/useLoginErrorHandler.tsx` - Auth-specific handler
- `src/components/ErrorBoundary.tsx` - React error boundary
- `src/components/LoginErrorNotice.tsx` - Error notice example
- Firebase Auth Errors: https://firebase.google.com/docs/auth/admin/errors
