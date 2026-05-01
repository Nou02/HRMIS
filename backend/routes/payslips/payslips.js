const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();
  const { payslips } = state;

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    const onlyConfirmed = String(req.query.only_confirmed || '').toLowerCase() === 'true';
    const [ers] = await db.query(`SELECT uid AS id, uid, name, avatar_url AS avatarUrl, employment_category AS employmentCategory FROM employees`);
    const byUid = {};
    payslips.forEach((p) => {
      byUid[p.uid] = p;
    });
    let list = ers.map((e) => {
      const cur = byUid[e.uid];
      if (cur) {
        return {
          ...cur,
          name: e.name,
          avatarUrl: e.avatarUrl,
          role: e.employmentCategory || 'Staff',
        };
      }
      return {
        id: e.id,
        uid: e.uid,
        name: e.name,
        avatarUrl: e.avatarUrl,
        role: e.employmentCategory || 'Staff',
        gross: '—',
        bonus: '—',
        deductions: '—',
        netPay: '—',
        period: '—',
        status: 'Draft',
        statusClass: 'draft', 
      };
    });
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
    console.log('Fetching payslips for list, count:', list.length);
    if (list.length > 0) {
      console.log('Sample item avatarUrl:', list[0].avatarUrl);
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
    const netN = (grossN / 2) + bonusN - dedN;
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
