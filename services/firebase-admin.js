const admin = require('firebase-admin');
const config = require('../config');

const privateKey = config.google.private_key.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "cms-collonges",
    clientEmail: config.google.client_email,
    privateKey: privateKey,
  }),
  databaseURL: "https://cms-collonges-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

module.exports = { db };

