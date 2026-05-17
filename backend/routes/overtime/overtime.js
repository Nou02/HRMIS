const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();

  async function ensureOvertimeTables() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS overtime_entries (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        date DATE NOT NULL,
        hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        description VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS overtime_settings (
        id INT PRIMARY KEY DEFAULT 1,
        hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      const [settings] = await db.query('SELECT COUNT(*) as cnt FROM overtime_settings');
      if (settings[0].cnt === 0) {
        await db.query('INSERT INTO overtime_settings (id, hourly_rate) VALUES (1, 0.00)');
      }
    } catch (err) {
      console.error('[Overtime] Error ensuring settings:', err);
    }

    try {
      const [indexes] = await db.query('SHOW INDEX FROM overtime_entries WHERE Key_name = "idx_emp_date"');
      if (indexes.length === 0) {
        await db.query('ALTER TABLE overtime_entries ADD INDEX idx_emp_date (employee_id, date)');
      }
    } catch (err) {
      console.error('[Overtime] Error adding index:', err);
    }
  }

  function getPayrollPeriod(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (day >= 1 && day <= 15) {
      return { period: `P1-${year}-${String(month).padStart(2, '0')}`, startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: `${year}-${String(month).padStart(2, '0')}-15` };
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      return { period: `P2-${year}-${String(month).padStart(2, '0')}`, startDate: `${year}-${String(month).padStart(2, '0')}-16`, endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}` };
    }
  }

  function parsePeriod(periodStr) {
    if (!periodStr) return null;
    const match = periodStr.match(/^P(\d)-(\d{4})-(\d{2})$/);
    if (!match) return null;
    const periodNum = parseInt(match[1]);
    const year = parseInt(match[2]);
    const month = parseInt(match[3]);
    if (periodNum === 1) {
      return { startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: `${year}-${String(month).padStart(2, '0')}-15` };
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      return { startDate: `${year}-${String(month).padStart(2, '0')}-16`, endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}` };
    }
  }

  router.get('/rate', async (req, res) => {
    try {
      await ensureOvertimeTables();
      const [rows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      res.json({ hourlyRate: rows[0]?.hourly_rate || 0 });
    } catch (e) {
      console.error('Overtime rate error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.put('/rate', async (req, res) => {
    const { hourlyRate } = req.body || {};
    if (typeof hourlyRate !== 'number' || hourlyRate < 0) {
      return res.status(400).json({ error: 'Invalid hourly rate' });
    }
    try {
      await ensureOvertimeTables();
      await db.query('UPDATE overtime_settings SET hourly_rate = ? WHERE id = 1', [hourlyRate]);
      res.json({ hourlyRate });
    } catch (e) {
      console.error('Overtime rate update error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.get('/', async (req, res) => {
    const { uid, period } = req.query;
    try {
      await ensureOvertimeTables();
      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const hourlyRate = rateRows[0]?.hourly_rate || 0;

      let query = `
        SELECT 
          oe.id,
          e.uid,
          e.name,
          e.avatar_url AS avatarUrl,
          oe.date,
          oe.hours,
          oe.description
        FROM overtime_entries oe
        JOIN employees e ON oe.employee_id = e.id
      `;
      const params = [];
      const whereClauses = [];

      if (uid) {
        whereClauses.push('e.uid = ?');
        params.push(uid);
      }

      if (period) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          whereClauses.push('oe.date >= ? AND oe.date <= ?');
          params.push(periodInfo.startDate, periodInfo.endDate);
        }
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
      query += ' ORDER BY oe.date DESC, oe.id DESC';

      const [rows] = await db.query(query, params);

      let totalHours = 0;
      if (uid && period) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          const [sumRows] = await db.query(
            'SELECT COALESCE(SUM(hours), 0) as total FROM overtime_entries oe JOIN employees e ON oe.employee_id = e.id WHERE e.uid = ? AND oe.date >= ? AND oe.date <= ?',
            [uid, periodInfo.startDate, periodInfo.endDate]
          );
          totalHours = parseFloat(sumRows[0]?.total || 0);
        }
      }

      const list = rows.map(r => ({
        id: r.id,
        uid: r.uid,
        name: r.name,
        avatarUrl: r.avatarUrl,
        date: r.date,
        hours: parseFloat(r.hours),
        description: r.description || '',
      }));

      res.json({
        entries: list,
        summary: uid && period ? {
          totalHours,
          hourlyRate,
          totalPay: totalHours * hourlyRate,
          period
        } : null
      });
    } catch (e) {
      console.error('Overtime entries error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.get('/summary', async (req, res) => {
    const { uid, period } = req.query;
    if (!uid || !period) {
      return res.status(400).json({ error: 'uid and period are required' });
    }
    try {
      await ensureOvertimeTables();
      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

      const periodInfo = parsePeriod(period);
      if (!periodInfo) {
        return res.status(400).json({ error: 'Invalid period format. Use P1-YYYY-MM or P2-YYYY-MM' });
      }

      const [sumRows] = await db.query(
        `SELECT COALESCE(SUM(hours), 0) as totalHours 
         FROM overtime_entries oe 
         JOIN employees e ON oe.employee_id = e.id 
         WHERE e.uid = ? AND oe.date >= ? AND oe.date <= ?`,
        [uid, periodInfo.startDate, periodInfo.endDate]
      );

      const totalHours = parseFloat(sumRows[0]?.totalHours || 0);
      const totalPay = totalHours * hourlyRate;

      res.json({
        uid,
        period,
        periodStart: periodInfo.startDate,
        periodEnd: periodInfo.endDate,
        totalHours,
        hourlyRate,
        totalPay
      });
    } catch (e) {
      console.error('Overtime summary error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.post('/', async (req, res) => {
    const { uid, date, hours, description } = req.body || {};
    if (!uid || !date || typeof hours !== 'number') {
      return res.status(400).json({ error: 'uid, date, and hours are required' });
    }
    if (hours < 0) {
      return res.status(400).json({ error: 'Hours cannot be negative' });
    }
    try {
      await ensureOvertimeTables();
      const [empRows] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (empRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const employeeId = empRows[0].id;

      const [result] = await db.query(
        'INSERT INTO overtime_entries (employee_id, date, hours, description) VALUES (?, ?, ?, ?)',
        [employeeId, date, hours, description || '']
      );

      const periodInfo = getPayrollPeriod(date);
      const [sumRows] = await db.query(
        `SELECT COALESCE(SUM(hours), 0) as totalHours 
         FROM overtime_entries oe 
         WHERE oe.employee_id = ? AND oe.date >= ? AND oe.date <= ?`,
        [employeeId, periodInfo.startDate, periodInfo.endDate]
      );
      const totalHours = parseFloat(sumRows[0]?.totalHours || 0);

      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

      res.status(201).json({
        id: result.insertId,
        uid,
        date,
        hours,
        description: description || '',
        period: periodInfo.period,
        periodTotalHours: totalHours,
        hourlyRate,
        periodTotalPay: totalHours * hourlyRate
      });
    } catch (e) {
      console.error('Overtime entry error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [entries] = await db.query('SELECT employee_id, date FROM overtime_entries WHERE id = ?', [id]);
      if (entries.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const entry = entries[0];

      await db.query('DELETE FROM overtime_entries WHERE id = ?', [id]);

      const periodInfo = getPayrollPeriod(entry.date);
      const [sumRows] = await db.query(
        `SELECT COALESCE(SUM(hours), 0) as totalHours 
         FROM overtime_entries oe 
         WHERE oe.employee_id = ? AND oe.date >= ? AND oe.date <= ?`,
        [entry.employee_id, periodInfo.startDate, periodInfo.endDate]
      );
      const totalHours = parseFloat(sumRows[0]?.totalHours || 0);

      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

      res.json({
        deleted: true,
        periodTotalHours: totalHours,
        hourlyRate,
        periodTotalPay: totalHours * hourlyRate
      });
    } catch (e) {
      console.error('Overtime delete error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};