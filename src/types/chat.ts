// Chat types - matches Firestore schema

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
