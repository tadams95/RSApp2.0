/**
 * Theme Context
 * Provides theme state management with light/dark/system mode support
 *
 * Features:
 * - Persists user preference to AsyncStorage
 * - Respects system color scheme when set to "system"
 * - Provides theme object and isDark boolean for convenience
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, Theme, ThemeMode } from "../constants/themes";

const THEME_STORAGE_KEY = "@ragestate_theme_mode";

interface ThemeContextValue {
  /** The current theme object with all tokens */
  theme: Theme;
  /** The user's theme preference: 'light', 'dark', or 'system' */
  mode: ThemeMode;
  /** Convenience boolean - true if currently showing dark theme */
  isDark: boolean;
  /** Update the theme mode preference */
  setMode: (mode: ThemeMode) => Promise<void>;
  /** Whether the theme context has finished loading */
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Initial mode to use before loading from storage (default: 'system') */
  defaultMode?: ThemeMode;
}

/**
 * ThemeProvider
 * Wrap your app with this provider to enable theming
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultMode = "system",
}: ThemeProviderProps): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored && ["light", "dark", "system"].includes(stored)) {
          setModeState(stored as ThemeMode);
        }
      } catch (error) {
        console.warn("Failed to load theme preference:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemePreference();
  }, []);

  // Update theme mode and persist to storage
  const setMode = useCallback(async (newMode: ThemeMode) => {
    try {
      setModeState(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  }, []);

  // Determine if we should show dark theme
  const isDark = useMemo(() => {
    if (mode === "system") {
      return systemColorScheme === "dark";
    }
    return mode === "dark";
  }, [mode, systemColorScheme]);

  // Get the appropriate theme object
  const theme = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  const contextValue = useMemo(
    () => ({
      theme,
      mode,
      isDark,
      setMode,
      isLoaded,
    }),
    [theme, mode, isDark, setMode, isLoaded]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme hook
 * Access the current theme and theme controls
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, isDark, setMode } = useTheme();
 *
 *   return (
 *     <View style={{ backgroundColor: theme.colors.bgRoot }}>
 *       <Text style={{ color: theme.colors.textPrimary }}>
 *         Currently using {isDark ? 'dark' : 'light'} mode
 *       </Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used within a ThemeProvider. " +
        "Wrap your app with <ThemeProvider> in _layout.tsx"
    );
  }

  return context;
}

/**
 * useThemeColors hook
 * Shorthand to get just the colors object
 *
 * @example
 * ```tsx
 * const colors = useThemeColors();
 * <View style={{ backgroundColor: colors.bgRoot }} />
 * ```
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * useIsDarkMode hook
 * Simple hook to check if dark mode is active
 *
 * @example
 * ```tsx
 * const isDark = useIsDarkMode();
 * const iconColor = isDark ? 'white' : 'black';
 * ```
 */
export function useIsDarkMode(): boolean {
  const { isDark } = useTheme();
  return isDark;
}

// Named export for class components using ThemeContext.Consumer
export { ThemeContext };

export default ThemeContext;
