const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

module.exports = (db) => {
  const router = express.Router();

  const GATEPASS_TEMPLATE_PATH = path.resolve(__dirname, '..', '..', 'uploads', 'DICT R4A Gate Pass Monitoring.xlsx');

  router.get('/export-xlsx', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
      if (!fs.existsSync(GATEPASS_TEMPLATE_PATH)) {
        return res.status(404).json({ error: 'Template file not found' });
      }

      const [rows] = await db.query(`
        SELECT 
          id, uid, name, 
          official_type AS officialType, 
          official_purpose AS officialPurpose,
          personal_type AS personalType,
          personal_purpose AS personalPurpose,
          DATE_FORMAT(date, '%Y-%m-%d') AS date,
          est_start_time AS estStartTime,
          est_end_time AS estEndTime,
          act_start_time AS actStartTime,
          act_end_time AS actEndTime,
          venue,
          approved_by AS approvedBy,
          status
        FROM gatepasses WHERE id = ?
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Gate Pass not found' });
      }
      const g = rows[0];


      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(GATEPASS_TEMPLATE_PATH);
      
      // Radical formula stripping for ALL worksheets in the workbook
      workbook.worksheets.forEach(ws => {
        ws.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.model && (cell.model.formula || cell.model.sharedFormula || cell.type === 4 || cell.formula)) {
              let result = cell.value;
              if (result && typeof result === 'object' && result.result !== undefined) {
                result = result.result;
              }
              // If the result is still an object, try to get the text or stringify
              if (result && typeof result === 'object') {
                if (result.richText) {
                  result = result.richText.map(t => t.text).join('');
                } else if (result.text) {
                  result = result.text;
                } else {
                  // Fallback: if it's an object we can't parse, just make it empty 
                  // to avoid [object Object] appearing in the sheet
                  result = '';
                }
              }
              const style = cell.style;
              cell.model = {
                address: cell.address,
                type: (result === null || result === undefined) ? 0 : (typeof result === 'number' ? 2 : 3),
                value: result,
                style: style
              };
            }
          });
        });
        if (ws._sharedFormulas) ws._sharedFormulas = {};
      });

      // Clear workbook level metadata that might cause issues
      workbook.definedNames.model = [];

       const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('No worksheets found in template');
      }

      // Section 1: Name, Office, Date
      worksheet.getCell('C7').value = g.name || '';
      worksheet.getCell('C8').value = 'Office of the Regional Director'; // Static or from DB if available
      worksheet.getCell('C9').value = g.date || '';

      // Section 2: Official vs Personal
      if (g.officialType) {
        worksheet.getCell('C11').value = '✔'; 
        worksheet.getCell('E11').value = g.officialType;
        worksheet.getCell('E12').value = g.officialPurpose || '';
      } else {
        worksheet.getCell('C13').value = '✔';
        worksheet.getCell('E13').value = g.personalType || '';
        worksheet.getCell('E14').value = g.personalPurpose || '';
      }

      // Section 3: Destination
      worksheet.getCell('E15').value = g.venue || '';

      // Section 4: Time (Estimated)
      worksheet.getCell('E17').value = g.estStartTime || '';
      worksheet.getCell('G17').value = g.estEndTime || '';

      // Section 5: Signature
      worksheet.getCell('C22').value = g.name || '';
      worksheet.getCell('C24').value = g.approvedBy || '';

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `GatePass_${g.name.replace(/\s+/g, '_')}_${g.date}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('[GatePass Export] FATAL ERROR:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Export failed', details: err.message, stack: err.stack });
      }
    }
  });

  // Helper to ensure table exists (though we already updated database.sql)
  const ensureGatepassesTable = async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS gatepasses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        uid VARCHAR(50),
        name VARCHAR(120),
        official_type VARCHAR(100),
        official_purpose TEXT,
        personal_type VARCHAR(100),
        personal_purpose TEXT,
        date DATE,
        est_start_time TIME,
        est_end_time TIME,
        act_start_time TIME,
        act_end_time TIME,
        venue VARCHAR(255),
        approved_by VARCHAR(120),
        status VARCHAR(40),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_gate_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);
  };

  router.get('/', async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    const sort = (req.query.sort || '').toString();

    try {
      await ensureGatepassesTable();
      const [rows] = await db.query(`
        SELECT 
          id, uid, name, 
          official_type AS officialType, 
          official_purpose AS officialPurpose,
          personal_type AS personalType,
          personal_purpose AS personalPurpose,
          DATE_FORMAT(date, '%Y-%m-%d') AS date,
          est_start_time AS estStartTime,
          est_end_time AS estEndTime,
          act_start_time AS actStartTime,
          act_end_time AS actEndTime,
          venue,
          approved_by AS approvedBy,
          status
        FROM gatepasses
      `);

      let list = rows;

      if (q) {
        list = list.filter(
          (g) =>
            (g.uid || '').toLowerCase().includes(q) ||
            (g.name || '').toLowerCase().includes(q) ||
            (g.venue || '').toLowerCase().includes(q) ||
            (g.status || '').toLowerCase().includes(q)
        );
      }

      if (sort === 'name_asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sort === 'name_desc') {
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      } else {
        // Default: Sort by date and start time descending
        list.sort((a, b) => {
          const dateA = new Date(`${a.date || ''}T${a.estStartTime || '00:00'}`);
          const dateB = new Date(`${b.date || ''}T${b.estStartTime || '00:00'}`);
          return dateB - dateA;
        });
      }

      res.json(list);
    } catch (err) {
      console.error('GET /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.post('/', async (req, res) => {
    const { 
      uid, name, officialType, officialPurpose, personalType, personalPurpose,
      date, estStartTime, estEndTime, actStartTime, actEndTime, venue, approvedBy,
      status = 'Pending' 
    } = req.body || {};

    if (!uid) return res.status(400).json({ error: 'uid is required' });

    try {
      await ensureGatepassesTable();
      
      // Get employee_id from uid
      const [empRows] = await db.query('SELECT id, name FROM employees WHERE uid = ?', [uid]);
      if (empRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const employeeId = empRows[0].id;
      const employeeName = empRows[0].name;

      const [result] = await db.query(`
        INSERT INTO gatepasses (
          employee_id, uid, name, official_type, official_purpose, 
          personal_type, personal_purpose, date, est_start_time, 
          est_end_time, act_start_time, act_end_time, venue, approved_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employeeId, uid, employeeName, 
        officialType || null, officialPurpose || null,
        personalType || null, personalPurpose || null, 
        date || null, estStartTime || null,
        estEndTime || null, actStartTime || null, 
        actEndTime || null, venue || null, 
        approvedBy || null, status || 'Pending'
      ]);

      res.status(201).json({ id: result.insertId, ...req.body, name: employeeName });
    } catch (err) {
      console.error('POST /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      officialType, officialPurpose, personalType, personalPurpose,
      date, estStartTime, estEndTime, actStartTime, actEndTime, venue, approvedBy,
      status 
    } = req.body || {};

    try {
      await ensureGatepassesTable();

      // Check if exists
      const [existing] = await db.query('SELECT id FROM gatepasses WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ error: 'Not found' });

      await db.query(`
        UPDATE gatepasses SET 
          official_type = COALESCE(?, official_type),
          official_purpose = COALESCE(?, official_purpose),
          personal_type = COALESCE(?, personal_type),
          personal_purpose = COALESCE(?, personal_purpose),
          date = COALESCE(?, date),
          est_start_time = COALESCE(?, est_start_time),
          est_end_time = COALESCE(?, est_end_time),
          act_start_time = COALESCE(?, act_start_time),
          act_end_time = COALESCE(?, act_end_time),
          venue = COALESCE(?, venue),
          approved_by = COALESCE(?, approved_by),
          status = COALESCE(?, status)
        WHERE id = ?
      `, [
        officialType, officialPurpose, personalType, personalPurpose,
        date, estStartTime, estEndTime, actStartTime, actEndTime,
        venue, approvedBy, status, id
      ]);

      res.json({ id, ...req.body });
    } catch (err) {
      console.error('PUT /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await ensureGatepassesTable();
      await db.query('DELETE FROM gatepasses WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/gatepasses error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};
