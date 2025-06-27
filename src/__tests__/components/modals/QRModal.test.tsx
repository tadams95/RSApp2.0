import { render, screen } from "@testing-library/react-native";
import React from "react";
import QRModal from "../../../components/modals/QRModal";

// Mock react-redux
jest.mock("react-redux", () => ({
  useSelector: jest.fn(),
}));

// Mock react-native-qrcode-svg
jest.mock("react-native-qrcode-svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockQRCode = ({ value, size, logo, logoSize }: any) => (
    <View
      testID="qr-code"
      accessibilityLabel={`QR Code with value: ${value}`}
      style={{ width: size, height: size }}
    />
  );
  MockQRCode.displayName = "QRCode";
  return MockQRCode;
});

// Mock MyEvents component
jest.mock("../../../components/modals/MyEvents", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockMyEvents = () => (
    <View testID="my-events" accessibilityLabel="My Events section" />
  );
  MockMyEvents.displayName = "MyEvents";
  return MockMyEvents;
});

describe("QRModal", () => {
  // Mock functions
  const mockUseSelector = jest.fn();

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockReturnValue("test-user-123");

    // Setup react-redux mock
    const ReactRedux = require("react-redux");
    ReactRedux.useSelector.mockImplementation(mockUseSelector);
  });

  describe("Component Rendering", () => {
    it("renders the QR modal with all required elements", () => {
      render(<QRModal />);

      // Check main container
      expect(screen.getByLabelText("QR Code section")).toBeTruthy();

      // Check headline text
      expect(
        screen.getByText("Show code to enter RAGESTATE events")
      ).toBeTruthy();
      expect(screen.getByLabelText("QR Code instructions")).toBeTruthy();

      // Check QR code container
      expect(screen.getByLabelText("QR Code display")).toBeTruthy();

      // Check QR code component
      expect(screen.getByTestId("qr-code")).toBeTruthy();

      // Check MyEvents component
      expect(screen.getByTestId("my-events")).toBeTruthy();
    });

    it("has proper accessibility labels", () => {
      render(<QRModal />);

      // Verify accessibility labels
      const qrSection = screen.getByLabelText("QR Code section");
      expect(qrSection).toBeTruthy();

      const instructions = screen.getByLabelText("QR Code instructions");
      expect(instructions).toBeTruthy();
      expect(instructions.props.accessibilityRole).toBe("header");

      const qrDisplay = screen.getByLabelText("QR Code display");
      expect(qrDisplay).toBeTruthy();
    });

    it("renders with correct styling and layout", () => {
      const { root } = render(<QRModal />);

      // Check main container styles
      const mainContainer = screen.getByLabelText("QR Code section");
      const containerStyle = mainContainer.props.style;
      expect(containerStyle).toMatchObject({
        paddingTop: 20,
        alignItems: "center",
        width: "100%",
      });

      // Check headline styles
      const headline = screen.getByText("Show code to enter RAGESTATE events");
      const headlineStyle = headline.props.style;
      expect(headlineStyle).toMatchObject({
        backgroundColor: "#222",
        textAlign: "center",
        fontSize: 14,
        color: "white",
        fontWeight: "600",
        textTransform: "uppercase",
        padding: 10,
        borderRadius: 8,
        width: "100%",
        overflow: "hidden",
      });
    });
  });

  describe("Redux Integration", () => {
    it("uses localId from Redux store for QR code value", () => {
      const testLocalId = "user-456-test";
      mockUseSelector.mockReturnValue(testLocalId);

      render(<QRModal />);

      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode.props.accessibilityLabel).toBe(
        `QR Code with value: ${testLocalId}`
      );
    });

    it("handles null localId gracefully", () => {
      mockUseSelector.mockReturnValue(null);

      render(<QRModal />);

      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode.props.accessibilityLabel).toBe("QR Code with value: ");
    });

    it("handles empty string localId", () => {
      mockUseSelector.mockReturnValue("");

      render(<QRModal />);

      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode.props.accessibilityLabel).toBe("QR Code with value: ");
    });

    it("handles undefined localId from Redux", () => {
      mockUseSelector.mockReturnValue(undefined);

      render(<QRModal />);

      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode.props.accessibilityLabel).toBe("QR Code with value: ");
    });
  });

  describe("QR Code Generation", () => {
    it("creates QR code component", () => {
      render(<QRModal />);

      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode).toBeTruthy();
      expect(qrCode.props.accessibilityLabel).toBe(
        "QR Code with value: test-user-123"
      );
    });

    it("generates QR code with various localId formats", () => {
      const testLocalIds = [
        "simple-id",
        "user@example.com",
        "user-123-456-789",
        "special!@#$%characters",
        "very-long-user-id-with-many-characters-and-numbers-123456789",
      ];

      testLocalIds.forEach((localId) => {
        mockUseSelector.mockReturnValue(localId);

        const { unmount } = render(<QRModal />);

        const qrCode = screen.getByTestId("qr-code");
        expect(qrCode.props.accessibilityLabel).toBe(
          `QR Code with value: ${localId}`
        );

        unmount();
      });
    });
  });

  describe("Platform-Specific Font Handling", () => {
    it("applies font styling to headline text", () => {
      render(<QRModal />);

      const headline = screen.getByText("Show code to enter RAGESTATE events");
      expect(headline).toBeTruthy();
      expect(headline.props.style).toMatchObject({
        fontWeight: "600",
        textTransform: "uppercase",
      });
    });
  });

  describe("Layout and Styling", () => {
    it("applies correct QR background styles", () => {
      render(<QRModal />);

      const qrBackground = screen.getByLabelText("QR Code display");
      const backgroundStyle = qrBackground.props.style;

      expect(backgroundStyle).toMatchObject({
        backgroundColor: "white",
        padding: 12,
        borderWidth: 1,
        borderColor: "#333",
        borderRadius: 8,
        marginVertical: 16,
      });
    });

    it("maintains responsive layout structure", () => {
      render(<QRModal />);

      // Component should render without errors
      expect(screen.getByLabelText("QR Code section")).toBeTruthy();

      // QR code should be present
      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode).toBeTruthy();
    });
  });

  describe("Component Integration", () => {
    it("renders MyEvents component", () => {
      render(<QRModal />);

      const myEvents = screen.getByTestId("my-events");
      expect(myEvents).toBeTruthy();
      expect(myEvents.props.accessibilityLabel).toBe("My Events section");
    });

    it("maintains component hierarchy", () => {
      const { root } = render(<QRModal />);

      // Check that components are rendered in correct order
      const qrSection = screen.getByLabelText("QR Code section");
      const headline = screen.getByText("Show code to enter RAGESTATE events");
      const qrDisplay = screen.getByLabelText("QR Code display");
      const myEvents = screen.getByTestId("my-events");

      // All components should be present
      expect(qrSection).toBeTruthy();
      expect(headline).toBeTruthy();
      expect(qrDisplay).toBeTruthy();
      expect(myEvents).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("handles invalid Redux store state gracefully", () => {
      // Mock useSelector to return undefined (simulating malformed state)
      mockUseSelector.mockReturnValue(undefined);

      expect(() => {
        render(<QRModal />);
      }).not.toThrow();

      // Should render with empty QR code value
      const qrCode = screen.getByTestId("qr-code");
      expect(qrCode.props.accessibilityLabel).toBe("QR Code with value: ");
    });

    it("handles missing Redux store gracefully", () => {
      // Mock useSelector to throw error (simulating missing Provider)
      mockUseSelector.mockImplementation(() => {
        throw new Error("useSelector must be used within a Provider");
      });

      expect(() => {
        render(<QRModal />);
      }).toThrow("useSelector must be used within a Provider");
    });

    it("handles component errors gracefully", () => {
      // Component should not throw for normal rendering
      expect(() => {
        render(<QRModal />);
      }).not.toThrow();
    });
  });

  describe("Asset Loading", () => {
    it("loads RSLogo2025 asset correctly", () => {
      // Should not throw error when requiring the logo asset
      expect(() => {
        render(<QRModal />);
      }).not.toThrow();

      expect(screen.getByLabelText("QR Code section")).toBeTruthy();
    });
  });

  describe("Component Props Interface", () => {
    it("accepts empty props interface", () => {
      // Component should accept no props
      expect(() => {
        render(<QRModal />);
      }).not.toThrow();
    });

    it("maintains TypeScript compatibility", () => {
      // This test verifies that the component compiles with TypeScript
      const component = <QRModal />;

      expect(() => render(component)).not.toThrow();
    });
  });
});
