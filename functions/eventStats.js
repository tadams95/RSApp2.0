/* eslint-disable */
"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { db, admin } = require("./admin");

/**
 * When a rager (ticket holder) document is created,
 * increment the user's eventsAttended count.
 */
exports.onRagerCreated = onDocumentCreated(
  "events/{eventId}/ragers/{ragerId}",
  async (event) => {
    const ragerData = event.data?.data();
    if (!ragerData) return null;

    const userId = ragerData.firebaseId;
    if (!userId) {
      logger.warn("Rager created without firebaseId", {
        eventId: event.params.eventId,
        ragerId: event.params.ragerId,
      });
      return null;
    }

    try {
      // Write to both customers (private) and profiles (public) so that
      // eventsAttended is readable when viewing other users' profiles
      const batch = db.batch();
      const statsUpdate = {
        stats: {
          eventsAttended: admin.firestore.FieldValue.increment(1),
        },
      };
      batch.set(db.collection("customers").doc(userId), statsUpdate, {
        merge: true,
      });
      batch.set(db.collection("profiles").doc(userId), statsUpdate, {
        merge: true,
      });
      await batch.commit();
      logger.info("Incremented eventsAttended", {
        userId,
        eventId: event.params.eventId,
      });
    } catch (err) {
      logger.error("Failed to increment eventsAttended", { userId, err });
    }
    return null;
  },
);
