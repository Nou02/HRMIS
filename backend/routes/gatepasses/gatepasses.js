const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  // Helper to ensure table exists (though we already updated database.sql)
  const ensureGatepassesTable = async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS gatepasses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        uid VARCHAR(50),
        name VARCHAR(120),
        official_type VARCHAR(100),
        official_purpose TEXT,
        personal_type VARCHAR(100),
        personal_purpose TEXT,
        date DATE,
        est_start_time TIME,
        est_end_time TIME,
        act_start_time TIME,
        act_end_time TIME,
        venue VARCHAR(255),
        approved_by VARCHAR(120),
        status VARCHAR(40),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_gate_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);
  };

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();

    try {
      await ensureGatepassesTable();
      const [rows] = await db.query(`
        SELECT 
          id, uid, name, 
          official_type AS officialType, 
          official_purpose AS officialPurpose,
          personal_type AS personalType,
          personal_purpose AS personalPurpose,
          DATE_FORMAT(date, '%Y-%m-%d') AS date,
          est_start_time AS estStartTime,
          est_end_time AS estEndTime,
          act_start_time AS actStartTime,
          act_end_time AS actEndTime,
          venue,
          approved_by AS approvedBy,
          status
        FROM gatepasses
      `);

      let list = rows;

      if (q) {
        list = list.filter(
          (g) =>
            (g.uid || '').toLowerCase().includes(q) ||
            (g.name || '').toLowerCase().includes(q) ||
            (g.venue || '').toLowerCase().includes(q) ||
            (g.status || '').toLowerCase().includes(q)
        );
      }

      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sort === 'name_desc') {
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      } else {
        // Default: Sort by date and start time descending
        list.sort((a, b) => {
          const dateA = new Date(`${a.date || ''}T${a.estStartTime || '00:00'}`);
          const dateB = new Date(`${b.date || ''}T${b.estStartTime || '00:00'}`);
          return dateB - dateA;
        });
      }

      res.json(list);
    } catch (err) {
      console.error('GET /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.post('/', async (req, res) => {
    const { 
      uid, name, officialType, officialPurpose, personalType, personalPurpose,
      date, estStartTime, estEndTime, actStartTime, actEndTime, venue, approvedBy,
      status = 'Pending' 
    } = req.body || {};

    if (!uid) return res.status(400).json({ error: 'uid is required' });

    try {
      await ensureGatepassesTable();
      
      // Get employee_id from uid
      const [empRows] = await db.query('SELECT id, name FROM employees WHERE uid = ?', [uid]);
      if (empRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const employeeId = empRows[0].id;
      const employeeName = empRows[0].name;

      const [result] = await db.query(`
        INSERT INTO gatepasses (
          employee_id, uid, name, official_type, official_purpose, 
          personal_type, personal_purpose, date, est_start_time, 
          est_end_time, act_start_time, act_end_time, venue, approved_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employeeId, uid, employeeName, 
        officialType || null, officialPurpose || null,
        personalType || null, personalPurpose || null, 
        date || null, estStartTime || null,
        estEndTime || null, actStartTime || null, 
        actEndTime || null, venue || null, 
        approvedBy || null, status || 'Pending'
      ]);

      res.status(201).json({ id: result.insertId, ...req.body, name: employeeName });
    } catch (err) {
      console.error('POST /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      officialType, officialPurpose, personalType, personalPurpose,
      date, estStartTime, estEndTime, actStartTime, actEndTime, venue, approvedBy,
      status 
    } = req.body || {};

    try {
      await ensureGatepassesTable();

      // Check if exists
      const [existing] = await db.query('SELECT id FROM gatepasses WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

      await db.query(`
        UPDATE gatepasses SET 
          official_type = COALESCE(?, official_type),
          official_purpose = COALESCE(?, official_purpose),
          personal_type = COALESCE(?, personal_type),
          personal_purpose = COALESCE(?, personal_purpose),
          date = COALESCE(?, date),
          est_start_time = COALESCE(?, est_start_time),
          est_end_time = COALESCE(?, est_end_time),
          act_start_time = COALESCE(?, act_start_time),
          act_end_time = COALESCE(?, act_end_time),
          venue = COALESCE(?, venue),
          approved_by = COALESCE(?, approved_by),
          status = COALESCE(?, status)
        WHERE id = ?
      `, [
        officialType, officialPurpose, personalType, personalPurpose,
        date, estStartTime, estEndTime, actStartTime, actEndTime,
        venue, approvedBy, status, id
      ]);

      res.json({ id, ...req.body });
    } catch (err) {
      console.error('PUT /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await ensureGatepassesTable();
      await db.query('DELETE FROM gatepasses WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};
