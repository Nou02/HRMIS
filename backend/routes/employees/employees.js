const express = require('express');

module.exports = (upload, state) => {
  const router = express.Router();
  const { employees, saveEmployees } = state;

  router.get('/', (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const name = (req.query.name || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();
    let list = employees.slice();
    if (q) {
      list = list.filter(
        (e) =>
          e.uid.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.departmentProject.toLowerCase().includes(q)
      );
    }
    if (name) {
      list = list.filter((e) => e.name.toLowerCase().includes(name));
    }
    if (sort === 'department_asc') {
      list.sort((a, b) => a.departmentProject.localeCompare(b.departmentProject));
    }
    if (sort === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    res.json(list);
  });

  router.post('/', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), (req, res) => {
    const {
      uid,
      name,
      departmentProject,
      employmentCategory,
      certifications = [],
      pdsAvailable = false,
      idViewAvailable = false,
      avatarUrl = '',
    } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'uid and name are required' });
    }
    const existing = employees.find((e) => e.uid === uid);
    if (existing) {
      return res.status(409).json({ error: 'Employee with uid already exists' });
    }
    const pdsFile = req.files?.pdsFile?.[0];
    const idFile = req.files?.idFile?.[0];
    const emp = {
      uid,
      name,
      departmentProject: departmentProject || '',
      employmentCategory: employmentCategory || '',
      certifications: Array.isArray(certifications)
        ? certifications
        : String(certifications).split(',').map((s) => s.trim()).filter(Boolean),
      pdsAvailable: pdsFile ? true : !!pdsAvailable,
      idViewAvailable: idFile ? true : !!idViewAvailable,
      pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : null,
      idFilePath: idFile ? `/uploads/${idFile.filename}` : null,
      avatarUrl,
    };
    employees.push(emp);
    saveEmployees();
    res.status(201).json(emp);
  });

  router.put('/:uid', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), (req, res) => {
    const { uid } = req.params;
    const idx = employees.findIndex((e) => e.uid === uid);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = employees[idx];
    const {
      name = cur.name,
      departmentProject = cur.departmentProject,
      employmentCategory = cur.employmentCategory,
      certifications = cur.certifications,
      pdsAvailable = cur.pdsAvailable,
      idViewAvailable = cur.idViewAvailable,
      avatarUrl = cur.avatarUrl,
    } = req.body || {};
    const pdsFile = req.files?.pdsFile?.[0];
    const idFile = req.files?.idFile?.[0];
    employees[idx] = {
      uid,
      name,
      departmentProject,
      employmentCategory,
      certifications: Array.isArray(certifications)
        ? certifications
        : String(certifications).split(',').map((s) => s.trim()).filter(Boolean),
      pdsAvailable: pdsFile ? true : !!pdsAvailable,
      idViewAvailable: idFile ? true : !!idViewAvailable,
      pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : cur.pdsFilePath || null,
      idFilePath: idFile ? `/uploads/${idFile.filename}` : cur.idFilePath || null,
      avatarUrl,
    };
    saveEmployees();
    res.json(employees[idx]);
  });

  return router;
};
