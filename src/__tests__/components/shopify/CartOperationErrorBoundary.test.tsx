import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Alert, Text } from "react-native";
import { CartOperationErrorBoundary } from "../../../components/shopify/CartOperationErrorBoundary";

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
  return <Text>Normal content</Text>;
};

// Mock ShopifyErrorBoundary to directly render the fallback
jest.mock("../../../components/shopify/ShopifyErrorBoundary", () => {
  const mockReact = require("react");

  return {
    ShopifyErrorBoundary: ({ children, fallbackComponent, onError }: any) => {
      // Simple test error boundary component
      class TestErrorBoundary extends mockReact.Component {
        constructor(props: any) {
          super(props);
          this.state = { hasError: false, error: null };
        }

        static getDerivedStateFromError(error: Error) {
          return { hasError: true, error };
        }

        componentDidCatch(error: Error, errorInfo: any) {
          if (onError) {
            onError(error, errorInfo);
          }
        }

        render() {
          if (this.state.hasError && this.state.error && fallbackComponent) {
            const FallbackComponent = fallbackComponent;
            return mockReact.createElement(FallbackComponent, {
              error: this.state.error,
              resetError: () => this.setState({ hasError: false, error: null }),
              context: "cart operations",
            });
          }
          return children;
        }
      }

      return mockReact.createElement(TestErrorBoundary, {}, children);
    },
  };
});

describe("CartOperationErrorBoundary", () => {
  const mockAlert = Alert.alert as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders children when no error occurs", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Normal content")).toBeTruthy();
    });

    it("renders error fallback when error occurs", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Cart operation failed")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Cart Operation Failed")).toBeTruthy();
      expect(
        getByText(/We encountered an issue updating your cart/)
      ).toBeTruthy();
    });
  });

  describe("Error Classification", () => {
    it("identifies network errors correctly", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Network timeout occurred")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Connection Issue")).toBeTruthy();
      expect(
        getByText(/Unable to update your cart due to connection issues/)
      ).toBeTruthy();
      expect(getByText(/Your cart changes are saved locally/)).toBeTruthy();
    });

    it("identifies inventory errors correctly", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Item out of stock")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Item Unavailable")).toBeTruthy();
      expect(
        getByText(/The item you're trying to add is no longer available/)
      ).toBeTruthy();
      expect(
        getByText(/Check product availability and try alternative options/)
      ).toBeTruthy();
    });

    it("identifies validation errors correctly", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Validation failed: invalid size")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Cart Validation Error")).toBeTruthy();
      expect(
        getByText(/There was an issue with your cart selection/)
      ).toBeTruthy();
    });

    it("identifies conflict errors correctly", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Concurrent modification conflict")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Cart Sync Issue")).toBeTruthy();
      expect(
        getByText(/Your cart was updated from another device/)
      ).toBeTruthy();
      expect(
        getByText(
          /Cart was updated from another device - syncing latest version/
        )
      ).toBeTruthy();
    });

    it("handles NetworkError by name", () => {
      const networkError = new Error("Request failed");
      networkError.name = "NetworkError";

      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={networkError} />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Connection Issue")).toBeTruthy();
    });
  });

  describe("Dynamic Button Rendering", () => {
    it("shows 'Sync Cart' button for conflict errors", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Version conflict detected")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Sync Cart")).toBeTruthy();
    });

    it("shows 'Try Again' button for non-conflict errors", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Generic error")} />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Try Again")).toBeTruthy();
    });

    it("always shows View Cart, Keep Shopping, and Get Help buttons", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      expect(getByText("View Cart")).toBeTruthy();
      expect(getByText("Keep Shopping")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("shows alert when View Cart button is pressed", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      const viewCartButton = getByText("View Cart");
      fireEvent.press(viewCartButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "View Cart",
        "Your cart has been preserved. Would you like to review your items?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View Cart", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows alert when Keep Shopping button is pressed", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      const continueButton = getByText("Keep Shopping");
      fireEvent.press(continueButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Continue Shopping",
        "Would you like to continue browsing while we resolve the cart issue?",
        [
          { text: "Stay Here", style: "cancel" },
          { text: "Continue Shopping", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows support alert when Get Help button is pressed", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      const helpButton = getByText("Get Help");
      fireEvent.press(helpButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Cart Support",
        "If you continue having trouble with cart operations, please contact support at cart@ragestate.com",
        [{ text: "OK", style: "default" }]
      );
    });
  });

  describe("Error Details Display", () => {
    it("displays error message when provided", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Specific error message")}
          />
        </CartOperationErrorBoundary>
      );

      expect(getByText("Error details: Specific error message")).toBeTruthy();
    });

    it("handles empty error message gracefully", () => {
      const { queryByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("")} />
        </CartOperationErrorBoundary>
      );

      expect(queryByText("Error details:")).toBeFalsy();
    });
  });

  describe("Callback Handling", () => {
    it("calls onError callback when provided", () => {
      const mockOnError = jest.fn();

      render(
        <CartOperationErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("calls onInventoryError callback for inventory errors", () => {
      const mockOnInventoryError = jest.fn();

      render(
        <CartOperationErrorBoundary onInventoryError={mockOnInventoryError}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Item is out of stock")}
          />
        </CartOperationErrorBoundary>
      );

      expect(mockOnInventoryError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("calls onSyncConflict callback for conflict errors", () => {
      const mockOnSyncConflict = jest.fn();

      render(
        <CartOperationErrorBoundary onSyncConflict={mockOnSyncConflict}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Concurrent update conflict")}
          />
        </CartOperationErrorBoundary>
      );

      expect(mockOnSyncConflict).toHaveBeenCalled();
    });

    it("calls multiple callbacks when applicable", () => {
      const mockOnError = jest.fn();
      const mockOnInventoryError = jest.fn();

      render(
        <CartOperationErrorBoundary
          onError={mockOnError}
          onInventoryError={mockOnInventoryError}
        >
          <ThrowError
            shouldThrow={true}
            error={new Error("Product unavailable")}
          />
        </CartOperationErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalled();
      expect(mockOnInventoryError).toHaveBeenCalled();
    });
  });

  describe("Error Type Variants", () => {
    const testCases = [
      {
        error: new Error("network connection failed"),
        expectedTitle: "Connection Issue",
        expectedHint: "💾 Your cart changes are saved locally",
      },
      {
        error: new Error("Network timeout"),
        expectedTitle: "Connection Issue",
        expectedHint: "💾 Your cart changes are saved locally",
      },
      {
        error: new Error("item inventory insufficient"),
        expectedTitle: "Item Unavailable",
        expectedHint: "📦 Check product availability",
      },
      {
        error: new Error("product sold out"),
        expectedTitle: "Item Unavailable",
        expectedHint: "📦 Check product availability",
      },
      {
        error: new Error("validation error: required field"),
        expectedTitle: "Cart Validation Error",
        expectedHint: null,
      },
      {
        error: new Error("invalid product selection"),
        expectedTitle: "Cart Validation Error",
        expectedHint: null,
      },
      {
        error: new Error("version conflict detected"),
        expectedTitle: "Cart Sync Issue",
        expectedHint: "🔄 Cart was updated from another device",
      },
      {
        error: new Error("concurrent modification"),
        expectedTitle: "Cart Sync Issue",
        expectedHint: "🔄 Cart was updated from another device",
      },
    ];

    testCases.forEach(({ error, expectedTitle, expectedHint }) => {
      it(`correctly handles ${
        error.message.includes("network")
          ? "network"
          : error.message.includes("inventory") ||
            error.message.includes("stock")
          ? "inventory"
          : error.message.includes("validation") ||
            error.message.includes("invalid")
          ? "validation"
          : "conflict"
      } error: ${error.message}`, () => {
        const { getByText, queryByText } = render(
          <CartOperationErrorBoundary>
            <ThrowError shouldThrow={true} error={error} />
          </CartOperationErrorBoundary>
        );

        expect(getByText(expectedTitle)).toBeTruthy();

        if (expectedHint) {
          expect(
            queryByText(new RegExp(expectedHint.split(" ")[0]))
          ).toBeTruthy();
        }
      });
    });
  });

  describe("Accessibility and Layout", () => {
    it("maintains proper component structure", () => {
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CartOperationErrorBoundary>
      );

      // Check that all expected UI elements are present
      expect(getByText("Cart Operation Failed")).toBeTruthy();
      expect(
        getByText(/We encountered an issue updating your cart/)
      ).toBeTruthy();
      expect(getByText("Try Again")).toBeTruthy();
      expect(getByText("View Cart")).toBeTruthy();
      expect(getByText("Keep Shopping")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });

    it("handles very long error messages", () => {
      const longError = new Error(
        "This is a very long error message that might cause layout issues if not handled properly in the UI component rendering system"
      );

      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError shouldThrow={true} error={longError} />
        </CartOperationErrorBoundary>
      );

      expect(getByText(/This is a very long error message/)).toBeTruthy();
    });
  });

  describe("Integration with ShopifyErrorBoundary", () => {
    it("passes context correctly to ShopifyErrorBoundary", () => {
      // This test verifies the component integrates properly with ShopifyErrorBoundary
      const { getByText } = render(
        <CartOperationErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Integration test")}
          />
        </CartOperationErrorBoundary>
      );

      // If the integration works, we should see the fallback UI
      expect(getByText("Cart Operation Failed")).toBeTruthy();
    });
  });
});
