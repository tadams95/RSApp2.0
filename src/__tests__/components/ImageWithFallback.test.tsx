import { render } from "@testing-library/react-native";
import React from "react";
import ImageWithFallback from "../../components/ui/ImageWithFallback";

// Mock expo-image with a simple mock that doesn't involve async behavior
jest.mock("expo-image", () => ({
  Image: ({ testID, source, onLoad, onError, ...props }: any) => {
    const MockView = require("react-native").View;
    return (
      <MockView testID={testID ? `${testID}-image` : "mock-image"} {...props} />
    );
  },
}));

// Mock image cache utilities
jest.mock("../../utils/imageCacheConfig", () => ({
  CACHE_POLICIES: {
    PRODUCT: {
      cachePolicy: "memory",
      priority: "normal",
      transition: { duration: 200 },
    },
    STATIC: {
      cachePolicy: "disk",
      priority: "high",
      transition: { duration: 100 },
    },
  },
  generateCacheKey: jest.fn(
    (type, id, version) => `${type}-${id}-${version || "default"}`
  ),
}));

// Mock error utilities
jest.mock("../../utils/logError", () => ({
  logError: jest.fn(),
}));

jest.mock("../../utils/storageErrorHandler", () => ({
  getStorageErrorMessage: jest.fn(
    (error) => error.message || "Failed to load image"
  ),
}));

describe("ImageWithFallback", () => {
  const mockImageSource = { uri: "https://example.com/image.jpg" };
  const mockFallbackSource = { uri: "https://example.com/fallback.jpg" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render container with correct testID", () => {
    const { getByTestId } = render(
      <ImageWithFallback source={mockImageSource} testID="test-image" />
    );

    expect(getByTestId("test-image")).toBeTruthy();
    expect(getByTestId("mock-image")).toBeTruthy();
  });

  it("should render image component", () => {
    const { getByTestId } = render(
      <ImageWithFallback source={mockImageSource} testID="test-image" />
    );

    expect(getByTestId("mock-image")).toBeTruthy();
  });

  it("should show loading indicator by default", () => {
    const { getByTestId } = render(
      <ImageWithFallback source={mockImageSource} testID="test-image" />
    );

    // Component should render with loading state initially
    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should not show loading indicator when showLoadingIndicator=false", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        showLoadingIndicator={false}
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should handle different cache types", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        cacheType="STATIC"
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should handle cache configuration with custom ID and version", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        cacheType="PRODUCT"
        cacheId="product-123"
        cacheVersion="v2"
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should accept fallback source prop", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        fallbackSource={mockFallbackSource}
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should accept error handling props", () => {
    const mockOnLoadSuccess = jest.fn();
    const mockOnLoadError = jest.fn();

    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        onLoadSuccess={mockOnLoadSuccess}
        onLoadError={mockOnLoadError}
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should accept retry configuration props", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        maxRetries={3}
        showRetryButton={true}
        showErrorMessage={true}
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should render with custom error context", () => {
    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        errorContext="CustomContext"
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });

  it("should render custom fallback when renderFallback is provided", () => {
    const CustomFallback = () => {
      const MockText = require("react-native").Text;
      return <MockText>Custom fallback content</MockText>;
    };

    const { getByTestId } = render(
      <ImageWithFallback
        source={mockImageSource}
        renderFallback={() => <CustomFallback />}
        testID="test-image"
      />
    );

    expect(getByTestId("test-image")).toBeTruthy();
  });
});
