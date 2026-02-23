const admin = require('firebase-admin');

let db;

try {
  let serviceAccount;
  const databaseURL = "https://cms-collonges-default-rtdb.europe-west1.firebasedatabase.app";

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('🔥 Using Firebase credentials from environment variable');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    const config = require('../config');
    const pk = config.google && config.google.private_key;
    if (!pk) {
      throw new Error('Credentials manquantes: définir FIREBASE_SERVICE_ACCOUNT (Heroku) ou GG_private_key (local)');
    }
    console.log('🔥 Using Firebase credentials from config.js');
    serviceAccount = {
      projectId: 'cms-collonges',
      clientEmail: config.google.client_email,
      privateKey: String(pk).replace(/\\n/g, '\n')
    };
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
  db = admin.database();
} catch (err) {
  console.error('🔥 Firebase init failed:', err.message);
  db = new Proxy({}, {
    get() {
      throw new Error('Firebase non initialisé. Vérifier FIREBASE_SERVICE_ACCOUNT sur Heroku.');
    }
  });
}

module.exports = { db };