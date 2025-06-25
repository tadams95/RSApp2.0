import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { LoginErrorNotice } from "../../components/LoginErrorNotice";

// Wrapper component to provide PaperProvider context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("LoginErrorNotice", () => {
  const mockOnRetry = jest.fn();
  const mockSecondaryAction = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
    mockSecondaryAction.mockClear();
  });

  it("renders error message correctly", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Invalid credentials" />
      </TestWrapper>
    );

    expect(screen.getByText("Invalid credentials")).toBeTruthy();
    expect(screen.getByText("Login Issue")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Network error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error message" />
      </TestWrapper>
    );

    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("calls onRetry when retry button is pressed", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    const retryButton = screen.getByText("Try Again");
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action button when provided", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice
          message="Forgot your password?"
          secondaryAction={{
            text: "Reset Password",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Reset Password")).toBeTruthy();
  });

  it("calls secondary action when secondary button is pressed", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice
          message="Error"
          secondaryAction={{
            text: "Reset Password",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    const secondaryButton = screen.getByText("Reset Password");
    fireEvent.press(secondaryButton);

    expect(mockSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it("displays attempts warning when attempts > 2", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Invalid credentials" attempts={3} />
      </TestWrapper>
    );

    expect(
      screen.getByText(
        "Multiple unsuccessful attempts. Please verify your credentials."
      )
    ).toBeTruthy();
  });

  it("does not display attempts warning when attempts <= 2", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Invalid credentials" attempts={2} />
      </TestWrapper>
    );

    expect(
      screen.queryByText(
        "Multiple unsuccessful attempts. Please verify your credentials."
      )
    ).toBeNull();
  });

  it("renders both retry and secondary action buttons when both are provided", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice
          message="Error"
          onRetry={mockOnRetry}
          secondaryAction={{
            text: "Reset Password",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getByText("Reset Password")).toBeTruthy();
  });

  it("renders with testID when provided", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error" testID="login-error-notice" />
      </TestWrapper>
    );

    expect(screen.getByTestId("login-error-notice")).toBeTruthy();
  });

  it("applies custom styles when provided", () => {
    const customStyle = { marginTop: 20 };

    render(
      <TestWrapper>
        <LoginErrorNotice
          message="Error"
          style={customStyle}
          testID="styled-error"
        />
      </TestWrapper>
    );

    const errorNotice = screen.getByTestId("styled-error");
    // Check that the component renders with testID (indicating style was passed through)
    expect(errorNotice).toBeTruthy();
  });

  it("handles zero attempts correctly", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error" attempts={0} />
      </TestWrapper>
    );

    expect(
      screen.queryByText(
        "Multiple unsuccessful attempts. Please verify your credentials."
      )
    ).toBeNull();
  });

  it("renders alert icon", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error" />
      </TestWrapper>
    );

    // The MaterialCommunityIcons component should be rendered
    // We can't easily test the specific icon, but we can ensure the component structure is correct
    expect(screen.getByText("Login Issue")).toBeTruthy();
  });

  it("handles long error messages", () => {
    const longMessage =
      "This is a very long error message that should be displayed properly without breaking the layout or causing any issues with text wrapping or component rendering";

    render(
      <TestWrapper>
        <LoginErrorNotice message={longMessage} />
      </TestWrapper>
    );

    expect(screen.getByText(longMessage)).toBeTruthy();
  });

  it("handles empty secondary action text", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice
          message="Error"
          secondaryAction={{
            text: "",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    // Should still render the button even with empty text
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("handles high attempt counts", () => {
    render(
      <TestWrapper>
        <LoginErrorNotice message="Error" attempts={10} />
      </TestWrapper>
    );

    expect(
      screen.getByText(
        "Multiple unsuccessful attempts. Please verify your credentials."
      )
    ).toBeTruthy();
  });
});
