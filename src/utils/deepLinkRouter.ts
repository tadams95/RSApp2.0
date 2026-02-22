import { router } from "expo-router";

export interface NotificationRouteData {
  type?: string;
  postId?: string;
  chatId?: string;
  actorId?: string;
  eventId?: string;
  transferId?: string;
  token?: string;
  [key: string]: string | undefined;
}

/**
 * Route from notification tap or deep link data.
 * Returns true if navigation was handled.
 */
export function routeFromNotificationData(
  data: NotificationRouteData,
): boolean {
  // Post-related (likes, comments, mentions, reposts)
  if (data.postId) {
    router.push(`/home/post/${data.postId}`);
    return true;
  }
  // Chat messages
  if (data.chatId) {
    router.push(`/messages/${data.chatId}`);
    return true;
  }
  // Ticket transfers
  if (data.transferId || data.token) {
    router.push({
      pathname: "/(app)/transfer/claim",
      params: {
        token: data.token || "",
        transferId: data.transferId || "",
      },
    });
    return true;
  }
  // Events
  if (data.eventId) {
    router.push(`/events/${data.eventId}`);
    return true;
  }
  // Profile (follower notifications)
  if (data.actorId) {
    router.push(`/home/profile/${data.actorId}`);
    return true;
  }
  // Cart
  if (data.type === "cart_abandonment") {
    router.push("/cart");
    return true;
  }
  return false;
}

/**
 * Route from a parsed deep link URL path.
 * Handles ragestate:// and https://ragestate.com paths.
 */
export function routeFromDeepLinkPath(
  path: string,
  queryParams?: Record<string, string | undefined>,
): boolean {
  // messages/{chatId}
  if (path.startsWith("messages/")) {
    const chatId = path.replace("messages/", "");
    if (chatId) {
      router.push(`/messages/${chatId}`);
      return true;
    }
  }
  // post/{postId}
  if (path.startsWith("post/")) {
    const postId = path.replace("post/", "");
    if (postId) {
      router.push(`/home/post/${postId}`);
      return true;
    }
  }
  // profile/{userId}
  if (path.startsWith("profile/")) {
    const userId = path.replace("profile/", "");
    if (userId) {
      router.push(`/home/profile/${userId}`);
      return true;
    }
  }
  // events/{eventId}
  if (path.startsWith("events/")) {
    const eventId = path.replace("events/", "");
    if (eventId) {
      router.push(`/events/${eventId}`);
      return true;
    }
  }
  // transfer/ and claim-ticket/ (existing logic preserved)
  if (
    path.startsWith("transfer") ||
    path.startsWith("claim-ticket") ||
    path.startsWith("claim")
  ) {
    const token = queryParams?.token || queryParams?.t;
    const transferId = queryParams?.id;
    if (token) {
      router.push({
        pathname: "/(app)/transfer/claim",
        params: { token, transferId: transferId || "" },
      });
      return true;
    }
  }
  return false;
}
