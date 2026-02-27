const express = require('express');

module.exports = (state) => {
  const router = express.Router();
  const { payrollRecords, employees } = state;

  router.get('/summary', (_req, res) => {
    const totalEmployees = payrollRecords.length || employees.length;
    const basePayroll = payrollRecords.reduce((sum, r) => sum + (Number(r.baseSalary) || 0), 0);
    const totalOvertime = payrollRecords.reduce((sum, r) => sum + (Number(r.overtimeAmount) || 0), 0);
    res.json({
      totalEmployees,
      basePayroll: basePayroll ? `₱${basePayroll.toLocaleString()}` : '—',
      totalOvertime: totalOvertime ? `₱${totalOvertime.toLocaleString()}` : '—',
      period: '—',
    });
  });

  router.get('/records', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    const onlyGenerated = String(req.query.only_generated || '').toLowerCase() === 'true';
    let list = payrollRecords.length
      ? payrollRecords.slice()
      : employees.map((e) => ({
          employeeId: e.uid,
          employeeName: e.name,
          baseSalary: '-',
          overtime: '-',
          deduction: '-',
          netPay: '-',
          status: 'Draft',
          statusClass: 'draft',
        }));
    if (q) {
      list = list.filter(
        (r) =>
          (r.employeeId || '').toLowerCase().includes(q) ||
          (r.employeeName || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') {
      list.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
    }
    if (onlyGenerated) {
      list = list.filter((r) => (r.status || '').toLowerCase() === 'generated');
    }
    res.json(list);
  });

  router.post('/generate', (_req, res) => {
    payrollRecords.length = 0;
    const count = employees.length;
    employees.forEach((e) => {
      payrollRecords.push({
        employeeId: e.uid,
        employeeName: e.name,
        baseSalary: '-',
        overtime: '-',
        deduction: '-',
        netPay: '-',
        status: 'Generated',
        statusClass: 'approved',
      });
    });
    res.json({ ok: true, count });
  });

  router.put('/records/:employeeId', (req, res) => {
    const { employeeId } = req.params;
    const idx = payrollRecords.findIndex((r) => r.employeeId === employeeId);
    const cur = idx !== -1 ? payrollRecords[idx] : {
      employeeId,
      employeeName: '',
      baseSalary: '-',
      overtime: '-',
      deduction: '-',
      netPay: '-',
      status: 'Generated',
      statusClass: 'approved',
    };
    const {
      employeeName = cur.employeeName,
      baseSalary = cur.baseSalary,
      overtime = cur.overtime,
      deduction = cur.deduction,
      netPay,
      status = cur.status,
    } = req.body || {};
    const baseN = Number(String(baseSalary).replace(/[^\d.-]/g, '')) || 0;
    const otN = Number(String(overtime).replace(/[^\d.-]/g, '')) || 0;
    const dedN = Number(String(deduction).replace(/[^\d.-]/g, '')) || 0;
    const computedNet = baseN || otN || dedN ? (baseN + otN - dedN) : null;
    const rec = {
      employeeId,
      employeeName,
      baseSalary: baseN ? `₱${baseN.toLocaleString()}` : baseSalary,
      overtime: otN ? `₱${otN.toLocaleString()}` : overtime,
      deduction: dedN ? `₱${dedN.toLocaleString()}` : deduction,
      netPay: typeof netPay !== 'undefined' ? netPay : (computedNet ? `₱${computedNet.toLocaleString()}` : cur.netPay),
      status,
      statusClass: (status || '').toLowerCase() === 'generated' ? 'approved' : 'review',
    };
    if (idx === -1) {
      payrollRecords.push(rec);
    } else {
      payrollRecords[idx] = rec;
    }
    res.json(rec);
  });

  return router;
};
