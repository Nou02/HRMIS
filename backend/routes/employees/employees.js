const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = (upload, db) => {
  const router = express.Router();
  const USE_DB = String(process.env.BACKEND_USE_DB || process.env.USE_DB || 'true').toLowerCase() === 'true';
  const dataDir = path.join(__dirname, '../../data');
  const fallbackFile = path.join(dataDir, 'fallback_employees.json');
  function readFallback() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
      if (!fs.existsSync(fallbackFile)) fs.writeFileSync(fallbackFile, '[]');
      const raw = fs.readFileSync(fallbackFile, 'utf-8');
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (_e) {
      return [];
    }
  }
  function writeFallback(list) {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
      fs.writeFileSync(fallbackFile, JSON.stringify(list, null, 2));
      return true;
    } catch (_e) {
      return false;
    }
  }
  async function ensureEmployeesTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        department_project VARCHAR(120),
        employment_category VARCHAR(80),
        certifications TEXT,
        avatar_url VARCHAR(255),
        pds_available TINYINT(1) DEFAULT 0,
        id_view_available TINYINT(1) DEFAULT 0,
        pds_file_path VARCHAR(255),
        id_file_path VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }
  router.get('/', async (req, res) => {
    if (!USE_DB) {
      return res.json(readFallback());
    }
    const q = (req.query.q || '').toString();
    const sort = (req.query.sort || '').toString();
    let orderBy = '';
    if (sort === 'department_asc') orderBy = 'ORDER BY department_project ASC';
    if (sort === 'name_asc') orderBy = 'ORDER BY name ASC';
    const where = q
      ? `WHERE (uid LIKE ? OR name LIKE ? OR department_project LIKE ?)`
      : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    try {
      await ensureEmployeesTable();
      const [rows] = await db.query(
        `SELECT uid,name,department_project AS departmentProject,employment_category AS employmentCategory,certifications,pds_available AS pdsAvailable,id_view_available AS idViewAvailable,pds_file_path AS pdsFilePath,id_file_path AS idFilePath,avatar_url AS avatarUrl FROM employees ${where} ${orderBy}`
      , params);
      res.json(rows.map((r) => ({
        ...r,
        certifications: r.certifications || '',
      })));
    } catch (_e) {
      try {
        const dataDir = path.join(__dirname, '../../data');
        const fallbackFile = path.join(dataDir, 'fallback_employees.json');
        if (fs.existsSync(fallbackFile)) {
          const raw = fs.readFileSync(fallbackFile, 'utf-8');
          const list = JSON.parse(raw);
          res.json(Array.isArray(list) ? list : []);
        } else {
          res.json([]);
        }
      } catch (_ee) {
        res.json([]);
      }
    }
  });

  router.post('/', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), async (req, res) => {
    if (!USE_DB) {
      const {
        uid,
        name,
        departmentProject,
        employmentCategory,
        certifications = '',
        pdsAvailable = false,
        idViewAvailable = false,
        avatarUrl = '',
      } = req.body || {};
      if (!uid || !name) {
        return res.status(400).json({ error: 'uid and name are required' });
      }
      const pdsFile = req.files?.pdsFile?.[0];
      const idFile = req.files?.idFile?.[0];
      const list = readFallback();
      const emp = {
        uid,
        name,
        departmentProject: departmentProject || '',
        employmentCategory: employmentCategory || '',
        certifications: Array.isArray(certifications)
          ? certifications
          : String(certifications || '').split(',').map((s) => s.trim()).filter(Boolean),
        pdsAvailable: pdsFile ? true : !!pdsAvailable,
        idViewAvailable: idFile ? true : !!idViewAvailable,
        pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : null,
        idFilePath: idFile ? `/uploads/${idFile.filename}` : null,
        avatarUrl,
      };
      const idx = list.findIndex((r) => r.uid === uid);
      if (idx !== -1) return res.status(409).json({ error: 'Employee with uid already exists' });
      list.push(emp);
      writeFallback(list);
      return res.status(201).json(emp);
    }
    const {
      uid,
      name,
      departmentProject,
      employmentCategory,
      certifications = '',
      pdsAvailable = false,
      idViewAvailable = false,
      avatarUrl = '',
    } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'uid and name are required' });
    }
    const pdsFile = req.files?.pdsFile?.[0];
    const idFile = req.files?.idFile?.[0];
    try {
      await ensureEmployeesTable();
      const [existing] = await db.query('SELECT uid FROM employees WHERE uid = ?', [uid]);
      if (existing.length) return res.status(409).json({ error: 'Employee with uid already exists' });
      await db.query(
        `INSERT INTO employees (uid,name,department_project,employment_category,certifications,pds_available,id_view_available,pds_file_path,id_file_path,avatar_url) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uid,
          name,
          departmentProject || '',
          employmentCategory || '',
          Array.isArray(certifications) ? certifications.join(', ') : String(certifications || ''),
          pdsFile ? 1 : (pdsAvailable ? 1 : 0),
          idFile ? 1 : (idViewAvailable ? 1 : 0),
          pdsFile ? `/uploads/${pdsFile.filename}` : null,
          idFile ? `/uploads/${idFile.filename}` : null,
          avatarUrl || '',
        ]
      );
      const [rows] = await db.query(
        `SELECT uid,name,department_project AS departmentProject,employment_category AS employmentCategory,certifications,pds_available AS pdsAvailable,id_view_available AS idViewAvailable,pds_file_path AS pdsFilePath,id_file_path AS idFilePath,avatar_url AS avatarUrl FROM employees WHERE uid=?`,
        [uid]
      );
      res.status(201).json(rows[0] || {});
    } catch (e) {
      try {
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
        const fallbackFile = path.join(dataDir, 'fallback_employees.json');
        const raw = fs.existsSync(fallbackFile) ? fs.readFileSync(fallbackFile, 'utf-8') : '[]';
        const list = JSON.parse(raw);
        const emp = {
          uid,
          name,
          departmentProject: departmentProject || '',
          employmentCategory: employmentCategory || '',
          certifications: Array.isArray(certifications)
            ? certifications
            : String(certifications || '').split(',').map((s) => s.trim()).filter(Boolean),
          pdsAvailable: pdsFile ? true : !!pdsAvailable,
          idViewAvailable: idFile ? true : !!idViewAvailable,
          pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : null,
          idFilePath: idFile ? `/uploads/${idFile.filename}` : null,
          avatarUrl,
        };
        const idx = list.findIndex((r) => r.uid === uid);
        if (idx === -1) list.push(emp); else list[idx] = emp;
        fs.writeFileSync(fallbackFile, JSON.stringify(list, null, 2));
        res.status(201).json(emp);
      } catch (_ee) {
        res.status(500).json({ error: 'db_error', detail: e && e.message ? String(e.message) : 'unknown' });
      }
    }
  });

  router.put('/:uid', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), async (req, res) => {
    const { uid } = req.params;
    if (!USE_DB) {
      const list = readFallback();
      const idx = list.findIndex((e) => e.uid === uid);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const cur = list[idx];
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
      list[idx] = {
        uid,
        name,
        departmentProject,
        employmentCategory,
        certifications: Array.isArray(certifications)
          ? certifications
          : String(certifications || '').split(',').map((s) => s.trim()).filter(Boolean),
        pdsAvailable: pdsFile ? true : !!pdsAvailable,
        idViewAvailable: idFile ? true : !!idViewAvailable,
        pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : cur.pdsFilePath || null,
        idFilePath: idFile ? `/uploads/${idFile.filename}` : cur.idFilePath || null,
        avatarUrl,
      };
      writeFallback(list);
      return res.json(list[idx]);
    }
    try {
      await ensureEmployeesTable();
      const [curRows] = await db.query('SELECT * FROM employees WHERE uid=?', [uid]);
      if (!curRows.length) return res.status(404).json({ error: 'Not found' });
      const cur = curRows[0];
      const {
        name = cur.name,
        departmentProject = cur.department_project,
        employmentCategory = cur.employment_category,
        certifications = cur.certifications || '',
        pdsAvailable = cur.pds_available ? 1 : 0,
        idViewAvailable = cur.id_view_available ? 1 : 0,
        avatarUrl = cur.avatar_url || '',
      } = req.body || {};
      const pdsFile = req.files?.pdsFile?.[0];
      const idFile = req.files?.idFile?.[0];
      const nextPdsPath = pdsFile ? `/uploads/${pdsFile.filename}` : cur.pds_file_path || null;
      const nextIdPath = idFile ? `/uploads/${idFile.filename}` : cur.id_file_path || null;
      await db.query(
        `UPDATE employees SET name=?,department_project=?,employment_category=?,certifications=?,pds_available=?,id_view_available=?,pds_file_path=?,id_file_path=?,avatar_url=? WHERE uid=?`,
        [
          name,
          departmentProject,
          employmentCategory,
          Array.isArray(certifications) ? certifications.join(', ') : String(certifications || ''),
          pdsFile ? 1 : (pdsAvailable ? 1 : 0),
          idFile ? 1 : (idViewAvailable ? 1 : 0),
          nextPdsPath,
          nextIdPath,
          avatarUrl,
          uid,
        ]
      );
      const [rows] = await db.query(
        `SELECT uid,name,department_project AS departmentProject,employment_category AS employmentCategory,certifications,pds_available AS pdsAvailable,id_view_available AS idViewAvailable,pds_file_path AS pdsFilePath,id_file_path AS idFilePath,avatar_url AS avatarUrl FROM employees WHERE uid=?`,
        [uid]
      );
      res.json(rows[0] || {});
    } catch (_e) {
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};
