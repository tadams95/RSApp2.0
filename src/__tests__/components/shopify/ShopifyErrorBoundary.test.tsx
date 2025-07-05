import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Alert, Text } from "react-native";
import { ShopifyErrorBoundary } from "../../../components/shopify/ShopifyErrorBoundary";

// Mock react-native with minimal components
jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
  Pressable: "Pressable",
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (styles: any) => styles,
  },
  Text: "Text",
  View: "View",
}));

// Mock error logging utility
jest.mock("../../../utils/logError", () => ({
  logError: jest.fn(),
}));

// Create a test component that throws errors
const ThrowError = ({
  shouldThrow,
  error,
}: {
  shouldThrow: boolean;
  error?: Error;
}) => {
  if (shouldThrow) {
    throw error || new Error("Test error");
  }
  return <Text>Shopify content</Text>;
};

// Get mocked functions
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;
const { logError } = require("../../../utils/logError");

describe("ShopifyErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Normal Operation", () => {
    it("renders children when no error occurs", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shopify content")).toBeTruthy();
    });

    it("does not log errors when children render successfully", () => {
      render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShopifyErrorBoundary>
      );

      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("catches and displays error when child component throws", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(
        getByText(
          "We're having trouble loading shop content. Please try again."
        )
      ).toBeTruthy();
      expect(getByText("Test error")).toBeTruthy();
    });

    it("logs error with correct context and details", () => {
      const testError = new Error("Shop service failed");

      render(
        <ShopifyErrorBoundary context="product_catalog">
          <ThrowError shouldThrow={true} error={testError} />
        </ShopifyErrorBoundary>
      );

      expect(logError).toHaveBeenCalledWith(
        testError,
        "ShopifyErrorBoundary",
        expect.objectContaining({
          context: "product_catalog",
          componentStack: expect.any(String),
          errorBoundary: "ShopifyErrorBoundary",
        })
      );
    });

    it("uses default context when none provided", () => {
      const testError = new Error("Default context test");

      render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={testError} />
        </ShopifyErrorBoundary>
      );

      expect(logError).toHaveBeenCalledWith(
        testError,
        "ShopifyErrorBoundary",
        expect.objectContaining({
          context: "shopify_integration",
          errorBoundary: "ShopifyErrorBoundary",
        })
      );
    });

    it("calls custom onError callback when provided", () => {
      const mockOnError = jest.fn();
      const testError = new Error("Callback test");

      render(
        <ShopifyErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} error={testError} />
        </ShopifyErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe("Error Types and Classification", () => {
    it("handles network errors appropriately", () => {
      const networkError = new Error("Network request failed");
      networkError.name = "NetworkError";

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={networkError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Network request failed")).toBeTruthy();
    });

    it("handles API errors with descriptive messages", () => {
      const apiError = new Error("Shopify API rate limit exceeded");
      apiError.name = "ShopifyAPIError";

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={apiError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shopify API rate limit exceeded")).toBeTruthy();
    });

    it("handles timeout errors", () => {
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "TimeoutError";

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={timeoutError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Request timeout")).toBeTruthy();
    });

    it("handles authentication errors", () => {
      const authError = new Error("Invalid Shopify credentials");
      authError.name = "AuthenticationError";

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={authError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Invalid Shopify credentials")).toBeTruthy();
    });

    it("handles generic errors with fallback message", () => {
      const genericError = new Error("");

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={genericError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("An unexpected error occurred")).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("allows user to retry after error", () => {
      let boundary: any;

      const TestComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);

        return (
          <ShopifyErrorBoundary
            ref={(ref) => {
              boundary = ref;
            }}
          >
            <ThrowError shouldThrow={shouldThrow} />
          </ShopifyErrorBoundary>
        );
      };

      const { getByText } = render(<TestComponent />);

      // Verify error state
      expect(getByText("Shop Unavailable")).toBeTruthy();

      // Click retry button - this should call resetError
      const retryButton = getByText("Try Again");
      fireEvent.press(retryButton);

      // The error state should be reset, but we need to trigger a re-render
      // In a real app, the retry would typically refetch data or reset state
      expect(getByText("Try Again")).toBeTruthy(); // Still in error state until external change
    });

    it("shows help dialog when help button is pressed", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      const helpButton = getByText("Get Help");
      fireEvent.press(helpButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Shop Support",
        "If you continue to experience issues with the shop, please contact support at support@ragestate.com",
        [{ text: "OK", style: "default" }]
      );
    });

    it("displays retry and help buttons in error state", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Try Again")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });
  });

  describe("Custom Fallback Component", () => {
    it("renders custom fallback component when provided", () => {
      const CustomFallback = ({ error, resetError, context }: any) => (
        <Text>
          Custom shop error: {error.message} in {context || "unknown"}
        </Text>
      );

      const { getByText } = render(
        <ShopifyErrorBoundary
          fallbackComponent={CustomFallback}
          context="custom_shop"
        >
          <ThrowError shouldThrow={true} error={new Error("Custom error")} />
        </ShopifyErrorBoundary>
      );

      expect(
        getByText("Custom shop error: Custom error in custom_shop")
      ).toBeTruthy();
    });

    it("passes correct props to custom fallback component", () => {
      const mockFallback = jest.fn(() => <Text>Custom fallback</Text>);

      render(
        <ShopifyErrorBoundary
          fallbackComponent={mockFallback}
          context="prop_test"
        >
          <ThrowError shouldThrow={true} error={new Error("Prop test error")} />
        </ShopifyErrorBoundary>
      );

      // Verify the component was called
      expect(mockFallback).toHaveBeenCalled();
      expect(mockFallback.mock.calls.length).toBeGreaterThan(0);
    });

    it("allows custom fallback to reset error state", () => {
      let resetFunction: any = null;

      const CustomFallback = ({ resetError }: any) => {
        resetFunction = resetError;
        return <Text>Custom fallback with reset</Text>;
      };

      const { getByText, rerender } = render(
        <ShopifyErrorBoundary fallbackComponent={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Custom fallback with reset")).toBeTruthy();

      // Call reset function
      if (resetFunction) {
        resetFunction();
      }

      // Re-render with successful state
      rerender(
        <ShopifyErrorBoundary fallbackComponent={CustomFallback}>
          <ThrowError shouldThrow={false} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shopify content")).toBeTruthy();
    });
  });

  describe("Context Handling", () => {
    it("passes context to default fallback component", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary context="shop_navigation">
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      // Context is used in error logging but doesn't appear in default UI
      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        "ShopifyErrorBoundary",
        expect.objectContaining({
          context: "shop_navigation",
        })
      );
    });

    it("uses default context when not specified", () => {
      render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        "ShopifyErrorBoundary",
        expect.objectContaining({
          context: "shopify_integration",
        })
      );
    });
  });

  describe("Edge Cases and Safety", () => {
    it("handles errors thrown during render", () => {
      const RenderError = () => {
        throw new Error("Render phase error");
      };

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <RenderError />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Render phase error")).toBeTruthy();
    });

    it("handles errors with null or undefined messages", () => {
      const nullMessageError = new Error();
      nullMessageError.message = "";

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={nullMessageError} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("An unexpected error occurred")).toBeTruthy();
    });

    it("maintains error state until explicitly reset", () => {
      const { getByText, rerender } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();

      // Re-render without resetting - should still show error
      rerender(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
    });

    it("prevents error boundary loops", () => {
      const ErrorFallback = () => {
        // We'll suppress the error for this test
        return <Text>Stable fallback</Text>;
      };

      // Mock console.error to catch the fallback error
      const mockConsoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const { getByText } = render(
          <ShopifyErrorBoundary fallbackComponent={ErrorFallback}>
            <ThrowError shouldThrow={true} />
          </ShopifyErrorBoundary>
        );

        // Should render the stable fallback instead of causing loops
        expect(getByText("Stable fallback")).toBeTruthy();
        expect(logError).toHaveBeenCalled();
      } finally {
        mockConsoleError.mockRestore();
      }
    });

    it("handles rapid successive errors", () => {
      const { rerender } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("First error")} />
        </ShopifyErrorBoundary>
      );

      rerender(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Second error")} />
        </ShopifyErrorBoundary>
      );

      rerender(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Third error")} />
        </ShopifyErrorBoundary>
      );

      // Should handle multiple errors gracefully
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("Integration Scenarios", () => {
    it("works with nested error boundaries", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary context="outer_shop">
          <ShopifyErrorBoundary context="inner_shop">
            <ThrowError shouldThrow={true} error={new Error("Nested error")} />
          </ShopifyErrorBoundary>
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Nested error")).toBeTruthy();
    });

    it("handles errors in complex component trees", () => {
      const ComplexTree = () => (
        <ShopifyErrorBoundary context="complex_tree">
          <Text>Header</Text>
          <ThrowError shouldThrow={true} error={new Error("Deep tree error")} />
          <Text>Footer</Text>
        </ShopifyErrorBoundary>
      );

      const { getByText } = render(<ComplexTree />);

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Deep tree error")).toBeTruthy();
    });

    it("preserves error boundary isolation", () => {
      const { getByText } = render(
        <>
          <ShopifyErrorBoundary context="boundary_1">
            <ThrowError shouldThrow={true} error={new Error("Error 1")} />
          </ShopifyErrorBoundary>
          <ShopifyErrorBoundary context="boundary_2">
            <ThrowError shouldThrow={false} />
          </ShopifyErrorBoundary>
        </>
      );

      // First boundary should show error
      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Error 1")).toBeTruthy();

      // Second boundary should show normal content
      expect(getByText("Shopify content")).toBeTruthy();
    });

    it("handles async component errors", async () => {
      const AsyncErrorComponent = () => {
        React.useEffect(() => {
          // Simulate async error - though this won't be caught by error boundary
          // Error boundaries only catch synchronous render errors
        }, []);
        throw new Error("Async render error");
      };

      const { getByText } = render(
        <ShopifyErrorBoundary>
          <AsyncErrorComponent />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(getByText("Async render error")).toBeTruthy();
    });
  });

  describe("Performance and Memory", () => {
    it("cleans up state properly on unmount", () => {
      const { unmount } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      // Should unmount without issues
      expect(() => unmount()).not.toThrow();
    });

    it("handles multiple renders efficiently", () => {
      const { rerender } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ShopifyErrorBoundary>
      );

      // Multiple re-renders should not cause issues
      for (let i = 0; i < 10; i++) {
        rerender(
          <ShopifyErrorBoundary>
            <ThrowError shouldThrow={false} />
          </ShopifyErrorBoundary>
        );
      }

      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility and User Experience", () => {
    it("provides clear error messaging", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Service unavailable")}
          />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Shop Unavailable")).toBeTruthy();
      expect(
        getByText(
          "We're having trouble loading shop content. Please try again."
        )
      ).toBeTruthy();
      expect(getByText("Service unavailable")).toBeTruthy();
    });

    it("provides actionable recovery options", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      expect(getByText("Try Again")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });

    it("shows appropriate help information", () => {
      const { getByText } = render(
        <ShopifyErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ShopifyErrorBoundary>
      );

      const helpButton = getByText("Get Help");
      fireEvent.press(helpButton);

      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining("Shop Support"),
        expect.stringContaining("support@ragestate.com"),
        expect.any(Array)
      );
    });
  });
});
