const mysql = require('mysql2/promise');
const config = require('../config');

async function query(sql, params) {
  const connection = await mysql.createConnection(config.db);
  try {
    const [results, ] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = {
  query
}