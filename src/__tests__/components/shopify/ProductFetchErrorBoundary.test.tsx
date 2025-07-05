import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Alert, Text } from "react-native";
import { ProductFetchErrorBoundary } from "../../../components/shopify/ProductFetchErrorBoundary";

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
  return <Text>Product content</Text>;
};

// Mock ShopifyErrorBoundary to directly render the fallback
jest.mock("../../../components/shopify/ShopifyErrorBoundary", () => {
  const mockReact = require("react");

  return {
    ShopifyErrorBoundary: ({ children, fallbackComponent, onError }: any) => {
      // Simple test error boundary component
      class TestErrorBoundary extends mockReact.Component<any, any> {
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
          if (this.state.hasError && fallbackComponent) {
            const FallbackComponent = fallbackComponent;
            return (
              <FallbackComponent
                error={this.state.error}
                resetError={() =>
                  this.setState({ hasError: false, error: null })
                }
              />
            );
          }
          return this.props.children;
        }
      }

      return mockReact.createElement(TestErrorBoundary, {}, children);
    },
  };
});

const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe("ProductFetchErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    it("renders children when no error occurs", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Product content")).toBeTruthy();
    });

    it("catches errors and renders fallback UI", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Products Unavailable")).toBeTruthy();
      expect(
        getByText(
          /We're having trouble loading our product catalog. Please try again in a few moments./
        )
      ).toBeTruthy();
      expect(getByText("Details: Test error")).toBeTruthy();
    });
  });

  describe("Error Classification", () => {
    it("identifies network errors correctly", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Network timeout during fetch")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Connection Issue")).toBeTruthy();
      expect(
        getByText(
          /Unable to load products due to connection issues. Please check your internet connection and try again./
        )
      ).toBeTruthy();
      expect(
        getByText(/🌐 Check your internet connection and try refreshing/)
      ).toBeTruthy();
    });

    it("identifies rate limit errors correctly", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("rate limit exceeded")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Service Busy")).toBeTruthy();
      expect(
        getByText(
          /Our shop is experiencing high traffic. Please wait a moment and try again./
        )
      ).toBeTruthy();
      expect(
        getByText(/⏱️ High traffic detected - automatic retry in a few seconds/)
      ).toBeTruthy();
    });

    it("identifies Shopify service errors correctly", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Shopify storefront API error")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Shop Service Error")).toBeTruthy();
      expect(
        getByText(
          /Our shop service is temporarily unavailable. We're working to restore it quickly./
        )
      ).toBeTruthy();
      expect(
        getByText(/🔧 Shop service maintenance - please check back shortly/)
      ).toBeTruthy();
    });

    it("identifies product not found errors correctly", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Product not found")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Product Not Found")).toBeTruthy();
      expect(
        getByText(
          /The product you're looking for could not be found. It may have been removed or is temporarily unavailable./
        )
      ).toBeTruthy();
    });

    it("handles 404 errors as product not found", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("404 error")} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Product Not Found")).toBeTruthy();
    });

    it("handles 429 errors as rate limit", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("429 Too many requests")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Service Busy")).toBeTruthy();
    });

    it("handles NetworkError by name", () => {
      const networkError = new Error("Connection failed");
      networkError.name = "NetworkError";

      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={networkError} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Connection Issue")).toBeTruthy();
    });
  });

  describe("UI Elements", () => {
    it("shows Refresh button for general errors", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Refresh")).toBeTruthy();
      expect(getByText("Browse Events")).toBeTruthy();
      expect(getByText("Contact Support")).toBeTruthy();
    });

    it("shows Wait & Retry button for rate limit errors", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("rate limit exceeded")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Wait & Retry")).toBeTruthy();
      expect(getByText("Browse Events")).toBeTruthy();
      expect(getByText("Contact Support")).toBeTruthy();
    });

    it("hides Browse Events button for product not found errors", () => {
      const { getByText, queryByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Product not found")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Refresh")).toBeTruthy();
      expect(queryByText("Browse Events")).toBeFalsy();
      expect(getByText("Contact Support")).toBeTruthy();
    });

    it("always shows Contact Support button", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Any error")} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Contact Support")).toBeTruthy();
    });

    it("shows context-specific hints for different error types", () => {
      // Network error hint
      const { getByText: getByTextNetwork } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Network timeout")} />
        </ProductFetchErrorBoundary>
      );
      expect(
        getByTextNetwork(/🌐 Check your internet connection and try refreshing/)
      ).toBeTruthy();

      // Rate limit hint
      const { getByText: getByTextRate } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("rate limit exceeded")}
          />
        </ProductFetchErrorBoundary>
      );
      expect(
        getByTextRate(
          /⏱️ High traffic detected - automatic retry in a few seconds/
        )
      ).toBeTruthy();

      // Shopify service hint
      const { getByText: getByTextShopify } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Shopify GraphQL error")}
          />
        </ProductFetchErrorBoundary>
      );
      expect(
        getByTextShopify(
          /🔧 Shop service maintenance - please check back shortly/
        )
      ).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("shows alert when Browse Events button is pressed", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );

      const browseEventsButton = getByText("Browse Events");
      fireEvent.press(browseEventsButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Browse Alternatives",
        "Would you like to browse our events instead while we work on fixing the shop?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Browse Events", onPress: expect.any(Function) },
        ]
      );
    });

    it("shows alert when Contact Support button is pressed", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );

      const contactSupportButton = getByText("Contact Support");
      fireEvent.press(contactSupportButton);

      expect(mockAlert).toHaveBeenCalledWith(
        "Shop Support",
        "If products continue to be unavailable, please contact our shop support at shop@ragestate.com",
        [{ text: "OK", style: "default" }]
      );
    });

    it("calls resetError when Refresh button is pressed", () => {
      // This test verifies the refresh functionality indirectly
      // by checking that the button exists and can be pressed
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );

      const refreshButton = getByText("Refresh");
      expect(() => fireEvent.press(refreshButton)).not.toThrow();
    });

    it("handles Wait & Retry button for rate limit errors", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("rate limit exceeded")}
          />
        </ProductFetchErrorBoundary>
      );

      const waitRetryButton = getByText("Wait & Retry");
      expect(() => fireEvent.press(waitRetryButton)).not.toThrow();
    });

    it("executes Browse Events alert action correctly", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );

      const browseEventsButton = getByText("Browse Events");
      fireEvent.press(browseEventsButton);

      // Simulate pressing the "Browse Events" button in the alert
      const alertCall = (mockAlert as jest.Mock).mock.calls[0];
      const browseEventsAction = alertCall[2][1]; // Second button in alert
      expect(() => browseEventsAction.onPress()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty error message gracefully", () => {
      const { getByText, queryByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("")} />
        </ProductFetchErrorBoundary>
      );

      // Should not crash and should show default fallback content
      expect(getByText("Products Unavailable")).toBeTruthy();
      expect(queryByText("Details:")).toBeFalsy(); // Empty message should not show details
    });

    it("handles null or undefined error gracefully", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ProductFetchErrorBoundary>
      );

      // Should not crash and should show default fallback content
      expect(getByText("Products Unavailable")).toBeTruthy();
    });

    it("handles multiple error type matches correctly", () => {
      // Error message that could match multiple patterns
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("network Shopify timeout")}
          />
        </ProductFetchErrorBoundary>
      );

      // Should prioritize network error (checked first)
      expect(getByText("Connection Issue")).toBeTruthy();
      expect(
        getByText(/🌐 Check your internet connection and try refreshing/)
      ).toBeTruthy();
    });
  });

  describe("Callback Handling", () => {
    it("calls onError callback when provided", () => {
      const mockOnError = jest.fn();

      render(
        <ProductFetchErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </ProductFetchErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("calls onProductNotFound callback for product not found errors", () => {
      const mockOnProductNotFound = jest.fn();

      render(
        <ProductFetchErrorBoundary onProductNotFound={mockOnProductNotFound}>
          <ThrowError
            shouldThrow={true}
            error={new Error("Product not found")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(mockOnProductNotFound).toHaveBeenCalled();
    });

    it("calls onProductNotFound callback for 404 errors", () => {
      const mockOnProductNotFound = jest.fn();

      render(
        <ProductFetchErrorBoundary onProductNotFound={mockOnProductNotFound}>
          <ThrowError shouldThrow={true} error={new Error("404 error")} />
        </ProductFetchErrorBoundary>
      );

      expect(mockOnProductNotFound).toHaveBeenCalled();
    });

    it("does not call onProductNotFound for other error types", () => {
      const mockOnProductNotFound = jest.fn();

      render(
        <ProductFetchErrorBoundary onProductNotFound={mockOnProductNotFound}>
          <ThrowError shouldThrow={true} error={new Error("Network timeout")} />
        </ProductFetchErrorBoundary>
      );

      expect(mockOnProductNotFound).not.toHaveBeenCalled();
    });

    it("calls both onError and onProductNotFound for product not found errors", () => {
      const mockOnError = jest.fn();
      const mockOnProductNotFound = jest.fn();

      render(
        <ProductFetchErrorBoundary
          onError={mockOnError}
          onProductNotFound={mockOnProductNotFound}
        >
          <ThrowError
            shouldThrow={true}
            error={new Error("Product not found")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
      expect(mockOnProductNotFound).toHaveBeenCalled();
    });

    it("handles callbacks being undefined gracefully", () => {
      expect(() => {
        render(
          <ProductFetchErrorBoundary>
            <ThrowError
              shouldThrow={true}
              error={new Error("Product not found")}
            />
          </ProductFetchErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe("Integration with ShopifyErrorBoundary", () => {
    it("integrates correctly with ShopifyErrorBoundary", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Integration test")}
          />
        </ProductFetchErrorBoundary>
      );

      // Should render the fallback component
      expect(getByText("Products Unavailable")).toBeTruthy();
      expect(getByText("Details: Integration test")).toBeTruthy();
    });

    it("passes context to ShopifyErrorBoundary", () => {
      // This is indirectly tested through the integration
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Context test")} />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Products Unavailable")).toBeTruthy();
    });
  });

  describe("Error Message Display", () => {
    it("displays error details when error message exists", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("Detailed error message")}
          />
        </ProductFetchErrorBoundary>
      );

      expect(getByText("Details: Detailed error message")).toBeTruthy();
    });

    it("does not display error details when error message is empty", () => {
      const { queryByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("")} />
        </ProductFetchErrorBoundary>
      );

      expect(queryByText(/Details:/)).toBeFalsy();
    });
  });

  describe("Button Styling and Accessibility", () => {
    it("renders all button types correctly", () => {
      // Test general error (shows Refresh button)
      const { getByText: getByTextGeneral } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("General error")} />
        </ProductFetchErrorBoundary>
      );
      expect(getByTextGeneral("Refresh")).toBeTruthy();

      // Test rate limit error (shows Wait & Retry button)
      const { getByText: getByTextRate } = render(
        <ProductFetchErrorBoundary>
          <ThrowError
            shouldThrow={true}
            error={new Error("rate limit exceeded")}
          />
        </ProductFetchErrorBoundary>
      );
      expect(getByTextRate("Wait & Retry")).toBeTruthy();
    });

    it("maintains button accessibility", () => {
      const { getByText } = render(
        <ProductFetchErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error("Test error")} />
        </ProductFetchErrorBoundary>
      );

      // All buttons should be pressable
      const refreshButton = getByText("Refresh");
      const browseEventsButton = getByText("Browse Events");
      const contactSupportButton = getByText("Contact Support");

      expect(() => fireEvent.press(refreshButton)).not.toThrow();
      expect(() => fireEvent.press(browseEventsButton)).not.toThrow();
      expect(() => fireEvent.press(contactSupportButton)).not.toThrow();
    });
  });
});
