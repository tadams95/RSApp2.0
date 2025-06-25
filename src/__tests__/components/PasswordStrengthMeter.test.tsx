import { render, screen } from "@testing-library/react-native";
import React from "react";
import PasswordStrengthMeter from "../../components/auth/PasswordStrengthMeter";

describe("PasswordStrengthMeter", () => {
  it("renders nothing when password is empty", () => {
    const { toJSON } = render(<PasswordStrengthMeter password="" />);
    expect(toJSON()).toBeNull();
  });

  it('displays "Very Weak" for passwords with only one criterion', () => {
    render(<PasswordStrengthMeter password="abc" />);

    expect(screen.getByText("Very Weak")).toBeTruthy();
    expect(screen.getByText("At least 8 characters")).toBeTruthy();
    expect(screen.getByText("At least 1 uppercase letter")).toBeTruthy();
    expect(screen.getByText("At least 1 lowercase letter")).toBeTruthy();
    expect(screen.getByText("At least 1 number")).toBeTruthy();
    expect(screen.getByText("At least 1 special character")).toBeTruthy();
  });

  it('displays "Weak" for passwords with two criteria', () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);

    expect(screen.getByText("Weak")).toBeTruthy();
  });

  it('displays "Moderate" for passwords with three criteria', () => {
    render(<PasswordStrengthMeter password="abcdefghA" />);

    expect(screen.getByText("Moderate")).toBeTruthy();
  });

  it('displays "Strong" for passwords with four criteria', () => {
    render(<PasswordStrengthMeter password="abcdefghA1" />);

    expect(screen.getByText("Strong")).toBeTruthy();
  });

  it('displays "Very Strong" for passwords with all five criteria', () => {
    render(<PasswordStrengthMeter password="abcdefghA1@" />);

    expect(screen.getByText("Very Strong")).toBeTruthy();
  });

  it("shows checkmarks for met criteria and circles for unmet criteria", () => {
    render(<PasswordStrengthMeter password="abcdefghA1@" />);

    // All criteria should be met for this password
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks).toHaveLength(5);

    // No unmet criteria
    const circles = screen.queryAllByText("○");
    expect(circles).toHaveLength(0);
  });

  it("shows mixed checkmarks and circles for partially met criteria", () => {
    render(<PasswordStrengthMeter password="abc" />);

    // Only lowercase criterion should be met
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks).toHaveLength(1);

    // Four criteria should be unmet
    const circles = screen.getAllByText("○");
    expect(circles).toHaveLength(4);
  });

  it("correctly validates length criterion", () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);

    // Find the row with "At least 8 characters"
    expect(screen.getByText("At least 8 characters")).toBeTruthy();

    // This should have a checkmark since password is 8 characters
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("correctly validates uppercase criterion", () => {
    render(<PasswordStrengthMeter password="ABC" />);

    expect(screen.getByText("At least 1 uppercase letter")).toBeTruthy();

    // Should have at least one checkmark for uppercase
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("correctly validates lowercase criterion", () => {
    render(<PasswordStrengthMeter password="abc" />);

    expect(screen.getByText("At least 1 lowercase letter")).toBeTruthy();

    // Should have at least one checkmark for lowercase
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("correctly validates number criterion", () => {
    render(<PasswordStrengthMeter password="123" />);

    expect(screen.getByText("At least 1 number")).toBeTruthy();

    // Should have at least one checkmark for number
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("correctly validates special character criterion", () => {
    render(<PasswordStrengthMeter password="@$!" />);

    expect(screen.getByText("At least 1 special character")).toBeTruthy();

    // Should have at least one checkmark for special character
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it("handles special characters correctly", () => {
    const specialChars = ["@", "$", "!", "%", "*", "?", "&", "#"];

    specialChars.forEach((char) => {
      render(<PasswordStrengthMeter password={`test${char}`} />);

      expect(screen.getByText("At least 1 special character")).toBeTruthy();

      // Should have checkmarks for lowercase and special character
      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("updates strength meter when password changes", () => {
    const { rerender } = render(<PasswordStrengthMeter password="a" />);

    expect(screen.getByText("Very Weak")).toBeTruthy();

    rerender(<PasswordStrengthMeter password="abcdefghA1@" />);

    expect(screen.getByText("Very Strong")).toBeTruthy();
  });

  it("renders all required UI elements", () => {
    render(<PasswordStrengthMeter password="test123" />);

    // Should have strength text (lowercase + number = 2 criteria = Weak)
    expect(screen.getByText("Weak")).toBeTruthy();

    // Should have all requirement items
    expect(screen.getByText("At least 8 characters")).toBeTruthy();
    expect(screen.getByText("At least 1 uppercase letter")).toBeTruthy();
    expect(screen.getByText("At least 1 lowercase letter")).toBeTruthy();
    expect(screen.getByText("At least 1 number")).toBeTruthy();
    expect(screen.getByText("At least 1 special character")).toBeTruthy();
  });
});
