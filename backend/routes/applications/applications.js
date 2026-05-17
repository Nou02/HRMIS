const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  function getPayrollPeriod(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (day >= 1 && day <= 15) {
      return {
        period: `P1-${year}-${String(month).padStart(2, '0')}`,
        startDate: `${year}-${String(month).padStart(2, '0')}-01`,
        endDate: `${year}-${String(month).padStart(2, '0')}-15`
      };
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      return {
        period: `P2-${year}-${String(month).padStart(2, '0')}`,
        startDate: `${year}-${String(month).padStart(2, '0')}-16`,
        endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`
      };
    }
  }

  async function ensureTimeOffRequestsTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS time_off_requests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        uid VARCHAR(50),
        name VARCHAR(120),
        type_of_leave VARCHAR(60) NOT NULL,
        leave_status VARCHAR(60),
        offset_hours INT DEFAULT 0,
        offset_status VARCHAR(60),
        request_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add request_date if it doesn't exist
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM time_off_requests LIKE "request_date"');
      if (cols.length === 0) {
        await db.query('ALTER TABLE time_off_requests ADD COLUMN request_date DATE AFTER offset_status');
      }
    } catch (err) {
      console.error('Error adding request_date column:', err);
    }
  }

  router.get('/available-offset/:uid', async (req, res) => {
    const { uid } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const periodInfo = getPayrollPeriod(today);

    try {
      await ensureTimeOffRequestsTable();
      const [empRows] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (empRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const employeeId = empRows[0].id;

      // 1. Get daily manual overtime entries
      const [otRows] = await db.query(
        `SELECT date, hours 
         FROM overtime_entries 
         WHERE employee_id = ? AND date >= ? AND date <= ?`,
        [employeeId, periodInfo.startDate, periodInfo.endDate]
      );

      // 2. Get daily timekeeping overtime records
      const [tkRows] = await db.query(
        `SELECT date, total_overtime_minutes 
         FROM timekeeping_records 
         WHERE employee_id = ? AND date >= ? AND date <= ?`,
        [employeeId, periodInfo.startDate, periodInfo.endDate]
      );

      // Group by date to apply the 4/8 hour rule
      const dailyOT = {};
      otRows.forEach(row => {
        const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
        dailyOT[d] = (dailyOT[d] || 0) + parseFloat(row.hours || 0);
      });
      tkRows.forEach(row => {
        const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
        dailyOT[d] = (dailyOT[d] || 0) + (parseFloat(row.total_overtime_minutes || 0) / 60);
      });

      // Apply the rule: ONLY 4 or 8 hours count per day
      let totalOTAvailability = 0;
      Object.values(dailyOT).forEach(hours => {
        if (hours >= 8) {
          totalOTAvailability += 8;
        } else if (hours >= 4) {
          totalOTAvailability += 4;
        }
      });

      const totalOTHours = totalOTAvailability;

      // 3. Get total used offset hours (approved only)
      const [usedRows] = await db.query(
        `SELECT COALESCE(SUM(offset_hours), 0) as usedHours 
         FROM time_off_requests 
         WHERE employee_id = ? AND offset_status = 'Approved' AND request_date >= ? AND request_date <= ?`,
        [employeeId, periodInfo.startDate, periodInfo.endDate]
      );

      const usedHours = parseFloat(usedRows[0].usedHours || 0);
      const availableHours = Math.max(0, totalOTHours - usedHours);

      res.json({
        uid,
        period: periodInfo.period,
        startDate: periodInfo.startDate,
        endDate: periodInfo.endDate,
        totalOTHours, // This now reflects the 4/8 availability rule
        usedHours,
        availableHours
      });
    } catch (err) {
      console.error('GET /available-offset error:', err);
      res.status(500).json({ error: 'db_error', details: err.message });
    }
  });

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    try {
      await ensureTimeOffRequestsTable();
      const [rows] = await db.query(`
        SELECT
          a.id,
          a.uid,
          a.name,
          a.type_of_leave AS typeOfLeave,
          a.leave_status AS leaveStatus,
          a.offset_hours AS offsetHours,
          a.offset_status AS offsetStatus,
          DATE_FORMAT(a.request_date, '%Y-%m-%d') AS requestDate
        FROM time_off_requests a
      `);
      let list = rows.map((r) => ({
        id: r.id,
        uid: r.uid || '',
        name: r.name || '',
        typeOfLeave: r.typeOfLeave || '',
        leaveStatus: r.leaveStatus || '',
        offsetHours: r.offsetHours || 0,
        offsetStatus: r.offsetStatus || '',
        offset: r.offsetHours ? `${r.offsetHours}h` : '',
        requestDate: r.requestDate || '',
      }));
      if (q) {
        list = list.filter(
          (a) =>
            (a.uid || '').toLowerCase().includes(q) ||
            (a.name || '').toLowerCase().includes(q) ||
            (a.typeOfLeave || '').toLowerCase().includes(q) ||
            (a.leaveStatus || '').toLowerCase().includes(q)
        );
      }
      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      if (sort === 'type_asc') {
        list.sort((a, b) => (a.typeOfLeave || '').localeCompare(b.typeOfLeave || ''));
      }
      res.json(list);
    } catch (err) {
      console.error('GET /api/applications error:', err);
      res.status(500).json({ error: 'db_error', details: err.message });
    }
  });

  router.post('/', async (req, res) => {
    const {
      uid,
      name,
      typeOfLeave,
      leaveStatus,
      offsetHours = 0,
      offsetStatus,
      requestDate,
    } = req.body || {};

    console.log('POST /api/applications body:', req.body);

    if (!uid || !name || !typeOfLeave) {
      return res.status(400).json({ error: 'uid, name, and typeOfLeave are required' });
    }

    const hours = Number(offsetHours || 0);
    if (hours !== 0 && hours !== 4 && hours !== 8) {
      return res.status(400).json({ error: 'Off-set hours must be exactly 4 or 8' });
    }

    try {
      await ensureTimeOffRequestsTable();
      let employeeId;
      const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (ers.length) {
        employeeId = ers[0].id;
      } else {
        const [empResult] = await db.query(
          `INSERT INTO employees (uid,name,department_project,employment_category,certifications,avatar_url,pds_available,id_view_available,pds_file_path,id_file_path)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [uid, name, '', '', '', '', 0, 0, null, null]
        );
        employeeId = empResult.insertId;
      }
      const [result] = await db.query(
        `INSERT INTO time_off_requests (employee_id,uid,name,type_of_leave,leave_status,offset_hours,offset_status,request_date)
         VALUES (?,?,?,?,?,?,?,?)`,
        [employeeId, uid, name, typeOfLeave, leaveStatus || 'Pending', hours, offsetStatus || 'Pending', requestDate || null]
      );
      const id = result.insertId;

      // Fetch the newly created record with formatted date to ensure consistency
      const [newRows] = await db.query(`
        SELECT
          id, uid, name, type_of_leave AS typeOfLeave, leave_status AS leaveStatus,
          offset_hours AS offsetHours, offset_status AS offsetStatus,
          DATE_FORMAT(request_date, '%Y-%m-%d') AS requestDate
        FROM time_off_requests
        WHERE id = ?
      `, [id]);

      const appRec = {
        ...newRows[0],
        offset: newRows[0].offsetHours ? `${newRows[0].offsetHours}h` : '',
      };
      res.status(201).json(appRec);
    } catch (err) {
      console.error('POST /api/applications error:', err);
      res.status(500).json({ error: 'db_error', details: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
      uid,
      name,
      typeOfLeave,
      leaveStatus,
      offsetHours,
      offsetStatus,
      requestDate,
    } = req.body || {};

    console.log('PUT /api/applications body:', req.body);

    const hours = typeof offsetHours === 'undefined' ? null : Number(offsetHours || 0);
    if (hours !== null && hours !== 0 && hours !== 4 && hours !== 8) {
      return res.status(400).json({ error: 'Off-set hours must be exactly 4 or 8' });
    }

    try {
      await ensureTimeOffRequestsTable();
      const [curRows] = await db.query(
        `SELECT id,employee_id,uid,name,type_of_leave,leave_status,offset_hours,offset_status,request_date
         FROM time_off_requests
         WHERE id = ?`,
        [id]
      );
      if (!curRows.length) return res.status(404).json({ error: 'Not found' });
      const cur = curRows[0];
      const nextUid = uid || cur.uid;
      const nextName = name || cur.name;
      const nextType = typeOfLeave || cur.type_of_leave;
      const nextLeaveStatus = typeof leaveStatus === 'undefined' ? cur.leave_status : leaveStatus;
      const nextHours = hours === null ? cur.offset_hours : hours;
      const nextOffsetStatus =
        typeof offsetStatus === 'undefined' ? cur.offset_status : offsetStatus;
      const nextRequestDate = typeof requestDate === 'undefined' ? cur.request_date : requestDate;

      let employeeId = cur.employee_id;
      if (uid && uid !== cur.uid) {
        const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [nextUid]);
        if (!ers.length) {
          return res.status(400).json({ error: 'Employee not found for uid' });
        }
        employeeId = ers[0].id;
      }
      await db.query(
        `UPDATE time_off_requests
         SET employee_id = ?, uid = ?, name = ?, type_of_leave = ?, leave_status = ?, offset_hours = ?, offset_status = ?, request_date = ?
         WHERE id = ?`,
        [employeeId, nextUid, nextName, nextType, nextLeaveStatus || '', nextHours || 0, nextOffsetStatus || '', nextRequestDate || null, id]
      );

      // Fetch the updated record with formatted date
      const [updatedRows] = await db.query(`
        SELECT
          id, uid, name, type_of_leave AS typeOfLeave, leave_status AS leaveStatus,
          offset_hours AS offsetHours, offset_status AS offsetStatus,
          DATE_FORMAT(request_date, '%Y-%m-%d') AS requestDate
        FROM time_off_requests
        WHERE id = ?
      `, [id]);

      const updated = {
        ...updatedRows[0],
        offset: updatedRows[0].offsetHours ? `${updatedRows[0].offsetHours}h` : '',
      };
      res.json(updated);
    } catch (err) {
      console.error('PUT /api/applications/:id error:', err);
      res.status(500).json({ error: 'db_error', details: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await ensureTimeOffRequestsTable();
      await db.query('DELETE FROM time_off_requests WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/applications/:id error:', err);
      res.status(500).json({ error: 'db_error', details: err.message });
    }
  });

  return router;
};
