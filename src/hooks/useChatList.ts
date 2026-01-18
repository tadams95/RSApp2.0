import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectLocalId, setUnreadChatCount } from "../store/redux/userSlice";
import { subscribeToChatList } from "../services/chatService";
import type { ChatSummary } from "../types/chat";

interface UseChatListResult {
  chats: ChatSummary[];
  isLoading: boolean;
  error: Error | null;
  totalUnread: number;
  refetch: () => void;
}

/**
 * Hook for subscribing to real-time chat list updates
 * Automatically updates global unread count in Redux
 */
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

    const unsubscribe = subscribeToChatList(
      userId,
      (newChats) => {
        setChats(newChats);
        setIsLoading(false);
        setError(null);

        // Update global unread count in Redux
        const total = newChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
        dispatch(setUnreadChatCount(total));
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
  }, [userId, refreshKey, dispatch]);

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return { chats, isLoading, error, totalUnread, refetch };
}

/**
 * Helper function to filter and get recent DM contacts from chat list
 * @param chats - Array of chat summaries
 * @param limit - Maximum number of contacts to return (default 5)
 * @returns Array of DM chat summaries with valid peer info
 */
export function getRecentDmContacts(
  chats: ChatSummary[],
  limit: number = 5,
): ChatSummary[] {
  return chats
    .filter((chat) => chat.type === "dm" && chat.peerId && chat.peerName)
    .slice(0, limit);
}

/**
 * Helper function to get existing DM peer IDs from chat list
 * Useful for excluding users who already have DMs in suggested lists
 * @param chats - Array of chat summaries
 * @returns Set of peer user IDs
 */
export function getExistingDmPeerIds(chats: ChatSummary[]): Set<string> {
  return new Set(
    chats
      .filter((chat) => chat.type === "dm" && chat.peerId)
      .map((chat) => chat.peerId as string),
  );
}
