#!/usr/bin/env node
/**
 * Script to backfill attendingCount for all events
 *
 * This script directly connects to Firestore using Firebase Admin SDK
 * and updates the attendingCount field on all event documents.
 *
 * Usage:
 *   cd /Users/tyrelle/Desktop/RS-APP-2.0/rs-app/ragestate
 *   node scripts/backfill-attending-counts.js
 *
 * Prerequisites:
 *   - Firebase CLI must be logged in (firebase login)
 *   - You must have admin access to the Firestore database
 */

const {
  initializeApp,
  cert,
  applicationDefault,
} = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Try to use application default credentials, fall back to project-only init
let app;
try {
  app = initializeApp({
    credential: applicationDefault(),
    projectId: "ragestate-app",
  });
} catch (e) {
  // Fall back to just project ID (works with emulators or when running via firebase CLI)
  app = initializeApp({
    projectId: "ragestate-app",
  });
}

const db = getFirestore(app);

async function backfillAttendingCounts() {
  console.log("Starting backfill of attending counts...\n");

  try {
    // Get all events
    const eventsSnapshot = await db.collection("events").get();
    console.log(`Found ${eventsSnapshot.size} events\n`);

    const results = { success: 0, failed: 0, events: [] };

    for (const eventDoc of eventsSnapshot.docs) {
      try {
        // Count ragers in subcollection
        const ragersSnapshot = await eventDoc.ref
          .collection("ragers")
          .count()
          .get();
        const attendingCount = ragersSnapshot.data().count;

        // Update the event document
        await eventDoc.ref.update({
          attendingCount: attendingCount,
          attendingCountUpdatedAt: FieldValue.serverTimestamp(),
        });

        results.success++;
        results.events.push({ id: eventDoc.id, attendingCount });
        console.log(`✅ ${eventDoc.id}: ${attendingCount} ragers`);
      } catch (err) {
        results.failed++;
        console.error(`❌ ${eventDoc.id}: ${err.message}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`Backfill complete!`);
    console.log(`  Success: ${results.success}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`========================================\n`);

    return results;
  } catch (error) {
    console.error("Backfill failed:", error);
    throw error;
  }
}

// Run the backfill
backfillAttendingCounts()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
