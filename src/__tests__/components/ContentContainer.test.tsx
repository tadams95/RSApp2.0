import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { ContentContainer } from "../../components/ui/ContentContainer";
import { GlobalStyles } from "../../constants/styles";

describe("ContentContainer", () => {
  const testContent = "Test content";

  it("should render children correctly", () => {
    const { getByText } = render(
      <ContentContainer>
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    expect(getByText(testContent)).toBeTruthy();
  });

  it("should apply default padding from GlobalStyles", () => {
    const { getByTestId } = render(
      <ContentContainer testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.padding).toBe(GlobalStyles.spacing.contentPadding);
  });

  it("should apply custom padding from GlobalStyles spacing key", () => {
    const { getByTestId } = render(
      <ContentContainer padding="screenPadding" testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.padding).toBe(GlobalStyles.spacing.screenPadding);
  });

  it("should apply custom numeric padding", () => {
    const customPadding = 25;
    const { getByTestId } = render(
      <ContentContainer padding={customPadding} testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.padding).toBe(customPadding);
  });

  it("should not apply centered styles by default", () => {
    const { getByTestId } = render(
      <ContentContainer testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.alignItems).toBeUndefined();
    expect(flattenedStyle.justifyContent).toBeUndefined();
  });

  it("should apply centered styles when centered=true", () => {
    const { getByTestId } = render(
      <ContentContainer centered testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );
    expect(flattenedStyle.alignItems).toBe("center");
    expect(flattenedStyle.justifyContent).toBe("center");
  });

  it("should apply custom styles", () => {
    const customStyle = { marginTop: 20, backgroundColor: "#FF0000" };
    const { getByTestId } = render(
      <ContentContainer style={customStyle} testID="content-container">
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    expect(container.props.style).toContainEqual(
      expect.objectContaining(customStyle)
    );
  });

  it("should combine all props correctly", () => {
    const customPadding = 15;
    const customStyle = { margin: 10 };

    const { getByTestId } = render(
      <ContentContainer
        padding={customPadding}
        centered
        style={customStyle}
        testID="content-container"
      >
        <Text>{testContent}</Text>
      </ContentContainer>
    );

    const container = getByTestId("content-container");
    const flattenedStyle = container.props.style.reduce(
      (acc: any, style: any) => ({ ...acc, ...style }),
      {}
    );

    expect(flattenedStyle).toMatchObject({
      padding: customPadding,
      alignItems: "center",
      justifyContent: "center",
      margin: 10,
    });
  });
});
