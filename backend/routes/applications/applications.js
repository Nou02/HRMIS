const express = require('express');

module.exports = (state) => {
  const router = express.Router();
  const { applications } = state;

  router.get('/', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    let list = applications.slice();
    if (q) {
      list = list.filter(
        (a) =>
          a.uid.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.typeOfLeave.toLowerCase().includes(q) ||
          a.leaveStatus.toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === 'type_asc') {
      list.sort((a, b) => (a.typeOfLeave || '').localeCompare(b.typeOfLeave || ''));
    }
    res.json(list);
  });

  router.post('/', (req, res) => {
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
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    applications.push(appRec);
    res.status(201).json(appRec);
  });

  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const idx = applications.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = applications[idx];
    const {
      uid = cur.uid,
      name = cur.name,
      typeOfLeave = cur.typeOfLeave,
      leaveStatus = cur.leaveStatus,
      offsetHours = cur.offsetHours,
      offsetStatus = cur.offsetStatus,
    } = req.body || {};
    const hours = Number(offsetHours || 0);
    if (hours && hours < 2) {
      return res.status(400).json({ error: 'offsetHours must be at least 2' });
    }
    applications[idx] = {
      id,
      uid,
      name,
      typeOfLeave,
      leaveStatus,
      offsetHours: hours,
      offsetStatus,
      offset: hours ? `${hours}h` : '',
    };
    res.json(applications[idx]);
  });

  return router;
};
