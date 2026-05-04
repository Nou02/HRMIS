const express = require('express');
const bcrypt = require('bcrypt');

module.exports = (db) => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    try {
      const [rows] = await db.query(
        'SELECT * FROM accounts WHERE username = ? OR email = ? LIMIT 1',
        [username, username]
      ).catch(async () => {
        return db.query(
          'SELECT * FROM accounts WHERE username = ? LIMIT 1',
          [username]
        );
      });

      if (!rows.length) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      
      const acc = rows[0];
      const storedHash = String(acc.password_hash || '');
      const isHashed = storedHash.startsWith('$2b$');

      console.log(`[Auth Login] User: ${username}, Stored is Hashed: ${isHashed}`);

      if (isHashed) {
        // Strictly use bcrypt comparison if the stored value is already a hash
        const passwordMatch = await bcrypt.compare(String(password), storedHash);
        console.log(`[Auth Login] Bcrypt match: ${passwordMatch}`);
        
        if (!passwordMatch) {
          return res.status(401).json({ error: 'invalid_credentials' });
        }
      } else {
        // Only use plain-text comparison if the stored value is NOT yet a hash
        const plainMatch = storedHash === String(password);
        console.log(`[Auth Login] Plain match: ${plainMatch}`);

        if (plainMatch) {
          console.log(`[Auth] Auto-migrating password for user: ${acc.username}`);
          const hashed = await bcrypt.hash(String(password), 10);
          await db.query('UPDATE accounts SET password_hash = ? WHERE id = ?', [hashed, acc.id]);
        } else {
          return res.status(401).json({ error: 'invalid_credentials' });
        }
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

