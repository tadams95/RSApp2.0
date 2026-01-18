/* eslint-disable */
"use strict";

/**
 * Chat Cloud Functions
 * - Message processing (update lastMessage, unreadCount, push notifications)
 * - Event chat lifecycle (create, auto-join on ticket purchase, archive)
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { admin, db } = require("./admin");

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
      profile.photoURL ||
      profile.profilePicture ||
      customer.profilePicture ||
      null,
    expoPushToken: customer.expoPushToken || null,
  };
}

// ============================================
// HELPER: Send Expo push notification
// ============================================

async function sendExpoPush(token, title, body, data) {
  if (!token) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
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

    if (!response.ok) {
      logger.warn("Expo push failed", { status: response.status, token });
    }
  } catch (err) {
    logger.error("Push notification failed", { err: err.message, token });
  }
}

// ============================================
// MESSAGE CREATED - Update metadata & notify
// ============================================

exports.onChatMessageCreated = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const { chatId, messageId } = event.params;
    const message = event.data?.data();

    if (!message) {
      logger.error("No message data", { chatId, messageId });
      return null;
    }

    const { senderId, senderName, text, createdAt, mediaUrl, mediaType } = message;

    try {
      // Get chat document
      const chatDoc = await db.doc(`chats/${chatId}`).get();

      if (!chatDoc.exists) {
        logger.error("Chat not found", { chatId });
        return null;
      }

      const chat = chatDoc.data();
      const recipients = chat.members.filter((id) => id !== senderId);

      // Determine message preview text
      const hasMedia = !!mediaUrl;
      const hasText = !!text;
      let previewText;
      if (hasMedia && hasText) {
        previewText = `📷 ${text}`;
      } else if (hasMedia) {
        previewText = "📷 Sent an image";
      } else {
        previewText = text || "";
      }

      // Prepare lastMessage update
      const lastMessage = {
        text: previewText,
        senderId,
        senderName,
        createdAt,
        type: mediaType || "text",
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
          const summaryRef = db.doc(
            `users/${memberId}/chatSummaries/${chatId}`,
          );
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
      // Use previewText for notification body
      const notificationBody = hasMedia && !hasText
        ? "Sent you an image"
        : (text || "Sent you a message");

      await Promise.all(
        recipientInfos
          .filter((r) => r.expoPushToken)
          .map((recipient) =>
            sendExpoPush(
              recipient.expoPushToken,
              senderName || "New message",
              notificationBody,
              { type: "chat_message", chatId, senderId },
            ),
          ),
      );

      logger.info("Message processed", { chatId, messageId });
    } catch (err) {
      logger.error("onChatMessageCreated failed", {
        err: err.message,
        chatId,
        messageId,
      });
    }

    return null;
  },
);

// ============================================
// DM CHAT: Create summaries on chat creation
// ============================================

exports.onDmChatCreated = onDocumentCreated("chats/{chatId}", async (event) => {
  const { chatId } = event.params;
  const chat = event.data?.data();

  // Only process DM chats
  if (!chat || chat.type !== "dm") {
    return null;
  }

  const { members } = chat;

  if (!members || members.length !== 2) {
    logger.error("Invalid DM chat members", { chatId, members });
    return null;
  }

  try {
    // Get user info for both parties
    const [user1Info, user2Info] = await Promise.all([
      getUserDisplayInfo(members[0]),
      getUserDisplayInfo(members[1]),
    ]);

    const batch = db.batch();

    // Create chat summary for user 1 (showing user 2 as peer)
    batch.set(db.doc(`users/${members[0]}/chatSummaries/${chatId}`), {
      chatId,
      type: "dm",
      peerId: members[1],
      peerName: user2Info.displayName,
      peerPhoto: user2Info.photoURL,
      lastMessage: null,
      unreadCount: 0,
      muted: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create chat summary for user 2 (showing user 1 as peer)
    batch.set(db.doc(`users/${members[1]}/chatSummaries/${chatId}`), {
      chatId,
      type: "dm",
      peerId: members[0],
      peerName: user1Info.displayName,
      peerPhoto: user1Info.photoURL,
      lastMessage: null,
      unreadCount: 0,
      muted: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    logger.info("DM chat summaries created", { chatId, members });
  } catch (err) {
    logger.error("onDmChatCreated failed", { err: err.message, chatId });
  }

  return null;
});

// ============================================
// EVENT CHAT: Create on event creation
// ============================================

exports.onEventCreatedCreateChat = onDocumentCreated(
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
      logger.error("onEventCreatedCreateChat failed", {
        err: err.message,
        eventId,
      });
    }

    return null;
  },
);

// ============================================
// EVENT CHAT: Auto-join on ticket purchase
// ============================================

exports.onTicketPurchasedJoinChat = onDocumentCreated(
  "customers/{userId}/tickets/{ticketId}",
  async (event) => {
    const { userId, ticketId } = event.params;
    const ticket = event.data?.data();
    const eventId = ticket?.eventId;

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
        senderPhoto: null,
        text: `${userInfo.displayName} joined the chat!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [],
      });

      logger.info("User joined event chat", { userId, chatId });
    } catch (err) {
      logger.error("onTicketPurchasedJoinChat failed", {
        err: err.message,
        userId,
        ticketId,
      });
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
    // Archive chats for events that ended more than 24 hours ago
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
          senderPhoto: null,
          text: "This event chat has been archived. Thanks for the memories!",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          readBy: [],
        });
      }

      await batch.commit();
      logger.info("Archived event chats", { count: chatsSnapshot.size });
    } catch (err) {
      logger.error("archiveExpiredEventChats failed", { err: err.message });
    }
  },
);
