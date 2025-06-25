import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { ScreenWrapper } from "../../components/ui/ScreenWrapper";
import { GlobalStyles } from "../../constants/styles";

describe("ScreenWrapper", () => {
  const testContent = "Test content";

  it("should render children correctly", () => {
    const { getByText } = render(
      <ScreenWrapper>
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    expect(getByText(testContent)).toBeTruthy();
  });

  it("should apply default background color", () => {
    const { getByTestId } = render(
      <ScreenWrapper testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    expect(wrapper.props.style).toContainEqual(
      expect.objectContaining({
        backgroundColor: GlobalStyles.colors.background,
      })
    );
  });

  it("should apply custom background color when provided", () => {
    const customColor = "#FF0000";
    const { getByTestId } = render(
      <ScreenWrapper backgroundColor={customColor} testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    expect(wrapper.props.style).toContainEqual(
      expect.objectContaining({
        backgroundColor: customColor,
      })
    );
  });

  it("should apply padding by default", () => {
    const { getByTestId } = render(
      <ScreenWrapper testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    expect(wrapper.props.style).toContainEqual(
      expect.objectContaining({
        padding: GlobalStyles.spacing.screenPadding,
      })
    );
  });

  it("should not apply padding when padding=false", () => {
    const { getByTestId } = render(
      <ScreenWrapper padding={false} testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    // Check that padding is not in the style array
    const flattenedStyle = wrapper.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.padding).toBeUndefined();
  });

  it("should apply custom styles", () => {
    const customStyle = { marginTop: 20, borderRadius: 10 };
    const { getByTestId } = render(
      <ScreenWrapper style={customStyle} testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    expect(wrapper.props.style).toContainEqual(
      expect.objectContaining(customStyle)
    );
  });

  it("should always have flex: 1 container style", () => {
    const { getByTestId } = render(
      <ScreenWrapper testID="screen-wrapper">
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    expect(wrapper.props.style).toContainEqual(
      expect.objectContaining({
        flex: 1,
      })
    );
  });

  it("should combine all styles correctly", () => {
    const customColor = "#00FF00";
    const customStyle = { margin: 10 };

    const { getByTestId } = render(
      <ScreenWrapper
        backgroundColor={customColor}
        padding={true}
        style={customStyle}
        testID="screen-wrapper"
      >
        <Text>{testContent}</Text>
      </ScreenWrapper>
    );

    const wrapper = getByTestId("screen-wrapper");
    const flattenedStyle = wrapper.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );

    expect(flattenedStyle).toMatchObject({
      flex: 1,
      backgroundColor: customColor,
      padding: GlobalStyles.spacing.screenPadding,
      margin: 10,
    });
  });
});
