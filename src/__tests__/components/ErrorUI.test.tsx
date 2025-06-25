import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import {
  ErrorMessage,
  ErrorScreen,
  NetworkError,
} from "../../components/ErrorUI";

// Mock react-native-paper components
jest.mock("react-native-paper", () => ({
  Button: ({ children, onPress, testID, ...props }: any) => {
    const MockButton = require("react-native").TouchableOpacity;
    const MockText = require("react-native").Text;
    return (
      <MockButton onPress={onPress} testID={testID} {...props}>
        <MockText>{children}</MockText>
      </MockButton>
    );
  },
  Surface: ({ children, testID, ...props }: any) => {
    const MockView = require("react-native").View;
    return (
      <MockView testID={testID} {...props}>
        {children}
      </MockView>
    );
  },
  Text: ({ children, ...props }: any) => {
    const MockText = require("react-native").Text;
    return <MockText {...props}>{children}</MockText>;
  },
}));

// Mock Expo vector icons
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: ({ name, testID, ...props }: any) => {
    const MockedIcon = require("react-native").Text;
    return <MockedIcon testID={testID}>{name}</MockedIcon>;
  },
}));

describe("ErrorMessage", () => {
  const defaultProps = {
    message: "Something went wrong",
  };

  it("should render error message correctly", () => {
    const { getByText } = render(<ErrorMessage {...defaultProps} />);

    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("alert-circle")).toBeTruthy(); // Icon name
  });

  it("should render with default testID", () => {
    const { getByTestId } = render(<ErrorMessage {...defaultProps} />);

    expect(getByTestId("error-message")).toBeTruthy();
  });

  it("should render with custom testID", () => {
    const { getByTestId } = render(
      <ErrorMessage {...defaultProps} testID="custom-error" />
    );

    expect(getByTestId("custom-error")).toBeTruthy();
  });

  it("should show retry button when onRetry is provided", () => {
    const mockOnRetry = jest.fn();
    const { getByText } = render(
      <ErrorMessage {...defaultProps} onRetry={mockOnRetry} />
    );

    expect(getByText("Retry")).toBeTruthy();
  });

  it("should call onRetry when retry button is pressed", () => {
    const mockOnRetry = jest.fn();
    const { getByText } = render(
      <ErrorMessage {...defaultProps} onRetry={mockOnRetry} />
    );

    fireEvent.press(getByText("Retry"));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("should not show retry button when onRetry is not provided", () => {
    const { queryByText } = render(<ErrorMessage {...defaultProps} />);

    expect(queryByText("Retry")).toBeNull();
  });

  it("should apply custom styles", () => {
    const customStyle = { backgroundColor: "#FF0000" };
    const { getByTestId } = render(
      <ErrorMessage {...defaultProps} style={customStyle} />
    );

    const container = getByTestId("error-message");
    expect(container.props.style).toContainEqual(
      expect.objectContaining(customStyle)
    );
  });
});

describe("ErrorScreen", () => {
  const defaultProps = {
    message: "Something went wrong with the application",
  };

  it("should render with default title", () => {
    const { getByText } = render(<ErrorScreen {...defaultProps} />);

    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Something went wrong with the application")).toBeTruthy();
  });

  it("should render with custom title", () => {
    const { getByText } = render(
      <ErrorScreen {...defaultProps} title="Custom Error Title" />
    );

    expect(getByText("Custom Error Title")).toBeTruthy();
  });

  it("should show Try Again button when onRetry is provided", () => {
    const mockOnRetry = jest.fn();
    const { getByText } = render(
      <ErrorScreen {...defaultProps} onRetry={mockOnRetry} />
    );

    expect(getByText("Try Again")).toBeTruthy();
  });

  it("should call onRetry when Try Again button is pressed", () => {
    const mockOnRetry = jest.fn();
    const { getByText } = render(
      <ErrorScreen {...defaultProps} onRetry={mockOnRetry} />
    );

    fireEvent.press(getByText("Try Again"));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("should show Go Home button by default when onGoHome is provided", () => {
    const mockOnGoHome = jest.fn();
    const { getByText } = render(
      <ErrorScreen {...defaultProps} onGoHome={mockOnGoHome} />
    );

    expect(getByText("Go Home")).toBeTruthy();
  });

  it("should call onGoHome when Go Home button is pressed", () => {
    const mockOnGoHome = jest.fn();
    const { getByText } = render(
      <ErrorScreen {...defaultProps} onGoHome={mockOnGoHome} />
    );

    fireEvent.press(getByText("Go Home"));
    expect(mockOnGoHome).toHaveBeenCalledTimes(1);
  });

  it("should not show Go Home button when showHomeButton is false", () => {
    const mockOnGoHome = jest.fn();
    const { queryByText } = render(
      <ErrorScreen
        {...defaultProps}
        onGoHome={mockOnGoHome}
        showHomeButton={false}
      />
    );

    expect(queryByText("Go Home")).toBeNull();
  });
});

describe("NetworkError", () => {
  const defaultProps = {
    onRetry: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render with default message", () => {
    const { getByText } = render(<NetworkError {...defaultProps} />);

    expect(getByText("No Connection")).toBeTruthy();
    expect(
      getByText(
        "Network connection issue. Please check your internet connection."
      )
    ).toBeTruthy();
    expect(getByText("wifi-off")).toBeTruthy(); // Icon name
  });

  it("should render with custom message", () => {
    const customMessage = "Unable to connect to server";
    const { getByText } = render(
      <NetworkError {...defaultProps} message={customMessage} />
    );

    expect(getByText(customMessage)).toBeTruthy();
  });

  it("should show retry connection button", () => {
    const { getByText } = render(<NetworkError {...defaultProps} />);

    expect(getByText("Retry Connection")).toBeTruthy();
  });

  it("should call onRetry when retry button is pressed", () => {
    const mockOnRetry = jest.fn();
    const { getByText } = render(<NetworkError onRetry={mockOnRetry} />);

    fireEvent.press(getByText("Retry Connection"));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });
});
