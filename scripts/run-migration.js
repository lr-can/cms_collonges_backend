#!/usr/bin/env node
/**
 * Exécute un fichier SQL de migration.
 * Usage: node scripts/run-migration.js migrations/kits_use_stock_commun.sql
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: process.env.DB_NAME,
  port: 3307,
  multipleStatements: true
};

async function runMigration(filePath) {
  let sql = fs.readFileSync(path.resolve(filePath), 'utf8');
  sql = sql.replace(/^\s*--.*$/gm, ''); // supprimer les lignes de commentaire
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const conn = await mysql.createConnection(config);
  console.log('Connexion DB OK');

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    const preview = stmt.slice(0, 80).replace(/\n/g, ' ');
    try {
      await conn.query(stmt);
      console.log(`[OK] ${preview}...`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_COLUMN' || err.errno === 1060) {
        console.log(`[SKIP] Colonne déjà présente: ${preview}...`);
      } else {
        console.error(`[ERR] ${preview}...`);
        console.error(err.message);
        throw err;
      }
    }
  }

  await conn.end();
  console.log('Migration terminée.');
}

const file = process.argv[2] || 'migrations/schema_kits_v2.sql';
runMigration(file).catch(err => {
  console.error(err);
  process.exit(1);
});
