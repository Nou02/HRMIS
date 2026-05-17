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
        console.error(`[GatePass Export] Template not found: ${GATEPASS_TEMPLATE_PATH}`);
        return res.status(404).json({ error: 'Template file not found' });
      }

      console.log(`[GatePass Export] Fetching record for ID: ${id}`);
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
        console.error(`[GatePass Export] No record found for ID: ${id}`);
        return res.status(404).json({ error: 'Gate Pass not found' });
      }
      const g = rows[0];
      console.log(`[GatePass Export] Found record for: ${g.name}`);

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

      // Helper for 12h time format
      const format12h = (t) => {
        if (!t) return '';
        try {
          const parts = String(t).split(':');
          if (parts.length < 2) return String(t);
          let hrs = parseInt(parts[0]);
          const ampm = hrs >= 12 ? 'PM' : 'AM';
          hrs = hrs % 12 || 12;
          return `${hrs}:${parts[1]} ${ampm}`;
        } catch (e) {
          return String(t);
        }
      };

      // Helper to set checkboxes in Column C
      const setCheck = (row, isChecked) => {
        try {
          const cell = worksheet.getCell(`C${row}`);
          // Use standard characters and avoid complex formatting during cleaning
          cell.value = isChecked ? '☑' : '☐';
          cell.font = { name: 'Arial Unicode MS', size: 12 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } catch (e) {
          console.error(`[GatePass Export] Error setting check at C${row}:`, e);
        }
      };

      const fillSection = (offset, isHR = false) => {
        // Official
        setCheck(14 + offset, g.officialType === 'Travel');
        if (g.officialType === 'Travel') {
          const cell = worksheet.getCell(`I${14 + offset}`);
          cell.value = g.officialPurpose || '';
          cell.alignment = { horizontal: 'left', vertical: 'bottom' };
          cell.font = { name: 'Arial', size: 10 };
        }
        
        setCheck(15 + offset, g.officialType === 'Seminar/Training/Conference/Meeting');
        setCheck(16 + offset, g.officialType === 'Pick-up of Documents');
        setCheck(17 + offset, g.officialType === 'Others');
        if (g.officialType === 'Others') {
          const cell = worksheet.getCell(`I${17 + offset}`);
          cell.value = g.officialPurpose || '';
          cell.alignment = { horizontal: 'left', vertical: 'bottom' };
          cell.font = { name: 'Arial', size: 10 };
        }

        // Personal
        setCheck(21 + offset, g.personalType === "Medication/ Physical Check-up (subject to presentation of Doctor's Certification)");
        setCheck(22 + offset, g.personalType === "Medical Attention to Family Member/ Relative");
        setCheck(23 + offset, g.personalType === "Others");
        if (g.personalType === "Others") {
          const cell = worksheet.getCell(`I${23 + offset}`);
          cell.value = g.personalPurpose || '';
          cell.alignment = { horizontal: 'left', vertical: 'bottom' };
          cell.font = { name: 'Arial', size: 10 };
        }

        // Times and Venue - HR Copy has slightly different mapping in template
        if (isHR) {
          worksheet.getCell(`E${64}`).value = g.date || '';
          worksheet.getCell(`L${64}`).value = format12h(g.estStartTime);
          worksheet.getCell(`N${64}`).value = format12h(g.estEndTime);
          worksheet.getCell(`E${66}`).value = g.venue || '';
        } else {
          worksheet.getCell(`E${25 + offset}`).value = g.date || '';
          worksheet.getCell(`L${25 + offset}`).value = format12h(g.estStartTime);
          worksheet.getCell(`N${25 + offset}`).value = format12h(g.estEndTime);
          worksheet.getCell(`E${27 + offset}`).value = g.venue || '';
        }

        // Approver and Employee
        if (isHR) {
          // HR Copy signatures at row 75, centered above the line
          const approverCell = worksheet.getCell(`C75`);
          approverCell.value = g.approvedBy || '';
          approverCell.alignment = { horizontal: 'center', vertical: 'bottom' };
          approverCell.font = { name: 'Arial', size: 10, bold: true };

          const employeeCell = worksheet.getCell(`K75`);
          employeeCell.value = g.name || '';
          employeeCell.alignment = { horizontal: 'center', vertical: 'bottom' };
          employeeCell.font = { name: 'Arial', size: 10, bold: true };
        } else {
          // Personal Copy signatures at row 34, above the underline
          const approverCell = worksheet.getCell(`C${34}`);
          approverCell.value = g.approvedBy || '';
          approverCell.alignment = { horizontal: 'center', vertical: 'bottom' };
          approverCell.font = { name: 'Arial', size: 10, bold: true };

          const employeeCell = worksheet.getCell(`K${34}`);
          employeeCell.value = g.name || '';
          employeeCell.alignment = { horizontal: 'center', vertical: 'bottom' };
          employeeCell.font = { name: 'Arial', size: 10, bold: true };
        }
      };

      console.log(`[GatePass Export] Filling worksheet sections...`);
      fillSection(0, false);  // Personal Copy
      fillSection(39, true);  // HR Copy (14 + 39 = 53 for checkboxes)

      console.log(`[GatePass Export] Generating buffer...`);
      const buffer = await workbook.xlsx.writeBuffer();
      
      const safeName = String(g.name || 'Employee').replace(/[^a-z0-9]/gi, '_');
      const safeDate = String(g.date || 'download').replace(/[^a-z0-9]/gi, '_');
      const filename = `GatePass_${safeName}_${safeDate}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      console.log(`[GatePass Export] Sending file: ${filename} (${buffer.length} bytes)`);
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
