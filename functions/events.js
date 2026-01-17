/* eslint-disable */
"use strict";

/**
 * Event-related Cloud Functions
 * - Updates attendingCount on event documents when ragers are added/removed
 * - Migration functions for Google user parity
 * - Backfill functions for existing data
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { admin, db } = require("./admin");

/**
 * Helper function to check if a user is an admin
 * Checks: custom auth claim, /adminUsers collection, /users collection, /customers collection
 */
async function checkIsAdmin(auth) {
  const uid = auth.uid;

  // 1. Check custom auth claim (fastest)
  if (auth.token?.admin === true) {
    logger.info(`Admin check: ${uid} has admin custom claim`);
    return true;
  }

  // 2. Check /adminUsers collection
  const adminUserDoc = await db.doc(`adminUsers/${uid}`).get();
  if (adminUserDoc.exists) {
    logger.info(`Admin check: ${uid} found in /adminUsers`);
    return true;
  }

  // 3. Check /users collection
  const userDoc = await db.doc(`users/${uid}`).get();
  if (userDoc.exists && userDoc.data()?.isAdmin === true) {
    logger.info(`Admin check: ${uid} has isAdmin=true in /users`);
    return true;
  }

  // 4. Check /customers collection
  const customerDoc = await db.doc(`customers/${uid}`).get();
  if (customerDoc.exists && customerDoc.data()?.isAdmin === true) {
    logger.info(`Admin check: ${uid} has isAdmin=true in /customers`);
    return true;
  }

  logger.warn(`Admin check failed for ${uid}`);
  return false;
}

/**
 * Trigger: Updates attendingCount on parent event when ragers subcollection changes
 *
 * This solves the Firestore security rules issue where users can't read all rager
 * documents to count them (rules restrict reading to document owner only).
 *
 * By storing the count on the event document itself (which is publicly readable),
 * we can display the attending count without permission errors.
 *
 * Path: events/{eventId}/ragers/{ragerId}
 */
exports.updateAttendingCount = onDocumentWritten(
  "events/{eventId}/ragers/{ragerId}",
  async (event) => {
    const eventId = event.params.eventId;

    try {
      const eventRef = db.doc(`events/${eventId}`);

      // Use the count() aggregation query for efficiency (doesn't read all docs)
      const ragersSnapshot = await eventRef.collection("ragers").count().get();
      const attendingCount = ragersSnapshot.data().count;

      // Update the parent event document with the new count
      await eventRef.update({
        attendingCount: attendingCount,
        attendingCountUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Updated attendingCount for event ${eventId}: ${attendingCount}`,
      );

      return { success: true, eventId, attendingCount };
    } catch (error) {
      logger.error(
        `Failed to update attendingCount for event ${eventId}:`,
        error,
      );
      // Don't throw - we don't want to fail the original rager write
      return { success: false, eventId, error: error.message };
    }
  },
);

/**
 * Callable function to backfill attendingCount for all events
 * Run once after deploying updateAttendingCount trigger
 *
 * Usage: Call from Firebase Console or via client
 */
exports.backfillAttendingCounts = onCall(async (request) => {
  // Require admin authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  // Check if user is admin (check custom claim, /users, and /customers)
  const isAdminUser = await checkIsAdmin(request.auth);
  if (!isAdminUser) {
    throw new HttpsError("permission-denied", "Must be an admin");
  }

  logger.info("Starting backfill of attending counts...");

  try {
    const eventsSnapshot = await db.collection("events").get();
    const results = { success: 0, failed: 0, events: [] };

    for (const eventDoc of eventsSnapshot.docs) {
      try {
        const ragersSnapshot = await eventDoc.ref
          .collection("ragers")
          .count()
          .get();
        const attendingCount = ragersSnapshot.data().count;

        await eventDoc.ref.update({
          attendingCount: attendingCount,
          attendingCountUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.success++;
        results.events.push({ id: eventDoc.id, attendingCount });
        logger.info(`Backfilled ${eventDoc.id}: ${attendingCount} ragers`);
      } catch (err) {
        results.failed++;
        logger.error(`Failed to backfill ${eventDoc.id}:`, err);
      }
    }

    logger.info(
      `Backfill complete: ${results.success} success, ${results.failed} failed`,
    );
    return results;
  } catch (error) {
    logger.error("Backfill failed:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Callable function to migrate existing Google users
 * Adds missing fields and creates /customers and /profiles documents
 *
 * Usage: Call from Firebase Console or via client (admin only)
 */
exports.migrateGoogleUsers = onCall(async (request) => {
  // Require admin authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be authenticated");
  }

  // Check if user is admin (check custom claim, /users, and /customers)
  const isAdminUser = await checkIsAdmin(request.auth);
  if (!isAdminUser) {
    throw new HttpsError("permission-denied", "Must be an admin");
  }

  logger.info("Starting migration of Google users...");

  try {
    // Query all users with provider == "google"
    const usersSnapshot = await db
      .collection("users")
      .where("provider", "==", "google")
      .get();

    const results = {
      total: usersSnapshot.size,
      updated: 0,
      customersCreated: 0,
      profilesCreated: 0,
      stripeCreated: 0,
      failed: 0,
      users: [],
    };

    for (const userDocSnapshot of usersSnapshot.docs) {
      const userId = userDocSnapshot.id;
      const data = userDocSnapshot.data();

      try {
        // 1. Add missing fields to /users document
        const updates = {};

        if (data.isAdmin === undefined) updates.isAdmin = false;
        if (!data.userId) updates.userId = userId;
        if (!data.qrCode) updates.qrCode = userId;
        if (!data.displayName) {
          updates.displayName =
            `${data.firstName || ""} ${data.lastName || ""}`.trim() || "User";
        }
        if (!data.profilePicture) updates.profilePicture = data.photoURL || "";
        if (!data.phoneNumber) updates.phoneNumber = "";
        if (!data.stripeCustomerId) updates.stripeCustomerId = "";
        if (data.migratedFromRTDB === undefined)
          updates.migratedFromRTDB = false;
        if (data.isPublic === undefined) updates.isPublic = true;
        if (!data.verificationStatus) updates.verificationStatus = "none";
        if (!data.expoPushToken) updates.expoPushToken = "";
        if (!data.stats) {
          updates.stats = {
            eventsAttended: 0,
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
          };
        }

        if (Object.keys(updates).length > 0) {
          await userDocSnapshot.ref.update(updates);
          results.updated++;
          logger.info(
            `Updated user ${userId} with ${Object.keys(updates).length} fields`,
          );
        }

        // Merge data for subsequent operations
        const mergedData = { ...data, ...updates };

        // 2. Copy to /customers if missing
        const customerDoc = await db.doc(`customers/${userId}`).get();
        if (!customerDoc.exists) {
          await db.doc(`customers/${userId}`).set({
            ...mergedData,
            migrationDate: new Date().toISOString(),
          });
          results.customersCreated++;
          logger.info(`Created /customers/${userId}`);
        }

        // 3. Create /profiles if missing
        const profileDoc = await db.doc(`profiles/${userId}`).get();
        if (!profileDoc.exists) {
          await db.doc(`profiles/${userId}`).set({
            displayName:
              mergedData.displayName ||
              `${mergedData.firstName || ""} ${mergedData.lastName || ""}`.trim(),
            photoURL: mergedData.photoURL || "",
            profilePicture:
              mergedData.profilePicture || mergedData.photoURL || "",
            bio: mergedData.bio || "",
            usernameLower: mergedData.usernameLower || null,
            profileSongUrl: mergedData.profileSongUrl || null,
          });
          results.profilesCreated++;
          logger.info(`Created /profiles/${userId}`);
        }

        results.users.push({
          id: userId,
          email: data.email,
          fieldsUpdated: Object.keys(updates).length,
          customerCreated: !customerDoc.exists,
          profileCreated: !profileDoc.exists,
        });
      } catch (err) {
        results.failed++;
        logger.error(`Failed to migrate user ${userId}:`, err);
      }
    }

    logger.info(
      `Migration complete: ${results.updated} updated, ${results.customersCreated} customers created, ${results.profilesCreated} profiles created, ${results.failed} failed`,
    );
    return results;
  } catch (error) {
    logger.error("Migration failed:", error);
    throw new HttpsError("internal", error.message);
  }
});
