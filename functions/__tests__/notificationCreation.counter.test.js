/**
 * Scaffold test (skipped) for creation trigger -> unreadNotifications counter increment.
 * Assumes onPostLikeCreateNotify trigger writes a notification and increments counter transactionally.
 * Enable by removing .skip once Firestore emulator is running.
 */
/* eslint-disable no-undef */
const functionsTest = require('firebase-functions-test')();
const admin = require('firebase-admin');
require('..'); // ensure triggers are registered

describe.skip('notification creation trigger increments unreadNotifications', () => {
  const uid = 'owner_counter_test';
  const likeId = 'like_counter_test_1';
  const userRef = admin.firestore().collection('users').doc(uid);

  beforeAll(async () => {
    await userRef.set({ unreadNotifications: 0 }, { merge: true });
  });

  afterAll(async () => {
    await functionsTest.cleanup();
  });

  test('post like -> +1 unread', async () => {
    // Simulate like doc creation that trigger listens to.
    await admin.firestore().collection('postLikes').doc(likeId).set({
      postId: 'post123',
      userId: 'likerUser',
      postOwnerId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Small delay to allow trigger to run (tunable; emulator usually fast)
    await new Promise((r) => setTimeout(r, 1500));

    const snap = await userRef.get();
    const unread = snap.data().unreadNotifications || 0;
    expect(unread).toBeGreaterThanOrEqual(1);
  });
});
