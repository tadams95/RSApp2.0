RAGESTATE CHAT IMPLEMENTATION (React Native / Expo)
===================================================

This plan adapts the Firestore-first chat guide to our React Native stack (Expo Router, Firebase v9 modular, React Query, PostHog). Start with Firestore for DMs and small groups; consider Socket.io later if scale/latency demands it.

1) Data model (Firestore)
-------------------------

- chats/{chatId}
  - type: 'dm' | 'group'
  - members: string[] (≤ 50)
  - memberCount: number
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - lastMessage: { text: string; senderId: string; createdAt: Timestamp } | null
  - name?: string
  - photoUrl?: string

- chats/{chatId}/messages/{messageId}
  - senderId: string
  - text: string | null
  - mediaUrl?: string
  - mediaType?: 'image' | 'video'
  - createdAt: Timestamp
  - status?: 'sent' | 'delivered' | 'read' (optional; client-derived)

- users/{userId}/chatSummaries/{chatId}
  - chatId: string
  - peerIds: string[]
  - lastMessage: { text: string; senderId: string; createdAt: Timestamp } | null
  - unreadCount: number
  - pinned?: boolean
  - muted?: boolean
  - updatedAt: Timestamp

Indexes
- chats: updatedAt DESC
- messages: createdAt ASC (within subcollection, use orderBy)
- users.chatSummaries: updatedAt DESC

2) Security rules
-----------------

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.members;
      match /messages/{msgId} {
        allow read, create: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.members;
        allow update, delete: if false; // immutable
      }
    }
    match /users/{userId}/chatSummaries/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3) Screens and routes (Expo Router)
-----------------------------------

- `chat/index.tsx` – list of conversations (subscribe to `users/{uid}/chatSummaries` ordered by updatedAt desc, limit 25)
- `chat/[chatId].tsx` – active chat view (messages list + composer)

4) Components
-------------

`src/components/chat/`
- ChatList.tsx – list of chat summaries with unread badges
- ChatListItem.tsx – single conversation row
- ChatRoom.tsx – messages list (FlashList) + composer
- MessageBubble.tsx – text/media rendering, timestamps
- TypingIndicator.tsx – simple indicator (optional, V2)

Libraries
- List: `@shopify/flash-list`
- Media: `expo-image`, `expo-av`, `expo-image-picker` for sending

5) Services and hooks
---------------------

`src/services/chatService.ts`
- createDmChat(peerId)
- sendMessage(chatId, { text?, mediaUri? }) → upload media to Storage `chats/{chatId}/{filename}` then write message
- markRead(chatId) → reset unreadCount in `users/{uid}/chatSummaries/{chatId}`

`src/hooks/useChats.ts`
- useChatsList() – subscribe to chatSummaries (limit + pagination)
- useMessages(chatId) – paginated listener: orderBy createdAt desc limit 25; use startAfter for older pages

`src/hooks/useTypingIndicator.ts` (V2)
- throttle updates (≥2s) to a `presence/typing/{chatId}_{userId}` doc or RTDB path; clean up with TTL CF

6) Cloud Functions
------------------

- onCreate(messages):
  - Update `chats/{chatId}.lastMessage` and `updatedAt`
  - Increment recipients’ `unreadCount` in their chatSummaries (transaction or batched writes)
  - Optional: push notifications via FCM (reuse notification service)

- onCreate(chats): initialize chatSummaries for members

- storage.onFinalize: generate thumbnails/posters for media messages; update message with variants (optional)

7) Client behavior
------------------

- Conversations list: lightweight subscription to `chatSummaries` only
- Active chat: attach messages listener when screen is focused; detach on blur
- Pagination: initial 25 newest messages; `startAfter` to load older
- Offline: enable Firestore persistence; queue sends; show pending state

8) Analytics
------------

PostHog events:
- chat_open, chat_send_text, chat_send_media, chat_receive, chat_mark_read
- Include props: chatId, membersCount, hasMedia, messageBytes (approx), latencyMs

9) Performance and cost control
-------------------------------

- Avoid global listeners; subscribe only to visible chats
- Throttle typing indicator writes (V2), or prefer RTDB for presence to cut Firestore write costs
- Archive old chats by toggling a flag in summaries to exclude from default query

10) Rollout
-----------

MVP
- 1:1 DMs, text + images, unread counts, push notifications

V2
- Small groups (≤50), typing indicators, read receipts (client-only), media thumbnails

V3
- Reactions, message edit/delete via CF callable, moderation tools

11) Implementation checklist (RN)
---------------------------------

- [ ] Collections + indexes
- [ ] Rules deployed
- [ ] Expo Router screens: chat/, chat/[chatId]
- [ ] Components under src/components/chat
- [ ] Services/hooks
- [ ] Cloud Functions for summaries/unread + notifications
- [ ] Analytics wiring
- [ ] Tests/emulator
