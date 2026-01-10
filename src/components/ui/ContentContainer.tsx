import React from "react";
import { View, ViewStyle } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
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

const createStyles = (theme: Theme) =>
  ({
    centered: {
      alignItems: "center",
      justifyContent: "center",
    },
  } as const);

export default ContentContainer;
