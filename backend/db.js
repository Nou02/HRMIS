const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'hrmis',
} = process.env;

let pool;
async function ensurePool() {
  if (pool) return pool;
  const bootstrap = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });
  const conn = await bootstrap.getConnection();
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  conn.release();
  await bootstrap.end();
  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

module.exports = {
  query: async (...args) => {
    const p = await ensurePool();
    return p.query(...args);
  },
  getConnection: async () => {
    const p = await ensurePool();
    return p.getConnection();
  },
};
