import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { NetworkStatusBanner } from "../../components/ui/NetworkStatusBanner";

// Mock the network status hook
const mockNetworkStatus = {
  isOnline: true,
  connectionQuality: { level: "good" },
  isConnectionGood: jest.fn(() => true),
  isConnectionExpensive: jest.fn(() => false),
  getNetworkSummary: jest.fn(() => "Good connection"),
};

jest.mock("../../utils/networkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

// Mock Ionicons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name, testID, ...props }: any) => {
    const MockedIcon = require("react-native").Text;
    return <MockedIcon testID={testID}>{name}</MockedIcon>;
  },
}));

// Mock Animated
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      Value: jest.fn(() => ({
        setValue: jest.fn(),
      })),
      timing: jest.fn(() => ({
        start: jest.fn(),
      })),
      parallel: jest.fn((animations) => ({
        start: jest.fn(),
      })),
      View: RN.View,
    },
  };
});

describe("NetworkStatusBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock values
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.connectionQuality = { level: "good" };
    mockNetworkStatus.isConnectionGood.mockReturnValue(true);
    mockNetworkStatus.isConnectionExpensive.mockReturnValue(false);
  });

  it("should not render when online with good connection", () => {
    const { queryByText } = render(<NetworkStatusBanner />);

    // Component should return null when conditions are good - test by checking no error messages
    expect(
      queryByText("You're offline. Some features may be limited.")
    ).toBeNull();
    expect(
      queryByText("Slow connection detected. Loading may be slower.")
    ).toBeNull();
    expect(
      queryByText("Using cellular data. Data charges may apply.")
    ).toBeNull();
  });

  it("should render when offline", () => {
    mockNetworkStatus.isOnline = false;

    const { getByText } = render(<NetworkStatusBanner />);

    expect(
      getByText("You're offline. Some features may be limited.")
    ).toBeTruthy();
  });

  it("should render when connection is poor", () => {
    mockNetworkStatus.connectionQuality = { level: "poor" };
    mockNetworkStatus.isConnectionGood.mockReturnValue(false);

    const { getByText } = render(<NetworkStatusBanner />);

    expect(
      getByText("Slow connection detected. Loading may be slower.")
    ).toBeTruthy();
  });

  it("should render when connection is expensive", () => {
    mockNetworkStatus.isConnectionExpensive.mockReturnValue(true);
    mockNetworkStatus.isConnectionGood.mockReturnValue(false);

    const { getByText } = render(<NetworkStatusBanner />);

    expect(
      getByText("Using cellular data. Data charges may apply.")
    ).toBeTruthy();
  });

  it("should show sync status when syncing", () => {
    mockNetworkStatus.isOnline = false;

    const { getByText } = render(<NetworkStatusBanner syncStatus="syncing" />);

    expect(getByText("Syncing...")).toBeTruthy();
  });

  it("should show sync status when sync is successful", () => {
    mockNetworkStatus.isOnline = false;

    const { getByText } = render(<NetworkStatusBanner syncStatus="success" />);

    expect(getByText("Synced")).toBeTruthy();
  });

  it("should show sync status when sync fails", () => {
    mockNetworkStatus.isOnline = false;

    const { getByText } = render(<NetworkStatusBanner syncStatus="error" />);

    expect(getByText("Sync failed")).toBeTruthy();
  });

  it("should call onRetry when retry button is pressed and offline", () => {
    const mockOnRetry = jest.fn();
    mockNetworkStatus.isOnline = false;

    const { getByText } = render(<NetworkStatusBanner onRetry={mockOnRetry} />);

    const retryButton = getByText("Retry");
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("should not show retry button when online", () => {
    const mockOnRetry = jest.fn();
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isConnectionGood.mockReturnValue(false);

    const { queryByText } = render(
      <NetworkStatusBanner onRetry={mockOnRetry} />
    );

    expect(queryByText("Retry")).toBeNull();
  });

  it("should respect visible prop", () => {
    mockNetworkStatus.isOnline = false;

    const { queryByText } = render(<NetworkStatusBanner visible={false} />);

    expect(
      queryByText("You're offline. Some features may be limited.")
    ).toBeNull();
  });

  it("should not show connection quality when showConnectionQuality=false", () => {
    mockNetworkStatus.connectionQuality = { level: "poor" };
    mockNetworkStatus.isConnectionGood.mockReturnValue(false);

    const { queryByText } = render(
      <NetworkStatusBanner showConnectionQuality={false} />
    );

    expect(
      queryByText("Slow connection detected. Loading may be slower.")
    ).toBeNull();
  });
});
