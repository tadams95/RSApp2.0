/**
 * useThemedStyles Hook
 * Creates memoized StyleSheet objects that automatically update with theme changes
 *
 * This hook provides a pattern for creating theme-aware styles that:
 * - Automatically re-render when theme changes
 * - Are memoized for performance
 * - Support TypeScript type inference
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const styles = useThemedStyles((theme) => ({
 *     container: {
 *       backgroundColor: theme.colors.bgRoot,
 *       padding: theme.spacing.md,
 *     },
 *     title: {
 *       color: theme.colors.textPrimary,
 *       fontSize: theme.typography.sizes.sectionHeading,
 *       fontWeight: theme.typography.weights.bold,
 *     },
 *   }));
 *
 *   return (
 *     <View style={styles.container}>
 *       <Text style={styles.title}>Hello</Text>
 *     </View>
 *   );
 * }
 * ```
 */

import { useMemo } from "react";
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";

// Type for style objects
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

// Type for the style factory function
type StyleFactory<T extends NamedStyles<T>> = (theme: Theme) => T;

/**
 * useThemedStyles
 * Creates a StyleSheet from a factory function that receives the current theme
 *
 * @param styleFactory - Function that takes the theme and returns a styles object
 * @returns Memoized StyleSheet that updates when theme changes
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): T {
  const { theme } = useTheme();

  return useMemo(() => {
    const rawStyles = styleFactory(theme);
    return StyleSheet.create(rawStyles) as T;
  }, [theme, styleFactory]);
}

/**
 * useThemedStyle
 * Creates a single memoized style object (not a full StyleSheet)
 * Useful for inline styles that need theme values
 *
 * @example
 * ```tsx
 * const containerStyle = useThemedStyle((theme) => ({
 *   backgroundColor: theme.colors.bgRoot,
 *   flex: 1,
 * }));
 *
 * return <View style={containerStyle} />;
 * ```
 */
export function useThemedStyle<T extends ViewStyle | TextStyle | ImageStyle>(
  styleFactory: (theme: Theme) => T
): T {
  const { theme } = useTheme();

  return useMemo(() => styleFactory(theme), [theme, styleFactory]);
}

/**
 * createThemedStyles
 * Pre-creates a style factory function for use with useThemedStyles
 * Useful when you want to define styles outside the component
 *
 * @example
 * ```tsx
 * // In a separate styles file or at module level
 * const createStyles = createThemedStyles((theme) => ({
 *   container: {
 *     backgroundColor: theme.colors.bgRoot,
 *     flex: 1,
 *   },
 * }));
 *
 * // In your component
 * function MyComponent() {
 *   const styles = useThemedStyles(createStyles);
 *   return <View style={styles.container} />;
 * }
 * ```
 */
export function createThemedStyles<T extends NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): StyleFactory<T> {
  return styleFactory;
}

/**
 * Common themed style patterns
 * Pre-built style factories for common UI patterns
 */
export const commonThemedStyles = {
  /**
   * Screen container with theme background
   */
  screenContainer: createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
  })),

  /**
   * Card with theme styling
   */
  card: createThemedStyles((theme) => ({
    card: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      padding: theme.spacing.cardPadding,
      ...theme.shadows.card,
    },
  })),

  /**
   * Modal content with theme styling
   */
  modal: createThemedStyles((theme) => ({
    modalContent: {
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.modal,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      padding: theme.spacing.modalPadding,
      ...theme.shadows.modal,
    },
  })),

  /**
   * Primary button styling
   */
  primaryButton: createThemedStyles((theme) => ({
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.button,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      ...theme.shadows.button,
    },
    buttonText: {
      color: theme.colors.bgReverse,
      fontSize: theme.typography.sizes.button,
      fontWeight: theme.typography.weights.semibold,
      letterSpacing: theme.typography.letterSpacing.button,
    },
  })),

  /**
   * Text input with theme styling
   */
  input: createThemedStyles((theme) => ({
    input: {
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.radius.input,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      color: theme.colors.textPrimary,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      fontSize: theme.typography.sizes.body,
    },
    inputFocused: {
      borderColor: theme.colors.accent,
    },
  })),

  /**
   * Text styles for common typography
   */
  typography: createThemedStyles((theme) => ({
    displayText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.display,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: theme.typography.letterSpacing.display,
    },
    headingText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sectionHeading,
      fontWeight: theme.typography.weights.semibold,
      letterSpacing: theme.typography.letterSpacing.sectionHeading,
    },
    bodyText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.regular,
    },
    secondaryText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.regular,
    },
    metaText: {
      color: theme.colors.textTertiary,
      fontSize: theme.typography.sizes.meta,
      fontWeight: theme.typography.weights.regular,
      letterSpacing: theme.typography.letterSpacing.meta,
    },
  })),
};

export default useThemedStyles;
