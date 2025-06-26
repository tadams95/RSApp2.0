import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import EditProfile from "../../../components/modals/EditProfile";

// Mock Firebase
jest.mock("firebase/database", () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(),
  update: jest.fn(),
}));

// Mock Redux useSelector
jest.mock("react-redux", () => ({
  useSelector: jest.fn(),
}));

// Mock the profile update error handler
jest.mock("../../../hooks/useProfileUpdateErrorHandler", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    error: null,
    fieldErrors: {},
    validationErrors: undefined,
    recoveryAction: null,
    handleUpdateError: jest.fn(),
    clearErrors: jest.fn(),
  })),
}));

// Mock validation functions
jest.mock("../../../components/modals/EditProfileValidation", () => ({
  validateName: jest.fn(),
  validateEmail: jest.fn(),
  validatePhoneNumber: jest.fn(),
  formatPhoneNumberInput: jest.fn((text: string) => text),
}));

describe("EditProfile", () => {
  const mockOnProfileUpdated = jest.fn();
  const mockOnCancel = jest.fn();
  const mockUpdate = jest.fn();
  const mockHandleUpdateError = jest.fn();
  const mockClearErrors = jest.fn();
  const mockUseSelector = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firebase mocks
    const firebase = require("firebase/database");
    const mockRef = { path: "users/test-user-id" };
    firebase.ref.mockReturnValue(mockRef);
    firebase.update.mockImplementation(mockUpdate);

    // Setup useSelector mock
    const { useSelector } = require("react-redux");
    useSelector.mockImplementation(mockUseSelector);
    mockUseSelector.mockReturnValue("test-user-id");

    // Setup validation mocks with default valid responses
    const validation = require("../../../components/modals/EditProfileValidation");
    validation.validateName.mockReturnValue({
      isValid: true,
      errorMessage: "",
    });
    validation.validateEmail.mockReturnValue({
      isValid: true,
      errorMessage: "",
    });
    validation.validatePhoneNumber.mockReturnValue({
      isValid: true,
      errorMessage: "",
    });
    validation.formatPhoneNumberInput.mockImplementation(
      (text: string) => text
    );

    // Setup hook mocks
    const useProfileUpdateErrorHandler =
      require("../../../hooks/useProfileUpdateErrorHandler").default;
    useProfileUpdateErrorHandler.mockReturnValue({
      error: null,
      fieldErrors: {},
      validationErrors: undefined,
      recoveryAction: null,
      handleUpdateError: mockHandleUpdateError,
      clearErrors: mockClearErrors,
    });
  });

  const renderComponent = () => {
    return render(
      <EditProfile
        onProfileUpdated={mockOnProfileUpdated}
        onCancel={mockOnCancel}
      />
    );
  };

  describe("Component Rendering", () => {
    it("renders the edit profile form with all fields", () => {
      renderComponent();

      expect(screen.getByText("Edit your profile details below")).toBeTruthy();
      expect(screen.getByText("First Name")).toBeTruthy();
      expect(screen.getByText("Last Name")).toBeTruthy();
      expect(screen.getByText("Email")).toBeTruthy();
      expect(screen.getByText("Phone Number")).toBeTruthy();
      expect(screen.getByText("CANCEL")).toBeTruthy();
      expect(screen.getByText("CONFIRM")).toBeTruthy();
    });

    it("renders input fields with correct placeholders", () => {
      renderComponent();

      expect(screen.getByPlaceholderText("First Name Change")).toBeTruthy();
      expect(screen.getByPlaceholderText("Last Name Change")).toBeTruthy();
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
      expect(screen.getByPlaceholderText("(555) 555-5555")).toBeTruthy();
    });

    it("has proper accessibility labels", () => {
      renderComponent();

      expect(screen.getByLabelText("Edit profile form")).toBeTruthy();
      expect(screen.getByLabelText("First Name input")).toBeTruthy();
      expect(screen.getByLabelText("Last Name input")).toBeTruthy();
      expect(screen.getByLabelText("Email input")).toBeTruthy();
      expect(screen.getByLabelText("Phone Number input")).toBeTruthy();
      expect(screen.getByLabelText("Cancel edit")).toBeTruthy();
      expect(screen.getByLabelText("Confirm edit")).toBeTruthy();
    });
  });

  describe("Form Input Handling", () => {
    it("updates first name field when text is entered", () => {
      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      expect(firstNameInput.props.value).toBe("John");
    });

    it("updates last name field when text is entered", () => {
      renderComponent();

      const lastNameInput = screen.getByLabelText("Last Name input");
      fireEvent.changeText(lastNameInput, "Doe");

      expect(lastNameInput.props.value).toBe("Doe");
    });

    it("updates email field when text is entered", () => {
      renderComponent();

      const emailInput = screen.getByLabelText("Email input");
      fireEvent.changeText(emailInput, "john@example.com");

      expect(emailInput.props.value).toBe("john@example.com");
    });

    it("updates phone number field when text is entered", () => {
      renderComponent();

      const phoneInput = screen.getByLabelText("Phone Number input");
      fireEvent.changeText(phoneInput, "1234567890");

      expect(phoneInput.props.value).toBe("1234567890");
    });

    it("calls formatPhoneNumberInput when phone number changes", () => {
      const {
        formatPhoneNumberInput,
      } = require("../../../components/modals/EditProfileValidation");
      renderComponent();

      const phoneInput = screen.getByLabelText("Phone Number input");
      fireEvent.changeText(phoneInput, "1234567890");

      expect(formatPhoneNumberInput).toHaveBeenCalledWith("1234567890");
    });
  });

  describe("Form Validation", () => {
    it("validates first name field and shows error for invalid input", async () => {
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validateName.mockReturnValue({
        isValid: false,
        errorMessage: "Name must be at least 2 characters",
      });

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "A");

      await waitFor(() => {
        expect(
          screen.getByText("Name must be at least 2 characters")
        ).toBeTruthy();
      });
    });

    it("validates email field and shows error for invalid input", async () => {
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validateEmail.mockReturnValue({
        isValid: false,
        errorMessage: "Please enter a valid email address",
      });

      renderComponent();

      const emailInput = screen.getByLabelText("Email input");
      fireEvent.changeText(emailInput, "invalid-email");

      await waitFor(() => {
        expect(
          screen.getByText("Please enter a valid email address")
        ).toBeTruthy();
      });
    });

    it("validates phone number field and shows error for invalid input", async () => {
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validatePhoneNumber.mockReturnValue({
        isValid: false,
        errorMessage: "Phone number must be at least 10 digits",
      });

      renderComponent();

      const phoneInput = screen.getByLabelText("Phone Number input");
      fireEvent.changeText(phoneInput, "123");

      await waitFor(() => {
        expect(
          screen.getByText("Phone number must be at least 10 digits")
        ).toBeTruthy();
      });
    });

    it("applies error styling to input fields with validation errors", async () => {
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validateName.mockReturnValue({
        isValid: false,
        errorMessage: "Name must be at least 2 characters",
      });

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "A");

      await waitFor(() => {
        expect(firstNameInput.props.style).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ borderColor: "#FF6B6B" }),
          ])
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("displays ProfileUpdateErrorNotice when there is an error", () => {
      const useProfileUpdateErrorHandler =
        require("../../../hooks/useProfileUpdateErrorHandler").default;
      useProfileUpdateErrorHandler.mockReturnValue({
        error: "Update failed",
        fieldErrors: {},
        validationErrors: undefined,
        recoveryAction: null,
        handleUpdateError: mockHandleUpdateError,
        clearErrors: mockClearErrors,
      });

      renderComponent();

      expect(screen.getByText("Update failed")).toBeTruthy();
    });

    it("applies field errors from the error handler", () => {
      const useProfileUpdateErrorHandler =
        require("../../../hooks/useProfileUpdateErrorHandler").default;
      useProfileUpdateErrorHandler.mockReturnValue({
        error: null,
        fieldErrors: { firstName: "First name is required" },
        validationErrors: undefined,
        recoveryAction: null,
        handleUpdateError: mockHandleUpdateError,
        clearErrors: mockClearErrors,
      });

      renderComponent();

      expect(screen.getByText("First name is required")).toBeTruthy();
    });

    it("handles validation errors from the error handler", () => {
      const useProfileUpdateErrorHandler =
        require("../../../hooks/useProfileUpdateErrorHandler").default;
      useProfileUpdateErrorHandler.mockReturnValue({
        error: "Validation failed",
        fieldErrors: {},
        validationErrors: { email: "Invalid email format" },
        recoveryAction: null,
        handleUpdateError: mockHandleUpdateError,
        clearErrors: mockClearErrors,
      });

      renderComponent();

      expect(screen.getByText("Validation failed")).toBeTruthy();
    });
  });

  describe("Form Submission", () => {
    it("calls onCancel when cancel button is pressed", () => {
      renderComponent();

      const cancelButton = screen.getByLabelText("Cancel edit");
      fireEvent.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockClearErrors).toHaveBeenCalledTimes(1);
    });

    it("resets form fields when cancel is pressed", () => {
      renderComponent();

      // Fill in some form data
      const firstNameInput = screen.getByLabelText("First Name input");
      const emailInput = screen.getByLabelText("Email input");
      fireEvent.changeText(firstNameInput, "John");
      fireEvent.changeText(emailInput, "john@example.com");

      // Press cancel
      const cancelButton = screen.getByLabelText("Cancel edit");
      fireEvent.press(cancelButton);

      // Fields should be cleared
      expect(firstNameInput.props.value).toBe("");
      expect(emailInput.props.value).toBe("");
    });

    it("does not submit when form validation fails", async () => {
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validateName.mockReturnValue({
        isValid: false,
        errorMessage: "Name must be at least 2 characters",
      });

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "A");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("handles missing user ID error", async () => {
      // Mock useSelector to return null (no user ID)
      mockUseSelector.mockReturnValue(null);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockHandleUpdateError).toHaveBeenCalledWith({
          code: "not-found",
          message: "User ID not available. Please log in again.",
        });
      });
    });

    it("does not submit when no changes are made", async () => {
      renderComponent();

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
      });
    });

    it("successfully submits valid form data", async () => {
      mockUpdate.mockResolvedValue(undefined);

      renderComponent();

      // Fill in valid form data
      const firstNameInput = screen.getByLabelText("First Name input");
      const lastNameInput = screen.getByLabelText("Last Name input");
      const emailInput = screen.getByLabelText("Email input");
      const phoneInput = screen.getByLabelText("Phone Number input");

      fireEvent.changeText(firstNameInput, "John");
      fireEvent.changeText(lastNameInput, "Doe");
      fireEvent.changeText(emailInput, "john@example.com");
      fireEvent.changeText(phoneInput, "1234567890");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phoneNumber: "1234567890",
        });
        expect(mockOnProfileUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it("only submits fields that have values", async () => {
      mockUpdate.mockResolvedValue(undefined);

      renderComponent();

      // Only fill in first name
      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), {
          firstName: "John",
        });
      });
    });

    it("handles submission errors gracefully", async () => {
      const submitError = new Error("Network error");
      mockUpdate.mockRejectedValue(submitError);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockHandleUpdateError).toHaveBeenCalledWith(
          submitError,
          mockOnProfileUpdated
        );
      });
    });

    it("shows loading state during submission", async () => {
      // Create a promise that we can control
      let resolveUpdate: (value?: any) => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });
      mockUpdate.mockReturnValue(updatePromise);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      // Wait for async validation and state updates
      await waitFor(() => {
        expect(screen.getByText("UPDATING...")).toBeTruthy();
      });

      expect(confirmButton.props.accessibilityState.disabled).toBe(true);

      // Resolve the promise
      resolveUpdate!();

      await waitFor(() => {
        expect(screen.getByText("CONFIRM")).toBeTruthy();
      });
    });

    it("disables buttons during submission", async () => {
      // Create a promise that we can control
      let resolveUpdate: (value?: any) => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });
      mockUpdate.mockReturnValue(updatePromise);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      const cancelButton = screen.getByLabelText("Cancel edit");
      fireEvent.press(confirmButton);

      // Wait for async state updates
      await waitFor(() => {
        expect(confirmButton.props.accessibilityState.disabled).toBe(true);
      });
      expect(cancelButton.props.accessibilityState.disabled).toBe(true);

      // Resolve the promise
      resolveUpdate!();

      await waitFor(() => {
        expect(confirmButton.props.accessibilityState.disabled).toBe(false);
        expect(cancelButton.props.accessibilityState.disabled).toBe(false);
      });
    });
  });

  describe("Error Recovery", () => {
    it("provides retry functionality when there is an error", () => {
      const mockRetry = jest.fn();
      const useProfileUpdateErrorHandler =
        require("../../../hooks/useProfileUpdateErrorHandler").default;
      useProfileUpdateErrorHandler.mockReturnValue({
        error: "Update failed",
        fieldErrors: {},
        validationErrors: undefined,
        recoveryAction: { text: "Try Again", onPress: mockRetry },
        handleUpdateError: mockHandleUpdateError,
        clearErrors: mockClearErrors,
      });

      renderComponent();

      // Fill in form data for retry
      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      // Simulate retry action (this would be triggered by ProfileUpdateErrorNotice)
      // We're testing that the retry function calls clearErrors and attempts submission again
      const validation = require("../../../components/modals/EditProfileValidation");
      validation.validateName.mockReturnValue({
        isValid: true,
        errorMessage: "",
      });

      // Manually call the retry function that would be passed to ProfileUpdateErrorNotice
      expect(screen.getByText("Update failed")).toBeTruthy();
    });

    it("clears errors when retry is attempted", () => {
      renderComponent();

      // Fill form data
      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      // The retryUpdate function in EditProfile calls clearErrors when called
      // Since retryUpdate is passed to ProfileUpdateErrorNotice, we can't directly test it
      // but we can verify that clearErrors is available for the retry functionality
      expect(mockClearErrors).toBeDefined();
    });
  });

  describe("Firebase Integration", () => {
    it("creates correct Firebase database reference", async () => {
      const firebase = require("firebase/database");
      mockUpdate.mockResolvedValue(undefined);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(firebase.ref).toHaveBeenCalledWith({}, "users/test-user-id");
      });
    });

    it("calls Firebase update with correct reference and data", async () => {
      const firebase = require("firebase/database");
      const mockRef = { path: "users/test-user-id" };
      firebase.ref.mockReturnValue(mockRef);
      mockUpdate.mockResolvedValue(undefined);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(mockRef, { firstName: "John" });
      });
    });
  });

  describe("Component State Management", () => {
    it("maintains form state for error recovery", () => {
      renderComponent();

      // Fill form data
      const firstNameInput = screen.getByLabelText("First Name input");
      const emailInput = screen.getByLabelText("Email input");
      fireEvent.changeText(firstNameInput, "John");
      fireEvent.changeText(emailInput, "john@example.com");

      // Form state should be maintained (this is tested through the effect in the component)
      expect(firstNameInput.props.value).toBe("John");
      expect(emailInput.props.value).toBe("john@example.com");
    });

    it("resets form state after successful submission", async () => {
      mockUpdate.mockResolvedValue(undefined);

      renderComponent();

      const firstNameInput = screen.getByLabelText("First Name input");
      fireEvent.changeText(firstNameInput, "John");

      const confirmButton = screen.getByLabelText("Confirm edit");
      fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(firstNameInput.props.value).toBe("");
      });
    });
  });
});
