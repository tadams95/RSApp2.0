# Chat V2 Implementation Spec

> Focused improvements: Centralized access, UI polish, and foundation for media messages.

---

## Overview

### Goals
1. **Centralized Access** - Messages tab in bottom navigation (replaces Notifications)
2. **UI Polish** - Theme compliance, consistent headers, visual separators
3. **Message Status** - Visual indicators for sent/sending states
4. **Media Foundation** - Image sharing in chats (optional phase)

### Tab Layout Change
```
Before: Home | Shop | Events | Notifications | Account
After:  Home | Shop | Events | Messages | Account
```

Notifications will be accessible from the Account screen.

---

## Phase 1: Centralized Access

### 1.1 Tab Navigation Update

**File:** `src/app/(app)/_layout.tsx`

**Changes:**
1. Replace Notifications tab with Messages tab
2. Add unread badge to Messages icon
3. Update route configuration

**Pattern Reference:** CLAUDE.md - "Tab navigator screens"

**Interactions:**
- `selectUnreadChatCount` from `userSlice.tsx` (already imported)
- Badge styling matches existing notification badge pattern

```typescript
// Replace notifications tab (around line 89-103) with:
<Tabs.Screen
  name="messages"
  options={{
    tabBarIcon: ({ color }) => (
      <View>
        <MaterialCommunityIcons name="chat" color={color} size={24} />
        {unreadChatCount > 0 && (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
          </View>
        )}
      </View>
    ),
  }}
/>
```

**Remove:**
- `href: null` from messages route (lines 133-138)
- Notifications tab screen definition

### 1.2 Move Notifications to Account

**File:** `src/app/(app)/account/index.tsx`

**Changes:**
1. Add "Notifications" row in account menu
2. Navigate to notifications screen on tap
3. Show unread badge count

**Pattern Reference:** CLAUDE.md - "Profile screens", existing account menu items

**New File:** `src/app/(app)/account/notifications.tsx`
- Copy/move notifications screen logic here
- Update imports and navigation

### 1.3 Messages Index as Tab Entry

**File:** `src/app/(app)/messages/index.tsx`

**Changes:**
1. Remove back button (now a root tab)
2. Update header layout for tab context
3. Keep "New Message" action button

**Current Header:**
```
[← Back] [Messages] [📝]
```

**New Header:**
```
[Messages]                    [📝]
```

---

## Phase 2: UI Polish

### 2.1 Theme Color Compliance

**Pattern Reference:** CLAUDE.md - "Theme Tokens Quick Reference"

| File | Line | Current | Replace With |
|------|------|---------|--------------|
| `src/components/chat/MessageBubble.tsx` | ~98 | `color: "#FFFFFF"` | `color: theme.colors.textInverse` |
| `src/components/chat/ChatInput.tsx` | ~64 | `color="#FFFFFF"` | `color={theme.colors.textInverse}` |
| `src/components/chat/ChatInput.tsx` | ~69 | `color="#FFFFFF"` | `color={theme.colors.textInverse}` |
| `src/components/chat/EmptyChat.tsx` | ~65 | `color: "#FFFFFF"` | `color: theme.colors.textInverse` |

### 2.2 Header Consistency

**Pattern Reference:** Compare with `src/app/(app)/notifications/index.tsx` header

**Files to Update:**
- `src/app/(app)/messages/index.tsx`
- `src/app/(app)/messages/new.tsx`
- `src/app/(app)/messages/[chatId].tsx`

**Changes:**
- Title: `fontSize: 18` → `fontSize: 20`
- Title: `fontWeight: "600"` → `fontWeight: "700"`

### 2.3 Chat List Separators

**File:** `src/components/chat/ChatListItem.tsx`

**Changes:**
1. Add bottom border separator
2. Improve event chat avatar display

```typescript
// In createStyles, update container:
container: {
  // ... existing styles
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: theme.colors.borderSubtle,
},
```

**Event Avatar Enhancement:**
```typescript
// Replace "E" text with calendar icon for event chats
{chat.type === "event" ? (
  <View style={styles.eventAvatarContainer}>
    <MaterialCommunityIcons
      name="calendar-star"
      size={24}
      color={theme.colors.textSecondary}
    />
  </View>
) : (
  // existing DM avatar logic
)}
```

### 2.4 Message Status Indicators

**File:** `src/components/chat/MessageBubble.tsx`

**Pattern Reference:** CLAUDE.md - Component styling with useThemedStyles

**Changes:**
1. Show status icon for own messages
2. Use existing `status` field from Message type

```typescript
// Add below message text for own messages:
{isOwn && (
  <View style={styles.statusContainer}>
    {message.status === "sending" ? (
      <ActivityIndicator size={10} color={theme.colors.textTertiary} />
    ) : (
      <Ionicons
        name="checkmark"
        size={12}
        color={theme.colors.textTertiary}
      />
    )}
  </View>
)}
```

---

## Phase 3: Media Messages (Optional)

### 3.1 Overview

Enable image sharing in chats using existing patterns from post creation.

**Pattern Reference:**
- CLAUDE.md - "Firebase (Auth, Firestore, Storage, Functions)"
- Existing: `src/services/feedService.ts` media upload patterns

### 3.2 Files to Modify

| File | Changes |
|------|---------|
| `src/components/chat/ChatInput.tsx` | Add image picker button, preview, upload |
| `src/components/chat/MessageBubble.tsx` | Render image messages |
| `src/services/chatService.ts` | Add `uploadChatMedia()` function |
| `src/types/chat.ts` | Already has `mediaUrl`, `mediaType` fields |
| `functions/chat.js` | Handle media in push notification preview |

### 3.3 ChatInput Media Addition

**File:** `src/components/chat/ChatInput.tsx`

**New Props:**
```typescript
interface ChatInputProps {
  onSend: (text: string, mediaUrl?: string) => Promise<void>;
  // ... existing props
}
```

**UI Changes:**
```
Before: [Input Field                    ] [Send]
After:  [📷] [Input Field               ] [Send]
        [Image Preview with X to remove]
```

**Dependencies:**
- `expo-image-picker` (already in project for posts)
- Firebase Storage upload

### 3.4 MessageBubble Media Display

**File:** `src/components/chat/MessageBubble.tsx`

**Changes:**
```typescript
// Add image rendering:
{message.mediaUrl && (
  <TouchableOpacity onPress={() => openImageViewer(message.mediaUrl)}>
    <Image
      source={{ uri: message.mediaUrl }}
      style={styles.messageImage}
      contentFit="cover"
    />
  </TouchableOpacity>
)}
```

### 3.5 Chat Service Media Upload

**File:** `src/services/chatService.ts`

**New Function:**
```typescript
export async function uploadChatMedia(
  chatId: string,
  uri: string,
): Promise<string> {
  // Follow feedService.ts pattern for media upload
  // Upload to: chat-media/{chatId}/{timestamp}_{random}.jpg
  // Return download URL
}
```

---

## File Interaction Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tab Navigation                            │
│  src/app/(app)/_layout.tsx                                      │
│    ├── imports: selectUnreadChatCount (userSlice)               │
│    ├── renders: Messages tab with badge                         │
│    └── navigates to: /messages (index.tsx)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Messages Screen                              │
│  src/app/(app)/messages/index.tsx                               │
│    ├── imports: useChatList (hook)                              │
│    ├── renders: ChatListItem (component)                        │
│    └── navigates to: /messages/[chatId], /messages/new          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│     Chat Room            │    │     New Message          │
│  messages/[chatId].tsx   │    │  messages/new.tsx        │
│    ├── useChat (hook)    │    │    ├── useChatList       │
│    ├── MessageBubble     │    │    ├── userSearchService │
│    ├── ChatInput         │    │    └── chatService       │
│    └── chatService       │    └──────────────────────────┘
└──────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Components                                 │
│  src/components/chat/                                           │
│    ├── ChatListItem.tsx    ← renders in index.tsx               │
│    ├── MessageBubble.tsx   ← renders in [chatId].tsx            │
│    ├── ChatInput.tsx       ← renders in [chatId].tsx            │
│    └── EmptyChat.tsx       ← renders in index.tsx               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Services & Hooks                              │
│  src/services/chatService.ts                                    │
│    └── sendMessage, subscribeToMessages, uploadChatMedia        │
│  src/hooks/useChatList.ts                                       │
│    └── subscribeToChatList → dispatches to Redux                │
│  src/hooks/useChat.ts                                           │
│    └── messages, sendMessage, loadMore                          │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Redux                                    │
│  src/store/redux/userSlice.tsx                                  │
│    ├── unreadChatCount (state)                                  │
│    ├── setUnreadChatCount (action)                              │
│    └── selectUnreadChatCount (selector)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Centralized Access

- [x] **1.1** Update `_layout.tsx` - Replace Notifications with Messages tab
  - Pattern: Tab navigator with badge (see existing notifications badge)
  - File: `src/app/(app)/_layout.tsx`

- [x] **1.2** Update `_layout.tsx` - Remove `href: null` from messages route
  - File: `src/app/(app)/_layout.tsx`

- [x] **1.3** Add notifications link to Account - Notifications in SettingsModal
  - Pattern: Navigation button in SettingsModal
  - File: `src/components/modals/SettingsModal.tsx`

- [x] **1.4** Update `notifications/index.tsx` - Add back button for non-tab access
  - Pattern: Header with back navigation
  - File: `src/app/(app)/notifications/index.tsx`

- [x] **1.5** Update `messages/index.tsx` - Remove back button, tab-style header
  - Pattern: Tab root screen header (see `home/index.tsx`)
  - File: `src/app/(app)/messages/index.tsx`

### Phase 2: UI Polish

- [x] **2.1** Fix `MessageBubble.tsx` - Theme color for text
  - Pattern: CLAUDE.md "Theme Tokens" - `theme.colors.textInverse`
  - File: `src/components/chat/MessageBubble.tsx`

- [x] **2.2** Fix `ChatInput.tsx` - Theme colors for send button
  - Pattern: CLAUDE.md "Theme Tokens"
  - File: `src/components/chat/ChatInput.tsx`

- [x] **2.3** Fix `EmptyChat.tsx` - Theme color for button text
  - Pattern: CLAUDE.md "Theme Tokens"
  - File: `src/components/chat/EmptyChat.tsx`

- [x] **2.4** Update `messages/index.tsx` - Header font size/weight
  - Pattern: Match `notifications/index.tsx` header style
  - File: `src/app/(app)/messages/index.tsx`

- [x] **2.5** Update `messages/new.tsx` - Header font size/weight
  - Pattern: Match other screen headers
  - File: `src/app/(app)/messages/new.tsx`

- [x] **2.6** Update `messages/[chatId].tsx` - Header font size/weight
  - Pattern: Match other screen headers
  - File: `src/app/(app)/messages/[chatId].tsx`

- [x] **2.7** Update `ChatListItem.tsx` - Add separator border
  - Pattern: List item separators (see `UserCard.tsx`)
  - File: `src/components/chat/ChatListItem.tsx`

- [x] **2.8** Update `ChatListItem.tsx` - Event chat avatar icon
  - Pattern: MaterialCommunityIcons usage
  - File: `src/components/chat/ChatListItem.tsx`

- [x] **2.9** Update `MessageBubble.tsx` - Add status indicator
  - Pattern: Ionicons checkmark, ActivityIndicator
  - File: `src/components/chat/MessageBubble.tsx`

### Phase 3: Media Messages (Optional)

- [x] **3.1** Update `ChatInput.tsx` - Add image picker button
  - Pattern: Post creation image picker
  - File: `src/components/chat/ChatInput.tsx`

- [x] **3.2** Update `ChatInput.tsx` - Image preview with remove
  - Pattern: Post creation preview
  - File: `src/components/chat/ChatInput.tsx`

- [x] **3.3** Add `chatService.ts` - `uploadChatMedia()` function
  - Pattern: `feedService.ts` media upload
  - File: `src/services/chatService.ts`

- [x] **3.4** Update `MessageBubble.tsx` - Render image messages
  - Pattern: expo-image with proper sizing
  - File: `src/components/chat/MessageBubble.tsx`

- [x] **3.5** Update `useChat.ts` - Handle media in sendMessage
  - Pattern: Existing optimistic update pattern
  - File: `src/hooks/useChat.ts`

- [x] **3.6** Update `chat.js` - Media preview in push notifications
  - Pattern: Existing onChatMessageCreated function
  - File: `functions/chat.js`

---

## Testing Checklist

### Phase 1
- [ ] Messages tab appears in bottom navigation
- [ ] Unread badge shows on Messages tab
- [ ] Tapping Messages tab opens chat list
- [ ] Notifications accessible from Account screen
- [ ] Notification badge appears on Account menu item

### Phase 2
- [ ] All text colors adapt to theme (light/dark mode)
- [ ] Headers match other screen headers visually
- [ ] Chat list items have consistent separators
- [ ] Event chats show calendar icon instead of "E"
- [ ] Sent messages show checkmark indicator
- [ ] Sending messages show spinner indicator

### Phase 3
- [x] Image picker opens from chat input
- [x] Selected image shows preview
- [x] Can remove image before sending
- [x] Image uploads successfully
- [x] Image displays in message bubble
- [x] Image is tappable to view full size
- [x] Push notification shows "Sent an image" for media messages

---

## Success Criteria

1. **Centralized Access**: Users can access all chats from a dedicated tab
2. **Visual Consistency**: Chat UI matches app design language
3. **Status Clarity**: Users know when messages are sent vs sending
4. **Media Support**: Users can share images in chats (Phase 3)

---

*Last updated: January 2025*
