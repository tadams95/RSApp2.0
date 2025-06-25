import { render } from "@testing-library/react-native";
import React from "react";
import LoadingOverlay from "../../components/LoadingOverlay";

describe("LoadingOverlay", () => {
  it("should render loading indicator correctly", () => {
    const { getByLabelText } = render(<LoadingOverlay />);

    expect(getByLabelText("Loading indicator")).toBeTruthy();
  });

  it("should render without message by default", () => {
    const { queryByText } = render(<LoadingOverlay />);

    // Should not have any text when no message provided
    expect(queryByText(/.+/)).toBeNull();
  });

  it("should display message when provided", () => {
    const testMessage = "Loading your data...";
    const { getByText } = render(<LoadingOverlay message={testMessage} />);

    expect(getByText(testMessage)).toBeTruthy();
  });

  it("should have correct accessibility properties", () => {
    const { getByLabelText } = render(<LoadingOverlay />);

    const container = getByLabelText("Loading indicator");
    expect(container.props.accessibilityRole).toBe("progressbar");
  });

  it("should display both indicator and message together", () => {
    const testMessage = "Please wait...";
    const { getByText, getByLabelText } = render(
      <LoadingOverlay message={testMessage} />
    );

    expect(getByLabelText("Loading indicator")).toBeTruthy();
    expect(getByText(testMessage)).toBeTruthy();
  });
});
