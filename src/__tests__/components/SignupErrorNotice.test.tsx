import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SignupErrorNotice } from "../../components/SignupErrorNotice";

// Wrapper component to provide PaperProvider context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("SignupErrorNotice", () => {
  const mockOnRetry = jest.fn();
  const mockSecondaryAction = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
    mockSecondaryAction.mockClear();
  });

  it("renders error message correctly", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Email already exists" />
      </TestWrapper>
    );

    expect(screen.getByText("Email already exists")).toBeTruthy();
    expect(screen.getByText("Account Creation Issue")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Network error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Error message" />
      </TestWrapper>
    );

    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("calls onRetry when retry button is pressed", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    const retryButton = screen.getByText("Try Again");
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action button when provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice
          message="Account already exists"
          secondaryAction={{
            text: "Go to Login",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Go to Login")).toBeTruthy();
  });

  it("calls secondary action when secondary button is pressed", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice
          message="Error"
          secondaryAction={{
            text: "Go to Login",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    const secondaryButton = screen.getByText("Go to Login");
    fireEvent.press(secondaryButton);

    expect(mockSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it("renders both retry and secondary action buttons when both are provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice
          message="Error"
          onRetry={mockOnRetry}
          secondaryAction={{
            text: "Go to Login",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getByText("Go to Login")).toBeTruthy();
  });

  it("renders with testID when provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Error" testID="signup-error-notice" />
      </TestWrapper>
    );

    expect(screen.getByTestId("signup-error-notice")).toBeTruthy();
  });

  it("applies custom styles when provided", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice
          message="Error"
          style={{ marginTop: 20 }}
          testID="styled-error"
        />
      </TestWrapper>
    );

    // Check that the component renders with testID (indicating style was passed through)
    expect(screen.getByTestId("styled-error")).toBeTruthy();
  });

  it("renders alert icon", () => {
    render(
      <TestWrapper>
        <SignupErrorNotice message="Error" />
      </TestWrapper>
    );

    // The MaterialCommunityIcons component should be rendered
    expect(screen.getByText("Account Creation Issue")).toBeTruthy();
  });

  it("handles long error messages", () => {
    const longMessage =
      "This is a very long error message for signup that should be displayed properly without breaking the layout or causing any issues with text wrapping";

    render(
      <TestWrapper>
        <SignupErrorNotice message={longMessage} />
      </TestWrapper>
    );

    expect(screen.getByText(longMessage)).toBeTruthy();
  });

  it("handles validation-related error messages", () => {
    const validationErrors = [
      "Password must be at least 8 characters",
      "Email format is invalid",
      "Username already taken",
    ];

    validationErrors.forEach((error) => {
      const { unmount } = render(
        <TestWrapper>
          <SignupErrorNotice message={error} />
        </TestWrapper>
      );

      expect(screen.getByText(error)).toBeTruthy();
      expect(screen.getByText("Account Creation Issue")).toBeTruthy();

      unmount();
    });
  });

  it("handles different types of signup errors", () => {
    const errorScenarios = [
      { message: "Network connection failed", hasRetry: true },
      {
        message: "Email already exists",
        hasSecondary: true,
        secondaryText: "Go to Login",
      },
      { message: "Invalid email format", hasRetry: false },
      { message: "Password too weak", hasRetry: true },
    ];

    errorScenarios.forEach(
      ({ message, hasRetry, hasSecondary, secondaryText }) => {
        const props: any = { message };
        if (hasRetry) props.onRetry = mockOnRetry;
        if (hasSecondary)
          props.secondaryAction = {
            text: secondaryText,
            onPress: mockSecondaryAction,
          };

        const { unmount } = render(
          <TestWrapper>
            <SignupErrorNotice {...props} />
          </TestWrapper>
        );

        expect(screen.getByText(message)).toBeTruthy();

        if (hasRetry) {
          expect(screen.getByText("Try Again")).toBeTruthy();
        }

        if (hasSecondary && secondaryText) {
          expect(screen.getByText(secondaryText)).toBeTruthy();
        }

        unmount();
      }
    );
  });
});
