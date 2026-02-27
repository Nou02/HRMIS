const express = require('express');

module.exports = (state) => {
  const router = express.Router();
  const { payslips, employees } = state;

  router.get('/', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    const onlyConfirmed = String(req.query.only_confirmed || '').toLowerCase() === 'true';
    let list = payslips.length
      ? payslips.slice()
      : employees.map((e) => ({
          id: e.uid,
          uid: e.uid,
          name: e.name,
          role: '',
          gross: '—',
          bonus: '—',
          deductions: '—',
          netPay: '—',
          period: '—',
          status: 'Draft',
        }));
    if (onlyConfirmed) {
      list = list.filter((p) => (p.status || '').toLowerCase() === 'confirmed');
    }
    if (q) {
      list = list.filter(
        (p) =>
          (p.uid || '').toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    res.json(list);
  });

  router.put('/:uid', (req, res) => {
    const { uid } = req.params;
    const idx = payslips.findIndex((p) => p.uid === uid);
    const cur = idx !== -1 ? payslips[idx] : { uid, name: '', role: '' };
    const {
      name = cur.name,
      role = cur.role,
      gross = cur.gross,
      bonus = cur.bonus,
      deductions = cur.deductions,
      period = cur.period,
      confirm = false,
    } = req.body || {};
    const grossN = Number(String(gross).replace(/[^\d.-]/g, '')) || 0;
    const bonusN = Number(String(bonus).replace(/[^\d.-]/g, '')) || 0;
    const dedN = Number(String(deductions).replace(/[^\d.-]/g, '')) || 0;
    const netN = grossN + bonusN - dedN;
    const rec = {
      id: uid,
      uid,
      name,
      role,
      gross: grossN ? `₱${grossN.toLocaleString()}` : gross,
      bonus: bonusN ? `₱${bonusN.toLocaleString()}` : bonus,
      deductions: dedN ? `₱${dedN.toLocaleString()}` : deductions,
      netPay: netN ? `₱${netN.toLocaleString()}` : cur.netPay || '—',
      period,
      status: confirm ? 'Confirmed' : (cur.status || 'Draft'),
      statusClass: confirm ? 'approved' : (cur.statusClass || 'draft'),
    };
    if (idx === -1) {
      payslips.push(rec);
    } else {
      payslips[idx] = rec;
    }
    res.json(rec);
  });

  return router;
};
