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

    // Ensure 'date' column exists (it might if user added it manually)
    try {
      const [cols] = await db.query('SHOW COLUMNS FROM timekeeping_records LIKE "date"');
      if (cols.length === 0) {
        console.log('[Timekeeping] Adding date column');
        await db.query('ALTER TABLE timekeeping_records ADD COLUMN date DATE AFTER employee_id');
      }
    } catch (err) {
      console.error('[Timekeeping] Error adding date column:', err);
    }

    // Migrate existing data to 'date' column if NULL
    try {
      console.log('[Timekeeping] Migrating data to date column');
      // If we have records where date is null, try to fill it from created_at
      await db.query('UPDATE timekeeping_records SET date = DATE(created_at) WHERE date IS NULL');
    } catch (err) {
      console.error('[Timekeeping] Error migrating date data:', err);
    }

    // Clean up old virtual column and constraint if they exist
    try {
      const [indexes] = await db.query('SHOW INDEX FROM timekeeping_records WHERE Key_name = "unique_emp_date_ref"');
      if (indexes.length > 0) {
        console.log('[Timekeeping] Dropping old unique_emp_date_ref constraint');
        await db.query('ALTER TABLE timekeeping_records DROP INDEX unique_emp_date_ref');
      }
      
      const [cols] = await db.query('SHOW COLUMNS FROM timekeeping_records LIKE "date_ref"');
      if (cols.length > 0) {
        console.log('[Timekeeping] Dropping old date_ref virtual column');
        await db.query('ALTER TABLE timekeeping_records DROP COLUMN date_ref');
      }
    } catch (err) {
      console.error('[Timekeeping] Error cleaning up old schema:', err);
    }

    // Add unique constraint on (employee_id, date)
    try {
      const [indexes] = await db.query('SHOW INDEX FROM timekeeping_records WHERE Key_name = "unique_emp_date"');
      if (indexes.length === 0) {
        console.log('[Timekeeping] Adding unique constraint unique_emp_date');
        
        // Remove duplicates based on (employee_id, date) before adding constraint
        await db.query(`
          DELETE t1 FROM timekeeping_records t1
          INNER JOIN timekeeping_records t2 
          WHERE t1.id < t2.id 
          AND t1.employee_id = t2.employee_id 
          AND t1.date = t2.date
        `);
        
        await db.query('ALTER TABLE timekeeping_records ADD UNIQUE KEY unique_emp_date (employee_id, date)');
      }
    } catch (err) {
      console.error('[Timekeeping] Error ensuring unique_emp_date constraint:', err);
    }
  }

  function getLocalDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  function formatHM(minutes) {
    const total = Number(minutes) || 0;
    if (!total) return '-';
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  }

  router.get('/summary', async (req, res) => {
    try {
      await ensureTimekeepingTable();
      const date = req.query.date || getLocalDate();
      const [empRows] = await db.query('SELECT COUNT(*) AS totalEmployees FROM employees');
      const [tkRows] = await db.query('SELECT status, total_overtime_minutes, total_late_minutes FROM timekeeping_records WHERE date = ?', [date]);
      const totalEmployees = empRows[0]?.totalEmployees || 0;
      const totalAttendance = tkRows.filter(r => r.status !== 'Absent').length;
      const totalLateMinutes = tkRows.reduce(
        (sum, r) => sum + (Number(r.total_late_minutes) || 0),
        0
      );
      const totalAbsent = totalEmployees - totalAttendance;
      const totalOvertimeMinutes = tkRows.reduce(
        (sum, r) => sum + (Number(r.total_overtime_minutes) || 0),
        0
      );
      const overtimeHours = Math.floor(totalOvertimeMinutes / 60);
      const overtimeMins = totalOvertimeMinutes % 60;
      
      res.json({
        totalAttendance,
        totalLate: formatHM(totalLateMinutes),
        totalAbsent,
        totalOvertime: totalOvertimeMinutes ? formatHM(totalOvertimeMinutes) : '—',
        totalTime: formatHM(tkRows.reduce((sum, r) => sum + (Number(r.total_time_minutes) || 0), 0)),
        calendar: date,
      });
    } catch (_e) {
      const date = req.query.date || getLocalDate();
      const tkRows = timekeepingRecords.filter(r => r.date === date);
      const totalAttendance = tkRows.filter(r => r.status !== 'Absent').length;
      
      const totalLateMinutes = tkRows.reduce((sum, r) => {
        const lateMatch = (r.totalLate || '').match(/(\d+)m/);
        return sum + (lateMatch ? parseInt(lateMatch[1], 10) : 0);
      }, 0);

      const totalTimeMinutes = tkRows.reduce((sum, r) => {
        const timeMatch = (r.totalTime || '').match(/(\d+)h\s+(\d+)m/);
        if (timeMatch) return sum + parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        return sum;
      }, 0);

      const totalOvertimeMinutes = tkRows.reduce((sum, r) => {
        const otMatch = (r.totalOvertime || '').match(/(\d+)h\s+(\d+)m/);
        if (otMatch) return sum + parseInt(otMatch[1], 10) * 60 + parseInt(otMatch[2], 10);
        return sum;
      }, 0);

      res.json({
        totalAttendance,
        totalLate: formatHM(totalLateMinutes),
        totalAbsent: 0, // Fallback can't know total employees easily
        totalOvertime: totalOvertimeMinutes ? formatHM(totalOvertimeMinutes) : '—',
        totalTime: formatHM(totalTimeMinutes),
        calendar: date,
      });
    }
  });

  router.get('/', async (req, res) => {
    try {
      await ensureTimekeepingTable();
      
      // 1. Extract and sanitize parameters
      const range = (req.query.range || 'daily').toLowerCase().trim();
      const date = req.query.date || getLocalDate();
      const month = req.query.month; // '01' to '12'
      const year = req.query.year;
      const q = (req.query.q || '').toString().toLowerCase();
      const statusFilter = (req.query.status || '').toString();
      const sort = (req.query.sort || '').toString();

      console.log(`[Timekeeping] Fetching range: ${range}, date: ${date}, month: ${month}, year: ${year}`);

      let query = '';
      let params = [];

      // 2. Select query based on range
      if (range === 'monthly' && month && year) {
        // Monthly View: Show actual logs for the selected month/year
        const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
        query = `
          SELECT e.uid, e.name, e.avatar_url, tk.clock_in, tk.clock_out, 
                 tk.total_time_minutes, tk.total_late_minutes, tk.total_overtime_minutes, 
                 tk.status, tk.date as record_date
          FROM timekeeping_records tk
          INNER JOIN employees e ON tk.employee_id = e.id
          WHERE tk.date BETWEEN ? AND LAST_DAY(?)
          ORDER BY tk.date ASC, e.name ASC
        `;
        params = [startOfMonth, startOfMonth];
      } 
      else if (range === 'yearly' && year) {
        // Yearly View: Show actual logs for the selected year
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;
        query = `
          SELECT e.uid, e.name, e.avatar_url, tk.clock_in, tk.clock_out, 
                 tk.total_time_minutes, tk.total_late_minutes, tk.total_overtime_minutes, 
                 tk.status, tk.date as record_date
          FROM timekeeping_records tk
          INNER JOIN employees e ON tk.employee_id = e.id
          WHERE tk.date BETWEEN ? AND ?
          ORDER BY tk.date ASC, e.name ASC
        `;
        params = [startOfYear, endOfYear];
      } 
      else if (range === 'weekly') {
        // Weekly View: Show actual logs for the past 7 days from the selected date
        query = `
          SELECT e.uid, e.name, e.avatar_url, tk.clock_in, tk.clock_out, 
                 tk.total_time_minutes, tk.total_late_minutes, tk.total_overtime_minutes, 
                 tk.status, tk.date as record_date
          FROM timekeeping_records tk
          INNER JOIN employees e ON tk.employee_id = e.id
          WHERE tk.date BETWEEN DATE_SUB(?, INTERVAL 7 DAY) AND ?
          ORDER BY tk.date ASC, e.name ASC
        `;
        params = [date, date];
      } 
      else {
        // Daily View (Default): Show EVERY employee, joined with their log for that day if it exists
        query = `
          SELECT e.uid, e.name, e.avatar_url, tk.clock_in, tk.clock_out, 
                 tk.total_time_minutes, tk.total_late_minutes, tk.total_overtime_minutes, 
                 tk.status, tk.date as record_date
          FROM employees e
          LEFT JOIN timekeeping_records tk ON e.id = tk.employee_id AND tk.date = ?
          ORDER BY e.name ASC
        `;
        params = [date];
      }

      const [rows] = await db.query(query, params);
      
      // 3. Map database results to frontend format
      const results = rows.map(r => {
        const hasLog = r.record_date !== null;
        let formattedDate = '';
        
        if (hasLog) {
          // Force date to YYYY-MM-DD string without timezone interference
          const d = new Date(r.record_date);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          formattedDate = `${y}-${m}-${day}`;
        } else {
          // If no log (absent in daily view), use the requested date
          formattedDate = date;
        }

        const formatTime = (t) => t ? String(t).slice(0, 5) : '-';

        return {
          uid: r.uid,
          name: r.name,
          avatarUrl: r.avatar_url,
          clockIn: hasLog ? formatTime(r.clock_in) : '-',
          clockOut: hasLog ? formatTime(r.clock_out) : '-',
          totalTime: hasLog ? formatHM(r.total_time_minutes) : '-',
          totalLate: hasLog && r.total_late_minutes ? `${r.total_late_minutes}m` : '-',
          totalOvertime: hasLog ? formatHM(r.total_overtime_minutes) : '-',
          status: hasLog ? (r.status || 'Present') : 'Absent',
          date: formattedDate
        };
      });

      // 4. Apply client-side filters (Search and Status)
      let filtered = results;
      if (q) {
        filtered = filtered.filter(r => 
          (r.uid || '').toLowerCase().includes(q) || 
          (r.name || '').toLowerCase().includes(q)
        );
      }
      if (statusFilter && statusFilter !== 'All') {
        filtered = filtered.filter(r => r.status === statusFilter);
      }
      if (sort === 'name_asc') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      res.json(filtered);

    } catch (err) {
      console.error('[Timekeeping] API Error:', err);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    
    }
  });

  router.post('/', async (req, res) => {
    const { uid, name, clockIn = '', clockOut = '', status = 'Present', date = null } = req.body || {};
    if (!uid || !name) return res.status(400).json({ error: 'uid and name are required' });
    
    // Ensure we use the date from the request or the current date
    const targetDate = date || getLocalDate();
    console.log(`[Timekeeping] POST / - Saving record for ${uid} on ${targetDate}`);
    
    const totalMinutes = diffMinutes(clockIn, clockOut);
    // Overtime calculation starts after 6 PM (18:00)
    let overtimeMinutes = 0;
    if (clockOut) {
      const [outH, outM] = clockOut.split(':').map(Number);
      if (outH > 18 || (outH === 18 && outM > 0)) {
        overtimeMinutes = (outH - 18) * 60 + outM;
      }
    }
    
    // Late calculation starts after 8:30 AM (08:30)
    const lateMinutes = clockIn ? Math.max(0, diffMinutes('08:30', clockIn)) : 0;

    const rec = {
      uid,
      name,
      clockIn,
      clockOut,
      totalTime: formatHM(totalMinutes),
      totalLate: lateMinutes ? `${lateMinutes}m` : '-',
      totalOvertime: formatHM(overtimeMinutes),
      status,
      date: targetDate,
      statusClass:
        status === 'Present'
          ? 'approved'
          : status === 'Late' || status === 'Travel' || status === 'HalfDay'
          ? 'review'
          : 'draft',
    };

    // Update in-memory fallback
    const idx = timekeepingRecords.findIndex((r) => r.uid === uid && r.date === targetDate);
    if (idx === -1) {
      timekeepingRecords.push(rec);
    } else {
      timekeepingRecords[idx] = rec;
    }

    try {
      await ensureTimekeepingTable();
      const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (ers.length) {
        const employeeId = ers[0].id;
        await db.query(
          `INSERT INTO timekeeping_records (employee_id,date,clock_in,clock_out,total_time_minutes,total_late_minutes,total_overtime_minutes,status)
           VALUES (?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE 
             clock_in = VALUES(clock_in),
             clock_out = VALUES(clock_out),
             total_time_minutes = VALUES(total_time_minutes),
             total_late_minutes = VALUES(total_late_minutes),
             total_overtime_minutes = VALUES(total_overtime_minutes),
             status = VALUES(status)`,
          [
            employeeId,
            targetDate,
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
    const { date = null, name, clockIn, clockOut, status = 'Present' } = req.body || {};
    const targetDate = date || getLocalDate();
    console.log(`[Timekeeping] PUT /${uid} - Updating record for ${targetDate}`);

    const idx = timekeepingRecords.findIndex((r) => r.uid === uid && r.date === targetDate);
    
    const totalMinutes = diffMinutes(clockIn, clockOut);
    let overtimeMinutes = 0;
    if (clockOut) {
      const [outH, outM] = clockOut.split(':').map(Number);
      if (outH > 18 || (outH === 18 && outM > 0)) {
        overtimeMinutes = (outH - 18) * 60 + outM;
      }
    }
    const lateMinutes = clockIn ? Math.max(0, diffMinutes('08:30', clockIn)) : 0;

    const rec = {
      uid,
      name: name || (idx !== -1 ? timekeepingRecords[idx].name : ''),
      clockIn,
      clockOut,
      totalTime: formatHM(totalMinutes),
      totalLate: lateMinutes ? `${lateMinutes}m` : '-',
      totalOvertime: formatHM(overtimeMinutes),
      status,
      date: targetDate,
      statusClass:
        status === 'Present'
          ? 'approved'
          : status === 'Late' || status === 'Travel' || status === 'HalfDay'
          ? 'review'
          : 'draft',
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
          await db.query(
            `INSERT INTO timekeeping_records (employee_id,date,clock_in,clock_out,total_time_minutes,total_late_minutes,total_overtime_minutes,status)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE 
               clock_in = VALUES(clock_in),
               clock_out = VALUES(clock_out),
               total_time_minutes = VALUES(total_time_minutes),
               total_late_minutes = VALUES(total_late_minutes),
               total_overtime_minutes = VALUES(total_overtime_minutes),
               status = VALUES(status)`,
            [
              employeeId,
              targetDate,
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
        console.error('Error updating record in DB:', _e);
      }
      res.json(rec);
    })();
  });

  router.delete('/:uid', async (req, res) => {
    const { uid } = req.params;
    const date = req.query.date || getLocalDate();

    // Remove from in-memory fallback
    const idx = timekeepingRecords.findIndex((r) => r.uid === uid && r.date === date);
    if (idx !== -1) {
      timekeepingRecords.splice(idx, 1);
    }

    try {
      await ensureTimekeepingTable();
      const [ers] = await db.query('SELECT id FROM employees WHERE uid = ?', [uid]);
      if (ers.length) {
        const employeeId = ers[0].id;
        await db.query(
          'DELETE FROM timekeeping_records WHERE employee_id = ? AND date = ?',
          [employeeId, date]
        );
      }
      res.json({ success: true });
    } catch (_e) {
      res.status(500).json({ error: 'Failed to delete record' });
    }
  });

  return router;
};
