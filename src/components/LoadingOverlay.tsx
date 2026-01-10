import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";

interface LoadingOverlayProps {
  message?: string;
}

function LoadingOverlay({ message }: LoadingOverlayProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.container}
      accessibilityLabel="Loading indicator"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size="large" color={theme.colors.accent} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

export default LoadingOverlay;

const createStyles = (theme: Theme) =>
  ({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.bgRoot,
      padding: 24,
    },
    message: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "500",
      marginTop: 16,
    },
  } as const);
