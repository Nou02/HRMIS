const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();
  const { timekeepingRecords } = state;

  async function ensureTimekeepingTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS timekeeping_records (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        date DATE,
        clock_in TIME,
        clock_out TIME,
        total_time_minutes INT DEFAULT 0,
        total_late_minutes INT DEFAULT 0,
        total_overtime_minutes INT DEFAULT 0,
        status VARCHAR(40),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }

  function diffMinutes(clockIn, clockOut) {
    try {
      if (!clockIn || !clockOut) return 0;
      const [inH, inM] = String(clockIn).split(':').map((v) => Number(v) || 0);
      const [outH, outM] = String(clockOut).split(':').map((v) => Number(v) || 0);
      return Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
    } catch (_e) {
      return 0;
    }
  }

  router.get('/summary', async (_req, res) => {
    try {
      await ensureTimekeepingTable();
      const [empRows] = await db.query('SELECT COUNT(*) AS totalEmployees FROM employees');
      const [tkRows] = await db.query('SELECT status FROM timekeeping_records');
      const totalEmployees = empRows[0]?.totalEmployees || 0;
      const totalAttendance = timekeepingRecords.length || totalEmployees;
      const totalLate = tkRows.filter((r) => r.status === 'Late').length;
      const totalAbsent = tkRows.filter((r) => r.status === 'Absent').length;
      const totalOvertimeMinutes = 0;
      const hours = Math.floor(totalOvertimeMinutes / 60);
      res.json({
        totalAttendance,
        totalLate,
        totalAbsent,
        totalOvertime: hours ? `${hours}h` : '—',
        calendar: '',
      });
    } catch (_e) {
      const totalAttendance = timekeepingRecords.length;
      const totalLate = timekeepingRecords.filter((r) => r.status === 'Late').length;
      const totalAbsent = timekeepingRecords.filter((r) => r.status === 'Absent').length;
      res.json({
        totalAttendance,
        totalLate,
        totalAbsent,
        totalOvertime: '—',
        calendar: '',
      });
    }
  });

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    const statusFilter = (req.query.status || '').toString();
    try {
      await ensureTimekeepingTable();
      const [emps] = await db.query('SELECT id, uid, name FROM employees');
      const rows = [];
      for (const e of emps) {
        // latest record per employee
        const [tkRows] = await db.query(
          'SELECT date, clock_in, clock_out, total_time_minutes, total_late_minutes, total_overtime_minutes, status FROM timekeeping_records WHERE employee_id = ? ORDER BY date DESC, id DESC LIMIT 1',
          [e.id]
        );
        const tk = tkRows[0] || null;
        const status = tk ? (tk.status || 'Absent') : 'Absent';
        const statusClass =
          status === 'Present'
            ? 'approved'
            : status === 'Late' || status === 'Travel' || status === 'HalfDay'
            ? 'review'
            : 'draft';
        const totalMinutes = tk ? (tk.total_time_minutes || 0) : 0;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        rows.push({
          uid: e.uid,
          name: e.name,
          clockIn: tk && tk.clock_in ? tk.clock_in.toString().slice(0, 5) : '-',
          clockOut: tk && tk.clock_out ? tk.clock_out.toString().slice(0, 5) : '-',
          totalTime: totalMinutes ? `${hours}h ${String(minutes).padStart(2, '0')}m` : '-',
          totalLate: tk && tk.total_late_minutes ? `${tk.total_late_minutes}m` : '-',
          totalOvertime: tk && tk.total_overtime_minutes ? `${tk.total_overtime_minutes}m` : '-',
          status,
          statusClass,
        });
      }
      let list = rows;
      if (statusFilter) {
        list = list.filter((r) => (r.status || '') === statusFilter);
      }
      if (q) {
        list = list.filter(
          (r) =>
            (r.uid || '').toLowerCase().includes(q) ||
            (r.name || '').toLowerCase().includes(q)
        );
      }
      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      res.json(list);
    } catch (_e) {
      // Fallback to in-memory records if DB query fails
      let list = timekeepingRecords.length ? timekeepingRecords.slice() : [];
      if (statusFilter) {
        list = list.filter((r) => (r.status || '') === statusFilter);
      }
      if (q) {
        list = list.filter(
          (r) =>
            (r.uid || '').toLowerCase().includes(q) ||
            (r.name || '').toLowerCase().includes(q)
        );
      }
      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      res.json(list);
    }
  });

  router.post('/', async (req, res) => {
    const { uid, name, clockIn = '', clockOut = '', status = 'Present', date = null } = req.body || {};
    if (!uid || !name) return res.status(400).json({ error: 'uid and name are required' });
    const totalTime = (clockIn && clockOut) ? '8h 00m' : '-';
    const rec = {
      uid,
      name,
      clockIn,
      clockOut,
      totalTime,
      totalLate: status === 'Late' ? '15m' : '0m',
      totalOvertime: '0m',
      status,
      statusClass:
        status === 'Present'
          ? 'approved'
          : status === 'Late'
          ? 'review'
          : status === 'Travel'
          ? 'review'
          : status === 'HalfDay'
          ? 'review'
          : 'draft',
    };
    timekeepingRecords.push(rec);
    try {
      await ensureTimekeepingTable();
      const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (ers.length) {
        const employeeId = ers[0].id;
        const totalMinutes = diffMinutes(clockIn, clockOut);
        const lateMinutes = status === 'Late' ? 15 : 0;
        const overtimeMinutes = 0;
        await db.query(
          `INSERT INTO timekeeping_records (employee_id,date,clock_in,clock_out,total_time_minutes,total_late_minutes,total_overtime_minutes,status)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            employeeId,
            date || null,
            clockIn || null,
            clockOut || null,
            totalMinutes,
            lateMinutes,
            overtimeMinutes,
            status,
          ]
        );
      }
    } catch (_e) {
      // ignore db errors, record still kept in memory
    }
    res.status(201).json(rec);
  });

  router.put('/:uid', (req, res) => {
    const { uid } = req.params;
    const idx = timekeepingRecords.findIndex((r) => r.uid === uid);
    const cur = idx !== -1
      ? timekeepingRecords[idx]
      : {
          uid,
          name: '',
          clockIn: '',
          clockOut: '',
          totalTime: '-',
          totalLate: '0m',
          totalOvertime: '0m',
          status: 'Absent',
          statusClass: 'draft',
        };
    const {
      uid: nextUid = cur.uid,
      name = cur.name,
      clockIn = cur.clockIn,
      clockOut = cur.clockOut,
      status = cur.status || 'Present',
    } = req.body || {};
    const totalTime = (clockIn && clockOut) ? '8h 00m' : cur.totalTime || '-';
    const totalLate =
      status === 'Late'
        ? '15m'
        : status === 'Present'
        ? '0m'
        : cur.totalLate || '0m';
    const totalOvertime = cur.totalOvertime || '0m';
    const statusClass =
      status === 'Present'
        ? 'approved'
        : status === 'Late'
        ? 'review'
        : status === 'Travel'
        ? 'review'
        : status === 'HalfDay'
        ? 'review'
        : 'draft';
    const rec = {
      uid: nextUid,
      name,
      clockIn,
      clockOut,
      totalTime,
      totalLate,
      totalOvertime,
      status,
      statusClass,
    };
    if (idx === -1) {
      timekeepingRecords.push(rec);
    } else {
      timekeepingRecords[idx] = rec;
    }
    (async () => {
      try {
        await ensureTimekeepingTable();
        const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
        if (ers.length) {
          const employeeId = ers[0].id;
          const totalMinutes = diffMinutes(clockIn, clockOut);
          const lateMinutes = status === 'Late' ? 15 : 0;
          const overtimeMinutes = 0;
          const [rows] = await db.query(
            `SELECT id FROM timekeeping_records WHERE employee_id = ? ORDER BY date DESC, id DESC LIMIT 1`,
            [employeeId]
          );
          if (rows.length) {
            await db.query(
              `UPDATE timekeeping_records
               SET clock_in = ?, clock_out = ?, total_time_minutes = ?, total_late_minutes = ?, total_overtime_minutes = ?, status = ?
               WHERE id = ?`,
               [
                 clockIn || null,
                 clockOut || null,
                 totalMinutes,
                 lateMinutes,
                 overtimeMinutes,
                 status,
                 rows[0].id,
               ]
            );
          } else {
            await db.query(
              `INSERT INTO timekeeping_records (employee_id,date,clock_in,clock_out,total_time_minutes,total_late_minutes,total_overtime_minutes,status)
               VALUES (?,?,?,?,?,?,?,?)`,
              [
                employeeId,
                null,
                clockIn || null,
                clockOut || null,
                totalMinutes,
                lateMinutes,
                overtimeMinutes,
                status,
              ]
            );
          }
        }
      } catch (_e) {
      }
      res.json(rec);
    })();
  });

  return router;
};
