# Quote Repost Implementation Spec

## Overview

Implement Quote Repost functionality similar to Twitter/X's quote tweet feature. Users can repost content with their own commentary, which displays as a new post with the original post embedded as a preview.

**Date Created:** January 12, 2026  
**Status:** Ready for Implementation

---

## User Flow

1. User taps repost button on a post
2. Action sheet appears with options:
   - **Repost** - Instant repost (current behavior)
   - **Quote Repost** - Opens composer with embedded post preview
3. For Quote Repost:
   - User writes their commentary
   - Original post displayed as non-interactive preview below text input
   - User taps "Post" to publish
4. Quote repost appears in feed with:
   - User's commentary as main content
   - Original post embedded below as styled preview card

---

## Data Structure

### Current `RepostOf` Interface (feedService.ts)

```typescript
interface RepostOf {
  postId: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  authorUsername?: string;
}
```

### Extended `RepostOf` Interface (New Fields)

```typescript
interface RepostOf {
  postId: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  authorUsername?: string;
  // NEW: For quote repost preview
  originalContent?: string; // Original post text (for preview)
  originalMediaUrls?: string[]; // First 1-2 media URLs (for preview thumbnail)
}
```

### Quote Repost Document Structure

```typescript
{
  // Standard post fields
  content: "User's quote commentary here",  // Reposter's text (REQUIRED for quote)
  userId: "reposter-uid",
  userDisplayName: "Reposter Name",
  userProfilePicture: "https://...",
  usernameLower: "reposterusername",
  createdAt: Timestamp,
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,

  // Repost reference with embedded preview data
  repostOf: {
    postId: "original-post-id",
    authorId: "original-author-uid",
    authorName: "Original Author",
    authorPhoto: "https://...",
    authorUsername: "originalauthor",
    originalContent: "Original post text...",        // NEW
    originalMediaUrls: ["https://media1.jpg"],       // NEW
  }
}
```

### Differentiating Repost Types

| Type           | `content`                                              | `repostOf`                     |
| -------------- | ------------------------------------------------------ | ------------------------------ |
| Regular Repost | Empty/null or copies original                          | Present                        |
| Quote Repost   | User's commentary (non-empty, different from original) | Present with `originalContent` |

**Detection Logic:**

```typescript
const isQuoteRepost = (post: Post): boolean => {
  return !!(
    post.repostOf &&
    post.content &&
    post.content.trim().length > 0 &&
    post.repostOf.originalContent !== undefined
  );
};
```

---

## Files to Modify

### 1. `src/services/feedService.ts`

**Purpose:** Update TypeScript interfaces

**Changes:**

- [x] Add `originalContent?: string` to `RepostOf` interface
- [x] Add `originalMediaUrls?: string[]` to `RepostOf` interface

**Code Location:** Lines 15-22 (RepostOf interface)

### 2. `src/hooks/usePostInteractions.ts`

**Purpose:** Modify repost logic to support quote reposts

**Changes:**

- [x] Update `repostPost()` signature to accept optional `quoteText?: string`
- [x] When `quoteText` provided:
  - [x] Set `content` to user's quote text
  - [x] Include `originalContent` from original post
  - [x] Include `originalMediaUrls` (first 2 URLs from `mediaUrls`)
- [x] When `quoteText` NOT provided (regular repost):
  - [x] Keep current behavior (don't set `originalContent`)

**Code Location:** Lines 175-260 (repostPost function)

### 3. `src/components/feed/PostCard.tsx`

**Purpose:** Render quote reposts with embedded preview

**Changes:**

- [x] Add `isQuoteRepost()` helper function
- [x] Create `EmbeddedPostPreview` component (or inline styles)
- [x] Conditional rendering logic:
  - [x] If quote repost → show user's content + embedded original preview
  - [x] If regular repost → show current repost header behavior
- [x] Embedded preview styling:
  - [x] Rounded border container
  - [x] Author avatar + name + username
  - [x] Original post text (truncated to ~3 lines)
  - [x] Optional: small media thumbnail

**Code Location:** Lines 120-200 (post content rendering area)

### 4. `src/app/(app)/home/index.tsx`

**Purpose:** Add action sheet for repost options

**Changes:**

- [x] Import `ActionSheetIOS` or use cross-platform action sheet
- [x] Create `handleRepostOptions()` function to show action sheet
- [x] Action sheet options:
  - [x] "Repost" → calls existing `handleRepost(postId)`
  - [x] "Quote Repost" → opens QuoteRepostComposer modal
- [x] Add state: `quoteRepostTarget: Post | null`
- [x] Add QuoteRepostComposer to render tree
- [x] Update `onRepost` prop to call `handleRepostOptions`

**Code Location:** Lines 130-170 (handleRepost function area)

### 5. `src/components/feed/QuoteRepostComposer.tsx` (NEW FILE)

**Purpose:** Modal for composing quote reposts

**Components to Build:**

- [x] Modal container (similar to PostComposer)
- [x] Header with Cancel/Post buttons
- [x] Text input for quote commentary
- [x] Read-only embedded post preview below input
- [x] Character counter (optional)
- [x] Loading state during submission

**Props Interface:**

```typescript
interface QuoteRepostComposerProps {
  visible: boolean;
  post: Post; // Original post to quote
  onClose: () => void;
  onQuotePosted: () => void; // Callback to refresh feed
}
```

---

## Implementation Checklist

### Phase 1: Data Layer

- [x] **1.1** Update `RepostOf` interface in `feedService.ts`

  - Add `originalContent?: string`
  - Add `originalMediaUrls?: string[]`

- [x] **1.2** Update `repostPost()` in `usePostInteractions.ts`
  - Add `quoteText?: string` parameter
  - Conditionally populate `originalContent` and `originalMediaUrls`
  - Ensure Firestore rules allow these new fields

### Phase 2: Quote Composer UI

- [x] **2.1** Create `QuoteRepostComposer.tsx` component

  - Modal structure (copy from PostComposer)
  - TextInput for quote text
  - Cancel/Post header buttons
  - Loading indicator

- [x] **2.2** Add embedded post preview in composer

  - Author info (avatar, name, username)
  - Original post content (read-only)
  - Styled container with border

- [x] **2.3** Wire up submission logic
  - Call `repostPost(postId, post, quoteText)`
  - Handle loading/error states
  - Close modal on success
  - Trigger feed refresh

### Phase 3: Action Sheet Integration

- [x] **3.1** Add action sheet to `home/index.tsx`

  - Import ActionSheetIOS or cross-platform library
  - Create `handleRepostOptions(post)` function
  - Options: "Repost", "Quote Repost", "Cancel"

- [x] **3.2** Add state for quote repost modal

  - `const [quoteRepostTarget, setQuoteRepostTarget] = useState<Post | null>(null)`
  - Show QuoteRepostComposer when target is set

- [x] **3.3** Update `onRepost` callback
  - Change from direct toggle to action sheet flow
  - Pass entire post object (not just postId)

### Phase 4: Feed Display

- [x] **4.1** Add quote repost detection in `PostCard.tsx`

  - Create `isQuoteRepost(post)` helper
  - Check for `post.repostOf?.originalContent`

- [x] **4.2** Create `EmbeddedPostPreview` component

  - Compact author header
  - Truncated content (max 3 lines)
  - Optional media thumbnail
  - Subtle border styling

- [x] **4.3** Update PostCard render logic
  - If quote repost: show quote content + embedded preview
  - If regular repost: show current repost header
  - Ensure repost header still shows "@username reposted"

### Phase 5: Firestore Rules (If Needed)

- [x] **5.1** Verify `posts` collection rules allow:
  - `repostOf.originalContent` field
  - `repostOf.originalMediaUrls` field

### Phase 6: Testing & Polish

- [ ] **6.1** Test regular repost still works
- [ ] **6.2** Test quote repost creation flow
- [ ] **6.3** Test quote repost display in feed
- [ ] **6.4** Test quote repost on profile page
- [ ] **6.5** Test tapping embedded preview (optional: navigate to original)
- [ ] **6.6** Add PostHog analytics events:
  - `quote_repost_composer_opened`
  - `quote_repost_created`

---

## UI/UX Specifications

### Action Sheet Design

```
┌─────────────────────────────┐
│         Repost              │  ← Instant repost
├─────────────────────────────┤
│       Quote Repost          │  ← Opens composer
├─────────────────────────────┤
│          Cancel             │
└─────────────────────────────┘
```

### Quote Composer Layout

```
┌─────────────────────────────────────────┐
│  Cancel                         Post    │  ← Header
├─────────────────────────────────────────┤
│                                         │
│  [TextInput: "Add your thoughts..."]    │  ← Quote input
│                                         │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ 🖼 AuthorName @username          │    │  ← Embedded preview
│  │ Original post content here...   │    │
│  │ [optional media thumbnail]      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Quote Repost in Feed

```
┌─────────────────────────────────────────┐
│ 🔄 @quoter reposted                     │  ← Repost header
├─────────────────────────────────────────┤
│ 🖼 Quoter Name @quoter        • 2h      │  ← Author header
│                                         │
│ This is my commentary on the post!      │  ← Quote text
│                                         │
│ ┌─────────────────────────────────┐     │
│ │ 🖼 Original Author @original    │     │  ← Embedded preview
│ │ Original post content here...  │     │
│ │ [optional media thumbnail]     │     │
│ └─────────────────────────────────┘     │
│                                         │
│ ❤️ 12    💬 3    🔄 5    ↗️             │  ← Action bar
└─────────────────────────────────────────┘
```

### Embedded Preview Styling

```typescript
embeddedPreview: {
  borderWidth: 1,
  borderColor: theme.colors.borderSubtle,
  borderRadius: 12,
  padding: 12,
  marginTop: 12,
  backgroundColor: theme.colors.bgElevated,
}
```

---

## Code Snippets

### Action Sheet (iOS)

```typescript
import { ActionSheetIOS, Platform } from "react-native";

const handleRepostOptions = (post: Post) => {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Repost", "Quote Repost"],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          handleRepost(post.id);
        } else if (buttonIndex === 2) {
          setQuoteRepostTarget(post);
        }
      }
    );
  } else {
    // Use Alert.alert or cross-platform action sheet for Android
    Alert.alert("Repost", "Choose an option", [
      { text: "Cancel", style: "cancel" },
      { text: "Repost", onPress: () => handleRepost(post.id) },
      { text: "Quote Repost", onPress: () => setQuoteRepostTarget(post) },
    ]);
  }
};
```

### Quote Repost Detection

```typescript
const isQuoteRepost = (post: Post): boolean => {
  return !!(post.repostOf && post.repostOf.originalContent !== undefined);
};
```

### Updated repostPost Function Signature

```typescript
export const repostPost = async (
  postId: string,
  originalPost: Post,
  quoteText?: string // NEW: Optional quote commentary
): Promise<void> => {
  // ... implementation
};
```

---

## Dependencies

### Required (Already Installed)

- `react-native` - ActionSheetIOS, Alert
- `firebase/firestore` - Firestore operations
- `expo-image` - Media display

### Optional Additions

- `@react-native-menu/menu` - Better cross-platform action sheet (optional)

---

## Analytics Events

| Event                          | Properties                                    | Trigger                         |
| ------------------------------ | --------------------------------------------- | ------------------------------- |
| `repost_options_opened`        | `post_id`                                     | Action sheet shown              |
| `quote_repost_composer_opened` | `post_id`, `original_author_id`               | Composer modal opened           |
| `quote_repost_created`         | `post_id`, `original_post_id`, `quote_length` | Quote repost submitted          |
| `quote_repost_cancelled`       | `post_id`                                     | Composer closed without posting |

---

## Edge Cases to Handle

1. **Empty quote text** - Require minimum 1 character, show validation error
2. **Very long original content** - Truncate preview to 280 chars with "..."
3. **Original post deleted** - Show "Original post unavailable" in preview
4. **Original post has no text** - Show only media preview or "Media post"
5. **Quote repost of a quote repost** - Allow (show immediate parent only)
6. **Offline state** - Disable post button, show connectivity message

---

## Future Enhancements (Out of Scope)

- [ ] Tap embedded preview to navigate to original post
- [ ] Undo quote repost
- [ ] Edit quote repost
- [ ] Quote repost analytics dashboard
- [ ] Notifications: "X quoted your post"

---

## Acceptance Criteria

- [ ] User can choose between "Repost" and "Quote Repost" via action sheet
- [ ] Quote composer displays original post as non-editable preview
- [ ] Quote reposts appear in feed with user's commentary above embedded preview
- [ ] Quote reposts display correctly on profile pages
- [ ] Regular repost functionality unchanged
- [ ] All new posts comply with existing Firestore security rules
- [ ] Analytics events fire correctly
