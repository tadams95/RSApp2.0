# Chat Implementation Spec

> **Priority**: 🟡 High
> **Dependencies**: Phase 4 complete | **Outcome**: Event group chats + optional 1:1 DMs

---

## Executive Summary

Implement **event-based group chats** as the primary feature, with optional 1:1 DMs. This approach:

- ✅ **Differentiated** — Radiate-style event chats, not generic messaging
- ✅ **Drives engagement** — See who's going, build hype, coordinate meetups
- ✅ **Drives ticket sales** — FOMO from seeing chat activity
- ✅ **Time-bounded** — Chats auto-archive after event, reducing moderation
- ✅ **Built-in audience** — Ticket holders auto-join event chat

### Feature Priority

| Feature               | Priority | Value   |
| --------------------- | -------- | ------- |
| **Event Group Chats** | P0       | 🔥 High |
| Basic 1:1 DMs         | P1       | Medium  |
| Typing indicators     | P2       | Low     |
| Reactions             | P2       | Low     |

### Why Event Chats > Generic DMs

| Feature                  | Generic DMs             | Event Group Chats  |
| ------------------------ | ----------------------- | ------------------ |
| **Unique to RAGESTATE?** | ❌ No (iMessage exists) | ✅ Yes             |
| **Drives ticket sales?** | ❌ No                   | ✅ Yes (FOMO)      |
| **Creates community?**   | Somewhat                | ✅ Definitely      |
| **Moderation burden**    | High (forever)          | Low (time-limited) |
| **Network effect**       | Weak                    | Strong             |

### Key Improvements (v2)

This spec has been updated to align with existing codebase patterns:

| Area | Before | After |
|------|--------|-------|
| **DM Lookup** | Query all chats + client-side filter | Deterministic ID (`dm_uid1_uid2`) - no query needed |
| **User Info** | Single collection | Multi-collection lookup (`customers` + `profiles`) |
| **Hooks** | Basic loading states | Full pagination (`loadMore`, `hasMore`, `isLoadingMore`) |
| **Cloud Functions** | v1 syntax, sequential push | v2 syntax, transactions, parallel push notifications |
| **Unread Badge** | Local state only | Redux global state for tab badge |
| **Components** | Custom styling | `useThemedStyles` pattern (matches `CommentInput`) |

---

## Current State Analysis

### ✅ Already Implemented

| Component                        | Status  | Location                              |
| -------------------------------- | ------- | ------------------------------------- |
| Firestore rules for chat         | ✅ Done | `firestore.rules` lines 332-353       |
| Firebase Auth                    | ✅ Done | `src/firebase/firebase.ts`            |
| Real-time subscription patterns  | ✅ Done | `src/services/feedService.ts`         |
| FlashList for lists              | ✅ Done | Feed, notifications                   |
| Push notification infrastructure | ✅ Done | `src/services/notificationService.ts` |
| User search                      | ✅ Done | `src/services/userSearchService.ts`   |
| Themed styles hook               | ✅ Done | `src/hooks/useThemedStyles.ts`        |
| Comment input component          | ✅ Done | `src/components/feed/CommentInput.tsx`|
| Redux user slice                 | ✅ Done | `src/store/redux/userSlice.tsx`       |
| React Query config               | ✅ Done | `src/config/reactQuery.ts`            |

### ⏳ Needs Implementation

| Component              | Priority |
| ---------------------- | -------- |
| Chat types             | P0       |
| Chat service           | P0       |
| Chat hooks             | P0       |
| Chat list screen       | P0       |
| Chat room screen       | P0       |
| Chat components        | P0       |
| Cloud Functions        | P0       |
| Redux unread state     | P0       |
| Push notifications     | P1       |
| Media messages         | P2       |

---

## Data Model

### Firestore Collections

```
chats/{chatId}
├── type: 'dm' | 'event'
├── members: string[]                    // [userId1, userId2, ...] - sorted for DMs
├── memberCount: number
├── createdAt: Timestamp
├── updatedAt: Timestamp
├── isActive: boolean                    // false = archived (event ended)
├── lastMessage: {
│   ├── text: string
│   ├── senderId: string
│   ├── senderName: string               // For group chats
│   ├── createdAt: Timestamp
│   └── type: 'text' | 'image' | 'video'
│   } | null
│
│   // Event chat specific fields
├── eventId?: string                     // Link to event (for event chats)
├── eventName?: string                   // Cached event name
├── eventDate?: Timestamp                // For auto-archive
├── maxMembers?: number                  // e.g., 500 for event chats
│
└── messages/{messageId}                 // Subcollection
    ├── senderId: string
    ├── senderName: string               // Cached for display
    ├── senderPhoto?: string             // Cached avatar
    ├── text: string | null
    ├── mediaUrl?: string
    ├── mediaType?: 'image' | 'video'
    ├── createdAt: Timestamp
    └── readBy: string[]                 // For read receipts (V2)

users/{userId}/chatSummaries/{chatId}
├── chatId: string
├── type: 'dm' | 'event'
├── lastMessage: { ... } | null
├── unreadCount: number
├── muted: boolean
├── updatedAt: Timestamp
│
│   // DM specific fields
├── peerId?: string
├── peerName?: string
├── peerPhoto?: string
│
│   // Event chat specific fields
├── eventId?: string
├── eventName?: string                   // "RAGESTATE NYE 2026"

events/{eventId}
├── ... existing fields ...
├── chatId?: string                      // Link to event chat
├── chatEnabled: boolean                 // Admin toggle
```

### Chat ID Strategy

**DM Chats**: Use deterministic IDs to avoid expensive queries:
```typescript
// Deterministic ID = no query needed to find existing DM
const chatId = `dm_${[userId1, userId2].sort().join('_')}`;
// Example: dm_abc123_xyz789
```

**Event Chats**: Use auto-generated IDs linked from the event document:
```typescript
// Event document stores chatId reference
const eventChat = await db.collection('chats').add({ type: 'event', ... });
await db.doc(`events/${eventId}`).update({ chatId: eventChat.id });
```

### Event Chat Lifecycle

```
Ticket Purchased → Auto-join event chat
        ↓
Event Date - 7 days → Chat becomes active
        ↓
Event Day → Peak activity
        ↓
Event + 24 hours → Chat archived (read-only)
        ↓
Event + 30 days → Chat deleted (optional)
```

### TypeScript Types

```typescript
// src/types/chat.ts

export type ChatType = "dm" | "event";
export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "video";

// User info helper (matches pattern in feedService)
export interface UserInfo {
  userId: string;
  displayName: string;
  photoURL: string | null;
  username: string | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  members: string[];
  memberCount: number;
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastMessage: LastMessage | null;

  // Event chat specific
  eventId?: string;
  eventName?: string;
  eventDate?: Date;
}

export interface LastMessage {
  text: string;
  senderId: string;
  senderName?: string;
  createdAt: Date;
  type: MessageType;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string | null;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  createdAt: Date;
  status: MessageStatus;
}

export interface ChatSummary {
  chatId: string;
  type: ChatType;
  lastMessage: LastMessage | null;
  unreadCount: number;
  muted: boolean;
  updatedAt: Date;

  // DM specific
  peerId?: string;
  peerName?: string;
  peerPhoto?: string;

  // Event chat specific
  eventId?: string;
  eventName?: string;
}
```

---

## Files to Create/Modify

### New Files

| File                                    | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `src/types/chat.ts`                     | TypeScript interfaces             |
| `src/services/chatService.ts`           | Firestore operations              |
| `src/hooks/useChat.ts`                  | Single chat room hook             |
| `src/hooks/useChatList.ts`              | Chat list hook                    |
| `src/app/(app)/messages/index.tsx`      | Chat list screen                  |
| `src/app/(app)/messages/[chatId].tsx`   | Chat room screen                  |
| `src/app/(app)/messages/new.tsx`        | New DM screen (P1)                |
| `src/components/chat/ChatListItem.tsx`  | List item component               |
| `src/components/chat/MessageBubble.tsx` | Message component                 |
| `src/components/chat/ChatInput.tsx`     | Message composer                  |
| `src/components/chat/EmptyChat.tsx`     | Empty states                      |
| `src/components/chat/index.ts`          | Barrel export                     |
| `functions/chat.js`                     | Cloud Functions (v2 syntax)       |

### Files to Modify

| File                                 | Changes                                        |
| ------------------------------------ | ---------------------------------------------- |
| `src/store/redux/userSlice.tsx`      | Add `unreadChatCount` state + selector         |
| `src/config/reactQuery.ts`           | Add `chat` query keys                          |
| `src/app/(app)/_layout.tsx`          | Add messages route + unread badge              |
| `src/app/(app)/profile/[userId].tsx` | Add "Message" button (P1)                      |
| `src/app/(app)/events/[eventId].tsx` | Add "Event Chat" button                        |
| `functions/index.js`                 | Export chat functions                          |

---

## Implementation Details

### 1. Chat Service (`src/services/chatService.ts`)

> **Pattern**: Follows `feedService.ts` and `commentService.ts` - real-time subscriptions return `Unsubscribe` cleanup functions.

```typescript
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { Chat, Message, ChatSummary, UserInfo } from "../types/chat";

const CHATS_COLLECTION = "chats";
const MESSAGES_COLLECTION = "messages";
const CHAT_SUMMARIES = "chatSummaries";
const PAGE_SIZE = 50;

// ============================================
// HELPER: Deterministic DM Chat ID
// ============================================

export function getDmChatId(userId1: string, userId2: string): string {
  return `dm_${[userId1, userId2].sort().join("_")}`;
}

// ============================================
// HELPER: User Info (follows feedService pattern)
// ============================================

export async function getUserDisplayInfo(userId: string): Promise<UserInfo> {
  const [customerDoc, profileDoc] = await Promise.all([
    getDoc(doc(db, "customers", userId)),
    getDoc(doc(db, "profiles", userId)),
  ]);

  const customer = customerDoc.data();
  const profile = profileDoc.data();

  return {
    userId,
    displayName:
      profile?.displayName ||
      customer?.displayName ||
      `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() ||
      "Anonymous",
    photoURL:
      profile?.photoURL ||
      profile?.profilePicture ||
      customer?.profilePicture ||
      null,
    username: profile?.usernameLower || customer?.username || null,
  };
}

// ============================================
// DM CHAT OPERATIONS
// ============================================

export async function getOrCreateDmChat(
  currentUserId: string,
  peerId: string,
): Promise<string> {
  const chatId = getDmChatId(currentUserId, peerId);
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const chatDoc = await getDoc(chatRef);

  if (chatDoc.exists()) {
    return chatId;
  }

  // Get user info for both parties
  const [currentUserInfo, peerInfo] = await Promise.all([
    getUserDisplayInfo(currentUserId),
    getUserDisplayInfo(peerId),
  ]);

  const batch = writeBatch(db);

  // Create chat document
  batch.set(chatRef, {
    type: "dm",
    members: [currentUserId, peerId].sort(),
    memberCount: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true,
    lastMessage: null,
  });

  // Create chat summary for current user
  batch.set(doc(db, `users/${currentUserId}/${CHAT_SUMMARIES}/${chatId}`), {
    chatId,
    type: "dm",
    peerId,
    peerName: peerInfo.displayName,
    peerPhoto: peerInfo.photoURL,
    lastMessage: null,
    unreadCount: 0,
    muted: false,
    updatedAt: serverTimestamp(),
  });

  // Create chat summary for peer
  batch.set(doc(db, `users/${peerId}/${CHAT_SUMMARIES}/${chatId}`), {
    chatId,
    type: "dm",
    peerId: currentUserId,
    peerName: currentUserInfo.displayName,
    peerPhoto: currentUserInfo.photoURL,
    lastMessage: null,
    unreadCount: 0,
    muted: false,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return chatId;
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
): Promise<string> {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);

  const messageData = {
    senderId,
    senderName,
    senderPhoto,
    text,
    createdAt: serverTimestamp(),
    readBy: [senderId],
  };

  const messageRef = await addDoc(messagesRef, messageData);
  return messageRef.id;
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

export function subscribeToMessages(
  chatId: string,
  onUpdate: (messages: Message[], lastDoc: QueryDocumentSnapshot | null) => void,
  onError: (error: Error) => void,
  limitCount = PAGE_SIZE,
): Unsubscribe {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
  const q = query(messagesRef, orderBy("createdAt", "desc"), limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        chatId,
        senderId: docSnap.data().senderId,
        senderName: docSnap.data().senderName,
        senderPhoto: docSnap.data().senderPhoto,
        text: docSnap.data().text,
        mediaUrl: docSnap.data().mediaUrl,
        mediaType: docSnap.data().mediaType,
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
        status: "sent",
      }));

      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      onUpdate(messages.reverse(), lastDoc);
    },
    (error) => {
      console.error("Error subscribing to messages:", error);
      onError(error);
    },
  );
}

export async function fetchOlderMessages(
  chatId: string,
  lastDoc: QueryDocumentSnapshot<DocumentData>,
  limitCount = PAGE_SIZE,
): Promise<{ messages: Message[]; lastDoc: QueryDocumentSnapshot | null }> {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
  const q = query(
    messagesRef,
    orderBy("createdAt", "desc"),
    startAfter(lastDoc),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const messages: Message[] = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    chatId,
    senderId: docSnap.data().senderId,
    senderName: docSnap.data().senderName,
    senderPhoto: docSnap.data().senderPhoto,
    text: docSnap.data().text,
    createdAt: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
    status: "sent",
  }));

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages: messages.reverse(), lastDoc: newLastDoc };
}

export function subscribeToChatList(
  userId: string,
  onUpdate: (chats: ChatSummary[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const summariesRef = collection(db, `users/${userId}/${CHAT_SUMMARIES}`);
  const q = query(summariesRef, orderBy("updatedAt", "desc"), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatSummary[] = snapshot.docs.map((docSnap) => ({
        chatId: docSnap.id,
        type: docSnap.data().type,
        peerId: docSnap.data().peerId,
        peerName: docSnap.data().peerName,
        peerPhoto: docSnap.data().peerPhoto,
        eventId: docSnap.data().eventId,
        eventName: docSnap.data().eventName,
        lastMessage: docSnap.data().lastMessage
          ? {
              ...docSnap.data().lastMessage,
              createdAt: docSnap.data().lastMessage.createdAt?.toDate() || new Date(),
            }
          : null,
        unreadCount: docSnap.data().unreadCount || 0,
        muted: docSnap.data().muted || false,
        updatedAt: (docSnap.data().updatedAt as Timestamp)?.toDate() || new Date(),
      }));

      onUpdate(chats);
    },
    (error) => {
      console.error("Error subscribing to chat list:", error);
      onError(error);
    },
  );
}

export async function markChatAsRead(userId: string, chatId: string): Promise<void> {
  const summaryRef = doc(db, `users/${userId}/${CHAT_SUMMARIES}/${chatId}`);
  await setDoc(summaryRef, { unreadCount: 0 }, { merge: true });
}

export function subscribeToTotalUnread(
  userId: string,
  onUpdate: (count: number) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const summariesRef = collection(db, `users/${userId}/${CHAT_SUMMARIES}`);

  return onSnapshot(
    summariesRef,
    (snapshot) => {
      const totalUnread = snapshot.docs.reduce(
        (sum, docSnap) => sum + (docSnap.data().unreadCount || 0),
        0,
      );
      onUpdate(totalUnread);
    },
    (error) => {
      console.error("Error subscribing to unread count:", error);
      onError(error);
    },
  );
}
```

### 2. Chat Hooks

> **Pattern**: Follows `useFeed.ts` and `useComments.ts` - manages loading states, uses `useRef` for subscriptions, `useCallback` for memoized actions.

#### `src/hooks/useChatList.ts`

```typescript
import { useEffect, useState, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { selectLocalId } from "../store/redux/userSlice";
import { setUnreadChatCount } from "../store/redux/userSlice";
import { subscribeToChatList } from "../services/chatService";
import type { ChatSummary } from "../types/chat";

interface UseChatListResult {
  chats: ChatSummary[];
  isLoading: boolean;
  error: Error | null;
  totalUnread: number;
  refetch: () => void;
}

export function useChatList(): UseChatListResult {
  const userId = useSelector(selectLocalId);
  const dispatch = useDispatch();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    unsubscribeRef.current = subscribeToChatList(
      userId,
      (newChats) => {
        setChats(newChats);
        setIsLoading(false);
        setError(null);

        // Update global unread count
        const total = newChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
        dispatch(setUnreadChatCount(total));
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => {
      unsubscribeRef.current?.();
    };
  }, [userId, refreshKey, dispatch]);

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return { chats, isLoading, error, totalUnread, refetch };
}
```

#### `src/hooks/useChat.ts`

```typescript
import { useEffect, useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { selectLocalId, selectUserDisplayInfo } from "../store/redux/userSlice";
import {
  subscribeToMessages,
  sendMessage as sendMessageService,
  fetchOlderMessages,
  markChatAsRead,
} from "../services/chatService";
import type { Message } from "../types/chat";

const PAGE_SIZE = 50;

interface UseChatResult {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  isSending: boolean;
  sendMessage: (text: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useChat(chatId: string): UseChatResult {
  const userId = useSelector(selectLocalId);
  const userInfo = useSelector(selectUserDisplayInfo);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);
    setHasMore(true);
    lastDocRef.current = null;

    unsubscribeRef.current = subscribeToMessages(
      chatId,
      (newMessages, lastDoc) => {
        setMessages(newMessages);
        lastDocRef.current = lastDoc;
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => {
      unsubscribeRef.current?.();
    };
  }, [chatId]);

  // Mark as read when viewing
  useEffect(() => {
    if (chatId && userId) {
      markChatAsRead(userId, chatId);
    }
  }, [chatId, userId]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !lastDocRef.current || !chatId) return;

    setIsLoadingMore(true);

    try {
      const { messages: olderMessages, lastDoc } = await fetchOlderMessages(
        chatId,
        lastDocRef.current,
        PAGE_SIZE,
      );

      if (olderMessages.length < PAGE_SIZE) {
        setHasMore(false);
      }

      lastDocRef.current = lastDoc;
      setMessages((prev) => [...olderMessages, ...prev]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, isLoadingMore]);

  // Send message with optimistic update
  const sendMessage = useCallback(
    async (text: string) => {
      if (!userId || !chatId || !text.trim()) return;

      setIsSending(true);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId,
        senderId: userId,
        senderName: userInfo.displayName,
        senderPhoto: null,
        text: text.trim(),
        createdAt: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        await sendMessageService(
          chatId,
          userId,
          userInfo.displayName,
          null,
          text.trim(),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id),
        );
        setError(err as Error);
      } finally {
        setIsSending(false);
      }
    },
    [chatId, userId, userInfo.displayName],
  );

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isSending,
    sendMessage,
    loadMore,
  };
}
```

### 3. Chat List Screen (`src/app/(app)/messages/index.tsx`)

```typescript
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ChatListItem, EmptyChat } from "../../../components/chat";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { useChatList } from "../../../hooks/useChatList";
import type { Theme } from "../../../constants/themes";
import type { ChatSummary } from "../../../types/chat";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { chats, isLoading, error } = useChatList();

  const handleChatPress = (chat: ChatSummary) => {
    router.push(`/messages/${chat.chatId}`);
  };

  const handleNewChat = () => {
    router.push("/messages/new");
  };

  const renderItem = ({ item }: { item: ChatSummary }) => (
    <ChatListItem chat={item} onPress={() => handleChatPress(item)} />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
          <Ionicons
            name="create-outline"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load messages</Text>
        </View>
      ) : chats.length === 0 ? (
        <EmptyChat onNewChat={handleNewChat} />
      ) : (
        <FlashList
          data={chats}
          renderItem={renderItem}
          estimatedItemSize={72}
          keyExtractor={(item) => item.chatId}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
  },
  newChatButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 20,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
});
```

### 4. Chat Room Screen (`src/app/(app)/messages/[chatId].tsx`)

```typescript
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";

import { ChatInput, MessageBubble } from "../../../components/chat";
import { useTheme } from "../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { useChat } from "../../../hooks/useChat";
import { selectLocalId } from "../../../store/redux/userSlice";
import type { Theme } from "../../../constants/themes";
import type { Message } from "../../../types/chat";

export default function ChatRoomScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const listRef = useRef<FlashList<Message>>(null);

  const userId = useSelector(selectLocalId);
  const { messages, isLoading, isSending, sendMessage } = useChat(chatId || "");

  const handleSend = async (text: string) => {
    await sendMessage(text);
    // Scroll to bottom after sending
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      isOwn={item.senderId === userId}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          estimatedItemSize={60}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          inverted={false}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isSending={isSending}
        style={{ paddingBottom: insets.bottom }}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgElev1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  messagesContent: {
    padding: 16,
  },
});
```

### 5. Cloud Functions (`functions/chat.js`)

> **Pattern**: Follows `notifications.js` - uses v2 syntax (`onDocumentCreated`), transactions for consistency, parallel operations for push notifications.

```javascript
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

// ============================================
// HELPER: Get user display info
// ============================================

async function getUserDisplayInfo(userId) {
  const [customerDoc, profileDoc] = await Promise.all([
    db.doc(`customers/${userId}`).get(),
    db.doc(`profiles/${userId}`).get(),
  ]);

  const customer = customerDoc.data() || {};
  const profile = profileDoc.data() || {};

  return {
    displayName:
      profile.displayName ||
      customer.displayName ||
      `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
      "Anonymous",
    photoURL:
      profile.photoURL || profile.profilePicture || customer.profilePicture || null,
    expoPushToken: customer.expoPushToken || null,
  };
}

// ============================================
// HELPER: Send push notification
// ============================================

async function sendPushNotification(token, title, body, data) {
  if (!token) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: "default",
      }),
    });
  } catch (err) {
    logger.error("Push notification failed", { err, token });
  }
}

// ============================================
// MESSAGE CREATED - Update metadata & notify
// ============================================

exports.onMessageCreated = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const { chatId, messageId } = event.params;
    const message = event.data?.data();

    if (!message) {
      logger.error("No message data", { chatId, messageId });
      return null;
    }

    const { senderId, senderName, text, createdAt } = message;

    try {
      // Get chat document
      const chatDoc = await db.doc(`chats/${chatId}`).get();

      if (!chatDoc.exists) {
        logger.error("Chat not found", { chatId });
        return null;
      }

      const chat = chatDoc.data();
      const recipients = chat.members.filter((id) => id !== senderId);

      // Prepare lastMessage update
      const lastMessage = {
        text: text || "[Media]",
        senderId,
        senderName,
        createdAt,
        type: message.mediaType || "text",
      };

      // Use transaction for consistent updates
      await db.runTransaction(async (tx) => {
        // Update chat document
        tx.update(db.doc(`chats/${chatId}`), {
          lastMessage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update all member summaries
        for (const memberId of chat.members) {
          const summaryRef = db.doc(`users/${memberId}/chatSummaries/${chatId}`);
          const updates = {
            lastMessage,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Increment unread for recipients only
          if (memberId !== senderId) {
            updates.unreadCount = admin.firestore.FieldValue.increment(1);
          }

          tx.update(summaryRef, updates);
        }
      });

      // Get recipient info in parallel (outside transaction)
      const recipientInfos = await Promise.all(
        recipients.map(async (recipientId) => {
          const info = await getUserDisplayInfo(recipientId);
          return { recipientId, ...info };
        }),
      );

      // Send push notifications in parallel
      await Promise.all(
        recipientInfos
          .filter((r) => r.expoPushToken)
          .map((recipient) =>
            sendPushNotification(
              recipient.expoPushToken,
              senderName || "New message",
              text || "Sent you a message",
              { type: "chat_message", chatId, senderId },
            ),
          ),
      );

      logger.info("Message processed", { chatId, messageId });
    } catch (err) {
      logger.error("onMessageCreated failed", { err, chatId, messageId });
    }

    return null;
  },
);

// ============================================
// EVENT CHAT: Create on event creation
// ============================================

exports.createEventChat = onDocumentCreated(
  "events/{eventId}",
  async (event) => {
    const { eventId } = event.params;
    const eventData = event.data?.data();

    if (!eventData?.chatEnabled) {
      logger.info("Chat not enabled for event", { eventId });
      return null;
    }

    try {
      const chatRef = db.collection("chats").doc();

      await chatRef.set({
        type: "event",
        eventId,
        eventName: eventData.title || eventData.name,
        eventDate: eventData.date || eventData.startDate,
        members: [],
        memberCount: 0,
        maxMembers: 500,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        lastMessage: null,
      });

      // Link chat to event
      await event.data.ref.update({ chatId: chatRef.id });

      logger.info("Event chat created", { eventId, chatId: chatRef.id });
    } catch (err) {
      logger.error("createEventChat failed", { err, eventId });
    }

    return null;
  },
);

// ============================================
// EVENT CHAT: Auto-join on ticket purchase
// ============================================

exports.joinEventChatOnTicketPurchase = onDocumentCreated(
  "customers/{userId}/tickets/{ticketId}",
  async (event) => {
    const { userId, ticketId } = event.params;
    const ticket = event.data?.data();
    const { eventId } = ticket || {};

    if (!eventId) {
      logger.info("No eventId on ticket", { ticketId });
      return null;
    }

    try {
      // Get event to find chatId
      const eventDoc = await db.doc(`events/${eventId}`).get();
      const eventData = eventDoc.data();

      if (!eventData?.chatId) {
        logger.info("No chat for event", { eventId });
        return null;
      }

      const chatId = eventData.chatId;
      const chatRef = db.doc(`chats/${chatId}`);

      // Use transaction for atomic updates
      await db.runTransaction(async (tx) => {
        const chatDoc = await tx.get(chatRef);

        if (!chatDoc.exists) {
          throw new Error(`Chat ${chatId} not found`);
        }

        const chat = chatDoc.data();

        // Check if already a member
        if (chat.members.includes(userId)) {
          logger.info("User already in chat", { userId, chatId });
          return;
        }

        // Check capacity
        if (chat.memberCount >= (chat.maxMembers || 500)) {
          logger.warn("Chat at capacity", { chatId });
          return;
        }

        // Add user to chat
        tx.update(chatRef, {
          members: admin.firestore.FieldValue.arrayUnion(userId),
          memberCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create chat summary for user
        tx.set(db.doc(`users/${userId}/chatSummaries/${chatId}`), {
          chatId,
          type: "event",
          eventId,
          eventName: chat.eventName,
          lastMessage: chat.lastMessage,
          unreadCount: 0,
          muted: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Send welcome message (outside transaction)
      const userInfo = await getUserDisplayInfo(userId);
      await chatRef.collection("messages").add({
        senderId: "system",
        senderName: "RAGESTATE",
        text: `${userInfo.displayName} joined the chat!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("User joined event chat", { userId, chatId });
    } catch (err) {
      logger.error("joinEventChatOnTicketPurchase failed", { err, userId, ticketId });
    }

    return null;
  },
);

// ============================================
// EVENT CHAT: Archive expired chats (daily)
// ============================================

exports.archiveExpiredEventChats = onSchedule(
  {
    schedule: "0 6 * * *", // 6 AM daily
    timeZone: "America/Los_Angeles",
  },
  async () => {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const chatsSnapshot = await db
        .collection("chats")
        .where("type", "==", "event")
        .where("isActive", "==", true)
        .where("eventDate", "<", cutoffDate)
        .get();

      if (chatsSnapshot.empty) {
        logger.info("No event chats to archive");
        return;
      }

      const batch = db.batch();

      for (const doc of chatsSnapshot.docs) {
        batch.update(doc.ref, {
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Add archive notice
        const messageRef = doc.ref.collection("messages").doc();
        batch.set(messageRef, {
          senderId: "system",
          senderName: "RAGESTATE",
          text: "This event chat has been archived. Thanks for the memories!",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      logger.info("Archived event chats", { count: chatsSnapshot.size });
    } catch (err) {
      logger.error("archiveExpiredEventChats failed", { err });
    }
  },
);
```

---

## Redux Integration

> **Pattern**: Follows existing `userSlice.tsx` - add chat-related state for global unread count badge.

### Add to `src/store/redux/userSlice.tsx`

```typescript
// Add to UserState interface
interface UserState {
  // ... existing fields
  unreadChatCount: number;
}

// Add to initialState
const initialState: UserState = {
  // ... existing fields
  unreadChatCount: 0,
};

// Add reducers
reducers: {
  // ... existing reducers
  setUnreadChatCount: (state, action: PayloadAction<number>) => {
    state.unreadChatCount = action.payload;
  },
},

// Add selector
export const selectUnreadChatCount = (state: RootState): number =>
  state.user.unreadChatCount;

// Export action
export const { setUnreadChatCount } = userSlice.actions;
```

### Usage in Tab Badge

```typescript
// In tab navigator or header
import { useSelector } from "react-redux";
import { selectUnreadChatCount } from "../store/redux/userSlice";

function TabBar() {
  const unreadCount = useSelector(selectUnreadChatCount);

  return (
    <Tab.Screen
      name="messages"
      options={{
        tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
      }}
    />
  );
}
```

---

## React Query Keys

> **Pattern**: Follows existing `reactQuery.ts` hierarchical key structure.

### Add to `src/config/reactQuery.ts`

```typescript
export const queryKeys = {
  // ... existing keys

  chat: {
    all: ["chat"] as const,
    lists: () => [...queryKeys.chat.all, "list"] as const,
    detail: (chatId: string) => [...queryKeys.chat.all, "detail", chatId] as const,
    messages: (chatId: string) => [...queryKeys.chat.all, "messages", chatId] as const,
  },
} as const;
```

---

## Component Designs

> **Pattern**: Follows existing component patterns - use `useThemedStyles`, `useTheme`, TypeScript interfaces.

### ChatListItem (`src/components/chat/ChatListItem.tsx`)

```typescript
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { formatRelativeTime } from "../../utils/dateUtils";
import type { ChatSummary } from "../../types/chat";
import type { Theme } from "../../constants/themes";

interface ChatListItemProps {
  chat: ChatSummary;
  onPress: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onPress }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const displayName = chat.type === "event" ? chat.eventName : chat.peerName;
  const photoURL = chat.type === "event" ? null : chat.peerPhoto;
  const hasUnread = chat.unreadCount > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {chat.type === "event" ? "🎉" : displayName?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
          {displayName || "Chat"}
        </Text>
        {chat.lastMessage && (
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {chat.lastMessage.text}
          </Text>
        )}
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        {chat.lastMessage && (
          <Text style={styles.time}>
            {formatRelativeTime(chat.lastMessage.createdAt)}
          </Text>
        )}
        {hasUnread && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bgRoot,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.bgElev2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarText: {
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  nameUnread: {
    fontWeight: "600" as const,
  },
  preview: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewUnread: {
    color: theme.colors.textPrimary,
  },
  meta: {
    alignItems: "flex-end" as const,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: theme.colors.textInverse,
  },
});
```

### MessageBubble (`src/components/chat/MessageBubble.tsx`)

```typescript
import React from "react";
import { View, Text, Image } from "react-native";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { formatMessageTime } from "../../utils/dateUtils";
import type { Message } from "../../types/chat";
import type { Theme } from "../../constants/themes";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender?: boolean; // For group chats
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSender = false,
}) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
      {showSender && !isOwn && (
        <View style={styles.senderRow}>
          {message.senderPhoto && (
            <Image source={{ uri: message.senderPhoto }} style={styles.senderPhoto} />
          )}
          <Text style={styles.senderName}>{message.senderName}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther]}>
          {message.text}
        </Text>
      </View>
      <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
        {formatMessageTime(message.createdAt)}
        {message.status === "sending" && " · Sending..."}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  containerOwn: {
    alignSelf: "flex-end" as const,
  },
  containerOther: {
    alignSelf: "flex-start" as const,
  },
  senderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  senderPhoto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "500" as const,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.colors.bgElev1,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textOwn: {
    color: theme.colors.textInverse,
  },
  textOther: {
    color: theme.colors.textPrimary,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  timeOwn: {
    color: theme.colors.textTertiary,
    textAlign: "right" as const,
  },
  timeOther: {
    color: theme.colors.textTertiary,
  },
});
```

### ChatInput (`src/components/chat/ChatInput.tsx`)

> **Note**: Based on existing `CommentInput.tsx` pattern.

```typescript
import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Theme } from "../../constants/themes";
import type { ViewStyle } from "react-native";

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  isSending?: boolean;
  placeholder?: string;
  style?: ViewStyle;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isSending = false,
  placeholder = "Message...",
  style,
}) => {
  const [text, setText] = useState("");
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSending) return;

    try {
      await onSend(trimmedText);
      setText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const canSend = text.trim().length > 0 && !isSending;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        maxLength={2000}
        editable={!isSending}
      />
      <TouchableOpacity
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!canSend}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={theme.colors.textInverse} />
        ) : (
          <Ionicons name="send" size={18} color={theme.colors.textInverse} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.bgElev1,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 44,
    color: theme.colors.textPrimary,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    position: "absolute" as const,
    right: 18,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
```

---

## Navigation Integration

### Option A: New Tab (Recommended for MVP)

Add messages as a hidden route accessible from notifications/profile:

```typescript
// src/app/(app)/_layout.tsx

// Add to Tabs:
<Tabs.Screen
  name="messages"
  options={{
    href: null, // Hidden from tab bar
    headerShown: false,
  }}
/>
```

### Option B: Badge on Notifications Tab

Show unread message count on notifications tab and have messages as a section within.

---

## Implementation Checklist

### Phase 1: Foundation

- [x] Create `src/types/chat.ts` with TypeScript interfaces
- [x] Create `src/services/chatService.ts` (deterministic DM IDs, user info helper)
- [x] Add `unreadChatCount` to `src/store/redux/userSlice.tsx`
- [x] Add `chat` query keys to `src/config/reactQuery.ts`
- [x] Create `functions/chat.js` with v2 syntax functions
- [x] Export from `functions/index.js`
- [x] Deploy functions

### Phase 2: Hooks

- [x] Create `src/hooks/useChatList.ts` (with Redux dispatch for unread)
- [x] Create `src/hooks/useChat.ts` (with pagination support)

### Phase 3: Components

- [x] Create `src/components/chat/ChatListItem.tsx`
- [x] Create `src/components/chat/MessageBubble.tsx` (with sender info for groups)
- [x] Create `src/components/chat/ChatInput.tsx` (based on CommentInput)
- [x] Create `src/components/chat/EmptyChat.tsx`
- [x] Create `src/components/chat/index.ts` barrel export

### Phase 4: Screens

- [x] Create `src/app/(app)/messages/index.tsx` (chat list)
- [x] Create `src/app/(app)/messages/[chatId].tsx` (chat room with FlashList)
- [x] Add route to `src/app/(app)/_layout.tsx`
- [x] Add "Event Chat" button to event detail screen

### Phase 5: Integration & Testing (P0)

- [ ] Test auto-join flow: purchase ticket → automatically in chat
- [ ] Test message flow: send → Cloud Function → recipient sees + push notification
- [ ] Test archive flow: event ends → chat becomes read-only
- [ ] Test unread badge updates in real-time
- [ ] Add analytics: `event_chat_joined`, `message_sent`, `chat_opened`

### Phase 6: DMs (P1)

#### Overview

Premium DM experience leveraging existing codebase capabilities:
- `userSearchService.ts` for user discovery
- `UserCard.tsx` for consistent user display
- `chatService.ts` with deterministic DM IDs
- Verification badges throughout

#### UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Message button layout** | Side-by-side with Follow | Instagram/Twitter pattern. Both are primary social actions, equal prominence expected. |
| **Recent conversations** | Last 5 + "See all" link | Keeps screen focused on discovery while providing quick access. "See all" goes to messages list. |
| **Chat header interaction** | Tap header → profile | Universal pattern (WhatsApp, Instagram, iMessage). Intuitive, no extra buttons, discoverable. |

#### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/app/(app)/messages/new.tsx` | Create | New DM screen with search + recent + suggested |
| `src/app/(app)/messages/_layout.tsx` | Modify | Register `new` screen in Stack |
| `src/components/profile/ProfileHeader.tsx` | Modify | Add Message button (side-by-side with Follow) |
| `src/components/profile/UserProfileView.tsx` | Modify | Handle onMessagePress → create DM → navigate |
| `src/app/(app)/messages/[chatId].tsx` | Modify | Enhanced header for DMs (peer photo, name, tap to profile) |
| `src/hooks/useChatList.ts` | Modify | Add helper to filter DM-type chats |

#### 6.1 New DM Screen (`messages/new.tsx`)

**Three-Section Layout:**

```
┌─────────────────────────────────┐
│  🔍 Search users...        [X]  │  ← Sticky search bar
├─────────────────────────────────┤
│  RECENT                See all →│  ← Last 5 DM contacts
│  ┌─────┐ ┌─────┐ ┌─────┐        │
│  │ 👤  │ │ 👤  │ │ 👤  │ ...    │  ← Horizontal scroll
│  │Name │ │Name │ │Name │        │
│  └─────┘ └─────┘ └─────┘        │
├─────────────────────────────────┤
│  SUGGESTED                      │  ← getSuggestedUsers()
│  ┌──────────────────────────┐   │
│  │ 👤 Display Name    ✓     │   │  ← UserCard style
│  │    @username             │   │
│  │    Bio text here...      │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ 👤 Another User    ★     │   │
│  │    @artist               │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘

When searching:
┌─────────────────────────────────┐
│  🔍 john                   [X]  │
├─────────────────────────────────┤
│  ┌──────────────────────────┐   │
│  │ 👤 John Smith      ✓     │   │  ← Search results
│  │    @johnsmith            │   │
│  │    Music producer from LA│   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ 👤 Johnny B              │   │
│  │    @johnny_b             │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

**Features:**
- Debounced search (300ms) for performance
- Detects `@` prefix → uses `searchUsersByUsername()`
- Otherwise → uses `searchUsersByName()`
- Shows verification badges (✓ verified, ★ artist)
- Shows user bio in results for context
- Recent section: horizontal scroll of last 5 DM partners
- "See all" navigates to `/messages` (main list)

**User Flow:**
1. User taps "New message" button
2. Screen shows Recent + Suggested sections
3. User can tap a recent contact OR search
4. On user selection → `getOrCreateDmChat()` → navigate to `/messages/{chatId}`
5. Loading indicator while creating chat

#### 6.2 Profile Message Button

**ProfileHeader.tsx Changes:**

```typescript
interface ProfileHeaderProps {
  // ... existing props
  onMessagePress?: () => void;  // NEW
}
```

**Visual Layout:**
```
┌─────────────────────────────────┐
│  [  Follow  ] [  💬 Message  ]  │  ← Side-by-side, equal width
└─────────────────────────────────┘
```

**Button Styling:**
- Outline style (matches "Following" state)
- Icon: `Ionicons "chatbubble-outline"`
- Same height/padding as Follow button
- Only renders for other users' profiles

#### 6.3 Enhanced Chat Header for DMs

**Current:**
```
┌─────────────────────────────────┐
│  ←  Chat                        │
└─────────────────────────────────┘
```

**Enhanced for DMs:**
```
┌─────────────────────────────────┐
│  ←  [👤] John Smith       ✓     │  ← Tap anywhere to view profile
└─────────────────────────────────┘
```

**Implementation:**
- Fetch peer info from `ChatSummary` (already has `peerName`, `peerPhoto`)
- Wrap header content in `TouchableOpacity`
- On tap → navigate to `/messages/profile/{peerId}` or appropriate profile route
- Show verification badge if available (requires adding to ChatSummary type)

#### 6.4 Analytics Events

| Event | Properties | Trigger |
|-------|------------|---------|
| `dm_screen_opened` | `source: "new_button" \| "profile" \| "chat_list"` | Open new DM screen or chat |
| `dm_search_performed` | `query`, `query_length`, `results_count` | User searches for recipient |
| `dm_started` | `peer_id`, `is_new_chat`, `source` | DM created or opened |
| `dm_profile_viewed` | `peer_id`, `from_chat` | Tap chat header to view profile |

#### Checklist

- [x] Create `src/app/(app)/messages/new.tsx`
  - [x] Search bar with debounce
  - [x] Recent conversations section (horizontal, last 5)
  - [x] Suggested users section (vertical list)
  - [x] Search results display
  - [x] Loading states
  - [x] Analytics tracking
- [x] Modify `src/app/(app)/messages/_layout.tsx`
  - [x] Add `new` screen to Stack
- [x] Modify `src/components/profile/ProfileHeader.tsx`
  - [x] Add `onMessagePress` prop
  - [x] Add Message button (side-by-side with Follow)
  - [x] Match Follow button styling (outline variant)
- [x] Modify `src/components/profile/UserProfileView.tsx`
  - [x] Import `getOrCreateDmChat` from chatService
  - [x] Add `handleMessagePress` function
  - [x] Pass to ProfileHeader
- [x] Modify `src/app/(app)/messages/[chatId].tsx`
  - [x] Enhanced header for DMs (peer photo + name)
  - [x] Tap header → navigate to peer profile
  - [x] Pass chat type/peer info via route params or fetch from hook
- [x] Modify `src/hooks/useChatList.ts`
  - [x] Add `getRecentDmContacts()` helper or filter function
  - [x] Add `getExistingDmPeerIds()` helper function
- [x] Test deterministic DM ID: same chat opens regardless of who initiates (implemented via `getDmChatId`)
- [x] Add analytics events (`dm_screen_opened`, `dm_search_performed`, `dm_started`, `dm_profile_viewed`)

### V2 Enhancements (Post-MVP)

- [x] Media messages (images/videos via Firebase Storage)
- [ ] Typing indicators (presence subcollection)
- [ ] Read receipts (track `readBy` array)
- [ ] Message reactions
- [ ] Search within chat
- [ ] Mute/unmute chats
- [ ] Event chat moderation (remove users, report)

---

## Analytics Events

### Event Chat Events

| Event                      | Properties                                       | Trigger                      |
| -------------------------- | ------------------------------------------------ | ---------------------------- |
| `event_chat_joined`        | `event_id`, `chat_id`, `member_count`            | Auto-join on ticket purchase |
| `event_chat_viewed`        | `event_id`, `chat_id`, `member_count`            | Open event chat              |

### DM Events

| Event                      | Properties                                       | Trigger                      |
| -------------------------- | ------------------------------------------------ | ---------------------------- |
| `dm_screen_opened`         | `source: "new_button" \| "profile" \| "chat_list"` | Open new DM screen         |
| `dm_search_performed`      | `query`, `query_length`, `results_count`         | User searches for recipient  |
| `dm_started`               | `peer_id`, `is_new_chat`, `source`               | DM created or opened         |
| `dm_profile_viewed`        | `peer_id`, `from_chat`                           | Tap chat header to view profile |

### General Chat Events

| Event                      | Properties                                       | Trigger                      |
| -------------------------- | ------------------------------------------------ | ---------------------------- |
| `chat_list_viewed`         | `chat_count`, `event_chat_count`, `dm_count`     | Open messages tab            |
| `chat_opened`              | `chat_id`, `type`, `peer_id?`, `event_id?`       | Open any chat room           |
| `message_sent`             | `chat_id`, `chat_type`, `message_type`, `length` | Send message                 |
| `chat_notification_tapped` | `chat_id`, `type`                                | Tap push notification        |

---

## Success Criteria

### Event Chats (P0)

- [ ] Event chats auto-create when events are created with chatEnabled=true
- [ ] Users automatically join event chat on ticket purchase
- [ ] Event chat shows member count and event info
- [ ] Event chats archive 24h after event ends (read-only)
- [ ] Messages appear in real-time (< 500ms)
- [ ] Push notifications work for new messages

### DMs (P1)

**Discovery & Creation:**
- [x] Users can start a DM from any profile (Message button)
- [x] Users can start a DM from new message screen (search + recent + suggested)
- [x] Deterministic chat ID works: same chat opens regardless of who initiates
- [x] Search works for both display name and @username

**Chat Experience:**
- [x] DM header shows peer's photo and name
- [x] Tap header navigates to peer's profile
- [ ] Unread counts update correctly in real-time (requires testing)
- [ ] Messages appear in real-time (< 500ms) (requires testing)

**Performance:**
- [ ] Chat list loads in < 1 second (requires testing)
- [ ] Search results appear within 500ms of typing (requires testing)
- [ ] No duplicate messages (requires testing)
- [ ] Works offline (queued sends) (requires testing)
