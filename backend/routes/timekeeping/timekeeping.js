const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();
  const { timekeepingRecords } = state;

  router.get('/summary', (_req, res) => {
    const totalAttendance = timekeepingRecords.length || employees.length;
    const totalLate = timekeepingRecords.filter((r) => r.status === 'Late').length;
    const totalAbsent = timekeepingRecords.filter((r) => r.status === 'Absent').length;
    const totalOvertimeMinutes = timekeepingRecords.reduce((sum, r) => {
      const val = String(r.totalOvertime || '').trim();
      if (!val) return sum;
      if (val.endsWith('m')) return sum + Number(val.slice(0, -1)) || 0;
      if (val.endsWith('h')) return sum + (Number(val.slice(0, -1)) || 0) * 60;
      return sum;
    }, 0);
    const hours = Math.floor(totalOvertimeMinutes / 60);
    res.json({
      totalAttendance,
      totalLate,
      totalAbsent,
      totalOvertime: hours ? `${hours}h` : '—',
      calendar: 'Oct 2023',
    });
  });

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    const status = (req.query.status || '').toString();
    let list = timekeepingRecords.length ? timekeepingRecords.slice() : [];
    if (!list.length) {
      try {
        const [ers] = await db.query(`SELECT uid, name FROM employees`);
        list = ers.map((e) => ({
          uid: e.uid,
          name: e.name,
          clockIn: '-',
          clockOut: '-',
          totalTime: '-',
          totalLate: '-',
          totalOvertime: '-',
          status: 'Absent',
          statusClass: 'draft',
        }));
      } catch (_e) {
        list = [];
      }
    }
    if (status) {
      list = list.filter((r) => (r.status || '') === status);
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
  });

  router.post('/', (req, res) => {
    const { uid, name, clockIn = '', clockOut = '', status = 'Present' } = req.body || {};
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
    res.status(201).json(rec);
  });

  return router;
};
