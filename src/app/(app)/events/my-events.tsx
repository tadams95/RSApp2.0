/**
 * My Events Screen Route
 *
 * This is a thin wrapper that renders the consolidated MyEvents component.
 * All logic, state management, and UI is in the MyEvents component.
 *
 * @see src/components/modals/MyEvents.tsx - Main component with all functionality
 */
import React from "react";
import { View } from "react-native";
import MyEvents from "../../../components/modals/MyEvents";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";

export default function MyEventsScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <MyEvents isStandaloneScreen />
    </View>
  );
}

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
  } as const);
