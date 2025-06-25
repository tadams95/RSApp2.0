import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { GlobalStyles } from "../../constants/styles";

interface ContentContainerProps {
  children: React.ReactNode;
  padding?: keyof typeof GlobalStyles.spacing | number;
  style?: ViewStyle;
  centered?: boolean;
  testID?: string;
}

/**
 * Standardized content container with consistent padding
 * Ensures uniform spacing across different content sections
 */
export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  padding = "contentPadding",
  style,
  centered = false,
  testID,
}) => {
  const paddingValue =
    typeof padding === "string" ? GlobalStyles.spacing[padding] : padding;

  return (
    <View
      testID={testID}
      style={[{ padding: paddingValue }, centered && styles.centered, style]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ContentContainer;
