import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { GlobalStyles } from "../../constants/styles";

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
  backgroundColor = GlobalStyles.colors.background,
  padding = true,
  style,
  testID,
}) => {
  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor },
        padding && styles.withPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  withPadding: {
    padding: GlobalStyles.spacing.screenPadding,
  },
});

export default ScreenWrapper;
