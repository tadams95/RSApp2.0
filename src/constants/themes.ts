/**
 * Theme Token System
 * Aligned with web app CSS variables from social-ui-design-spec.md
 *
 * This file defines the complete light/dark theme system for RAGESTATE
 * with tokens for colors, shadows, spacing, typography, and border radii.
 */

export interface ThemeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeColors {
  // Backgrounds (from --bg-*)
  bgRoot: string;
  bgElev1: string;
  bgElev2: string;
  bgReverse: string;
  bgHover: string;

  // Borders (from --border-*)
  borderSubtle: string;
  borderStrong: string;

  // Text (from --text-*)
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Brand (from --accent*)
  accent: string;
  accentGlow: string;
  accentMuted: string;
  focusRing: string;

  // Semantic
  success: string;
  warning: string;
  danger: string;

  // Reactions
  reactionFire: string;
  reactionWow: string;
  reactionLike: string;

  // Presence
  presenceOnline: string;
  presenceIdle: string;

  // Tab Bar
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;

  // Additional UI
  inputBackground: string;
  cardBackground: string;
  overlay: string;
  shimmerBase: string;
  shimmerHighlight: string;
}

export interface ThemeShadows {
  card: ThemeShadow;
  modal: ThemeShadow;
  dropdown: ThemeShadow;
  button: ThemeShadow;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
  cardPadding: number;
  bubblePadding: number;
  composerPadding: number;
  listGutter: number;
  screenPadding: number;
  modalPadding: number;
}

export interface ThemeTypography {
  sizes: {
    display: number;
    sectionHeading: number;
    author: number;
    body: number;
    meta: number;
    button: number;
    caption: number;
  };
  weights: {
    regular: "400";
    medium: "500";
    semibold: "600";
    bold: "700";
  };
  letterSpacing: {
    display: number;
    sectionHeading: number;
    meta: number;
    button: number;
  };
}

export interface ThemeRadius {
  card: number;
  bubble: number;
  composer: number;
  reactionPicker: number;
  button: number;
  input: number;
  avatar: number;
  modal: number;
}

export interface Theme {
  colors: ThemeColors;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  radius: ThemeRadius;
  isDark: boolean;
}

// Shared values that don't change between themes
const sharedSpacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  cardPadding: 16,
  bubblePadding: 12,
  composerPadding: 16,
  listGutter: 8,
  screenPadding: 15,
  modalPadding: 20,
};

const sharedTypography: ThemeTypography = {
  sizes: {
    display: 28, // Hero/optional
    sectionHeading: 20, // Feed heading
    author: 15, // Post author
    body: 15, // Body text
    meta: 12, // Timestamps/counters
    button: 13, // Button/Chip
    caption: 11, // Small captions
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  letterSpacing: {
    display: -0.01,
    sectionHeading: -0.005,
    meta: 0.02,
    button: 0.02,
  },
};

const sharedRadius: ThemeRadius = {
  card: 14,
  bubble: 18,
  composer: 20,
  reactionPicker: 16,
  button: 8,
  input: 10,
  avatar: 999, // Fully round
  modal: 20,
};

/**
 * Dark Theme
 * Primary theme for RAGESTATE, matches the web app's dark mode
 */
export const darkTheme: Theme = {
  colors: {
    // Backgrounds (from --bg-*)
    bgRoot: "#050505",
    bgElev1: "#0d0d0f",
    bgElev2: "#16171a",
    bgReverse: "#ffffff",
    bgHover: "rgba(255, 255, 255, 0.05)",

    // Borders (from --border-*)
    borderSubtle: "#242528",
    borderStrong: "#34363a",

    // Text (from --text-*)
    textPrimary: "#f5f6f7",
    textSecondary: "#a1a5ab",
    textTertiary: "#5d6269",

    // Brand (from --accent*) - RAGESTATE red
    accent: "#ff1f42",
    accentGlow: "#ff415f",
    accentMuted: "rgba(255, 31, 66, 0.25)",
    focusRing: "#ff1f42",

    // Semantic
    success: "#3ddc85",
    warning: "#ffb347",
    danger: "#ff4d4d",

    // Reactions
    reactionFire: "#ff8a1f",
    reactionWow: "#ffd31f",
    reactionLike: "#3d8bff",

    // Presence
    presenceOnline: "#3ddc85",
    presenceIdle: "#ffb347",

    // Tab Bar
    tabBarBackground: "#0d0d0f",
    tabBarActive: "#ff1f42",
    tabBarInactive: "#5d6269",

    // Additional UI
    inputBackground: "#16171a",
    cardBackground: "#0d0d0f",
    overlay: "rgba(0, 0, 0, 0.75)",
    shimmerBase: "#1a1a1c",
    shimmerHighlight: "#2a2a2c",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 4,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 28,
      elevation: 8,
    },
    dropdown: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 4,
    },
    button: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  spacing: sharedSpacing,
  typography: sharedTypography,
  radius: sharedRadius,
  isDark: true,
};

/**
 * Light Theme
 * Alternative theme for users who prefer light mode
 */
export const lightTheme: Theme = {
  colors: {
    // Backgrounds
    bgRoot: "#fafafa",
    bgElev1: "#ffffff",
    bgElev2: "#f0f0f2",
    bgReverse: "#050505",
    bgHover: "rgba(0, 0, 0, 0.04)",

    // Borders
    borderSubtle: "#e0e0e3",
    borderStrong: "#c8c8cc",

    // Text
    textPrimary: "#111113",
    textSecondary: "#555555",
    textTertiary: "#888888",

    // Brand (preserved - RAGESTATE red)
    accent: "#ff1f42",
    accentGlow: "#ff415f",
    accentMuted: "rgba(255, 31, 66, 0.15)",
    focusRing: "#ff1f42",

    // Semantic (adjusted for light)
    success: "#22a55a",
    warning: "#e6a020",
    danger: "#e53935",

    // Reactions (preserved)
    reactionFire: "#ff8a1f",
    reactionWow: "#ffd31f",
    reactionLike: "#3d8bff",

    // Presence (adjusted for light)
    presenceOnline: "#22a55a",
    presenceIdle: "#e6a020",

    // Tab Bar
    tabBarBackground: "#ffffff",
    tabBarActive: "#ff1f42",
    tabBarInactive: "#888888",

    // Additional UI
    inputBackground: "#f5f5f7",
    cardBackground: "#ffffff",
    overlay: "rgba(0, 0, 0, 0.5)",
    shimmerBase: "#e8e8e8",
    shimmerHighlight: "#f5f5f5",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    modal: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 28,
      elevation: 4,
    },
    dropdown: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 2,
    },
    button: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 1,
    },
  },
  spacing: sharedSpacing,
  typography: sharedTypography,
  radius: sharedRadius,
  isDark: false,
};

/**
 * Color Migration Reference
 * Use this as a guide when migrating hardcoded colors
 *
 * Legacy Hardcoded Value           | Use Theme Token
 * ---------------------------------|------------------
 * #000, #050505                    | bgRoot
 * #0d0d0d, #111                    | bgElev1
 * #16171a, #1a1a1c, #222           | bgElev2
 * #fff, #f5f6f7                    | textPrimary
 * #999, #a1a5ab, #888              | textSecondary
 * #666, #5d6269                    | textTertiary
 * #333, #242528                    | borderSubtle
 * #444, #34363a                    | borderStrong
 * #ff3c00, #FF0000, #ff1f42        | accent
 * #ef4444, #ff6b6b, #e74c3c        | danger
 * #2ecc71, #34C759, #3ddc85        | success
 * #FF9500, #ffb347                 | warning
 */

export type ThemeMode = "light" | "dark" | "system";

export default { darkTheme, lightTheme };
