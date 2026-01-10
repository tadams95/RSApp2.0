import React from "react";
import { View, ViewStyle } from "react-native";
import { GlobalStyles } from "../../constants/styles";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface ScreenWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  padding?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Standardized screen wrapper component to ensure consistent spacing and layout
 * across all screens. Replaces inconsistent SafeAreaView usage.
 */
export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  backgroundColor,
  padding = true,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const bgColor = backgroundColor ?? theme.colors.bgRoot;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: bgColor },
        padding && styles.withPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      flex: 1,
    },
    withPadding: {
      padding: GlobalStyles.spacing.screenPadding,
    },
  } as const);

export default ScreenWrapper;
