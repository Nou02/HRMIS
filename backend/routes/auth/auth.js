const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    try {
      // Be defensive: user might not have added the email column yet
      const [rows] = await db.query(
        'SELECT * FROM accounts WHERE username = ? OR email = ? LIMIT 1',
        [username, username]
      ).catch(async () => {
        // Fallback if email column is missing
        return db.query(
          'SELECT * FROM accounts WHERE username = ? LIMIT 1',
          [username]
        );
      });

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
        email: acc.email || null,
        role: acc.role || 'user',
      });
    } catch (e) {
      console.error('Auth error:', e);
      res.status(500).json({ error: 'auth_db_error', details: e.message });
    }
  });

  return router;
};

