import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  selectLocalId,
  selectUserDisplayInfo,
} from "../store/redux/userSlice";
import {
  subscribeToMessages,
  sendMessage as sendMessageService,
  fetchOlderMessages,
  markChatAsRead,
  uploadChatMedia,
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
  sendMessage: (text: string, mediaUri?: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Hook for managing a single chat room with real-time messages and pagination
 */
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
      },
    );

    unsubscribeRef.current = unsubscribe;

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

  // Send message with optimistic update (supports text and/or media)
  const sendMessage = useCallback(
    async (text: string, mediaUri?: string) => {
      if (!userId || !chatId || (!text.trim() && !mediaUri)) return;

      setIsSending(true);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId,
        senderId: userId,
        senderName: userInfo.displayName,
        senderPhoto: null,
        text: text.trim() || null,
        mediaUrl: mediaUri, // Show local URI while uploading
        mediaType: mediaUri ? "image" : undefined,
        createdAt: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        // Upload media if provided
        let uploadedMediaUrl: string | undefined;
        if (mediaUri) {
          uploadedMediaUrl = await uploadChatMedia(chatId, mediaUri);
        }

        // Send message with uploaded media URL
        await sendMessageService(
          chatId,
          userId,
          userInfo.displayName,
          null,
          text.trim() || null,
          uploadedMediaUrl,
          uploadedMediaUrl ? "image" : undefined,
        );
        // Real-time listener will update with the actual message
      } catch (err) {
        // Remove optimistic message on error
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
