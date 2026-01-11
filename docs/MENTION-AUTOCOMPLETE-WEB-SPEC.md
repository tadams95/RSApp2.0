# Mention Autocomplete - Web App Specification

## Overview

Add `@mention` autocomplete functionality to the Next.js 14 web app's PostComposer, allowing users to tag other users when creating posts. This follows the standard social media pattern (Twitter/X, Instagram, TikTok) and mirrors the mobile app implementation.

**Platform:** Next.js 14 (App Router)  
**Related Mobile Spec:** `docs/MENTION-AUTOCOMPLETE-SPEC.md`  
**Design System:** `docs/social-ui-design-spec.md`

---

## User Experience Flow

### Happy Path

```
1. User opens post composer (modal or inline)
2. User types in the textarea: "Hey "
3. User types "@" → Autocomplete dropdown appears below cursor
4. User continues typing "@rage" → Results filter in real-time
5. Dropdown shows matching users:
   ┌─────────────────────────────────────┐
   │ [avatar] @ragestate  ✓  RAGESTATE  │
   │ [avatar] @rager_mike    Mike Johnson│
   │ [avatar] @rage_dj       DJ Rage     │
   └─────────────────────────────────────┘
6. User clicks row OR uses arrow keys + Enter to select
7. Input updates to: "Hey @ragestate "
8. Mention is highlighted in accent color
9. Dropdown dismisses
10. User continues typing and posts
```

### Keyboard Navigation

| Key       | Action                                      |
| --------- | ------------------------------------------- |
| `↓` / `↑` | Navigate through suggestions                |
| `Enter`   | Select highlighted suggestion               |
| `Escape`  | Dismiss dropdown, keep text                 |
| `Tab`     | Select first/highlighted suggestion         |
| `@`       | Trigger autocomplete (after space or start) |

### Edge Cases

| Scenario                                            | Behavior                                |
| --------------------------------------------------- | --------------------------------------- |
| No matches found                                    | Show "No users found" message           |
| Network error                                       | Show "Couldn't search users" with retry |
| User types `@` then deletes it                      | Dismiss dropdown                        |
| User types `@` mid-word (e.g., `test@user`)         | Don't trigger autocomplete              |
| User manually types valid mention without selecting | Still works (parsed when rendering)     |
| Multiple mentions in one post                       | Each `@` triggers fresh autocomplete    |
| User clicks outside dropdown                        | Dismiss dropdown, keep text             |
| Very long username list                             | Virtualize with max-height scroll       |

### Visual Design

```
┌─────────────────────────────────────────────────────────┐
│ ✕                     New Post                   [Post] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Hey @rage█                                             │
│       ┌─────────────────────────────────────────┐       │
│       │ [👤] @ragestate  ✓     RAGESTATE       │       │
│       │ [👤] @rager_mike       Mike Johnson    │       │
│       │ [👤] @rage_dj          DJ Rage         │       │
│       └─────────────────────────────────────────┘       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  490 characters remaining        [📷] [🎥]  🌐 Public  │
└─────────────────────────────────────────────────────────┘
```

- Dropdown appears **below** the cursor/caret position
- Max 5 results shown, scrollable if more
- Accent color (`--accent`) for verified badge and highlighted selection
- Avatar + username (semibold) + display name (secondary text)
- Focus ring on keyboard navigation

---

## Data Model

### Existing Firebase Collections (No Changes Required)

The mobile app already uses these collections. **No schema changes needed.**

#### `usernames` Collection

```typescript
// Document ID: lowercase username (e.g., "ragestate")
{
  uid: string; // User's Firebase UID
  username: string; // Original casing (e.g., "RageState")
  createdAt: Timestamp;
}
```

#### `customers` Collection (for display info)

```typescript
// Document ID: Firebase UID
{
  displayName: string;
  username: string;
  profilePicture?: string;
  verificationStatus?: "verified" | "unverified";
  // ... other fields
}
```

### Search Query Strategy

Use the same Firestore prefix search as mobile:

```typescript
import { collection, query, where, limit, getDocs } from "firebase/firestore";

async function searchUsersByUsername(searchTerm: string, maxResults = 10) {
  const usernamesRef = collection(db, "usernames");
  const q = query(
    usernamesRef,
    where("__name__", ">=", searchTerm.toLowerCase()),
    where("__name__", "<=", searchTerm.toLowerCase() + "\uf8ff"),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  // Then fetch user details from customers collection...
}
```

### TypeScript Types

```typescript
// types/mention.ts

export interface MentionUser {
  uid: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  verified: boolean;
}

export interface MentionState {
  isOpen: boolean;
  query: string;
  startIndex: number;
  selectedIndex: number;
}
```

---

## Components Needed

### 1. `MentionAutocomplete.tsx` (New)

**Location:** `src/components/feed/MentionAutocomplete.tsx`

```typescript
interface MentionAutocompleteProps {
  query: string;
  isOpen: boolean;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  position?: { top: number; left: number };
}
```

**Responsibilities:**

- Fetch matching users based on query (with debounce)
- Render dropdown with user list
- Handle mouse selection
- Handle keyboard navigation (arrow keys, enter, escape)
- Show loading/empty/error states
- Position relative to caret (using passed coordinates)

**Styling:**

```css
/* Use CSS variables from globals.css */
.dropdown {
  background: var(--bg-elev-1);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  box-shadow: var(--shadow-dropdown);
  max-height: 240px;
  overflow-y: auto;
}

.userRow {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.userRow:hover,
.userRow[data-selected="true"] {
  background: var(--bg-hover);
}

.username {
  color: var(--text-primary);
  font-weight: 600;
}

.displayName {
  color: var(--text-secondary);
}

.verified {
  color: var(--accent);
}
```

### 2. `MentionUserRow.tsx` (New)

**Location:** `src/components/feed/MentionUserRow.tsx`

```typescript
interface MentionUserRowProps {
  user: MentionUser;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}
```

**Responsibilities:**

- Render single user row (avatar, username, verified badge, display name)
- Handle click
- Handle hover (for keyboard + mouse hybrid navigation)

### 3. `useMentionDetection.ts` (New Hook)

**Location:** `src/hooks/useMentionDetection.ts`

```typescript
interface UseMentionDetectionResult {
  mentionState: MentionState;
  handleTextChange: (text: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // returns true if handled
  insertMention: (username: string) => string;
  closeMention: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrent: () => void;
}
```

**Detection Logic (same as mobile):**

```typescript
function detectMention(text: string, cursorPos: number) {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex >= 0) {
    const charBefore = text[atIndex - 1];
    const isValidStart = atIndex === 0 || /\s/.test(charBefore);

    if (isValidStart) {
      const query = beforeCursor.slice(atIndex + 1);
      // Check query contains only valid username chars
      if (/^[a-zA-Z0-9_]*$/.test(query)) {
        return { isOpen: true, query, startIndex: atIndex };
      }
    }
  }

  return { isOpen: false, query: "", startIndex: -1 };
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
  clear: () => void;
}
```

**Features:**

- Debounced search (300ms)
- In-memory caching (Map with LRU eviction)
- Abort controller for canceling stale requests
- Error handling with retry capability

### 5. `HighlightedTextarea.tsx` (New or Modified)

**Location:** `src/components/feed/HighlightedTextarea.tsx`

Since HTML `<textarea>` doesn't support rich text, use the **overlay technique**:

```tsx
<div className="relative">
  {/* Highlighted text overlay */}
  <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap">
    {renderHighlightedText(content, confirmedMentions)}
  </div>

  {/* Actual textarea with transparent text */}
  <textarea
    className="bg-transparent text-transparent caret-[--text-primary]"
    value={content}
    onChange={handleChange}
    onKeyDown={handleKeyDown}
    onSelect={handleSelect}
  />
</div>
```

**Highlighting Logic:**

```typescript
function renderHighlightedText(
  text: string,
  confirmedMentions: Set<string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const mentionRegex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1].toLowerCase();
    const isConfirmed = confirmedMentions.has(username);

    // Text before mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex} className="text-[--text-primary]">
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    // Mention (highlighted only if confirmed)
    parts.push(
      <span
        key={match.index}
        className={
          isConfirmed ? "text-[--accent] font-medium" : "text-[--text-primary]"
        }
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={lastIndex} className="text-[--text-primary]">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts;
}
```

---

## Implementation Phases

### Phase 1: Core Detection Logic (Day 1)

- [ ] Create `useMentionDetection` hook
- [ ] Implement `detectMention()` function
- [ ] Implement `insertMention()` function
- [ ] Write unit tests for detection logic
- [ ] Test edge cases (mid-word @, multiple @, special chars)

### Phase 2: User Search Service (Day 1-2)

- [ ] Create `useUserSearch` hook
- [ ] Create `searchUsersByUsername()` Firestore query function
- [ ] Add debouncing (300ms)
- [ ] Add request cancellation (AbortController)
- [ ] Add result caching
- [ ] Test with existing usernames collection

### Phase 3: Autocomplete UI (Day 2-3)

- [ ] Create `MentionUserRow` component
- [ ] Create `MentionAutocomplete` dropdown component
- [ ] Style with CSS variables from design system
- [ ] Add loading/empty/error states
- [ ] Add keyboard navigation (↑↓, Enter, Escape, Tab)
- [ ] Add mouse hover/click selection
- [ ] Position dropdown relative to caret

### Phase 4: PostComposer Integration (Day 3)

- [ ] Integrate `useMentionDetection` into PostComposer
- [ ] Add `MentionAutocomplete` component
- [ ] Implement `HighlightedTextarea` for mention highlighting
- [ ] Track confirmed mentions (Set<string>)
- [ ] Wire up selection → text insertion
- [ ] Handle focus management (keep focus in textarea after selection)
- [ ] Test full flow

### Phase 5: Polish & Edge Cases (Day 4)

- [ ] Add focus ring styling
- [ ] Handle window resize (reposition dropdown)
- [ ] Handle scroll (reposition or dismiss dropdown)
- [ ] Accessibility: ARIA attributes, screen reader announcements
- [ ] Handle offline state gracefully
- [ ] Performance optimization (memo, virtualization if needed)
- [ ] Update documentation

---

## Integration Points

### PostComposer.tsx Modifications

```tsx
// Assuming existing PostComposer component

import { useMentionDetection } from "@/hooks/useMentionDetection";
import { MentionAutocomplete } from "@/components/feed/MentionAutocomplete";
import { useRef, useState } from "react";

export function PostComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [confirmedMentions, setConfirmedMentions] = useState<Set<string>>(
    new Set()
  );
  const [caretPosition, setCaretPosition] = useState({ top: 0, left: 0 });

  const {
    mentionState,
    handleTextChange,
    handleKeyDown,
    insertMention,
    closeMention,
    navigateUp,
    navigateDown,
  } = useMentionDetection();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(text);
    handleTextChange(text, cursorPos);
    updateCaretPosition();
  };

  const handleSelect = (user: MentionUser) => {
    const newContent = insertMention(user.username);
    setContent(newContent);
    setConfirmedMentions((prev) =>
      new Set(prev).add(user.username.toLowerCase())
    );
    closeMention();
    textareaRef.current?.focus();
  };

  const handleKeyDownEvent = (e: React.KeyboardEvent) => {
    if (mentionState.isOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateDown();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateUp();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
      }
      // Enter/Tab handled by MentionAutocomplete
    }
  };

  return (
    <div className="relative">
      <HighlightedTextarea
        ref={textareaRef}
        value={content}
        confirmedMentions={confirmedMentions}
        onChange={handleChange}
        onKeyDown={handleKeyDownEvent}
        onSelect={(e) => {
          handleTextChange(content, e.target.selectionStart);
          updateCaretPosition();
        }}
      />

      {mentionState.isOpen && (
        <MentionAutocomplete
          query={mentionState.query}
          isOpen={mentionState.isOpen}
          onSelect={handleSelect}
          onClose={closeMention}
          selectedIndex={mentionState.selectedIndex}
          position={caretPosition}
        />
      )}
    </div>
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
│       └── HighlightedTextarea.tsx # New
├── hooks/
│   ├── useMentionDetection.ts      # New
│   └── useUserSearch.ts            # New
├── lib/
│   └── firebase/
│       └── userSearch.ts           # New - Firestore query logic
└── types/
    └── mention.ts                  # New - TypeScript types
```

### Caret Position Detection

To position the dropdown near the cursor:

```typescript
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  // Create a hidden div that mirrors the textarea
  const div = document.createElement("div");
  const style = getComputedStyle(textarea);

  // Copy styles
  [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "padding",
    "border",
    "boxSizing",
    "width",
  ].forEach((prop) => {
    div.style[prop] = style[prop];
  });

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";

  // Content up to caret
  div.textContent = textarea.value.substring(0, position);

  // Add span for caret position
  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);

  const rect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();

  document.body.removeChild(div);

  return {
    top: spanRect.top - rect.top + textarea.scrollTop,
    left: spanRect.left - rect.left + textarea.scrollLeft,
  };
}
```

Or use `textarea-caret` npm package.

---

## Accessibility Requirements

| Requirement                 | Implementation                                             |
| --------------------------- | ---------------------------------------------------------- |
| Keyboard navigation         | Arrow keys, Enter, Escape, Tab all functional              |
| Screen reader announcements | `aria-live="polite"` for results count                     |
| Focus management            | Return focus to textarea after selection                   |
| ARIA attributes             | `role="listbox"`, `aria-activedescendant`, `aria-expanded` |
| Color contrast              | Meet WCAG AA (4.5:1 for text)                              |
| Focus visible               | Clear focus ring on selected item                          |

```tsx
<div
  role="listbox"
  aria-label="User mention suggestions"
  aria-activedescendant={`mention-${selectedIndex}`}
>
  {users.map((user, index) => (
    <div
      key={user.uid}
      id={`mention-${index}`}
      role="option"
      aria-selected={index === selectedIndex}
    >
      ...
    </div>
  ))}
</div>;

{
  /* Screen reader announcement */
}
<div aria-live="polite" className="sr-only">
  {results.length} user{results.length !== 1 ? "s" : ""} found
</div>;
```

---

## Performance Considerations

| Concern                  | Mitigation                                       |
| ------------------------ | ------------------------------------------------ |
| Too many Firestore reads | Debounce 300ms, limit 10 results, cache          |
| Slow dropdown render     | Virtualize if >20 items (react-window)           |
| Keystroke lag            | Debounce search, keep UI responsive              |
| Memory usage             | Clear cache on unmount, limit cache size         |
| Bundle size              | Dynamic import MentionAutocomplete               |
| Network waterfalls       | Use React Query or SWR for caching/deduplication |

---

## Testing Checklist

### Unit Tests

- [ ] `useMentionDetection` - detects @ at various positions
- [ ] `useMentionDetection` - ignores @ in middle of words
- [ ] `useMentionDetection` - handles special characters
- [ ] `useUserSearch` - returns matching users
- [ ] `useUserSearch` - debounces rapid calls
- [ ] `useUserSearch` - cancels stale requests
- [ ] `insertMention` - correctly replaces text

### Integration Tests (Playwright/Cypress)

- [ ] Typing @ shows dropdown
- [ ] Arrow keys navigate options
- [ ] Enter selects highlighted option
- [ ] Escape dismisses dropdown
- [ ] Click on user selects them
- [ ] Multiple mentions in one post work
- [ ] Dropdown dismisses on blur

### Manual Testing

- [ ] Works in Chrome, Firefox, Safari
- [ ] Works on mobile browsers
- [ ] Works with screen readers (VoiceOver, NVDA)
- [ ] Works in both light and dark modes
- [ ] Works offline (shows error gracefully)

---

## Dependencies

**No new packages required** (recommended approach):

- Use native fetch/AbortController
- Use CSS for positioning
- Use React state for keyboard navigation

**Optional packages:**

- `textarea-caret` - Caret position detection
- `react-window` - Virtualization (if list gets long)
- `@tanstack/react-query` - Caching/deduplication (if not already using)

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

## Notes for Implementation

1. **Reuse Firestore logic** - The query pattern is identical to mobile. Consider sharing types if using a monorepo.

2. **Confirmed mentions tracking** - Only highlight mentions selected from autocomplete, not manually typed text.

3. **Focus management** - Critical for keyboard users. After selecting a mention, return focus to the textarea at the correct cursor position.

4. **Dropdown positioning** - Consider viewport boundaries. If dropdown would overflow bottom, position above the caret instead.

5. **Mobile web** - Test on mobile browsers. May need touch-specific handling for the dropdown.

6. **Dark/Light mode** - Use CSS variables (`var(--bg-elev-1)`, etc.) for automatic theme support.

---

## Reference: Mobile Implementation Files

For implementation reference, see these files in the mobile codebase:

| Mobile File                                   | Purpose                     |
| --------------------------------------------- | --------------------------- |
| `src/hooks/useMentionDetection.ts`            | Detection logic (port this) |
| `src/hooks/useUserSearch.ts`                  | Search hook (adapt for web) |
| `src/components/feed/MentionAutocomplete.tsx` | Dropdown UI (adapt for web) |
| `src/components/feed/MentionUserRow.tsx`      | User row (adapt for web)    |
| `src/services/userSearchService.ts`           | Firestore queries (reuse)   |
| `src/components/feed/PostComposer.tsx`        | Integration example         |

---

## Sign-off

- [ ] Product review
- [ ] Design review
- [ ] Engineering review
- [ ] Ready for implementation
