const express = require('express');
module.exports = (upload, db) => {
  const router = express.Router();
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
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.post('/', (req, res, next) => {
    console.log('POST /api/employees hit');
    next();
  }, upload.any(), async (req, res) => {
    console.log('POST /api/employees files:', req.files?.map(f => f.fieldname));
    const {
      uid,
      name,
      departmentProject,
      employmentCategory,
      certifications = '',
      pdsAvailable = false,
      idViewAvailable = false,
    } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'uid and name are required' });
    }
    const pdsFile = req.files?.find(f => f.fieldname === 'pdsFile');
    const idFile = req.files?.find(f => f.fieldname === 'idFile');
    const avatarFile = req.files?.find(f => f.fieldname === 'avatarFile');
    try {
      await ensureEmployeesTable();
      const [existing] = await db.query('SELECT uid FROM employees WHERE uid = ?', [uid]);
      if (existing.length) return res.status(409).json({ error: 'Employee with uid already exists' });
      
      const avatarUrl = avatarFile ? `/uploads/${avatarFile.filename}` : (req.body.avatarUrl || '');

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
          avatarUrl,
        ]
      );
      const [rows] = await db.query(
        `SELECT uid,name,department_project AS departmentProject,employment_category AS employmentCategory,certifications,pds_available AS pdsAvailable,id_view_available AS idViewAvailable,pds_file_path AS pdsFilePath,id_file_path AS idFilePath,avatar_url AS avatarUrl FROM employees WHERE uid=?`,
        [uid]
      );
      res.status(201).json(rows[0] || {});
    } catch (e) {
      res.status(500).json({ error: 'db_error', detail: e && e.message ? String(e.message) : 'unknown' });
    }
  });

  router.put('/:uid', async (req, res) => {
    console.log('PUT /api/employees hit for:', req.params.uid);
    
    // Call upload.any() manually inside the handler
    upload.any()(req, res, async (err) => {
      if (err) {
        console.error('Multer error during update:', err);
        return res.status(400).json({ error: 'file_upload_error', detail: err.message });
      }
      
      console.log('PUT /api/employees files:', req.files?.map(f => f.fieldname));
      const { uid } = req.params;
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
        } = req.body || {};
        const pdsFile = req.files?.find(f => f.fieldname === 'pdsFile');
        const idFile = req.files?.find(f => f.fieldname === 'idFile');
        const avatarFile = req.files?.find(f => f.fieldname === 'avatarFile');
        const nextPdsPath = pdsFile ? `/uploads/${pdsFile.filename}` : cur.pds_file_path || null;
        const nextIdPath = idFile ? `/uploads/${idFile.filename}` : cur.id_file_path || null;
        const avatarUrl = avatarFile ? `/uploads/${avatarFile.filename}` : (req.body.avatarUrl || cur.avatar_url || '');

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
      } catch (dbErr) {
        console.error('PUT /api/employees DB error:', dbErr);
        res.status(500).json({ error: 'db_error', detail: dbErr.message });
      }
    });
  });

  return router;
};
