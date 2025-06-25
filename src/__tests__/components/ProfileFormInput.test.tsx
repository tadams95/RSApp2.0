import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TextInput } from "react-native";
import ProfileFormInput from "../../components/ui/ProfileFormInput";

describe("ProfileFormInput", () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    mockOnChangeText.mockClear();
  });

  it("renders label correctly", () => {
    render(
      <ProfileFormInput label="Test Label" onChangeText={mockOnChangeText} />
    );

    expect(screen.getByText("Test Label")).toBeTruthy();
  });

  it("renders TextInput with correct props", () => {
    render(
      <ProfileFormInput
        label="Email"
        placeholder="Enter your email"
        value="test@example.com"
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = screen.getByDisplayValue("test@example.com");
    expect(textInput).toBeTruthy();
    expect(textInput.props.placeholder).toBe("Enter your email");
  });

  it("calls onChangeText when text changes", () => {
    render(<ProfileFormInput label="Name" onChangeText={mockOnChangeText} />);

    const textInput = screen.getByDisplayValue("");
    fireEvent.changeText(textInput, "John Doe");

    expect(mockOnChangeText).toHaveBeenCalledWith("John Doe");
    expect(mockOnChangeText).toHaveBeenCalledTimes(1);
  });

  it("does not render error text when no error is provided", () => {
    render(<ProfileFormInput label="Name" onChangeText={mockOnChangeText} />);

    const errorText = screen.queryByText("This is an error");
    expect(errorText).toBeNull();
  });

  it("renders error text when error is provided", () => {
    render(
      <ProfileFormInput
        label="Email"
        error="Invalid email format"
        onChangeText={mockOnChangeText}
      />
    );

    expect(screen.getByText("Invalid email format")).toBeTruthy();
  });

  it("applies error styling when error is present", () => {
    render(
      <ProfileFormInput
        label="Email"
        error="Invalid email format"
        value="invalid-email"
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = screen.getByDisplayValue("invalid-email");
    expect(textInput.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderColor: "#FF6B6B",
        }),
      ])
    );
  });

  it("does not apply error styling when no error is present", () => {
    render(
      <ProfileFormInput
        label="Email"
        value="valid@email.com"
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = screen.getByDisplayValue("valid@email.com");
    expect(textInput.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderColor: "#555",
        }),
      ])
    );
  });

  it("passes through additional TextInput props", () => {
    const { UNSAFE_getByType } = render(
      <ProfileFormInput
        label="Password"
        secureTextEntry
        keyboardType="default"
        maxLength={50}
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = UNSAFE_getByType(TextInput);
    expect(textInput.props.secureTextEntry).toBe(true);
    expect(textInput.props.keyboardType).toBe("default");
    expect(textInput.props.maxLength).toBe(50);
  });

  it("uses correct placeholder text color", () => {
    render(
      <ProfileFormInput
        label="Name"
        placeholder="Enter name"
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = screen.getByPlaceholderText("Enter name");
    expect(textInput.props.placeholderTextColor).toBe("#666");
  });

  it("renders with testID when provided", () => {
    render(
      <ProfileFormInput
        label="Name"
        testID="profile-input-name"
        onChangeText={mockOnChangeText}
      />
    );

    expect(screen.getByTestId("profile-input-name")).toBeTruthy();
  });

  it("handles empty string values correctly", () => {
    render(
      <ProfileFormInput label="Name" value="" onChangeText={mockOnChangeText} />
    );

    const textInput = screen.getByDisplayValue("");
    expect(textInput).toBeTruthy();
  });

  it("handles multiline input when specified", () => {
    const { UNSAFE_getByType } = render(
      <ProfileFormInput
        label="Bio"
        multiline
        numberOfLines={4}
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = UNSAFE_getByType(TextInput);
    expect(textInput.props.multiline).toBe(true);
    expect(textInput.props.numberOfLines).toBe(4);
  });

  it("maintains focus behavior", () => {
    const { UNSAFE_getByType } = render(
      <ProfileFormInput
        label="Name"
        autoFocus
        onChangeText={mockOnChangeText}
      />
    );

    const textInput = UNSAFE_getByType(TextInput);
    expect(textInput.props.autoFocus).toBe(true);
  });

  it("handles keyboard type variations", () => {
    const keyboardTypes = [
      "email-address",
      "numeric",
      "phone-pad",
      "url",
    ] as const;

    keyboardTypes.forEach((keyboardType) => {
      const { unmount, UNSAFE_getByType } = render(
        <ProfileFormInput
          label={`Test ${keyboardType}`}
          keyboardType={keyboardType}
          onChangeText={mockOnChangeText}
        />
      );

      const textInput = UNSAFE_getByType(TextInput);
      expect(textInput.props.keyboardType).toBe(keyboardType);

      unmount();
    });
  });

  it("renders correctly with long error messages", () => {
    const longError =
      "This is a very long error message that should wrap properly and display correctly without breaking the layout";

    render(
      <ProfileFormInput
        label="Field"
        error={longError}
        onChangeText={mockOnChangeText}
      />
    );

    expect(screen.getByText(longError)).toBeTruthy();
  });

  it("handles special characters in input values", () => {
    const specialValue = "test@#$%^&*()_+-=[]{}|;':\",./<>?";

    render(
      <ProfileFormInput
        label="Special Input"
        value={specialValue}
        onChangeText={mockOnChangeText}
      />
    );

    expect(screen.getByDisplayValue(specialValue)).toBeTruthy();
  });
});
