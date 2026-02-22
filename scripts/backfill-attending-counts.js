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
const fs = require("fs");
const path = require("path");
const os = require("os");

// Set up credentials before initializing the Admin SDK.
// If GOOGLE_APPLICATION_CREDENTIALS is not set, try the Firebase CLI's stored refresh token.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const configPath = path.join(
      os.homedir(),
      ".config/configstore/firebase-tools.json",
    );
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.tokens && config.tokens.refresh_token) {
      const adcJson = JSON.stringify({
        type: "authorized_user",
        client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
        refresh_token: config.tokens.refresh_token,
      });
      const tmpFile = path.join(os.tmpdir(), "firebase-adc-tmp.json");
      fs.writeFileSync(tmpFile, adcJson, { mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;
      console.log("Using Firebase CLI refresh token for auth");
    }
  } catch (_) {}
}

let app;
try {
  app = initializeApp({
    credential: applicationDefault(),
    projectId: "ragestate-app",
  });
} catch (e) {
  app = initializeApp({ projectId: "ragestate-app" });
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
        // Read all rager docs and sum ticketQuantity (fallback to 1 for legacy docs missing the field)
        const ragersSnapshot = await eventDoc.ref.collection("ragers").get();
        let attendingCount = 0;
        ragersSnapshot.forEach((doc) => {
          attendingCount += doc.data().ticketQuantity || 1;
        });

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
