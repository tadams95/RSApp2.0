import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Alert, Text } from "react-native";
import { CheckoutPaymentErrorBoundary } from "../../../components/shopify/CheckoutPaymentErrorBoundary";

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
  return <Text>Checkout content</Text>;
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
              context: "checkout and payment",
            });
          }
          return children;
        }
      }

      return mockReact.createElement(TestErrorBoundary, {}, children);
    },
  };
});

describe("CheckoutPaymentErrorBoundary", () => {
  const mockAlert = Alert.alert as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders children when no error occurs", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Checkout content")).toBeTruthy();
    });

    it("renders error fallback when error occurs", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Checkout processing failed")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Checkout Failed")).toBeTruthy();
      expect(
        getByText(/We encountered an issue processing your order/)
      ).toBeTruthy();
      expect(
        getByText(/Your payment was not charged and your cart is preserved/)
      ).toBeTruthy();
    });
  });

  describe("Error Classification", () => {
    it("identifies payment errors correctly", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment card declined")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Payment Issue")).toBeTruthy();
      expect(
        getByText(/There was an issue processing your payment/)
      ).toBeTruthy();
      expect(
        getByText(/Try a different payment method or contact your bank/)
      ).toBeTruthy();
    });

    it("identifies network errors correctly", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Network timeout during checkout")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Connection Error")).toBeTruthy();
      expect(
        getByText(/Unable to complete checkout due to connection issues/)
      ).toBeTruthy();
      expect(
        getByText(/Check your connection and try again - no charges were made/)
      ).toBeTruthy();
    });

    it("identifies checkout errors correctly", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Checkout processing error")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Checkout Failed")).toBeTruthy();
      expect(
        getByText(/We encountered an issue processing your order/)
      ).toBeTruthy();
    });

    it("identifies validation errors correctly", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Validation failed: invalid address")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Information Required")).toBeTruthy();
      expect(
        getByText(/Please check your shipping and billing information/)
      ).toBeTruthy();
    });

    it("identifies inventory errors correctly", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Item inventory insufficient")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Items Unavailable")).toBeTruthy();
      expect(
        getByText(/Some items in your cart are no longer available/)
      ).toBeTruthy();
      expect(
        getByText(/Review cart items and update quantities before retrying/)
      ).toBeTruthy();
    });

    it("handles NetworkError by name", () => {
      const networkError = new Error("Request failed");
      networkError.name = "NetworkError";

      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={networkError} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Connection Error")).toBeTruthy();
    });
  });

  describe("Dynamic Button Rendering", () => {
    it("shows payment-specific buttons for payment errors", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment stripe error")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Update Payment")).toBeTruthy();
      expect(getByText("Retry Payment")).toBeTruthy();
      expect(getByText("Save for Later")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });

    it("shows review cart button for inventory errors", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Product sold out")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Review Cart")).toBeTruthy();
      expect(getByText("Save for Later")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });

    it("shows try again button for general errors", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("General checkout error")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(getByText("Try Again")).toBeTruthy();
      expect(getByText("Save for Later")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
    });

    it("always shows safety notice", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByText(/Your payment was not charged and your cart is preserved/)
      ).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("shows alert when Update Payment button is pressed", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment declined")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      const updatePaymentButton = getByText("Update Payment");
      fireEvent.press(updatePaymentButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Update Payment Method",
        "Would you like to update your payment information and try again?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Update Payment", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows alert when Retry Payment button is pressed", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment card error")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      const retryPaymentButton = getByText("Retry Payment");
      fireEvent.press(retryPaymentButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Retry Payment",
        "Would you like to try processing your payment again?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry Payment", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows alert when Review Cart button is pressed", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Item stock insufficient")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      const reviewCartButton = getByText("Review Cart");
      fireEvent.press(reviewCartButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Review Cart",
        "Would you like to review and update your cart before trying again?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Review Cart", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows alert when Save for Later button is pressed", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CheckoutPaymentErrorBoundary>
      );

      const saveButton = getByText("Save for Later");
      fireEvent.press(saveButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Save Cart",
        "Your cart has been saved. You can complete your order later when the issue is resolved.",
        [{ text: "OK", style: "default", onPress: expect.any(Function) }]
      );
    });

    it("shows support alert when Get Help button is pressed", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CheckoutPaymentErrorBoundary>
      );

      const helpButton = getByText("Get Help");
      fireEvent.press(helpButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Checkout Support",
        "If you continue having trouble with checkout, please contact our order support at orders@ragestate.com",
        [{ text: "OK", style: "default" }]
      );
    });
  });

  describe("Error Details Display", () => {
    it("displays error message when provided", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Specific payment error")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByText("Technical details: Specific payment error")
      ).toBeTruthy();
    });

    it("handles empty error message gracefully", () => {
      const { queryByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("")} />
        </CheckoutPaymentErrorBoundary>
      );

      // Should not crash and should show default fallback content
      expect(queryByText("Order Processing Error")).toBeTruthy();
    });
  });

  describe("Callback Handling", () => {
    it("calls onError callback when provided", () => {
      const mockOnError = jest.fn();

      render(
        <CheckoutPaymentErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("calls onPaymentFailure callback for payment errors", () => {
      const mockOnPaymentFailure = jest.fn();

      render(
        <CheckoutPaymentErrorBoundary onPaymentFailure={mockOnPaymentFailure}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment card declined")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(mockOnPaymentFailure).toHaveBeenCalledWith(expect.any(Error));
    });

    it("calls onInventoryIssue callback for inventory errors", () => {
      const mockOnInventoryIssue = jest.fn();

      render(
        <CheckoutPaymentErrorBoundary onInventoryIssue={mockOnInventoryIssue}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Item inventory depleted")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(mockOnInventoryIssue).toHaveBeenCalled();
    });

    it("calls onRetryNeeded callback for retry-eligible errors", () => {
      const mockOnRetryNeeded = jest.fn();

      render(
        <CheckoutPaymentErrorBoundary onRetryNeeded={mockOnRetryNeeded}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Network timeout occurred")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(mockOnRetryNeeded).toHaveBeenCalled();
    });

    it("calls multiple callbacks when applicable", () => {
      const mockOnError = jest.fn();
      const mockOnPaymentFailure = jest.fn();

      render(
        <CheckoutPaymentErrorBoundary
          onError={mockOnError}
          onPaymentFailure={mockOnPaymentFailure}
        >
          <ThrowError
            shouldThrow={true}
            error={new Error("Payment stripe failure")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalled();
      expect(mockOnPaymentFailure).toHaveBeenCalled();
    });
  });

  describe("Error Type Variants", () => {
    const testCases = [
      {
        error: new Error("payment card expired"),
        expectedTitle: "Payment Issue",
        expectedHint: "💳 Try a different payment method or contact your bank",
      },
      {
        error: new Error("stripe payment failed"),
        expectedTitle: "Payment Issue",
        expectedHint: "💳 Try a different payment method or contact your bank",
      },
      {
        error: new Error("card declined by bank"),
        expectedTitle: "Payment Issue",
        expectedHint: "💳 Try a different payment method or contact your bank",
      },
      {
        error: new Error("network connection lost"),
        expectedTitle: "Connection Error",
        expectedHint:
          "🌐 Check your connection and try again - no charges were made",
      },
      {
        error: new Error("timeout during checkout"),
        expectedTitle: "Connection Error",
        expectedHint:
          "🌐 Check your connection and try again - no charges were made",
      },
      {
        error: new Error("checkout session expired"),
        expectedTitle: "Checkout Failed",
        expectedHint: null,
      },
      {
        error: new Error("order processing failed"),
        expectedTitle: "Checkout Failed",
        expectedHint: null,
      },
      {
        error: new Error("validation error: required shipping address"),
        expectedTitle: "Information Required",
        expectedHint: null,
      },
      {
        error: new Error("invalid billing information"),
        expectedTitle: "Information Required",
        expectedHint: null,
      },
      {
        error: new Error("item inventory exhausted"),
        expectedTitle: "Items Unavailable",
        expectedHint:
          "📦 Review cart items and update quantities before retrying",
      },
      {
        error: new Error("product sold out"),
        expectedTitle: "Items Unavailable",
        expectedHint:
          "📦 Review cart items and update quantities before retrying",
      },
      {
        error: new Error("item no longer available"),
        expectedTitle: "Items Unavailable",
        expectedHint:
          "📦 Review cart items and update quantities before retrying",
      },
    ];

    testCases.forEach(({ error, expectedTitle, expectedHint }) => {
      const errorType =
        error.message.includes("payment") ||
        error.message.includes("stripe") ||
        error.message.includes("card") ||
        error.message.includes("declined")
          ? "payment"
          : error.message.includes("network") ||
            error.message.includes("timeout")
          ? "network"
          : error.message.includes("checkout") ||
            error.message.includes("order")
          ? "checkout"
          : error.message.includes("validation") ||
            error.message.includes("invalid") ||
            error.message.includes("required")
          ? "validation"
          : error.message.includes("inventory") ||
            error.message.includes("stock") ||
            error.message.includes("available") ||
            error.message.includes("sold out")
          ? "inventory"
          : "general";

      it(`correctly handles ${errorType} error: ${error.message}`, () => {
        const { getByText, queryByText } = render(
          <CheckoutPaymentErrorBoundary>
            <ThrowError shouldThrow={true} error={error} />
          </CheckoutPaymentErrorBoundary>
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
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </CheckoutPaymentErrorBoundary>
      );

      // Check that all expected UI elements are present
      expect(getByText("Order Processing Error")).toBeTruthy();
      expect(
        getByText(/We're having trouble completing your order/)
      ).toBeTruthy();
      expect(getByText("Try Again")).toBeTruthy();
      expect(getByText("Save for Later")).toBeTruthy();
      expect(getByText("Get Help")).toBeTruthy();
      expect(
        getByText(/Your payment was not charged and your cart is preserved/)
      ).toBeTruthy();
    });

    it("handles very long error messages", () => {
      const longError = new Error(
        "This is a very long checkout error message that might cause layout issues if not handled properly in the payment processing system"
      );

      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={longError} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByText(/This is a very long checkout error message/)
      ).toBeTruthy();
    });
  });

  describe("Integration with ShopifyErrorBoundary", () => {
    it("passes context correctly to ShopifyErrorBoundary", () => {
      // This test verifies the component integrates properly with ShopifyErrorBoundary
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Integration test")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      // If the integration works, we should see the fallback UI
      expect(getByText("Order Processing Error")).toBeTruthy();
    });
  });

  describe("Safety Features", () => {
    it("always displays payment protection notice", () => {
      const { getByText } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Any error")} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByText(/Your payment was not charged and your cart is preserved/)
      ).toBeTruthy();
    });

    it("shows appropriate context-sensitive hints", () => {
      // Test network hint
      const { getByText: getByTextNetwork } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("network timeout")} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByTextNetwork(
          /Check your connection and try again - no charges were made/
        )
      ).toBeTruthy();

      // Test payment hint
      const { getByText: getByTextPayment } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("payment failed")} />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByTextPayment(/Try a different payment method or contact your bank/)
      ).toBeTruthy();

      // Test inventory hint
      const { getByText: getByTextInventory } = render(
        <CheckoutPaymentErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("inventory depleted")}
          />
        </CheckoutPaymentErrorBoundary>
      );

      expect(
        getByTextInventory(
          /Review cart items and update quantities before retrying/
        )
      ).toBeTruthy();
    });
  });
});
