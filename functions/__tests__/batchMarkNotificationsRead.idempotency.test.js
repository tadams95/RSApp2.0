/**
 * Idempotency scaffold test for batchMarkNotificationsRead callable.
 * NOTE: This is a scaffold only. It is skipped by default because running it meaningfully
 * requires Firestore emulator or production-like credentials. Fill in FIREBASE_CONFIG and
 * service account env (or initialize firebase-functions-test with emulator opts) before enabling.
 */

/* eslint-disable no-undef */
const functionsTest = require('firebase-functions-test')();

// Import the functions index AFTER initializing test context
const functions = require('..');

// Helpers to fabricate auth context & seed docs using admin SDK directly.
const admin = require('firebase-admin');

// Skip by default to avoid accidental CI failures without emulator.
// To enable: change `describe.skip` to `describe` and run with emulator:
//   firebase emulators:start --only firestore,functions
// Then in another terminal run:  npm --prefix functions test (add a script if needed)

describe.skip('batchMarkNotificationsRead idempotency', () => {
  const uid = 'testUser_idempo';
  const userRef = admin.firestore().collection('users').doc(uid);
  let callable;

  beforeAll(async () => {
    // Seed a user doc and two unread notifications
    await userRef.set({ unreadNotifications: 0 }, { merge: true });
    const notifCol = userRef.collection('notifications');
    const notifA = notifCol.doc();
    const notifB = notifCol.doc();
    await admin.firestore().runTransaction(async (tx) => {
      tx.set(notifA, {
        type: 'test_type',
        title: 'Test A',
        body: 'Body A',
        data: {},
        link: '/',
        deepLink: 'ragestate://home',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        seenAt: null,
        read: false,
        sendPush: false,
        pushSentAt: null,
        pushStatus: 'pending',
      });
      tx.set(notifB, {
        type: 'test_type',
        title: 'Test B',
        body: 'Body B',
        data: {},
        link: '/',
        deepLink: 'ragestate://home',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        seenAt: null,
        read: false,
        sendPush: false,
        pushSentAt: null,
        pushStatus: 'pending',
      });
      tx.update(userRef, { unreadNotifications: 2 });
    });

    callable = functions.batchMarkNotificationsRead; // onCall wrapped function
  });

  afterAll(async () => {
    await functionsTest.cleanup();
  });

  test('second invocation produces 0 updates and counter unchanged', async () => {
    // First call: mark both as read
    const first = await callable.run({
      auth: { uid },
      data: { markAll: true, max: 10 },
    });
    expect(first.updated).toBeGreaterThanOrEqual(1);

    // Read counter after first call (should decrement from 2 to 0)
    const snapAfterFirst = await userRef.get();
    const unreadAfterFirst = snapAfterFirst.data().unreadNotifications;

    // Second call: nothing to update
    const second = await callable.run({
      auth: { uid },
      data: { markAll: true, max: 10 },
    });
    expect(second.updated).toBe(0);

    const snapAfterSecond = await userRef.get();
    const unreadAfterSecond = snapAfterSecond.data().unreadNotifications;

    expect(unreadAfterSecond).toEqual(unreadAfterFirst); // unchanged
    expect(unreadAfterSecond).toBe(0);
  });
});
