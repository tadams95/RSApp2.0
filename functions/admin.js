'use strict';

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'ragestate-app',
    storageBucket: 'ragestate-app.appspot.com',
  });
}

const db = admin.firestore();

module.exports = { admin, db };
