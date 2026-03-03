const express = require('express');

module.exports = (db) => {
  const router = express.Router();
  async function ensureApplicationsTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        type_of_leave VARCHAR(60) NOT NULL,
        leave_status VARCHAR(60),
        offset_hours INT DEFAULT 0,
        offset_status VARCHAR(60),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    try {
      await ensureApplicationsTable();
      const [rows] = await db.query(`
        SELECT
          a.id,
          e.uid,
          e.name,
          a.type_of_leave AS typeOfLeave,
          a.leave_status AS leaveStatus,
          a.offset_hours AS offsetHours,
          a.offset_status AS offsetStatus
        FROM applications a
        JOIN employees e ON a.employee_id = e.id
      `);
      let list = rows.map((r) => ({
        id: r.id,
        uid: r.uid,
        name: r.name,
        typeOfLeave: r.typeOfLeave || '',
        leaveStatus: r.leaveStatus || '',
        offsetHours: r.offsetHours || 0,
        offsetStatus: r.offsetStatus || '',
        offset: r.offsetHours ? `${r.offsetHours}h` : '',
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
    } catch (_e) {
      res.status(500).json({ error: 'db_error' });
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
    } = req.body || {};
    if (!uid || !name || !typeOfLeave) {
      return res.status(400).json({ error: 'uid, name, and typeOfLeave are required' });
    }
    const hours = Number(offsetHours || 0);
    if (hours && hours < 2) {
      return res.status(400).json({ error: 'offsetHours must be at least 2' });
    }
    try {
      await ensureApplicationsTable();
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
        `INSERT INTO applications (employee_id,type_of_leave,leave_status,offset_hours,offset_status)
         VALUES (?,?,?,?,?)`,
        [employeeId, typeOfLeave, leaveStatus || '', hours, offsetStatus || '']
      );
      const id = result.insertId;
      const appRec = {
        id,
        uid,
        name,
        typeOfLeave,
        leaveStatus: leaveStatus || '',
        offsetHours: hours,
        offsetStatus: offsetStatus || '',
        offset: hours ? `${hours}h` : '',
      };
      res.status(201).json(appRec);
    } catch (_e) {
      res.status(500).json({ error: 'db_error' });
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
    } = req.body || {};
    const hours = typeof offsetHours === 'undefined' ? null : Number(offsetHours || 0);
    if (hours !== null && hours && hours < 2) {
      return res.status(400).json({ error: 'offsetHours must be at least 2' });
    }
    try {
      await ensureApplicationsTable();
      const [curRows] = await db.query(
        `SELECT a.id,a.employee_id,e.uid,e.name,a.type_of_leave,a.leave_status,a.offset_hours,a.offset_status
         FROM applications a
         JOIN employees e ON a.employee_id = e.id
         WHERE a.id = ?`,
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
      let employeeId = cur.employee_id;
      if (uid && uid !== cur.uid) {
        const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [nextUid]);
        if (!ers.length) {
          return res.status(400).json({ error: 'Employee not found for uid' });
        }
        employeeId = ers[0].id;
      }
      await db.query(
        `UPDATE applications
         SET employee_id = ?, type_of_leave = ?, leave_status = ?, offset_hours = ?, offset_status = ?
         WHERE id = ?`,
        [employeeId, nextType, nextLeaveStatus || '', nextHours || 0, nextOffsetStatus || '', id]
      );
      const updated = {
        id: Number(id),
        uid: nextUid,
        name: nextName,
        typeOfLeave: nextType,
        leaveStatus: nextLeaveStatus || '',
        offsetHours: nextHours || 0,
        offsetStatus: nextOffsetStatus || '',
        offset: nextHours ? `${nextHours}h` : '',
      };
      res.json(updated);
    } catch (_e) {
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};
