import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import ErrorBoundary from "../../components/ErrorBoundary";

// Mock react-native-paper components
jest.mock("react-native-paper", () => {
  const { View, TouchableOpacity, Text } = require("react-native");

  const MockCard = ({ children, testID, ...props }: any) => (
    <View testID={testID} {...props}>
      {children}
    </View>
  );

  MockCard.Content = ({ children, ...props }: any) => (
    <View {...props}>{children}</View>
  );

  return {
    Button: ({ children, onPress, testID, ...props }: any) => (
      <TouchableOpacity onPress={onPress} testID={testID} {...props}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),

    Surface: ({ children, testID, ...props }: any) => (
      <View testID={testID} {...props}>
        {children}
      </View>
    ),

    Card: MockCard,

    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

// Mock Expo vector icons
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: ({ name, testID, ...props }: any) => {
    const MockedIcon = require("react-native").Text;
    return <MockedIcon testID={testID}>{name}</MockedIcon>;
  },
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

// Component that always throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <Text>Normal content</Text>;
};

describe("ErrorBoundary", () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render children when there is no error", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(getByText("Normal content")).toBeTruthy();
  });

  it("should render error UI when child component throws", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("Something went wrong")).toBeTruthy();
    expect(
      getByText("We encountered an error while trying to display this content.")
    ).toBeTruthy();
    expect(getByText("Try Again")).toBeTruthy();
    expect(getByText("Go Home")).toBeTruthy();
  });

  it("should render custom fallback component when provided", () => {
    const CustomFallback = () => <Text>Custom error fallback</Text>;

    const { getByText } = render(
      <ErrorBoundary fallbackComponent={<CustomFallback />}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("Custom error fallback")).toBeTruthy();
  });

  it("should call onError callback when error occurs", () => {
    const mockOnError = jest.fn();

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it("should reset error state when resetKeys change", () => {
    let resetKey = "initial";

    const { rerender, getByText, queryByText } = render(
      <ErrorBoundary resetKeys={[resetKey]}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should show error UI
    expect(getByText("Something went wrong")).toBeTruthy();

    // Change reset key and stop throwing
    resetKey = "changed";
    rerender(
      <ErrorBoundary resetKeys={[resetKey]}>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    // Should show normal content
    expect(queryByText("Something went wrong")).toBeNull();
    expect(getByText("Normal content")).toBeTruthy();
  });

  it("should show alert-circle icon in error state", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("alert-circle")).toBeTruthy();
  });

  // Note: Testing the actual button press functionality is complex in this context
  // as it involves component state and navigation. The main functionality
  // (error catching and UI rendering) is covered above.
});
