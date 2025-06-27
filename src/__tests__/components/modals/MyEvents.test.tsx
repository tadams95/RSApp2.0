import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import MyEvents from "../../../components/modals/MyEvents";

// Suppress console logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Mock React Native components and modules following AdminModal pattern
jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
  Modal: "Modal",
  ScrollView: "ScrollView",
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  ActivityIndicator: ({ testID, ...props }: any) => {
    const React = require("react");
    const { View } = require("react-native");
    return <View testID={testID || "loading-indicator"} {...props} />;
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  Platform: {
    OS: "ios",
    select: jest.fn((options) => options.ios || options.default),
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (styles: any) => styles,
  },
}));

// Mock Firebase Auth
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: { uid: "test-user-123" },
  })),
}));

// Mock Firebase Firestore
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

// Mock Firebase Realtime Database
jest.mock("firebase/database", () => ({
  getDatabase: jest.fn(),
  ref: jest.fn(),
  get: jest.fn(),
}));

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock expo-camera
jest.mock("expo-camera", () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
  },
  CameraView: "CameraView",
}));

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(),
}));

// Mock ImageWithFallback component
jest.mock("../../../components/ui/ImageWithFallback", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const MockImageWithFallback = ({
    source,
    onLoadError,
    errorContext,
  }: any) => (
    <View
      testID="image-with-fallback"
      accessibilityLabel={`Image: ${source?.uri || "fallback"}`}
    >
      <Text>Image Component</Text>
    </View>
  );
  MockImageWithFallback.displayName = "ImageWithFallback";
  return MockImageWithFallback;
});

// Mock utility functions
jest.mock("../../../utils/cart/networkErrorDetection", () => ({
  retryWithBackoff: jest.fn(),
}));

jest.mock("../../../utils/databaseErrorHandler", () => ({
  extractDatabaseErrorCode: jest.fn(),
}));

jest.mock("../../../utils/eventDataHandler", () => ({
  getRetryBackoffTime: jest.fn(),
  handleEventFetchError: jest.fn(),
  sanitizeEventData: jest.fn(),
  shouldRetryEventFetch: jest.fn(),
}));

// Mock MaterialCommunityIcons
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

describe("MyEvents", () => {
  // Mock functions - get them from the mocked modules
  const mockAlert = Alert.alert as jest.Mock;
  const mockGetDocs = jest.fn();
  const mockCollection = jest.fn();
  const mockQuery = jest.fn();
  const mockGetCameraPermissionsAsync = jest.fn();
  const mockSanitizeEventData = jest.fn();
  const mockHandleEventFetchError = jest.fn();
  const mockNetInfoAddEventListener = jest.fn();

  // Sample test data
  const mockEventData = [
    {
      name: "Test Event 1",
      dateTime: {
        toDate: () => new Date("2025-12-30"),
      },
      imgURL: "https://example.com/event1.jpg",
      id: "event-1",
    },
  ];

  const mockTicketData = [
    {
      id: "ticket-1",
      active: true,
      email: "user@example.com",
      expoPushToken: "ExponentPushToken[test]",
      firebaseId: "test-user-123",
      owner: "test-user-123",
    },
  ];

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firebase mocks
    const firestore = require("firebase/firestore");
    const netInfo = require("@react-native-community/netinfo");
    const utils = require("../../../utils/eventDataHandler");

    mockCollection.mockReturnValue({});
    firestore.collection.mockImplementation(mockCollection);
    firestore.getDocs.mockImplementation(mockGetDocs);
    firestore.query.mockImplementation(mockQuery);
    firestore.where.mockReturnValue({});

    netInfo.addEventListener.mockImplementation(mockNetInfoAddEventListener);

    // Setup Camera mocks
    const { Camera } = require("expo-camera");
    Camera.getCameraPermissionsAsync.mockImplementation(
      mockGetCameraPermissionsAsync
    );

    // Setup utility mocks
    utils.handleEventFetchError.mockImplementation(mockHandleEventFetchError);
    utils.sanitizeEventData.mockImplementation(mockSanitizeEventData);

    // Default successful responses
    mockGetDocs.mockResolvedValue({
      docs: mockEventData.map((data) => ({
        id: data.id,
        data: () => data,
      })),
    });

    mockSanitizeEventData.mockImplementation((data) => data);

    // Mock user tickets for each event
    mockQuery.mockResolvedValue({
      docs: mockTicketData.map((ticket) => ({
        id: ticket.id,
        data: () => ticket,
      })),
    });

    // Camera permission defaults
    mockGetCameraPermissionsAsync.mockResolvedValue({ status: "granted" });

    // Default network status (online)
    mockNetInfoAddEventListener.mockImplementation((callback) => {
      callback({ isConnected: true });
      return jest.fn(); // Return unsubscribe function
    });

    // Default error handling
    mockHandleEventFetchError.mockReturnValue("Failed to load events");
  });

  describe("Component Rendering", () => {
    it("renders loading state initially", async () => {
      render(<MyEvents />);

      expect(screen.getByTestId("loading-indicator")).toBeTruthy();
    });

    it("renders headline correctly", async () => {
      render(<MyEvents />);

      await waitFor(() => {
        expect(screen.getByText("Your events")).toBeTruthy();
      });
    });

    it("displays events when data is available", async () => {
      render(<MyEvents />);

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeTruthy();
      });
    });

    it("displays no tickets message when no events exist", async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      render(<MyEvents />);

      await waitFor(() => {
        expect(screen.getByText("No tickets found")).toBeTruthy();
      });
    });

    it("displays no active tickets message when no user tickets exist", async () => {
      mockQuery.mockResolvedValue({ docs: [] });

      render(<MyEvents />);

      await waitFor(() => {
        expect(screen.getByText("No active tickets")).toBeTruthy();
      });
    });
  });

  describe("Firebase Integration", () => {
    it("fetches events from Firestore", async () => {
      render(<MyEvents />);

      await waitFor(() => {
        expect(mockCollection).toHaveBeenCalledWith({}, "events");
        expect(mockGetDocs).toHaveBeenCalled();
      });
    });

    it("handles Firebase errors gracefully", async () => {
      mockGetDocs.mockRejectedValue(new Error("Firestore error"));

      render(<MyEvents />);

      await waitFor(() => {
        expect(mockHandleEventFetchError).toHaveBeenCalled();
      });
    });

    it("sanitizes event data", async () => {
      render(<MyEvents />);

      await waitFor(() => {
        expect(mockSanitizeEventData).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Test Event 1",
            id: "event-1",
          })
        );
      });
    });
  });

  describe("Network Connectivity", () => {
    it("handles offline state", async () => {
      mockNetInfoAddEventListener.mockImplementation((callback) => {
        callback({ isConnected: false });
        return jest.fn();
      });

      render(<MyEvents />);

      await waitFor(() => {
        expect(
          screen.getByText("You're offline. Please check your connection.")
        ).toBeTruthy();
      });
    });
  });

  describe("Camera Permissions", () => {
    it("requests camera permission on component mount", async () => {
      render(<MyEvents />);

      await waitFor(() => {
        expect(mockGetCameraPermissionsAsync).toHaveBeenCalled();
      });
    });

    it("handles camera permission denied", async () => {
      mockGetCameraPermissionsAsync.mockResolvedValue({ status: "denied" });

      render(<MyEvents />);

      await waitFor(() => {
        const eventCard = screen.getByText("Test Event 1");
        fireEvent.press(eventCard);
      });

      await waitFor(() => {
        expect(mockGetCameraPermissionsAsync).toHaveBeenCalled();
      });
    });
  });

  describe("Component State Management", () => {
    it("manages loading state correctly", async () => {
      render(<MyEvents />);

      // Initially loading
      expect(screen.getByTestId("loading-indicator")).toBeTruthy();

      await waitFor(() => {
        // After data loads, loading should be false
        expect(screen.queryByTestId("loading-indicator")).toBeFalsy();
      });
    });

    it("manages error state correctly", async () => {
      mockGetDocs.mockRejectedValue(new Error("Test error"));
      mockHandleEventFetchError.mockReturnValue("Test error message");

      render(<MyEvents />);

      await waitFor(() => {
        expect(screen.getByText("Test error message")).toBeTruthy();
      });
    });
  });

  describe("Component Props and TypeScript", () => {
    it("renders without props correctly", async () => {
      expect(() => {
        render(<MyEvents />);
      }).not.toThrow();
    });

    it("maintains TypeScript compatibility", async () => {
      const component = <MyEvents />;
      expect(() => render(component)).not.toThrow();
    });
  });
});
