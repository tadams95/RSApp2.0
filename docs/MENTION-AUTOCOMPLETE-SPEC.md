# Mention Autocomplete Specification

## Overview

Add `@mention` autocomplete functionality to the PostComposer, allowing users to tag other users when creating posts. This follows the standard social media pattern (Twitter/X, Instagram, TikTok).

**Related:** This feature complements the existing LinkedText implementation which renders mentions as tappable links in the feed.

---

## User Experience Flow

### Happy Path

```
1. User opens PostComposer (taps FAB button)
2. User types in the text input: "Hey "
3. User types "@" → Autocomplete dropdown appears
4. User continues typing "@rage" → Results filter in real-time
5. Dropdown shows matching users:
   ┌─────────────────────────────────────┐
   │ 🔍 @rage                            │
   ├─────────────────────────────────────┤
   │ [avatar] @ragestate  ✓              │
   │          RAGESTATE                  │
   ├─────────────────────────────────────┤
   │ [avatar] @rager_mike                │
   │          Mike Johnson               │
   └─────────────────────────────────────┘
6. User taps "@ragestate" row
7. Input updates to: "Hey @ragestate "
8. Mention is visually highlighted (accent color)
9. Dropdown dismisses
10. User continues typing and posts
```

### Edge Cases

| Scenario                                            | Behavior                                |
| --------------------------------------------------- | --------------------------------------- |
| No matches found                                    | Show "No users found" message           |
| Network error                                       | Show "Couldn't search users" with retry |
| User types `@` then deletes it                      | Dismiss dropdown                        |
| User types `@` mid-word (e.g., `test@user`)         | Don't trigger autocomplete              |
| User manually types valid mention without selecting | Still works (parsed by LinkedText)      |
| Multiple mentions in one post                       | Each `@` triggers fresh autocomplete    |
| User scrolls dropdown                               | Keyboard stays open                     |
| User taps outside dropdown                          | Dismiss dropdown, keep text             |

### Visual Design

```
┌─────────────────────────────────────────────────┐
│ Cancel          New Post              [Post]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Hey @rage|                                      │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [👤] @ragestate  ✓        RAGESTATE         │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [👤] @rager_mike          Mike Johnson      │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [👤] @rage_dj             DJ Rage           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│ 490                    [📷]         🌐 Public  │
└─────────────────────────────────────────────────┘
```

- Dropdown appears **above** the keyboard, overlaying the composer
- Max 5 results shown, scrollable if more
- Accent color for verified badge
- Avatar + username (bold) + display name (secondary)

---

## Data Model

### Existing Collections Used

#### `usernames` Collection

```typescript
// Document ID: lowercase username (e.g., "ragestate")
{
  uid: string; // User's Firebase UID
  username: string; // Original casing (e.g., "RageState")
  createdAt: Timestamp;
}
```

#### `users` Collection (for display info)

```typescript
// Document ID: Firebase UID
{
  displayName: string;
  username: string;
  profilePicture?: string;
  verified?: boolean;
  // ... other fields
}
```

### New Index Required

For efficient prefix search on usernames:

```javascript
// firestore.indexes.json
{
  "collectionGroup": "usernames",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "usernameLower", "order": "ASCENDING" }
  ]
}
```

### Search Query Strategy

**Option A: Client-side filtering (Simple, for <10k users)**

```typescript
// Query all usernames starting with prefix
const q = query(
  collection(db, "usernames"),
  where("__name__", ">=", searchTerm.toLowerCase()),
  where("__name__", "<=", searchTerm.toLowerCase() + "\uf8ff"),
  limit(10)
);
```

**Option B: Algolia/Typesense (Scalable, for >10k users)**

- Sync usernames to search index
- Full-text search with typo tolerance
- Recommended for production scale

**Recommendation:** Start with Option A, migrate to B when needed.

---

## Components Needed

### 1. `MentionAutocomplete.tsx` (New)

**Location:** `src/components/feed/MentionAutocomplete.tsx`

```typescript
interface MentionAutocompleteProps {
  /** Current search query (text after @) */
  query: string;
  /** Whether to show the dropdown */
  visible: boolean;
  /** Called when user selects a mention */
  onSelect: (user: MentionUser) => void;
  /** Called when dropdown should close */
  onDismiss: () => void;
  /** Position from bottom (above keyboard) */
  bottomOffset?: number;
}

interface MentionUser {
  uid: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  verified?: boolean;
}
```

**Responsibilities:**

- Fetch matching users based on query
- Render dropdown with user list
- Handle selection and dismissal
- Debounce search requests (300ms)
- Show loading/empty/error states

### 2. `MentionUserRow.tsx` (New)

**Location:** `src/components/feed/MentionUserRow.tsx`

```typescript
interface MentionUserRowProps {
  user: MentionUser;
  onPress: () => void;
}
```

**Responsibilities:**

- Render single user row (avatar, username, display name, verified badge)
- Handle tap with haptic feedback

### 3. `useMentionDetection.ts` (New Hook)

**Location:** `src/hooks/useMentionDetection.ts`

```typescript
interface UseMentionDetectionResult {
  /** Whether autocomplete should be visible */
  showAutocomplete: boolean;
  /** Current mention query (text after @, before cursor) */
  mentionQuery: string;
  /** Start index of the @ in the text */
  mentionStartIndex: number;
  /** Update when text or selection changes */
  onTextChange: (
    text: string,
    selection: { start: number; end: number }
  ) => void;
  /** Insert selected mention into text */
  insertMention: (username: string) => string;
  /** Clear mention state */
  clearMention: () => void;
}
```

**Logic:**

```typescript
// Detect @ mention being typed
// 1. Find @ before cursor
// 2. Check it's at start or after whitespace
// 3. Extract query (chars after @ until cursor or whitespace)

const text = "Hey @rage";
const cursorPos = 9; // After 'e'

// Find @ before cursor
const beforeCursor = text.slice(0, cursorPos);
const atIndex = beforeCursor.lastIndexOf("@");

if (atIndex >= 0) {
  const charBefore = text[atIndex - 1];
  const isValidStart = atIndex === 0 || /\s/.test(charBefore);

  if (isValidStart) {
    const query = beforeCursor.slice(atIndex + 1); // "rage"
    // Trigger autocomplete with query
  }
}
```

### 4. `useUserSearch.ts` (New Hook)

**Location:** `src/hooks/useUserSearch.ts`

```typescript
interface UseUserSearchResult {
  results: MentionUser[];
  isLoading: boolean;
  error: Error | null;
  search: (query: string) => void;
}
```

**Responsibilities:**

- Debounced Firestore queries
- Cache recent results
- Handle errors gracefully

---

## Implementation Phases

### Phase 1: Core Detection Logic (Day 1) ✅

- [x] Create `useMentionDetection` hook
- [x] Write unit tests for mention detection
- [x] Test edge cases (mid-word @, multiple @, etc.)

### Phase 2: User Search Service (Day 1-2) ✅

- [x] Create `useUserSearch` hook
- [x] Implement Firestore prefix query
- [x] Add debouncing (300ms)
- [x] Test with existing usernames collection

### Phase 3: Autocomplete UI (Day 2-3) ✅

- [x] Create `MentionUserRow` component
- [x] Create `MentionAutocomplete` dropdown component
- [x] Style with theme tokens
- [x] Add loading/empty/error states
- [x] Test keyboard avoidance

### Phase 4: PostComposer Integration (Day 3) ✅

- [x] Integrate `useMentionDetection` into PostComposer
- [x] Add `MentionAutocomplete` overlay
- [x] Wire up selection → text insertion
- [x] Handle keyboard interactions
- [x] Test full flow

### Phase 5: Polish & Edge Cases (Day 4) ✅

- [x] Add haptic feedback on selection
- [x] Optimize performance (memo, virtualization)
- [x] Handle offline gracefully
- [x] Accessibility labels
- [x] Update documentation

---

## Integration Points

### PostComposer.tsx Modifications

```typescript
// Add imports
import { MentionAutocomplete } from "./MentionAutocomplete";
import { useMentionDetection } from "../../hooks/useMentionDetection";

// Inside component
const {
  showAutocomplete,
  mentionQuery,
  onTextChange,
  insertMention,
  clearMention,
} = useMentionDetection();

// Track selection for mention detection
const [selection, setSelection] = useState({ start: 0, end: 0 });

// Update TextInput
<TextInput
  value={content}
  onChangeText={(text) => {
    setContent(text);
    onTextChange(text, selection);
  }}
  onSelectionChange={(e) => {
    setSelection(e.nativeEvent.selection);
    onTextChange(content, e.nativeEvent.selection);
  }}
  // ... existing props
/>;

// Add autocomplete overlay
{
  showAutocomplete && (
    <MentionAutocomplete
      query={mentionQuery}
      visible={showAutocomplete}
      onSelect={(user) => {
        const newContent = insertMention(user.username);
        setContent(newContent);
        clearMention();
      }}
      onDismiss={clearMention}
      bottomOffset={keyboardHeight}
    />
  );
}
```

### File Structure

```
src/
├── components/
│   └── feed/
│       ├── PostComposer.tsx        # Modified
│       ├── MentionAutocomplete.tsx # New
│       ├── MentionUserRow.tsx      # New
│       └── index.ts                # Export new components
├── hooks/
│   ├── useMentionDetection.ts      # New
│   └── useUserSearch.ts            # New
└── services/
    └── userSearchService.ts        # New (optional, for Algolia)
```

### Firestore Security Rules

```javascript
// Ensure usernames collection is readable for search
match /usernames/{username} {
  allow read: if request.auth != null;
  allow write: if false; // Only written via Cloud Functions
}
```

---

## Performance Considerations

| Concern                  | Mitigation                                        |
| ------------------------ | ------------------------------------------------- |
| Too many Firestore reads | Debounce 300ms, limit 10 results, cache           |
| Slow dropdown render     | Virtualize list with FlashList if >20 items       |
| Keyboard lag             | Defer autocomplete render with InteractionManager |
| Memory usage             | Clear results when dropdown closes                |
| Bundle size              | Lazy load MentionAutocomplete                     |

---

## Testing Checklist

### Unit Tests

- [ ] `useMentionDetection` - detects @ at various positions
- [ ] `useMentionDetection` - ignores @ in middle of words
- [ ] `useUserSearch` - returns matching users
- [ ] `useUserSearch` - handles empty query
- [ ] `useUserSearch` - debounces rapid calls

### Integration Tests

- [ ] PostComposer shows dropdown when typing @
- [ ] Selecting user inserts mention correctly
- [ ] Multiple mentions in one post work
- [ ] Dropdown dismisses appropriately

### Manual Testing

- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works with external keyboard
- [ ] Works in dark mode
- [ ] Works offline (shows error gracefully)

---

## Success Metrics

| Metric                   | Target                                    |
| ------------------------ | ----------------------------------------- |
| Time to first suggestion | < 500ms                                   |
| Mention completion rate  | > 70% of @ triggers result in selection   |
| Error rate               | < 1% of searches fail                     |
| User satisfaction        | Matches Twitter/Instagram UX expectations |

---

## Future Enhancements

1. **Hashtag Autocomplete** - Same pattern for `#` with trending tags
2. **Recent Mentions** - Show recently mentioned users first
3. **Mutual Friends** - Prioritize users you interact with
4. **Rich Preview** - Show mini-profile card on long press
5. **Algolia Integration** - Full-text search with typo tolerance

---

## Dependencies

- No new packages required
- Uses existing:
  - `firebase/firestore` for queries
  - `expo-haptics` for feedback (already installed)
  - Theme system for styling

---

## Timeline Estimate

| Phase                    | Duration   |
| ------------------------ | ---------- |
| Phase 1: Detection Logic | 0.5 day    |
| Phase 2: Search Service  | 0.5 day    |
| Phase 3: UI Components   | 1 day      |
| Phase 4: Integration     | 0.5 day    |
| Phase 5: Polish          | 0.5 day    |
| **Total**                | **3 days** |

---

## Sign-off

- [ ] Product review
- [ ] Design review
- [ ] Engineering review
- [ ] Ready for implementation
