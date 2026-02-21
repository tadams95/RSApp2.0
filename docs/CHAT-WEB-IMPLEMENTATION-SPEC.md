# Chat Implementation Specification for Next.js Web App

> **Target Repository**: `ragestate-dotcom` (Next.js web app)
> **Reference Implementation**: RAGESTATE React Native mobile app
> **Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [TypeScript Interfaces](#3-typescript-interfaces)
4. [Service Layer](#4-service-layer)
5. [Custom Hooks](#5-custom-hooks)
6. [Component Mapping](#6-component-mapping)
7. [Page Structure](#7-page-structure)
8. [Web-Specific Concerns](#8-web-specific-concerns)
9. [Implementation Checklist](#9-implementation-checklist)
10. [Testing Checklist](#10-testing-checklist)
11. [Analytics Events](#11-analytics-events)

---

## 1. Executive Summary

### Scope
Implement **DM (Direct Message) chats** and **Event group chats** for the RAGESTATE web application with full feature parity to the mobile app.

### Constraints
- **Backend Compatibility**: Use the **existing Firebase backend** without modifications
- **Feature Parity**: Match all mobile chat features (real-time messaging, media upload, unread counts, etc.)
- **Cross-Platform Sync**: Messages must sync in real-time between web and mobile clients

### Architecture Philosophy
```
┌─────────────────────────────────────────────────────────────────┐
│                        SHARED BACKEND                           │
│  (Firebase Firestore + Cloud Functions + Storage)               │
│  ⚠️ DO NOT MODIFY - Used by both Mobile and Web                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
          ┌───────────────────┴───────────────────┐
          │                                       │
┌─────────┴─────────┐                 ┌──────────┴──────────┐
│   Mobile App      │                 │    Web App          │
│   (React Native)  │                 │    (Next.js)        │
│   ✅ Complete     │                 │    📋 This Spec     │
└───────────────────┘                 └─────────────────────┘
```

---

## 2. Architecture Overview

### 2.1 Shared Backend (DO NOT MODIFY)

| Component | Location | Purpose |
|-----------|----------|---------|
| **Chat Documents** | `/chats/{chatId}` | Chat metadata, members list, lastMessage |
| **Messages** | `/chats/{chatId}/messages/{messageId}` | Individual message documents |
| **User Summaries** | `/users/{userId}/chatSummaries/{chatId}` | Per-user chat list with unread counts |
| **Media Storage** | `chat-media/{chatId}/{filename}` | Uploaded images/videos |

#### Cloud Functions (Reference Only)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onChatMessageCreated` | Message document created | Updates `lastMessage`, increments `unreadCount`, sends push notifications |
| `onDmChatCreated` | DM chat document created | Creates `chatSummaries` for both users |
| `onEventCreatedCreateChat` | Event with `chatEnabled: true` | Creates event chat, links to event |
| `onTicketPurchasedJoinChat` | Ticket purchased | Adds user to event chat, creates summary |
| `archiveExpiredEventChats` | Daily schedule (6 AM PT) | Marks expired event chats as inactive |

#### Firestore Security Rules

```javascript
// Chat document - members only
match /chats/{chatId} {
  allow read, update, delete: if isAuthenticated() && request.auth.uid in resource.data.members;
  allow create: if isAuthenticated()
    && request.resource.data.members is list
    && request.resource.data.members.size() >= 2
    && request.auth.uid in request.resource.data.members;
}

// Messages - members only, immutable
match /chats/{chatId}/messages/{messageId} {
  allow read, create: if isAuthenticated() &&
    request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.members;
  allow update, delete: if false; // Messages are immutable
}

// User summaries - owner only
match /users/{userId}/chatSummaries/{chatId} {
  allow read, write: if isAuthenticated() && request.auth.uid == userId;
}
```

### 2.2 Web-Specific Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 14+ (App Router) | Server components where possible |
| **Routing** | `/app/messages/...` | File-based routing |
| **State Management** | Zustand (recommended) | Lightweight alternative to Redux |
| **Styling** | Tailwind CSS | Match mobile theme tokens |
| **Firebase** | `firebase/firestore`, `firebase/storage` | Same SDK as mobile |

---

## 3. TypeScript Interfaces

Copy these interfaces exactly from the mobile app (`src/types/chat.ts`):

```typescript
// chat.ts - matches Firestore schema

export type ChatType = "dm" | "event";
export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "video";

/**
 * User info helper for display purposes
 * Used when fetching user data from customers + profiles collections
 */
export interface UserInfo {
  userId: string;
  displayName: string;
  photoURL: string | null;
  username: string | null;
}

/**
 * Chat document in /chats/{chatId}
 */
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

/**
 * Last message preview stored on chat document
 */
export interface LastMessage {
  text: string;
  senderId: string;
  senderName?: string;
  createdAt: Date;
  type: MessageType;
}

/**
 * Message document in /chats/{chatId}/messages/{messageId}
 */
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

/**
 * Chat summary stored per-user in /users/{userId}/chatSummaries/{chatId}
 * Used for chat list display
 */
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

## 4. Service Layer

Create `services/chatService.ts` based on the mobile implementation. Most functions are **identical**.

### 4.1 Functions Reference

| Function | Signature | Web Changes |
|----------|-----------|-------------|
| `getDmChatId` | `(userId1, userId2) => string` | **Identical** - deterministic ID generation |
| `getUserDisplayInfo` | `(userId) => Promise<UserInfo>` | **Identical** - checks both `customers` and `profiles` |
| `getOrCreateDmChat` | `(currentUserId, peerId) => Promise<string>` | **Identical** |
| `uploadChatMedia` | `(chatId, file, onProgress?) => Promise<string>` | **Changed** - accept `File` object instead of URI |
| `sendMessage` | `(chatId, senderId, senderName, senderPhoto, text, mediaUrl?, mediaType?) => Promise<string>` | **Identical** |
| `subscribeToMessages` | `(chatId, onUpdate, onError, limit?) => Unsubscribe` | **Identical** |
| `fetchOlderMessages` | `(chatId, lastDoc, limit?) => Promise<{messages, lastDoc}>` | **Identical** |
| `subscribeToChatList` | `(userId, onUpdate, onError) => Unsubscribe` | **Identical** |
| `markChatAsRead` | `(userId, chatId) => Promise<void>` | **Identical** |
| `subscribeToTotalUnread` | `(userId, onUpdate, onError) => Unsubscribe` | **Identical** |

### 4.2 Key Implementation: Deterministic DM Chat ID

```typescript
/**
 * Generate deterministic chat ID for DMs
 * CRITICAL: This must match mobile implementation exactly
 * Eliminates expensive queries to find existing chats
 */
export function getDmChatId(userId1: string, userId2: string): string {
  return `dm_${[userId1, userId2].sort().join("_")}`;
}
```

### 4.3 Web-Specific: File Upload

The mobile app uses a URI string from expo-image-picker. The web app should accept a `File` object:

```typescript
/**
 * Upload chat media (image) to Firebase Storage
 * Web version accepts File object instead of URI
 */
export async function uploadChatMedia(
  chatId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const storagePath = `chat-media/${chatId}/${filename}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}
```

### 4.4 Complete Service File Template

```typescript
// services/chatService.ts

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
  QueryDocumentSnapshot,
  DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Message, ChatSummary, UserInfo } from "@/types/chat";

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
// HELPER: User Info (multi-collection pattern)
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
  peerId: string
): Promise<string> {
  const chatId = getDmChatId(currentUserId, peerId);
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const chatDoc = await getDoc(chatRef);

  if (chatDoc.exists()) {
    return chatId;
  }

  // Create chat document only - Cloud Function creates summaries for both users
  await setDoc(chatRef, {
    type: "dm",
    members: [currentUserId, peerId].sort(),
    memberCount: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isActive: true,
    lastMessage: null,
  });

  return chatId;
}

// ============================================
// MEDIA UPLOAD (Web-specific)
// ============================================

export async function uploadChatMedia(
  chatId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const storagePath = `chat-media/${chatId}/${filename}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string | null,
  mediaUrl?: string,
  mediaType?: "image" | "video"
): Promise<string> {
  const messagesRef = collection(
    db,
    CHATS_COLLECTION,
    chatId,
    MESSAGES_COLLECTION
  );

  const messageData: Record<string, unknown> = {
    senderId,
    senderName,
    senderPhoto,
    text: text || null,
    createdAt: serverTimestamp(),
    readBy: [senderId],
  };

  if (mediaUrl) {
    messageData.mediaUrl = mediaUrl;
    messageData.mediaType = mediaType || "image";
  }

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
  limitCount = PAGE_SIZE
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
      // Reverse to show oldest first (for chat display)
      onUpdate(messages.reverse(), lastDoc);
    },
    (error) => {
      console.error("Error subscribing to messages:", error);
      onError(error);
    }
  );
}

export async function fetchOlderMessages(
  chatId: string,
  lastDoc: QueryDocumentSnapshot<DocumentData>,
  limitCount = PAGE_SIZE
): Promise<{ messages: Message[]; lastDoc: QueryDocumentSnapshot | null }> {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_COLLECTION);
  const q = query(
    messagesRef,
    orderBy("createdAt", "desc"),
    startAfter(lastDoc),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
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

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  return { messages: messages.reverse(), lastDoc: newLastDoc };
}

export function subscribeToChatList(
  userId: string,
  onUpdate: (chats: ChatSummary[]) => void,
  onError: (error: Error) => void
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
    }
  );
}

export async function markChatAsRead(userId: string, chatId: string): Promise<void> {
  const summaryRef = doc(db, `users/${userId}/${CHAT_SUMMARIES}/${chatId}`);
  await setDoc(summaryRef, { unreadCount: 0 }, { merge: true });
}

export function subscribeToTotalUnread(
  userId: string,
  onUpdate: (count: number) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const summariesRef = collection(db, `users/${userId}/${CHAT_SUMMARIES}`);

  return onSnapshot(
    summariesRef,
    (snapshot) => {
      const totalUnread = snapshot.docs.reduce(
        (sum, docSnap) => sum + (docSnap.data().unreadCount || 0),
        0
      );
      onUpdate(totalUnread);
    },
    (error) => {
      console.error("Error subscribing to unread count:", error);
      onError(error);
    }
  );
}
```

---

## 5. Custom Hooks

### 5.1 useChat Hook

```typescript
// hooks/useChat.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext"; // Your auth context
import {
  subscribeToMessages,
  sendMessage as sendMessageService,
  fetchOlderMessages,
  markChatAsRead,
  uploadChatMedia,
} from "@/services/chatService";
import type { Message } from "@/types/chat";

const PAGE_SIZE = 50;

interface UseChatResult {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  isSending: boolean;
  sendMessage: (text: string, mediaFile?: File) => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useChat(chatId: string): UseChatResult {
  const { user } = useAuth(); // Assumes user has { uid, displayName }
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasMore(true);
    lastDocRef.current = null;

    const unsubscribe = subscribeToMessages(
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
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  // Mark as read when viewing
  useEffect(() => {
    if (chatId && user?.uid) {
      markChatAsRead(user.uid, chatId);
    }
  }, [chatId, user?.uid]);

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !lastDocRef.current || !chatId) return;

    setIsLoadingMore(true);

    try {
      const { messages: olderMessages, lastDoc } = await fetchOlderMessages(
        chatId,
        lastDocRef.current,
        PAGE_SIZE
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

  // Send message (supports text and/or media File)
  const sendMessage = useCallback(
    async (text: string, mediaFile?: File) => {
      if (!user?.uid || !chatId || (!text.trim() && !mediaFile)) return;

      setIsSending(true);

      // Optimistic update with local preview
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId,
        senderId: user.uid,
        senderName: user.displayName || "You",
        senderPhoto: null,
        text: text.trim() || null,
        mediaUrl: mediaFile ? URL.createObjectURL(mediaFile) : undefined,
        mediaType: mediaFile ? "image" : undefined,
        createdAt: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        // Upload media if provided
        let uploadedMediaUrl: string | undefined;
        if (mediaFile) {
          uploadedMediaUrl = await uploadChatMedia(chatId, mediaFile);
        }

        // Send message with uploaded media URL
        await sendMessageService(
          chatId,
          user.uid,
          user.displayName || "Anonymous",
          null,
          text.trim() || null,
          uploadedMediaUrl,
          uploadedMediaUrl ? "image" : undefined
        );
        // Real-time listener will update with the actual message
      } catch (err) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setError(err as Error);
      } finally {
        setIsSending(false);
        // Clean up object URL
        if (optimisticMessage.mediaUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(optimisticMessage.mediaUrl);
        }
      }
    },
    [chatId, user]
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

### 5.2 useChatList Hook

```typescript
// hooks/useChatList.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatStore } from "@/store/chatStore"; // Zustand store
import { subscribeToChatList } from "@/services/chatService";
import type { ChatSummary } from "@/types/chat";

interface UseChatListResult {
  chats: ChatSummary[];
  isLoading: boolean;
  error: Error | null;
  totalUnread: number;
  refetch: () => void;
}

export function useChatList(): UseChatListResult {
  const { user } = useAuth();
  const setUnreadCount = useChatStore((state) => state.setUnreadCount);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = subscribeToChatList(
      user.uid,
      (newChats) => {
        setChats(newChats);
        setIsLoading(false);
        setError(null);

        // Update global unread count in Zustand store
        const total = newChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
        setUnreadCount(total);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, refreshKey, setUnreadCount]);

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return { chats, isLoading, error, totalUnread, refetch };
}

// Helper functions (same as mobile)
export function getRecentDmContacts(chats: ChatSummary[], limit = 5): ChatSummary[] {
  return chats
    .filter((chat) => chat.type === "dm" && chat.peerId && chat.peerName)
    .slice(0, limit);
}

export function getExistingDmPeerIds(chats: ChatSummary[]): Set<string> {
  return new Set(
    chats
      .filter((chat) => chat.type === "dm" && chat.peerId)
      .map((chat) => chat.peerId as string)
  );
}
```

### 5.3 Zustand Store for Chat State

```typescript
// store/chatStore.ts

import { create } from "zustand";

interface ChatState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
```

---

## 6. Component Mapping

| Mobile Component | Web Equivalent | Key Differences |
|------------------|----------------|-----------------|
| `ChatListItem` | `<div>` / `<button>` with Tailwind | Use `next/link` or `router.push` |
| `MessageBubble` | `<div>` with dialog for images | Use `<dialog>` or Radix UI Dialog |
| `ChatInput` | `<textarea>` + `<input type="file">` | HTML file input instead of expo-image-picker |
| `EmptyChat` | Standard `<div>` layout | Identical structure |
| `FlashList` | Native `<div>` with virtualization | Consider `react-window` for long lists |

### 6.1 ChatListItem Component

```tsx
// components/chat/ChatListItem.tsx

import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react"; // or any icon library
import type { ChatSummary } from "@/types/chat";
import { formatRelativeTime } from "@/lib/utils";

interface ChatListItemProps {
  chat: ChatSummary;
}

export function ChatListItem({ chat }: ChatListItemProps) {
  const displayName = chat.type === "event" ? chat.eventName : chat.peerName;
  const photoURL = chat.type === "event" ? null : chat.peerPhoto;
  const hasUnread = chat.unreadCount > 0;

  return (
    <Link
      href={`/messages/${chat.chatId}`}
      className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border"
    >
      {/* Avatar */}
      <div className="mr-3">
        {chat.type === "event" ? (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-muted-foreground" />
          </div>
        ) : photoURL ? (
          <Image
            src={photoURL}
            alt={displayName || "User"}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <span className="text-lg font-semibold text-foreground">
              {displayName?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 mr-2">
        <p className={`truncate ${hasUnread ? "font-semibold" : ""}`}>
          {displayName || "Chat"}
        </p>
        {chat.lastMessage && (
          <p className={`text-sm truncate ${hasUnread ? "text-foreground" : "text-muted-foreground"}`}>
            {chat.lastMessage.text}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end">
        {chat.lastMessage && (
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(chat.lastMessage.createdAt)}
          </span>
        )}
        {hasUnread && (
          <span className="mt-1 px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
```

### 6.2 MessageBubble Component

```tsx
// components/chat/MessageBubble.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import type { Message } from "@/types/chat";
import { formatMessageTime } from "@/lib/utils";
import { ImageViewerDialog } from "./ImageViewerDialog";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender?: boolean;
}

export function MessageBubble({ message, isOwn, showSender = false }: MessageBubbleProps) {
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  const hasMedia = !!message.mediaUrl;
  const hasText = !!message.text;

  return (
    <div className={`my-1 max-w-[80%] ${isOwn ? "ml-auto" : "mr-auto"}`}>
      {showSender && !isOwn && (
        <div className="flex items-center gap-1 mb-1">
          {message.senderPhoto && (
            <Image
              src={message.senderPhoto}
              alt={message.senderName}
              width={16}
              height={16}
              className="rounded-full"
            />
          )}
          <span className="text-xs text-muted-foreground font-medium">
            {message.senderName}
          </span>
        </div>
      )}

      <div
        className={`rounded-2xl overflow-hidden ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        } ${hasMedia ? "p-1" : "px-3.5 py-2.5"}`}
      >
        {/* Media Content */}
        {hasMedia && (
          <button onClick={() => setImageViewerOpen(true)} className="block">
            <Image
              src={message.mediaUrl!}
              alt="Shared image"
              width={200}
              height={150}
              className="rounded-xl object-cover"
            />
          </button>
        )}

        {/* Text Content */}
        {hasText && (
          <p className={`text-[15px] leading-5 ${hasMedia ? "mt-2 mx-2.5 mb-1.5" : ""}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Time and Status */}
      <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
        <span className="text-[11px] text-muted-foreground">
          {formatMessageTime(message.createdAt)}
        </span>
        {isOwn && (
          <span className="ml-1">
            {message.status === "sending" ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <Check className="w-3 h-3 text-muted-foreground" />
            )}
          </span>
        )}
      </div>

      {/* Image Viewer Dialog */}
      {hasMedia && (
        <ImageViewerDialog
          open={imageViewerOpen}
          onOpenChange={setImageViewerOpen}
          imageUrl={message.mediaUrl!}
        />
      )}
    </div>
  );
}
```

### 6.3 ChatInput Component

```tsx
// components/chat/ChatInput.tsx

"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ImageIcon, Send, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, mediaFile?: File) => Promise<void>;
  isSending?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isSending = false,
  placeholder = "Message...",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    const trimmedText = text.trim();
    if ((!trimmedText && !selectedImage) || isSending) return;

    try {
      await onSend(trimmedText, selectedImage || undefined);
      setText("");
      handleRemoveImage();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (text.trim().length > 0 || selectedImage) && !isSending;

  return (
    <div className="border-t bg-card">
      {/* Image Preview */}
      {imagePreview && (
        <div className="relative mx-3 mt-2 inline-block">
          <Image
            src={imagePreview}
            alt="Selected"
            width={80}
            height={80}
            className="rounded-lg object-cover"
          />
          <button
            onClick={handleRemoveImage}
            disabled={isSending}
            className="absolute -top-2 -right-2 p-0.5 rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-6 h-6" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSending}
            rows={1}
            className="w-full resize-none rounded-2xl bg-muted px-4 py-2.5 pr-12 text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-24"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="absolute right-2 bottom-1.5 p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 6.4 EmptyChat Component

```tsx
// components/chat/EmptyChat.tsx

import Link from "next/link";
import { MessageCircle } from "lucide-react";

interface EmptyChatProps {
  onNewChat?: () => void;
}

export function EmptyChat({ onNewChat }: EmptyChatProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">No messages yet</h2>
      <p className="text-muted-foreground text-center mb-6">
        Start a conversation or join an event chat
      </p>
      {onNewChat && (
        <button
          onClick={onNewChat}
          className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
        >
          Start a Chat
        </button>
      )}
    </div>
  );
}
```

---

## 7. Page Structure

```
app/
└── messages/
    ├── page.tsx           # Chat list (index)
    ├── new/
    │   └── page.tsx       # New DM screen (user search)
    └── [chatId]/
        └── page.tsx       # Chat room
```

### 7.1 Chat List Page (`/messages/page.tsx`)

```tsx
// app/messages/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ChatListItem, EmptyChat } from "@/components/chat";
import { useChatList } from "@/hooks/useChatList";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function MessagesPage() {
  const router = useRouter();
  const { chats, isLoading, error } = useChatList();

  const handleNewChat = () => {
    router.push("/messages/new");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-xl font-bold">Messages</h1>
        <button
          onClick={handleNewChat}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-destructive">Failed to load messages</p>
        </div>
      ) : chats.length === 0 ? (
        <EmptyChat onNewChat={handleNewChat} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <ChatListItem key={chat.chatId} chat={chat} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 7.2 Chat Room Page (`/messages/[chatId]/page.tsx`)

```tsx
// app/messages/[chatId]/page.tsx

"use client";

import { useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ChatInput, MessageBubble } from "@/components/chat";
import { useChat } from "@/hooks/useChat";
import { useChatList } from "@/hooks/useChatList";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ChatRoomPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { chats } = useChatList();
  const { messages, isLoading, isSending, sendMessage, loadMore, hasMore, isLoadingMore } =
    useChat(chatId);

  // Find current chat info
  const chatInfo = useMemo(() => {
    return chats.find((chat) => chat.chatId === chatId);
  }, [chats, chatId]);

  const isDm = chatInfo?.type === "dm";
  const headerTitle = isDm
    ? chatInfo?.peerName || "Chat"
    : chatInfo?.eventName || "Event Chat";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isLoadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoadingMore]);

  // Handle scroll for pagination (load more on scroll up)
  const handleScroll = () => {
    if (!messagesContainerRef.current || !hasMore || isLoadingMore) return;

    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop < 100) {
      loadMore();
    }
  };

  const handleSend = async (text: string, mediaFile?: File) => {
    await sendMessage(text, mediaFile);
  };

  const handleBack = () => {
    router.back();
  };

  const handleHeaderClick = () => {
    if (isDm && chatInfo?.peerId) {
      router.push(`/profile/${chatInfo.peerId}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <button onClick={handleBack} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleHeaderClick}
          disabled={!isDm}
          className={`flex-1 flex items-center gap-2 ${isDm ? "cursor-pointer" : "cursor-default"}`}
        >
          {isDm && chatInfo?.peerPhoto && (
            <Image
              src={chatInfo.peerPhoto}
              alt={headerTitle}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="font-bold text-lg">{headerTitle}</span>
          {isDm && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
      </header>

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4"
        >
          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-3">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === user?.uid}
              showSender={!isDm} // Show sender in group chats
            />
          ))}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} isSending={isSending} />
    </div>
  );
}
```

### 7.3 New DM Page (`/messages/new/page.tsx`)

```tsx
// app/messages/new/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatList, getExistingDmPeerIds } from "@/hooks/useChatList";
import { getOrCreateDmChat } from "@/services/chatService";
import { searchUsers } from "@/services/userSearchService"; // Implement this
import Image from "next/image";

export default function NewChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { chats } = useChatList();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const existingPeerIds = getExistingDmPeerIds(chats);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      // Filter out current user and existing DM contacts
      setSearchResults(
        results.filter(
          (u) => u.userId !== user?.uid && !existingPeerIds.has(u.userId)
        )
      );
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (peerId: string) => {
    if (!user?.uid || isCreating) return;

    setIsCreating(true);
    try {
      const chatId = await getOrCreateDmChat(user.uid, peerId);
      router.replace(`/messages/${chatId}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg">New Message</h1>
      </header>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="p-4 text-center text-muted-foreground">Searching...</div>
        ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
          <div className="p-4 text-center text-muted-foreground">No users found</div>
        ) : (
          searchResults.map((result) => (
            <button
              key={result.userId}
              onClick={() => handleSelectUser(result.userId)}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {result.photoURL ? (
                <Image
                  src={result.photoURL}
                  alt={result.displayName}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="font-semibold">
                    {result.displayName?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="text-left">
                <p className="font-medium">{result.displayName}</p>
                {result.username && (
                  <p className="text-sm text-muted-foreground">@{result.username}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## 8. Web-Specific Concerns

### 8.1 File Upload

| Mobile | Web |
|--------|-----|
| `expo-image-picker` returns URI | `<input type="file" accept="image/*">` returns `File` |
| `fetch(uri)` to get blob | File is already a blob |

```tsx
// Web file input pattern
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview: URL.createObjectURL(file)
      // Upload: pass file directly to uploadChatMedia()
    }
  }}
/>
```

### 8.2 Keyboard Handling

| Mobile | Web |
|--------|-----|
| `KeyboardAvoidingView` needed | CSS flexbox handles naturally |
| Manual offset calculations | Browser manages viewport |

No special handling needed on web. Use CSS flexbox with `flex-1` and `overflow-y-auto`.

### 8.3 Scrolling & Pagination

| Mobile | Web |
|--------|-----|
| `FlashList` with `onStartReached` | Native scroll with `onScroll` handler |
| Virtualization built-in | Consider `react-window` for 1000+ messages |

```tsx
// Web scroll handler for pagination
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const { scrollTop } = e.currentTarget;
  if (scrollTop < 100 && hasMore && !isLoadingMore) {
    loadMore();
  }
};
```

### 8.4 Auto-Scroll to Bottom

```tsx
// Scroll to newest message
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isLoadingMore) {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, [messages, isLoadingMore]);

// In render:
<div ref={messagesEndRef} />
```

### 8.5 Push Notifications (FCM for Web)

For web push notifications, you'll need:

1. **Service Worker** (`public/firebase-messaging-sw.js`):
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Your Firebase config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
  });
});
```

2. **Request Permission & Get Token**:
```typescript
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const messaging = getMessaging();

// Request permission
const permission = await Notification.requestPermission();
if (permission === "granted") {
  const token = await getToken(messaging, {
    vapidKey: "YOUR_VAPID_KEY",
  });
  // Save token to user document for Cloud Functions to use
}
```

---

## 9. Implementation Checklist

### Phase 1: Setup & Types
- [ ] Create `types/chat.ts` with all interfaces
- [ ] Set up Zustand store (`store/chatStore.ts`)
- [ ] Configure Firebase in Next.js

### Phase 2: Service Layer
- [ ] Implement `services/chatService.ts`
- [ ] Test `getDmChatId` deterministic ID generation
- [ ] Test `uploadChatMedia` with File objects
- [ ] Verify real-time subscriptions work

### Phase 3: Hooks
- [ ] Implement `hooks/useChat.ts`
- [ ] Implement `hooks/useChatList.ts`
- [ ] Test optimistic updates
- [ ] Test pagination (load more)

### Phase 4: Components
- [ ] `ChatListItem` component
- [ ] `MessageBubble` component
- [ ] `ChatInput` component with file upload
- [ ] `EmptyChat` component
- [ ] `ImageViewerDialog` component

### Phase 5: Pages
- [ ] `/messages` - Chat list page
- [ ] `/messages/[chatId]` - Chat room page
- [ ] `/messages/new` - New DM page
- [ ] Implement user search service

### Phase 6: Push Notifications
- [ ] Set up Firebase Cloud Messaging for web
- [ ] Create service worker
- [ ] Request notification permission
- [ ] Save FCM tokens to user document

### Phase 7: Integration & Polish
- [ ] Test cross-platform sync (mobile ↔ web)
- [ ] Verify unread counts sync correctly
- [ ] Add loading states and error handling
- [ ] Implement analytics events

---

## 10. Testing Checklist

### Cross-Platform Sync
- [ ] Message sent on mobile appears on web in real-time
- [ ] Message sent on web appears on mobile in real-time
- [ ] Unread counts update correctly on both platforms
- [ ] `markChatAsRead` clears unread on both platforms

### DM Functionality
- [ ] Deterministic chat ID is consistent: `dm_${[id1, id2].sort().join("_")}`
- [ ] Creating DM from web triggers Cloud Function to create summaries
- [ ] Existing DMs are found without creating duplicates
- [ ] Peer info (name, photo) displays correctly

### Event Chat Functionality
- [ ] Event chats appear in list after ticket purchase
- [ ] Event chat shows event name (not peer name)
- [ ] Sender names show in group messages (`showSender`)
- [ ] Archived chats show as inactive

### Media Upload
- [ ] File selection works via `<input type="file">`
- [ ] Image preview shows before sending
- [ ] Upload progress indicator works
- [ ] Uploaded image displays in message
- [ ] Full-screen image viewer works

### Edge Cases
- [ ] Empty chat list shows EmptyChat component
- [ ] Long message text wraps correctly
- [ ] Very long chat history pagination works
- [ ] Network errors handled gracefully
- [ ] Auth state changes handled (logout clears subscriptions)

---

## 11. Analytics Events

Match mobile event names exactly for consistent cross-platform analytics:

| Event | Properties | Trigger |
|-------|------------|---------|
| `chat_list_viewed` | — | Chat list page loaded |
| `chat_opened` | `chat_id`, `chat_type` | Chat room opened |
| `message_sent` | `chat_id`, `chat_type`, `has_media` | Message sent |
| `dm_started` | `peer_id` | New DM created |
| `dm_profile_viewed` | `peer_id`, `from_chat: true` | Tapped peer name to view profile |
| `chat_media_uploaded` | `chat_id`, `file_size` | Image uploaded |

```typescript
// Analytics implementation
import { usePostHog } from "@/analytics/PostHogProvider";

const { capture } = usePostHog();

capture("message_sent", {
  chat_id: chatId,
  chat_type: chatInfo?.type,
  has_media: !!mediaFile,
});
```

---

## Appendix: Source File References

| Mobile File | Purpose | Copy/Adapt |
|-------------|---------|------------|
| `src/types/chat.ts` | TypeScript interfaces | Copy exactly |
| `src/services/chatService.ts` | Service functions | Adapt file upload |
| `src/hooks/useChat.ts` | Chat room hook | Adapt for File type |
| `src/hooks/useChatList.ts` | Chat list hook | Adapt for Zustand |
| `src/components/chat/ChatListItem.tsx` | List item UI | Rewrite for web |
| `src/components/chat/MessageBubble.tsx` | Message UI | Rewrite for web |
| `src/components/chat/ChatInput.tsx` | Input UI | Rewrite for web (file input) |
| `src/components/chat/EmptyChat.tsx` | Empty state | Rewrite for web |
| `src/app/(app)/messages/index.tsx` | Chat list screen | Reference for page structure |
| `src/app/(app)/messages/[chatId].tsx` | Chat room screen | Reference for page structure |
| `functions/chat.js` | Cloud Functions | DO NOT MODIFY (reference only) |
| `firestore.rules` (lines 332-352) | Security rules | DO NOT MODIFY (reference only) |

---

*This specification was generated based on the RAGESTATE React Native mobile app implementation. For questions or clarifications, refer to the mobile codebase or contact the development team.*
