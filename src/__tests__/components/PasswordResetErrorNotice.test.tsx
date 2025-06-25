import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { PasswordResetErrorNotice } from "../../components/PasswordResetErrorNotice";

// Wrapper component to provide PaperProvider context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("PasswordResetErrorNotice", () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
  });

  it("renders error message correctly", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice message="Email not found" />
      </TestWrapper>
    );

    expect(screen.getByText("Email not found")).toBeTruthy();
    expect(screen.getByText("Password Reset Issue")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice
          message="Network error"
          onRetry={mockOnRetry}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice message="Error message" />
      </TestWrapper>
    );

    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("calls onRetry when retry button is pressed", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice message="Error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    const retryButton = screen.getByText("Try Again");
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("renders with testID when provided", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice
          message="Error"
          testID="password-reset-error"
        />
      </TestWrapper>
    );

    expect(screen.getByTestId("password-reset-error")).toBeTruthy();
  });

  it("handles common password reset error scenarios", () => {
    const errorScenarios = [
      "Invalid email address",
      "Email not found in our system",
      "Too many reset attempts",
      "Network connection failed",
    ];

    errorScenarios.forEach((message) => {
      const { unmount } = render(
        <TestWrapper>
          <PasswordResetErrorNotice message={message} />
        </TestWrapper>
      );

      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.getByText("Password Reset Issue")).toBeTruthy();

      unmount();
    });
  });

  it("renders alert icon", () => {
    render(
      <TestWrapper>
        <PasswordResetErrorNotice message="Error" />
      </TestWrapper>
    );

    expect(screen.getByText("Password Reset Issue")).toBeTruthy();
  });
});
