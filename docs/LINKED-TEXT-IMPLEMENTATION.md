# Linked Text Implementation Spec

> **Timeline**: 2-3 hours | **Priority**: 🟡 Enhancement  
> **Dependencies**: None (standalone feature)  
> **Outcome**: URLs, @mentions, and #hashtags in feed posts become tappable links

---

## Overview

Implement a `LinkedText` component that parses text content and renders clickable links for:

- **URLs** → Opens in browser via `Linking.openURL()`
- **@mentions** → Navigates to user profile
- **#hashtags** → (Future) Navigates to hashtag search

---

## Current State

**File**: `src/components/feed/PostCard.tsx` (Line 169)

```typescript
// Current implementation - plain text, not interactive
{
  content ? <Text style={styles.content}>{content}</Text> : null;
}
```

**Problem**: URLs like `https://ragestate.com` and mentions like `@username` render as plain text with no tap interaction.

---

## Solution Architecture

### Components to Create

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `src/utils/textParser.ts`          | Regex parsing utilities for URLs, mentions, hashtags |
| `src/components/ui/LinkedText.tsx` | Renders parsed text with tappable segments           |

### Integration Point

| File                               | Change                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| `src/components/feed/PostCard.tsx` | Replace `<Text>{content}</Text>` with `<LinkedText text={content} />` |
| `src/components/ui/index.ts`       | Export LinkedText component                                           |

---

## Data Model

**No database changes required.** This is a presentation-layer enhancement.

---

## User Experience Flow

```
User views post with URL/mention
        ↓
LinkedText parses content
        ↓
    ┌───────────────────────────────────────┐
    │  "Check out https://ragestate.com     │
    │   with @djshadow for the event!"      │
    │        ↑              ↑               │
    │     (blue)        (blue)              │
    │     tappable      tappable            │
    └───────────────────────────────────────┘
        ↓                   ↓
   Tap URL            Tap @mention
        ↓                   ↓
   Opens browser      Navigate to profile
```

---

## Technical Specification

### 1. Text Parser Utility

**File**: `src/utils/textParser.ts`

```typescript
export type TextSegment =
  | { type: "text"; content: string }
  | { type: "url"; content: string; url: string }
  | { type: "mention"; content: string; username: string }
  | { type: "hashtag"; content: string; tag: string };

export function parseText(text: string): TextSegment[];
```

**Regex Patterns**:

| Pattern                 | Matches                             |
| ----------------------- | ----------------------------------- |
| `https?://[^\s<>"\)]+`  | URLs (http/https)                   |
| `@([a-zA-Z0-9_]{1,30})` | @mentions (1-30 alphanumeric chars) |
| `#([a-zA-Z0-9_]{1,50})` | #hashtags (1-50 alphanumeric chars) |

**Edge Cases to Handle**:

- URLs at end of sentence with punctuation: `Check this https://ragestate.com.`
- URLs in parentheses: `(see https://ragestate.com)`
- Multiple consecutive links
- Malformed URLs (validate before linking)

---

### 2. LinkedText Component

**File**: `src/components/ui/LinkedText.tsx`

```typescript
interface LinkedTextProps {
  text: string;
  style?: TextStyle;
  linkStyle?: TextStyle;
  onMentionPress?: (username: string) => void;
  onHashtagPress?: (tag: string) => void;
  onUrlPress?: (url: string) => void;
  numberOfLines?: number;
}

export function LinkedText(props: LinkedTextProps): JSX.Element;
```

**Behavior**:

| Segment Type | Tap Action                 | Style                            |
| ------------ | -------------------------- | -------------------------------- |
| Plain text   | None                       | `style` prop                     |
| URL          | `Linking.openURL(url)`     | `theme.colors.accent`, underline |
| @mention     | `onMentionPress(username)` | `theme.colors.accent`, bold      |
| #hashtag     | `onHashtagPress(tag)`      | `theme.colors.accent`            |

**Theme Integration**:

- Link color: `theme.colors.accent`
- Inherits text styling from parent
- Uses `useTheme()` hook

---

### 3. PostCard Integration

**File**: `src/components/feed/PostCard.tsx`

**Before** (Line 169):

```typescript
{
  content ? <Text style={styles.content}>{content}</Text> : null;
}
```

**After**:

```typescript
{
  content ? (
    <LinkedText
      text={content}
      style={styles.content}
      onMentionPress={(username) => router.push(`/(app)/profile/${username}`)}
    />
  ) : null;
}
```

---

## Implementation Phases

### Phase 1: Core Parser (~30 min) ✅

- [x] Create `src/utils/textParser.ts`
- [x] Implement `parseText()` function
- [x] Handle URL regex with punctuation edge cases
- [x] Handle @mention regex
- [x] Handle #hashtag regex
- [ ] Write unit tests for parser (optional)

### Phase 2: LinkedText Component (~45 min) ✅

- [x] Create `src/components/ui/LinkedText.tsx`
- [x] Implement themed link styling
- [x] Handle URL tap with `Linking.openURL()`
- [x] Implement callback props for mentions/hashtags
- [x] Support `numberOfLines` truncation
- [x] Export from `src/components/ui/index.ts`

### Phase 3: PostCard Integration (~15 min) ✅

- [x] Import LinkedText in PostCard
- [x] Replace plain Text with LinkedText
- [x] Wire up `onMentionPress` to navigate to profile
- [ ] Test in feed

### Phase 4: @Mention Profile Navigation (~30 min) ✅

- [x] Verify username-based profile lookup works
- [x] Handle non-existent usernames gracefully (show toast)
- [ ] Test navigation flow

### Phase 5: Polish & Edge Cases (~30 min) ✅

- [x] Test malformed URLs (handled via `Linking.canOpenURL` check)
- [x] Test very long URLs (truncate display?) → Added `truncateUrl()` + `maxUrlLength` prop
- [x] Test accessibility (screen reader) → Added `accessibilityHint` to all link types
- [ ] Test in both light and dark themes (manual)

---

## Testing Checklist

### Manual Tests

| Test Case              | Expected Behavior                                   |
| ---------------------- | --------------------------------------------------- |
| Post with URL          | URL styled accent color, opens browser on tap       |
| Post with @mention     | @mention styled accent + bold, navigates to profile |
| Post with #hashtag     | #hashtag styled accent (no action yet)              |
| Post with all three    | Each parsed and interactive correctly               |
| URL at end of sentence | Punctuation not included in URL                     |
| URL in parentheses     | Parentheses not included in URL                     |
| Non-existent @mention  | Shows "User not found" alert                        |
| Invalid URL            | `canOpenURL` checked before opening                 |
| Very long URL          | Truncated to ~50 chars with "..."                   |

### Unit Tests

```typescript
// src/utils/__tests__/textParser.test.ts
describe("parseText", () => {
  it("parses plain text");
  it("parses single URL");
  it("parses URL at end with period");
  it("parses URL in parentheses");
  it("parses @mention");
  it("parses #hashtag");
  it("parses mixed content");
  it("handles empty string");
  it("handles text with no links");
});
```

---

## Accessibility

- [x] Links have `accessibilityRole` ("link" for URLs, "button" for mentions/hashtags)
- [x] Links have `accessibilityLabel` announcing the type and content
- [x] Links have `accessibilityHint` describing the action ("Opens in browser", "Tap to view profile")
- [ ] Touch targets at least 44pt (inherits from parent Text size)

---

## Future Enhancements

1. **Hashtag Search**: Navigate to posts filtered by hashtag
2. **Link Preview Cards**: Show thumbnail/title for URLs
3. **Mention Autocomplete**: In composer, suggest users as typing @
4. ~~**URL Shortening**: Display truncated URLs like "ragestate.com/even..."~~ ✅ Implemented
5. **Phone Numbers**: Parse and make callable
6. **Email Addresses**: Parse and open mail app

---

## Files Changed Summary

| File                                   | Action | LOC  |
| -------------------------------------- | ------ | ---- |
| `src/utils/textParser.ts`              | CREATE | ~120 |
| `src/components/ui/LinkedText.tsx`     | CREATE | ~200 |
| `src/components/ui/index.ts`           | MODIFY | +1   |
| `src/components/feed/PostCard.tsx`     | MODIFY | ~10  |
| `src/app/(app)/home/index.tsx`         | MODIFY | ~30  |
| `src/app/(app)/home/post/[postId].tsx` | MODIFY | ~30  |

**Total**: ~400 lines of code

---

## Success Criteria

- [x] URLs in posts open in external browser
- [x] @mentions navigate to user profile
- [x] Links styled with accent color in both themes
- [x] Works with `numberOfLines` truncation
- [x] Long URLs truncated for display
- [ ] No regression in feed performance (needs manual test)
