const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Initialize tables and seed data
  async function initSignatories() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS signatory_names (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS signatory_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role_name VARCHAR(255) NOT NULL UNIQUE,
          current_name_id INT,
          FOREIGN KEY (current_name_id) REFERENCES signatory_names(id) ON DELETE SET NULL
        )
      `);

      // Seed initial names if pool is empty
      const [names] = await db.query('SELECT COUNT(*) as count FROM signatory_names');
      if (names[0].count === 0) {
        const initialNames = [
          'Maria Graciela R. Bucad',
          'Rex D. Aguila',
          'Kenneth A. Benedicto',
          'Mary Ann O. Lacson',
          'April Rose H. Clemeno',
          'Hazel D. Pagao',
          'Dennis L. Yapbuan',
          'Carlo Paolo P. Murcia'
        ];
        for (const name of initialNames) {
          await db.query('INSERT INTO signatory_names (name) VALUES (?)', [name]);
        }
      }

      // Seed initial roles if empty
      const [roles] = await db.query('SELECT COUNT(*) as count FROM signatory_roles');
      if (roles[0].count === 0) {
        const initialRoles = [
          'Administrative Officer II',
          'Officer-in-Charge, Region IV-A',
          'OIC- Accountant',
          'Cashier II'
        ];
        for (const role of initialRoles) {
          await db.query('INSERT INTO signatory_roles (role_name) VALUES (?)', [role]);
        }
      }
    } catch (err) {
      console.error('[Signatories Init] Error:', err);
    }
  }

  initSignatories();

  // Get all data
  router.get('/', async (req, res) => {
    try {
      const [names] = await db.query('SELECT * FROM signatory_names ORDER BY name ASC');
      const [roles] = await db.query(`
        SELECT r.id, r.role_name, r.current_name_id, n.name as current_name
        FROM signatory_roles r
        LEFT JOIN signatory_names n ON r.current_name_id = n.id
        ORDER BY r.id ASC
      `);
      res.json({ names, roles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add name to pool
  router.post('/pool', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
      const [result] = await db.query('INSERT INTO signatory_names (name) VALUES (?)', [name]);
      res.json({ id: result.insertId, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete name from pool
  router.delete('/pool/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM signatory_names WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update role assignment
  router.put('/assignments', async (req, res) => {
    const { roleId, nameId } = req.body;
    try {
      await db.query('UPDATE signatory_roles SET current_name_id = ? WHERE id = ?', [nameId, roleId]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
