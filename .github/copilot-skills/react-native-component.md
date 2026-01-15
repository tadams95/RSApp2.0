# React Native Component Skill

> **Purpose:** Standardize React Native component creation following RAGESTATE patterns  
> **Applies to:** All components in `src/components/`, screens, and UI elements  
> **Last Updated:** January 14, 2026

---

## Core Principles

1. **Theme-aware by default** - Use `useThemedStyles` hook, never hardcode colors
2. **Type-safe** - All props, state, and data structures have TypeScript interfaces
3. **Performance-first** - Memoize styles, use FlashList for lists, expo-image for images
4. **Consistent patterns** - Follow established component structure and naming conventions

---

## Component Structure Template

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useTheme } from "@/contexts/ThemeContext";

// 1. Define Props Interface
interface MyComponentProps {
  title: string;
  onPress?: () => void;
  isActive?: boolean;
  // Always include optional props with ? and defaults
}

// 2. Component Declaration with FC type
export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onPress,
  isActive = false,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons
        name="check-circle"
        size={24}
        color={isActive ? theme.colors.accent : theme.colors.textSecondary}
      />
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
};

// 3. Styles Factory Function (outside component)
const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
  },
});
```

---

## Required Patterns

### 1. Theme Usage - ALWAYS Use Hooks

✅ **CORRECT:**

```tsx
const { theme } = useTheme();
const styles = useThemedStyles(createStyles);

// In styles factory
const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.bgRoot,
    padding: theme.spacing.md,
  },
});
```

❌ **WRONG:**

```tsx
// Never hardcode colors
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1a1a1a",
    padding: 16,
  },
});
```

### 2. Icons - Use MaterialCommunityIcons

✅ **CORRECT:**

```tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";

<MaterialCommunityIcons name="heart" size={24} color={theme.colors.danger} />;
```

Reference existing components for icon names:

- `ProfileHeader.tsx` - social media icons
- `PostActions.tsx` - interaction icons (heart, comment, share)
- `NotificationCard.tsx` - notification type icons

### 3. Images - Use expo-image

✅ **CORRECT:**

```tsx
import { Image } from "expo-image";

<Image
  source={{ uri: imageUrl }}
  style={styles.image}
  contentFit="cover"
  transition={200}
  placeholder={blurhash}
/>;
```

Use existing helper components:

- `ImageWithFallback` - for profile pictures and avatars
- `LazyImage` - for feed images with loading states
- `ProgressiveImage` - for gradual loading

### 4. Lists - Use FlashList

✅ **CORRECT:**

```tsx
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={100}
  keyExtractor={(item) => item.id}
/>;
```

❌ **WRONG:**

```tsx
// Avoid FlatList for large lists
<FlatList data={items} renderItem={renderItem} />
```

### 5. TypeScript Interfaces

✅ **CORRECT:**

```tsx
// Place interfaces above component
interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  onPress?: () => void;
  onProfilePress?: (userId: string) => void;
}

// For complex data, import from services
import { Post } from "@/services/feedService";
```

❌ **WRONG:**

```tsx
// No 'any' types
function MyComponent(props: any) {}

// No inline prop types
export const MyComponent = ({
  data,
  onPress,
}: {
  data: any;
  onPress: Function;
}) => {};
```

---

## Component Organization

### File Structure

```
src/components/
├── ui/                    # Reusable UI primitives
│   ├── LinkedText.tsx
│   ├── ImageWithFallback.tsx
│   └── index.ts          # Barrel exports
├── feed/                  # Feature-specific components
│   ├── PostCard.tsx
│   ├── PostActions.tsx
│   └── MediaGrid.tsx
├── profile/
│   ├── ProfileHeader.tsx
│   └── EditProfileForm.tsx
└── modals/
    └── ConfirmModal.tsx
```

### Barrel Exports Pattern

In `index.ts` files:

```tsx
// Export named components (not default)
export { LinkedText } from "./LinkedText";
export { ImageWithFallback } from "./ImageWithFallback";

// Document any non-exported components
// NOTE: AppCarousel is NOT exported due to TurboModule issues
```

---

## Theme Token Reference

### Colors (from `constants/themes.ts`)

**Backgrounds:**

- `theme.colors.bgRoot` - Main app background
- `theme.colors.bgElev1` - Cards, elevated surfaces
- `theme.colors.bgElev2` - Modals, overlays
- `theme.colors.bgHover` - Interactive hover states

**Text:**

- `theme.colors.textPrimary` - Primary content
- `theme.colors.textSecondary` - Metadata, labels
- `theme.colors.textTertiary` - Disabled, placeholders

**Brand:**

- `theme.colors.accent` - Primary actions, links
- `theme.colors.accentGlow` - Accent with glow effect
- `theme.colors.focusRing` - Focus states

**Semantic:**

- `theme.colors.success` - Confirmations, success states
- `theme.colors.danger` - Errors, destructive actions
- `theme.colors.warning` - Warnings, cautions

### Spacing

```tsx
theme.spacing.xs; // 4
theme.spacing.sm; // 8
theme.spacing.md; // 16
theme.spacing.lg; // 24
theme.spacing.xl; // 32
theme.spacing.xxl; // 48
theme.spacing.xxxl; // 64
```

### Typography

```tsx
// Sizes
theme.typography.sizes.display; // 32
theme.typography.sizes.sectionHeading; // 24
theme.typography.sizes.author; // 16
theme.typography.sizes.body; // 15
theme.typography.sizes.meta; // 13
theme.typography.sizes.caption; // 11

// Weights
theme.typography.weights.regular; // "400"
theme.typography.weights.medium; // "500"
theme.typography.weights.semibold; // "600"
theme.typography.weights.bold; // "700"
```

### Border Radius

```tsx
theme.borderRadius.sm; // 4
theme.borderRadius.md; // 8
theme.borderRadius.lg; // 12
theme.borderRadius.xl; // 16
theme.borderRadius.full; // 9999
```

### Shadows

```tsx
theme.shadows.card;
theme.shadows.modal;
theme.shadows.dropdown;
theme.shadows.button;
```

---

## Common Patterns from Codebase

### Interactive Touchables

```tsx
// Pattern from PostCard.tsx
<TouchableOpacity
  style={styles.container}
  onPress={onPress}
  activeOpacity={0.7}
>
  {/* Content */}
</TouchableOpacity>
```

### Conditional Rendering

```tsx
// Pattern from ProfileHeader.tsx
{
  userVerified && (
    <MaterialCommunityIcons
      name="check-decagram"
      size={14}
      color={theme.colors.accent}
      style={{ marginLeft: 4 }}
    />
  );
}
```

### Loading States

```tsx
// Pattern from feed components
{
  isLoading ? (
    <LoadingOverlay visible={true} />
  ) : (
    <FlashList data={posts} renderItem={renderPost} />
  );
}
```

### Error Boundaries

```tsx
// Wrap error-prone components
<ErrorBoundary>
  <FeedScreen />
</ErrorBoundary>
```

---

## Real-World Examples from Codebase

### Example 1: PostCard.tsx

- ✅ Uses `useThemedStyles` with factory function
- ✅ TypeScript interfaces for all props
- ✅ Theme tokens for all colors and spacing
- ✅ MaterialCommunityIcons for verification badge
- ✅ expo-image via `ImageWithFallback` component

### Example 2: LinkedText Component

- ✅ Handles @mentions and URLs with theme colors
- ✅ Proper TypeScript for text parsing logic
- ✅ Callback props with proper signatures

### Example 3: ProfileHeader.tsx

- ✅ Social media icons with MaterialCommunityIcons
- ✅ Conditional rendering for optional fields
- ✅ Theme-aware styling throughout

---

## DO's and DON'Ts

### ✅ DO

- Use `useThemedStyles` hook for all styles
- Import `Theme` type from `@/constants/themes`
- Use theme tokens for colors, spacing, typography
- Export components with named exports
- Add TypeScript interfaces for all props
- Use `React.FC<Props>` type for function components
- Memoize expensive computations with `useMemo`
- Use FlashList for long lists
- Use expo-image for images
- Handle loading and error states
- Add proper key props to list items

### ❌ DON'T

- Hardcode colors or spacing values
- Use `any` types in TypeScript
- Export with `default export` (use named exports)
- Use FlatList for large datasets (use FlashList)
- Use `Image` from react-native (use expo-image)
- Forget to clean up subscriptions/listeners
- Ignore theme context - all components must support light/dark
- Create inline style objects that recreate on every render
- Use string literals for repeated values
- Skip error boundaries for user-facing components

---

## Performance Tips

1. **Memoize styles** - `useThemedStyles` handles this automatically
2. **Use `React.memo`** for expensive list items
3. **Avoid inline functions** in render (define callbacks outside JSX)
4. **Use `estimatedItemSize`** with FlashList for better performance
5. **Lazy load images** with `LazyImage` or `ProgressiveImage`
6. **Debounce search inputs** - see `useUserSearch.ts` pattern

---

## Testing Checklist

Before committing a new component:

- [ ] Renders correctly in light AND dark theme
- [ ] All TypeScript types are defined (no `any`)
- [ ] Uses theme tokens (no hardcoded colors/spacing)
- [ ] Handles loading/error states appropriately
- [ ] Proper key props on list items
- [ ] TouchableOpacity has activeOpacity={0.7}
- [ ] Icons use MaterialCommunityIcons
- [ ] Images use expo-image
- [ ] Component is exported in appropriate index.ts
- [ ] No console warnings in development

---

## Additional Resources

- `src/components/feed/PostCard.tsx` - Complex component example
- `src/components/ui/LinkedText.tsx` - Text processing example
- `src/hooks/useThemedStyles.ts` - Styling hook documentation
- `src/constants/themes.ts` - Complete theme token reference
- `docs/social-ui-design-spec.md` - UI design system specification
