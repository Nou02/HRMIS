const express = require('express');

module.exports = (db) => {
  const router = express.Router();
  router.get('/db', async (_req, res) => {
    try {
      const conn = await db.getConnection();
      const [rows] = await conn.query('SELECT 1 AS ok');
      conn.release();
      res.json({
        ok: true,
        result: rows && rows[0] && rows[0].ok === 1 ? 1 : 0,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
      });
    } catch (e) {
      res.status(200).json({
        ok: false,
        error: e && e.message ? String(e.message) : 'unknown',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
      });
    }
  });
  return router;
};
