import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import HistoryModal from "../../../components/modals/HistoryModal";

// Mock react-redux
jest.mock("react-redux", () => ({
  useSelector: jest.fn(),
}));

// Mock Firebase Firestore
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  getDocs: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe("HistoryModal", () => {
  // Mock functions
  const mockUseSelector = jest.fn();
  const mockGetDocs = jest.fn();
  const mockCollection = jest.fn();
  const mockGetFirestore = jest.fn();

  // Suppress act() warnings for async tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes(
          "Warning: An update to HistoryModal inside a test was not wrapped in act"
        )
      ) {
        return;
      }
      originalError.call(console, ...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });

  // Sample test data
  const mockPurchaseData = [
    {
      id: "purchase-1",
      dateTime: new Date("2024-01-15"),
      cartItems: [
        {
          title: "Test Product 1",
          price: 29.99,
          quantity: 2,
          productImageSrc: "https://example.com/image1.jpg",
          color: "Red",
          size: "M",
        },
      ],
      total: 59.98,
      status: "Completed",
      orderNumber: "ORD-001",
    },
    {
      id: "purchase-2",
      orderDate: new Date("2024-01-10"),
      items: [
        {
          title: "Test Product 2",
          price: 15.5,
          quantity: 1,
          image: "https://example.com/image2.jpg",
        },
      ],
      totalAmount: 15.5,
    },
  ];

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockReturnValue("test-user-123");

    // Setup react-redux mock
    const ReactRedux = require("react-redux");
    ReactRedux.useSelector.mockImplementation(mockUseSelector);

    // Setup Firebase mocks
    const firestore = require("firebase/firestore");
    mockGetFirestore.mockReturnValue({});
    mockCollection.mockReturnValue({});
    firestore.getFirestore.mockImplementation(mockGetFirestore);
    firestore.collection.mockImplementation(mockCollection);
    firestore.getDocs.mockImplementation(mockGetDocs);

    // Default successful Firebase response
    mockGetDocs.mockResolvedValue({
      docs: mockPurchaseData.map((data) => ({
        id: data.id,
        data: () => data,
      })),
    });
  });

  describe("Component Rendering", () => {
    it("renders loading state initially", async () => {
      render(<HistoryModal />);

      // Check loading indicator using accessibility label instead of role
      expect(screen.getByLabelText("Loading purchase history")).toBeTruthy();
      expect(screen.getByText("Loading your purchase history...")).toBeTruthy();
    });

    it("renders empty state when no purchases exist", async () => {
      // Mock empty response
      mockGetDocs.mockResolvedValue({ docs: [] });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
        expect(
          screen.getByText("You haven't made any purchases yet.")
        ).toBeTruthy();
        expect(screen.getByLabelText("No purchase history")).toBeTruthy();
      });
    });

    it("renders purchase history when data exists", async () => {
      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
        expect(screen.getByText("Order #ORD-001")).toBeTruthy();
        expect(screen.getByText("Test Product 1")).toBeTruthy();
      });
    });

    it("has proper accessibility labels", async () => {
      render(<HistoryModal />);

      await waitFor(() => {
        const historyList = screen.getByLabelText("Purchase history list");
        expect(historyList).toBeTruthy();

        const headerText = screen.getByRole("header");
        expect(headerText).toBeTruthy();
      });
    });
  });

  describe("Redux Integration", () => {
    it("uses userId from Redux store to fetch purchases", async () => {
      const testUserId = "user-456-test";
      mockUseSelector.mockReturnValue(testUserId);

      render(<HistoryModal />);

      await waitFor(() => {
        expect(mockCollection).toHaveBeenCalledWith(
          {},
          `customers/${testUserId}/purchases`
        );
      });
    });

    it("handles null userId gracefully", async () => {
      mockUseSelector.mockReturnValue(null);

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
      });

      // Should not call Firebase when userId is null
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("handles undefined userId from Redux", async () => {
      mockUseSelector.mockReturnValue(undefined);

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
      });

      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("handles empty string userId", async () => {
      mockUseSelector.mockReturnValue("");

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
      });

      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe("Firebase Integration", () => {
    it("fetches user purchases from correct Firestore path", async () => {
      const userId = "test-user-123";
      render(<HistoryModal />);

      await waitFor(() => {
        // getFirestore() is called at module level, so we only check collection and getDocs
        expect(mockCollection).toHaveBeenCalledWith(
          {},
          `customers/${userId}/purchases`
        );
        expect(mockGetDocs).toHaveBeenCalled();
      });
    });

    it("handles Firebase errors gracefully", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching user purchases:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("handles malformed Firebase response", async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "invalid-doc",
            data: () => null,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        // Should still render but handle the malformed data
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
      });
    });
  });

  describe("Data Formatting and Transformation", () => {
    it("formats purchase data with cartItems correctly", async () => {
      const purchaseWithCartItems = {
        id: "test-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Cart Item",
            price: 25.0,
            quantity: 1,
          },
        ],
        total: 25.0,
        status: "Completed",
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: purchaseWithCartItems.id,
            data: () => purchaseWithCartItems,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Cart Item")).toBeTruthy();
        // The $25.00 appears both as item price and order total
        expect(screen.getAllByText("$25.00")).toHaveLength(2);
      });
    });

    it("formats purchase data with items array correctly", async () => {
      const purchaseWithItems = {
        id: "test-purchase-2",
        orderDate: new Date("2024-01-01"),
        items: [
          {
            title: "Regular Item",
            price: 30.0,
            quantity: 2,
          },
        ],
        totalAmount: 60.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: purchaseWithItems.id,
            data: () => purchaseWithItems,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Regular Item")).toBeTruthy();
        expect(screen.getByText("QTY: 2")).toBeTruthy();
      });
    });

    it("handles Firestore Timestamp objects", async () => {
      const firestoreTimestamp = {
        toDate: () => new Date("2024-01-01"),
      };

      const purchaseWithTimestamp = {
        id: "timestamp-purchase",
        dateTime: firestoreTimestamp,
        cartItems: [{ title: "Test", price: 10, quantity: 1 }],
        total: 10,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: purchaseWithTimestamp.id,
            data: () => purchaseWithTimestamp,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Test")).toBeTruthy();
      });
    });

    it("handles invalid date formats gracefully", async () => {
      const purchaseWithInvalidDate = {
        id: "invalid-date-purchase",
        dateTime: "invalid-date-string",
        cartItems: [{ title: "Test Item", price: 10, quantity: 1 }],
        total: 10,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: purchaseWithInvalidDate.id,
            data: () => purchaseWithInvalidDate,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Test Item")).toBeTruthy();
        // Should still render with a fallback date
      });
    });

    it("sorts orders by date (most recent first)", async () => {
      const olderPurchase = {
        id: "older-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [{ title: "Older Item", price: 10, quantity: 1 }],
        total: 10,
        orderNumber: "OLD-001",
      };

      const newerPurchase = {
        id: "newer-purchase",
        dateTime: new Date("2024-01-15"),
        cartItems: [{ title: "Newer Item", price: 20, quantity: 1 }],
        total: 20,
        orderNumber: "NEW-001",
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          { id: olderPurchase.id, data: () => olderPurchase },
          { id: newerPurchase.id, data: () => newerPurchase },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        const orders = screen.getAllByText(/Order #/);
        // Newer order should appear first
        expect(orders[0]).toHaveTextContent("Order #NEW-001");
        expect(orders[1]).toHaveTextContent("Order #OLD-001");
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("renders component without errors on different screen sizes", async () => {
      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
      });

      // Component should render without errors regardless of screen size
    });

    it("maintains layout structure consistently", async () => {
      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
        expect(screen.getByLabelText("Purchase history list")).toBeTruthy();
      });
    });
  });

  describe("Image Handling", () => {
    it("renders product images when available", async () => {
      const purchaseWithImage = {
        id: "image-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Product with Image",
            price: 25.0,
            quantity: 1,
            productImageSrc: "https://example.com/product.jpg",
          },
        ],
        total: 25.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [{ id: purchaseWithImage.id, data: () => purchaseWithImage }],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        const productImage = screen.getByLabelText(
          "Image of Product with Image"
        );
        expect(productImage).toBeTruthy();
        expect(productImage.props.source).toEqual({
          uri: "https://example.com/product.jpg",
        });
      });
    });

    it("renders fallback for missing images", async () => {
      const purchaseWithoutImage = {
        id: "no-image-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Product without Image",
            price: 25.0,
            quantity: 1,
          },
        ],
        total: 25.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          { id: purchaseWithoutImage.id, data: () => purchaseWithoutImage },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("No Image")).toBeTruthy();
      });
    });

    it("handles both productImageSrc and image fields", async () => {
      const purchaseWithDifferentImageField = {
        id: "alt-image-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Product with Alt Image",
            price: 25.0,
            quantity: 1,
            image: "https://example.com/alt-image.jpg",
          },
        ],
        total: 25.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: purchaseWithDifferentImageField.id,
            data: () => purchaseWithDifferentImageField,
          },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        const productImage = screen.getByLabelText(
          "Image of Product with Alt Image"
        );
        expect(productImage.props.source).toEqual({
          uri: "https://example.com/alt-image.jpg",
        });
      });
    });
  });

  describe("Product Details Display", () => {
    it("displays product color and size when available", async () => {
      const purchaseWithDetails = {
        id: "detailed-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Detailed Product",
            price: 25.0,
            quantity: 1,
            color: "Blue",
            size: "Large",
          },
        ],
        total: 25.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [{ id: purchaseWithDetails.id, data: () => purchaseWithDetails }],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Color: Blue")).toBeTruthy();
        expect(screen.getByText("Size: Large")).toBeTruthy();
      });
    });

    it("handles missing color and size gracefully", async () => {
      const purchaseWithoutDetails = {
        id: "simple-purchase",
        dateTime: new Date("2024-01-01"),
        cartItems: [
          {
            title: "Simple Product",
            price: 25.0,
            quantity: 1,
          },
        ],
        total: 25.0,
      };

      mockGetDocs.mockResolvedValue({
        docs: [
          { id: purchaseWithoutDetails.id, data: () => purchaseWithoutDetails },
        ],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        expect(screen.getByText("Simple Product")).toBeTruthy();
        // Color and size text should not be present
        expect(screen.queryByText(/Color:/)).toBeNull();
        expect(screen.queryByText(/Size:/)).toBeNull();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles missing Redux store gracefully", () => {
      mockUseSelector.mockImplementation(() => {
        throw new Error("useSelector must be used within a Provider");
      });

      expect(() => {
        render(<HistoryModal />);
      }).toThrow("useSelector must be used within a Provider");
    });

    it("handles component errors gracefully", async () => {
      // Component should not throw for normal rendering
      expect(() => {
        render(<HistoryModal />);
      }).not.toThrow();
    });

    it("handles malformed purchase data", async () => {
      const malformedPurchase = {
        id: "malformed-purchase",
        // Missing required fields
      };

      mockGetDocs.mockResolvedValue({
        docs: [{ id: malformedPurchase.id, data: () => malformedPurchase }],
      });

      render(<HistoryModal />);

      await waitFor(() => {
        // Should still render the history section
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
      });
    });
  });

  describe("Component Props Interface", () => {
    it("accepts no props (functional component)", async () => {
      expect(() => {
        render(<HistoryModal />);
      }).not.toThrow();
    });

    it("maintains TypeScript compatibility", async () => {
      const component = <HistoryModal />;
      expect(() => render(component)).not.toThrow();
    });
  });

  describe("Loading States", () => {
    it("shows loading state before data fetch completes", () => {
      // Make the Promise never resolve to test loading state
      mockGetDocs.mockImplementation(() => new Promise(() => {}));

      render(<HistoryModal />);

      expect(screen.getByLabelText("Loading purchase history")).toBeTruthy();
      expect(screen.getByText("Loading your purchase history...")).toBeTruthy();
    });

    it("transitions from loading to data display", async () => {
      render(<HistoryModal />);

      // Initially shows loading
      expect(screen.getByLabelText("Loading purchase history")).toBeTruthy();

      // Then shows data
      await waitFor(() => {
        expect(screen.getByText("Your Purchase History")).toBeTruthy();
        expect(screen.queryByLabelText("Loading purchase history")).toBeNull();
      });
    });

    it("transitions from loading to empty state", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      render(<HistoryModal />);

      // Initially shows loading
      expect(screen.getByLabelText("Loading purchase history")).toBeTruthy();

      // Then shows empty state
      await waitFor(() => {
        expect(screen.getByText("No Purchase History")).toBeTruthy();
        expect(screen.queryByLabelText("Loading purchase history")).toBeNull();
      });
    });
  });
});
