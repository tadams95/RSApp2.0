import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { ProfileUpdateErrorNotice } from "../../components/ProfileUpdateErrorNotice";

// Wrapper component to provide PaperProvider context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("ProfileUpdateErrorNotice", () => {
  const mockOnRetry = jest.fn();
  const mockSecondaryAction = jest.fn();

  beforeEach(() => {
    mockOnRetry.mockClear();
    mockSecondaryAction.mockClear();
  });

  it("renders error message correctly", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice message="Failed to update profile" />
      </TestWrapper>
    );

    expect(screen.getByText("Failed to update profile")).toBeTruthy();
    expect(screen.getByText("Profile Update Issue")).toBeTruthy();
  });

  it("renders validation error title when validation errors are present", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Validation failed"
          validationErrors={{ email: "Invalid email format" }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Validation Error")).toBeTruthy();
  });

  it("renders server error indicator when serverError is true", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice message="Server error" serverError={true} />
      </TestWrapper>
    );

    expect(screen.getByText("Profile Update Issue (Server)")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Network error"
          onRetry={mockOnRetry}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Try Again")).toBeTruthy();
  });

  it("calls onRetry when retry button is pressed", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice message="Error" onRetry={mockOnRetry} />
      </TestWrapper>
    );

    const retryButton = screen.getByText("Try Again");
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action button when provided", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Permission error"
          secondaryAction={{
            text: "Contact Support",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Contact Support")).toBeTruthy();
  });

  it("calls secondary action when secondary button is pressed", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Error"
          secondaryAction={{
            text: "Contact Support",
            onPress: mockSecondaryAction,
          }}
        />
      </TestWrapper>
    );

    const secondaryButton = screen.getByText("Contact Support");
    fireEvent.press(secondaryButton);

    expect(mockSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it("displays validation errors by category", () => {
    const validationErrors = {
      email: "Invalid email format",
      firstName: "First name is required",
      phoneNumber: "Invalid phone number",
    };

    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Validation failed"
          validationErrors={validationErrors}
        />
      </TestWrapper>
    );

    expect(screen.getByText("Personal Information Issues:")).toBeTruthy();
    expect(screen.getByText("Contact Information Issues:")).toBeTruthy();
  });

  it("formats field names correctly", () => {
    const validationErrors = {
      firstName: "Required",
      phoneNumber: "Invalid format",
      displayName: "Too short",
    };

    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Validation failed"
          validationErrors={validationErrors}
        />
      </TestWrapper>
    );

    expect(screen.getByText("First Name:")).toBeTruthy();
    expect(screen.getByText("Phone:")).toBeTruthy();
    expect(screen.getByText("Full Name:")).toBeTruthy();
  });

  it("renders with testID when provided", () => {
    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Error"
          testID="profile-update-error"
        />
      </TestWrapper>
    );

    expect(screen.getByTestId("profile-update-error")).toBeTruthy();
  });

  it("handles different error codes", () => {
    const errorCodes = ["validation", "network", "permission", "server"];

    errorCodes.forEach((errorCode) => {
      const { unmount } = render(
        <TestWrapper>
          <ProfileUpdateErrorNotice
            message={`Error with code: ${errorCode}`}
            errorCode={errorCode}
          />
        </TestWrapper>
      );

      expect(screen.getByText(`Error with code: ${errorCode}`)).toBeTruthy();

      unmount();
    });
  });

  it("handles mixed validation error categories", () => {
    const validationErrors = {
      email: "Invalid email",
      firstName: "Required",
      customField: "Custom error",
    };

    render(
      <TestWrapper>
        <ProfileUpdateErrorNotice
          message="Mixed validation errors"
          validationErrors={validationErrors}
        />
      </TestWrapper>
    );

    // Should categorize correctly
    expect(screen.getByText("Personal Information Issues:")).toBeTruthy();
    expect(screen.getByText("Contact Information Issues:")).toBeTruthy();
    expect(screen.getByText("Other Issues:")).toBeTruthy();
  });
});
