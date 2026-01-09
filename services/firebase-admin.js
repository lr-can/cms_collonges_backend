const admin = require('firebase-admin');

let serviceAccount;
let databaseURL = "https://cms-collonges-default-rtdb.europe-west1.firebasedatabase.app";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // ⭐ En production (Heroku) - utilise la variable d'environnement
  console.log('🔥 Using Firebase credentials from environment variable');
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // ⭐ En local - utilise le fichier config.js
  console.log('🔥 Using Firebase credentials from config.js');
  const config = require('../config');
  serviceAccount = {
    projectId: "cms-collonges",
    clientEmail: config.google.client_email,
    privateKey: config.google.private_key.replace(/\\n/g, '\n')
  };
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

const db = admin.database();

module.exports = { db };