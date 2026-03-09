const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    try {
      const [rows] = await db.query(
        'SELECT id, username, password_hash, role FROM accounts WHERE username = ? LIMIT 1',
        [username]
      );
      if (!rows.length) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const acc = rows[0];
      if (String(acc.password_hash || '') !== String(password)) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      res.json({
        id: acc.id,
        username: acc.username,
        role: acc.role || 'user',
      });
    } catch (_e) {
      res.status(500).json({ error: 'auth_db_error' });
    }
  });

  return router;
};

