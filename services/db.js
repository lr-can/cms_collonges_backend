const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 3),
  maxIdle: Number(process.env.DB_POOL_SIZE || 3),
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params ?? []);
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = {
  query
};