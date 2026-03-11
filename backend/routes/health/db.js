const express = require('express');

module.exports = (db) => {
  const router = express.Router();
  router.get('/db', async (_req, res) => {
    try {
      const conn = await db.getConnection();
      const [rows] = await conn.query('SELECT 1 AS ok');
      const [accCount] = await conn.query('SELECT COUNT(*) as count FROM accounts');
      conn.release();
      res.json({
        ok: true,
        result: rows && rows[0] && rows[0].ok === 1 ? 1 : 0,
        accounts_count: accCount[0].count,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
      });
    } catch (e) {
      console.error('Health DB error:', e);
      res.status(200).json({
        ok: false,
        error: e && e.message ? String(e.message) : 'unknown',
        code: e && e.code ? String(e.code) : 'no_code',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
      });
    }
  });
  return router;
};
