import { ViewStyle } from "react-native";
import { GlobalStyles } from "../constants/styles";

/**
 * Spacing utility functions for consistent spacing application
 */

type SpacingKey = keyof typeof GlobalStyles.spacing;
type SpacingValue = number;

/**
 * Get spacing value from the design system
 */
export const getSpacing = (key: SpacingKey | SpacingValue): number => {
  if (typeof key === "number") return key;
  return GlobalStyles.spacing[key];
};

/**
 * Create margin styles
 */
export const margin = {
  top: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginTop: getSpacing(value),
  }),
  bottom: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginBottom: getSpacing(value),
  }),
  left: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginLeft: getSpacing(value),
  }),
  right: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginRight: getSpacing(value),
  }),
  horizontal: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginHorizontal: getSpacing(value),
  }),
  vertical: (value: SpacingKey | SpacingValue): ViewStyle => ({
    marginVertical: getSpacing(value),
  }),
  all: (value: SpacingKey | SpacingValue): ViewStyle => ({
    margin: getSpacing(value),
  }),
};

/**
 * Create padding styles
 */
export const padding = {
  top: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingTop: getSpacing(value),
  }),
  bottom: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingBottom: getSpacing(value),
  }),
  left: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingLeft: getSpacing(value),
  }),
  right: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingRight: getSpacing(value),
  }),
  horizontal: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingHorizontal: getSpacing(value),
  }),
  vertical: (value: SpacingKey | SpacingValue): ViewStyle => ({
    paddingVertical: getSpacing(value),
  }),
  all: (value: SpacingKey | SpacingValue): ViewStyle => ({
    padding: getSpacing(value),
  }),
};

/**
 * Responsive spacing that adapts to screen size
 */
export const responsiveSpacing = {
  sm: (base: SpacingKey | SpacingValue): number => {
    const baseValue = getSpacing(base);
    return Math.max(baseValue * 0.75, 4); // Minimum 4px
  },
  md: (base: SpacingKey | SpacingValue): number => {
    return getSpacing(base);
  },
  lg: (base: SpacingKey | SpacingValue): number => {
    const baseValue = getSpacing(base);
    return baseValue * 1.25;
  },
};

/**
 * Common spacing patterns used throughout the app
 */
export const spacingPatterns = {
  flashList: {
    contentContainerStyle: {
      padding: GlobalStyles.spacing.flashListPadding,
    },
  },
  button: {
    padding: GlobalStyles.spacing.buttonPadding,
    marginVertical: GlobalStyles.spacing.tabButtonMargin,
  },
  modal: {
    padding: GlobalStyles.spacing.modalPadding,
  },
  screen: {
    padding: GlobalStyles.spacing.screenPadding,
  },
};
