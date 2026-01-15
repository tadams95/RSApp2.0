# Theming & Styling Skill

> **Purpose:** Ensure consistent dark/light theme support and styling patterns across RAGESTATE  
> **Applies to:** All React Native components with visual styles  
> **Last Updated:** January 14, 2026

---

## Core Principles

1. **Never hardcode colors** - Always use theme tokens from `ThemeContext`
2. **Support light/dark/system modes** - All components must work in both themes
3. **Consistent spacing** - Use theme spacing tokens, not magic numbers
4. **Memoized styles** - Use `useThemedStyles` hook to prevent unnecessary re-renders
5. **Type-safe** - Use `Theme` type from `constants/themes.ts`

---

## Theme System Architecture

RAGESTATE uses a token-based theme system aligned with web CSS variables:

```
constants/themes.ts      → Theme definitions (light/dark)
contexts/ThemeContext.tsx → Theme provider and state management
hooks/useThemedStyles.ts  → Style creation hook
```

---

## Essential Hooks

### 1. useTheme - Access Current Theme

```tsx
import { useTheme } from "@/contexts/ThemeContext";

function MyComponent() {
  const { theme, mode, isDark, setMode } = useTheme();

  // theme: Current theme object with all tokens
  // mode: 'light' | 'dark' | 'system'
  // isDark: boolean - true if dark theme active
  // setMode: Function to change theme mode
}
```

### 2. useThemedStyles - Create Memoized Styles

✅ **PRIMARY METHOD - Use this for all components:**

```tsx
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { Theme } from "@/constants/themes";

const MyComponent = () => {
  const styles = useThemedStyles(createStyles);

  return <View style={styles.container} />;
};

// Factory function OUTSIDE component
const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.bgRoot,
    padding: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sectionHeading,
    fontWeight: theme.typography.weights.bold,
  },
});
```

### 3. useThemedStyle - Single Style Object

For inline or one-off styles:

```tsx
import { useThemedStyle } from "@/hooks/useThemedStyles";

const containerStyle = useThemedStyle((theme) => ({
  backgroundColor: theme.colors.bgElev1,
  flex: 1,
}));

return <View style={containerStyle} />;
```

---

## Complete Theme Token Reference

### Colors

#### Backgrounds

```tsx
theme.colors.bgRoot       // Main app background
theme.colors.bgElev1      // Cards, elevated surfaces (level 1)
theme.colors.bgElev2      // Modals, overlays (level 2)
theme.colors.bgReverse    // Opposite of root (for high contrast)
theme.colors.bgHover      // Interactive hover/press states

// Usage example:
backgroundColor: theme.colors.bgElev1,
```

#### Borders

```tsx
theme.colors.borderSubtle  // Subtle dividers, soft borders
theme.colors.borderStrong  // Prominent borders, focused states

// Usage example:
borderWidth: 1,
borderColor: theme.colors.borderSubtle,
```

#### Text

```tsx
theme.colors.textPrimary   // Primary content, headlines
theme.colors.textSecondary // Metadata, labels, subdued text
theme.colors.textTertiary  // Disabled, placeholder text

// Usage example:
color: theme.colors.textPrimary,
```

#### Brand Colors

```tsx
theme.colors.accent        // Primary brand actions, links
theme.colors.accentGlow    // Accent with glow effect
theme.colors.accentMuted   // Muted accent for backgrounds
theme.colors.focusRing     // Focus indicator color

// Usage example:
color: theme.colors.accent,
```

#### Semantic Colors

```tsx
theme.colors.success       // Success messages, confirmations
theme.colors.warning       // Warning messages
theme.colors.danger        // Errors, destructive actions
theme.colors.warningMuted  // Warning backgrounds
theme.colors.dangerMuted   // Error backgrounds

// Usage example:
backgroundColor: theme.colors.dangerMuted,
color: theme.colors.danger,
```

#### Reactions

```tsx
theme.colors.reactionFire; // 🔥 Fire reaction
theme.colors.reactionWow; // 😮 Wow reaction
theme.colors.reactionLike; // ❤️ Like reaction

// Usage from PostActions.tsx
```

#### Presence

```tsx
theme.colors.presenceOnline; // Online status indicator
theme.colors.presenceIdle; // Away/idle status

// Usage for user status badges
```

#### Tab Bar

```tsx
theme.colors.tabBarBackground; // Tab bar background
theme.colors.tabBarActive; // Active tab color
theme.colors.tabBarInactive; // Inactive tab color

// Usage in navigation layouts
```

#### Additional UI

```tsx
theme.colors.inputBackground; // Text input backgrounds
theme.colors.cardBackground; // Card backgrounds
theme.colors.overlay; // Modal overlay backgrounds
theme.colors.shimmerBase; // Loading shimmer base color
theme.colors.shimmerHighlight; // Loading shimmer highlight
```

---

### Spacing

Consistent spacing scale based on 4px/8px grid:

```tsx
theme.spacing.xs; // 4px  - Tight gaps
theme.spacing.sm; // 8px  - Small gaps, icon padding
theme.spacing.md; // 16px - Default padding/margin
theme.spacing.lg; // 24px - Section spacing
theme.spacing.xl; // 32px - Large sections
theme.spacing.xxl; // 48px - Major sections
theme.spacing.xxxl; // 64px - Hero spacing

// Semantic spacing
theme.spacing.cardPadding; // 16px - Card internal padding
theme.spacing.bubblePadding; // 12px - Chat bubble padding
theme.spacing.composerPadding; // 12px - Input composer padding
theme.spacing.listGutter; // 8px  - List item gaps
theme.spacing.screenPadding; // 16px - Screen edge padding
theme.spacing.modalPadding; // 20px - Modal internal padding
```

**Usage examples:**

```tsx
// Good - semantic names
padding: theme.spacing.cardPadding,
marginBottom: theme.spacing.listGutter,

// Good - scale values
paddingHorizontal: theme.spacing.md,
gap: theme.spacing.sm,

// ❌ Bad - magic numbers
padding: 16,
margin: 8,
```

---

### Typography

#### Sizes

```tsx
theme.typography.sizes.display; // 32px - Page titles, hero text
theme.typography.sizes.sectionHeading; // 24px - Section headings
theme.typography.sizes.author; // 16px - Author names, usernames
theme.typography.sizes.body; // 15px - Body text, posts
theme.typography.sizes.meta; // 13px - Metadata, timestamps
theme.typography.sizes.button; // 16px - Button text
theme.typography.sizes.caption; // 11px - Captions, fine print
```

#### Weights

```tsx
theme.typography.weights.regular; // "400" - Body text
theme.typography.weights.medium; // "500" - Subtle emphasis
theme.typography.weights.semibold; // "600" - Subheadings
theme.typography.weights.bold; // "700" - Headings, strong emphasis
```

#### Line Heights

```tsx
theme.typography.lineHeights.tight; // 1.2  - Headlines
theme.typography.lineHeights.normal; // 1.5  - Body text
theme.typography.lineHeights.relaxed; // 1.75 - Paragraphs
```

**Usage example:**

```tsx
const createStyles = (theme: Theme) => ({
  title: {
    fontSize: theme.typography.sizes.sectionHeading,
    fontWeight: theme.typography.weights.bold,
    lineHeight: theme.typography.lineHeights.tight,
    color: theme.colors.textPrimary,
  },
  body: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.regular,
    lineHeight: theme.typography.lineHeights.normal,
    color: theme.colors.textSecondary,
  },
});
```

---

### Border Radius

```tsx
theme.borderRadius.sm; // 4px  - Subtle rounding
theme.borderRadius.md; // 8px  - Cards, buttons
theme.borderRadius.lg; // 12px - Large cards
theme.borderRadius.xl; // 16px - Modals
theme.borderRadius.full; // 9999px - Circular (avatars, pills)
```

**Usage example:**

```tsx
avatar: {
  width: 40,
  height: 40,
  borderRadius: theme.borderRadius.full,
},
card: {
  borderRadius: theme.borderRadius.md,
},
```

---

### Shadows

Pre-configured shadow objects with proper React Native structure:

```tsx
theme.shadows.card; // Subtle card elevation
theme.shadows.modal; // Modal/dialog elevation
theme.shadows.dropdown; // Dropdown/popover elevation
theme.shadows.button; // Button elevation
```

**Usage example:**

```tsx
const createStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.bgElev1,
    ...theme.shadows.card, // Spreads all shadow properties
  },
});

// Produces:
// {
//   shadowColor: "#000",
//   shadowOffset: { width: 0, height: 2 },
//   shadowOpacity: 0.1,
//   shadowRadius: 4,
//   elevation: 2, // Android
// }
```

---

## Real-World Examples

### Example 1: PostCard Component

```tsx
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { Theme } from "@/constants/themes";

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.authorName}>{post.userDisplayName}</Text>
      <Text style={styles.content}>{post.content}</Text>
      <Text style={styles.timestamp}>{formatTime(post.timestamp)}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.bgElev1,
    padding: theme.spacing.cardPadding,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
    marginBottom: theme.spacing.listGutter,
  },
  authorName: {
    fontSize: theme.typography.sizes.author,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  content: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.regular,
    lineHeight: theme.typography.lineHeights.normal,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  timestamp: {
    fontSize: theme.typography.sizes.meta,
    color: theme.colors.textTertiary,
  },
});
```

### Example 2: Interactive Button

```tsx
const MyButton = ({ title, onPress, variant = "primary" }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const backgroundColor =
    variant === "primary" ? theme.colors.accent : theme.colors.bgElev2;

  const textColor =
    variant === "primary" ? "#FFFFFF" : theme.colors.textPrimary;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => ({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    ...theme.shadows.button,
  },
  buttonText: {
    fontSize: theme.typography.sizes.button,
    fontWeight: theme.typography.weights.semibold,
  },
});
```

### Example 3: Icon with Theme Color

```tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

const LikeButton = ({ isLiked, onPress }) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity onPress={onPress}>
      <MaterialCommunityIcons
        name={isLiked ? "heart" : "heart-outline"}
        size={24}
        color={isLiked ? theme.colors.danger : theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
};
```

---

## Common Patterns

### Pattern 1: Conditional Theme-Based Styling

```tsx
const { theme, isDark } = useTheme();

// For component-level decisions
const iconColor = isDark
  ? theme.colors.textSecondary
  : theme.colors.textTertiary;

// For style objects
const dynamicStyle = useThemedStyle((theme) => ({
  backgroundColor: theme.colors.bgElev1,
  borderWidth: 1,
  borderColor: theme.isDark
    ? theme.colors.borderStrong
    : theme.colors.borderSubtle,
}));
```

### Pattern 2: Combining Static and Themed Styles

```tsx
const styles = useThemedStyles(createStyles);

<View style={[styles.container, { opacity: isVisible ? 1 : 0 }]} />;
```

### Pattern 3: Theme-Aware Animations

```tsx
import { useTheme } from "@/contexts/ThemeContext";

const AnimatedComponent = () => {
  const { theme } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.bgElev1, theme.colors.accent]
    ),
  }));

  return <Animated.View style={animatedStyle} />;
};
```

### Pattern 4: Platform-Specific Themed Styles

```tsx
import { Platform } from "react-native";

const createStyles = (theme: Theme) => ({
  container: {
    ...Platform.select({
      ios: {
        ...theme.shadows.card,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: `0 2px 8px ${theme.colors.overlay}`,
      },
    }),
  },
});
```

---

## Theme Migration Checklist

Use this when updating existing components:

- [ ] Remove all hardcoded color strings (`#000`, `#fff`, `"red"`)
- [ ] Replace magic number spacing with theme tokens
- [ ] Convert `StyleSheet.create` to `useThemedStyles` pattern
- [ ] Move style factory function outside component
- [ ] Import and use `Theme` type for factory function
- [ ] Test in both light and dark modes
- [ ] Check contrast ratios for accessibility
- [ ] Replace hardcoded font sizes with typography tokens
- [ ] Use theme border radius values
- [ ] Apply theme shadows instead of custom shadow props

---

## Color Contrast Guidelines

Ensure proper contrast for accessibility:

**High contrast pairs:**

- `textPrimary` on `bgRoot`
- `textPrimary` on `bgElev1`
- White on `accent`
- White on `danger`

**Medium contrast pairs:**

- `textSecondary` on `bgRoot`
- `textSecondary` on `bgElev1`

**Low contrast (use sparingly):**

- `textTertiary` on `bgElev1` (placeholders only)

---

## DO's and DON'Ts

### ✅ DO

- Use `useThemedStyles` for all component styles
- Use theme tokens for ALL colors, spacing, typography
- Test components in both light and dark themes
- Use semantic color names (`textPrimary` not `black`)
- Spread theme shadows: `...theme.shadows.card`
- Use theme spacing for consistency
- Keep style factory functions outside components
- Import `Theme` type for type safety

### ❌ DON'T

- Hardcode colors: `"#1a1a1a"`, `"black"`, `"white"`
- Hardcode spacing: `padding: 16`, use `theme.spacing.md`
- Use `StyleSheet.create` without theme
- Inline styles that should be themed
- Forget to test in dark mode
- Mix theme tokens with hardcoded values
- Create styles inside component body (causes re-renders)
- Use CSS color names (`"red"`, `"blue"`)

---

## Testing Checklist

Before committing themed components:

- [ ] Component renders in light mode
- [ ] Component renders in dark mode
- [ ] All colors come from theme tokens
- [ ] All spacing uses theme values
- [ ] Text is readable in both themes
- [ ] Borders are visible in both themes
- [ ] No hardcoded color values remain
- [ ] Icons use theme colors appropriately
- [ ] Shadows display correctly
- [ ] Focus states are visible

---

## Theme Debugging

### Quick Theme Switcher (for testing)

```tsx
import { useTheme } from "@/contexts/ThemeContext";

const ThemeDebugger = () => {
  const { mode, setMode } = useTheme();

  return (
    <View>
      <Button title="Light" onPress={() => setMode("light")} />
      <Button title="Dark" onPress={() => setMode("dark")} />
      <Button title="System" onPress={() => setMode("system")} />
      <Text>Current: {mode}</Text>
    </View>
  );
};
```

### Inspect Theme Values

```tsx
import { useTheme } from "@/contexts/ThemeContext";

const { theme } = useTheme();
console.log("Current theme colors:", theme.colors);
console.log("Current spacing:", theme.spacing);
```

---

## Additional Resources

- `src/constants/themes.ts` - Complete theme definitions
- `src/contexts/ThemeContext.tsx` - Theme provider implementation
- `src/hooks/useThemedStyles.ts` - Styling hook documentation
- `docs/THEME-MIGRATION-CHECKLIST.md` - Migration guide
- `docs/COLOR-CONSISTENCY-CHECKLIST.md` - Color usage guide
- `docs/social-ui-design-spec.md` - Design system specification
