const express = require('express');

module.exports = (state) => {
  const router = express.Router();
  const { gatepasses } = state;

  router.get('/', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    let list = gatepasses.slice();
    if (q) {
      list = list.filter(
        (g) =>
          (g.uid || '').toLowerCase().includes(q) ||
          (g.name || '').toLowerCase().includes(q) ||
          (g.destination || '').toLowerCase().includes(q) ||
          (g.purpose || '').toLowerCase().includes(q) ||
          (g.status || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (sort === 'date_desc') {
      list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }
    res.json(list);
  });

  router.post('/', (req, res) => {
    const {
      uid,
      name,
      destination = '',
      purpose = '',
      date = '',
      timeOut = '',
      timeIn = '',
      status = 'Pending',
    } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'uid and name are required' });
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const rec = {
      id,
      uid,
      name,
      destination,
      purpose,
      date,
      timeOut,
      timeIn,
      status,
      statusClass:
        (status || '').toLowerCase() === 'approved'
          ? 'approved'
          : (status || '').toLowerCase() === 'rejected'
          ? 'review'
          : 'draft',
    };
    gatepasses.push(rec);
    res.status(201).json(rec);
  });

  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const idx = gatepasses.findIndex((g) => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = gatepasses[idx];
    const {
      uid = cur.uid,
      name = cur.name,
      destination = cur.destination,
      purpose = cur.purpose,
      date = cur.date,
      timeOut = cur.timeOut,
      timeIn = cur.timeIn,
      status = cur.status,
    } = req.body || {};
    gatepasses[idx] = {
      id,
      uid,
      name,
      destination,
      purpose,
      date,
      timeOut,
      timeIn,
      status,
      statusClass:
        (status || '').toLowerCase() === 'approved'
          ? 'approved'
          : (status || '').toLowerCase() === 'rejected'
          ? 'review'
          : 'draft',
    };
    res.json(gatepasses[idx]);
  });

  return router;
};
