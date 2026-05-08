const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

module.exports = (state, db) => {
  const router = express.Router();

  router.get('/export-xlsx', async (req, res) => {
    const { uid, period } = req.query;
    console.log(`[Payslip Export] Request for UID: ${uid}, Period: ${period}`);

    if (!uid || !period) {
      return res.status(400).json({ error: 'UID and Period are required' });
    }

    try {
      const templatePath = path.join(__dirname, '../../uploads/pay slip.xlsx');
      if (!fs.existsSync(templatePath)) {
        console.error(`[Payslip Export] Template not found at: ${templatePath}`);
        return res.status(404).json({ error: 'Template file pay slip.xlsx not found in uploads folder' });
      }

      // Fetch employee and payslip data
      const [rows] = await db.query(`
        SELECT 
          e.name, e.uid, e.employment_category, e.id as emp_internal_id,
          ps.gross, ps.bonus, ps.deductions, ps.net_pay, ps.period
        FROM employees e
        LEFT JOIN payslips ps ON e.id = ps.employee_id AND ps.period LIKE ?
        WHERE e.uid = ?
      `, [`%${period}%`, uid]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Employee or Payslip record not found' });
      }

      const r = rows[0];
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
      const worksheet = workbook.getWorksheet(1);

      // Mapping based on "pay slip.xlsx" screenshot
      // Header Info
      worksheet.getCell('C3').value = period; // <MONTH/YEAR>
      worksheet.getCell('B5').value = r.name; // EMPLOYEE NAME
      worksheet.getCell('B6').value = r.uid;  // ID NUMBER
      worksheet.getCell('B7').value = r.employment_category; // POSITION

      // Earnings
      const grossNum = parseFloat(r.gross || 0);
      const basicSalary = grossNum / 2;
      const premium = r.employment_category !== 'Job Order' ? (grossNum * 0.2) / 2 : 0;
      
      worksheet.getCell('A10').value = basicSalary; // Basic Salary
      worksheet.getCell('A14').value = premium;     // 20% Premium
      worksheet.getCell('A21').value = basicSalary + premium + parseFloat(r.bonus || 0); // GROSS PAY

      // Deductions
      worksheet.getCell('C12').value = parseFloat(r.deductions || 0); // GTECMPC Loan (placeholder for general deductions)
      worksheet.getCell('C19').value = parseFloat(r.deductions || 0); // Total Tax Deduction (placeholder)
      worksheet.getCell('C21').value = parseFloat(r.net_pay || 0);    // NET PAY

      // Formatting
      const currencyCells = ['A10', 'A14', 'A21', 'C12', 'C19', 'C21'];
      currencyCells.forEach(cellAddr => {
        const cell = worksheet.getCell(cellAddr);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Payslip_${r.name.replace(/\s+/g, '_')}_${period}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`[Payslip Export] Export successful for ${r.name}`);
    } catch (err) {
      console.error('[Payslip Export] Error:', err);
      res.status(500).json({ error: 'Failed to export payslip', details: err.message });
    }
  });

  async function ensurePayslipTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS payslips (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          employee_id INT NOT NULL,
          gross DECIMAL(12,2) DEFAULT 0.00,
          bonus DECIMAL(12,2) DEFAULT 0.00,
          deductions DECIMAL(12,2) DEFAULT 0.00,
          net_pay DECIMAL(12,2) DEFAULT 0.00,
          period VARCHAR(60),
          status VARCHAR(40),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_payslip_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )
      `);
      
      // Ensure unique constraint on (employee_id, period)
      const [indexes] = await db.query('SHOW INDEX FROM payslips WHERE Key_name = "unique_emp_period"');
      if (indexes.length === 0) {
        await db.query('ALTER TABLE payslips ADD UNIQUE KEY unique_emp_period (employee_id, period)');
      }
    } catch (err) {
      console.error('[Payslips] Error ensuring table:', err.message);
    }
  }

  router.get('/', async (req, res) => {
    try {
      await ensurePayslipTable();
      const q = (req.query.q || '').toString().toLowerCase();
      const sort = (req.query.sort || '').toString();
      const onlyConfirmed = String(req.query.only_confirmed || '').toLowerCase() === 'true';
      const periodParam = req.query.period;

      // Determine default period if none provided
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const periodNum = now.getDate() <= 15 ? 1 : 2;
      const defaultPeriod = `P${periodNum}-${year}-${month}`;
      const activePeriod = periodParam || defaultPeriod;
      const periodPattern = activePeriod.includes('%') ? activePeriod : `%${activePeriod}%`;

      console.log(`[Payslips] Fetching for period: ${activePeriod}`);

      // Single query to get ALL employees, their saved payslips for THIS period, 
      // AND their latest payroll record (for auto-fill)
      const queryStr = `
        SELECT 
          e.id AS emp_id, e.uid, e.name, e.avatar_url, e.employment_category,
          ps.id AS ps_id, ps.gross AS ps_gross, ps.bonus AS ps_bonus, ps.deductions AS ps_deductions, 
          ps.net_pay AS ps_net_pay, ps.period AS ps_period, ps.status AS ps_status,
          pr.base_salary AS pr_base, pr.overtime_amount AS pr_bonus, pr.deduction AS pr_ded,
          pr.period AS pr_period
        FROM employees e
        LEFT JOIN payslips ps ON e.id = ps.employee_id AND ps.period LIKE ?
        LEFT JOIN (
          SELECT pr1.* FROM payroll_records pr1
          INNER JOIN (
            SELECT employee_id, MAX(id) as max_id
            FROM payroll_records
            GROUP BY employee_id
          ) pr2 ON pr1.id = pr2.max_id
        ) pr ON e.id = pr.employee_id
      `;

      const [rows] = await db.query(queryStr, [periodPattern]);
      console.log(`[Payslips] Found ${rows.length} rows`);

      let list = rows.map((r) => {
        // Use saved payslip data if it exists for this period, 
        // otherwise fallback to the most recent payroll record values
        let grossVal = 0;
        let bonusVal = 0;
        let dedVal = 0;
        let netVal = 0;
        let period = activePeriod;
        let status = 'Draft';

        if (r.ps_id) {
          // Found a saved payslip for this period
          grossVal = parseFloat(r.ps_gross || 0);
          bonusVal = parseFloat(r.ps_bonus || 0);
          dedVal = parseFloat(r.ps_deductions || 0);
          netVal = parseFloat(r.ps_net_pay || 0);
          period = r.ps_period;
          status = r.ps_status || 'Draft';
        } else if (r.pr_base !== null) {
          // No saved payslip, but found a payroll record to auto-fill from
          grossVal = parseFloat(r.pr_base || 0);
          // Apply the 1.2x multiplier for non-Job Order if we're falling back to base_salary
          if (r.employment_category && r.employment_category !== 'Job Order') {
            grossVal = grossVal * 1.2;
          }
          bonusVal = parseFloat(r.pr_bonus || 0);
          dedVal = parseFloat(r.pr_ded || 0);
          netVal = (grossVal / 2) + bonusVal - dedVal;
          // Note: status remains 'Draft'
        }

        return {
          id: r.ps_id || r.uid,
          uid: r.uid,
          name: r.name,
          avatarUrl: r.avatar_url,
          role: r.employment_category || 'Staff',
          gross: `₱${Number(grossVal / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          bonus: `₱${Number(bonusVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          deductions: `₱${Number(dedVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          netPay: `₱${Number(netVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          period: period,
          status: status,
          statusClass: status.toLowerCase() === 'confirmed' ? 'approved' : 'draft',
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

      res.json(list);
    } catch (err) {
      console.error('[Payslips] GET / Error:', err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  router.get('/:uid', async (req, res) => {
    const { uid } = req.params;
    const { period } = req.query;

    console.log(`DEBUG: GET /payslips/${uid}?period=${period}`);

    try {
      const periodPattern = period ? (period.includes('%') ? period : `%${period}%`) : null;

      const [rows] = await db.query(`
        SELECT ps.*, e.name, e.uid, e.employment_category
        FROM employees e
        LEFT JOIN payslips ps ON e.id = ps.employee_id AND ps.period LIKE ?
        WHERE e.uid = ?
      `, [periodPattern, uid]);

      if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
      
      const r = rows[0];

      // If we found a saved payslip (even if Draft)
      if (r.id) {
        return res.json({
          uid: r.uid,
          name: r.name,
          gross: r.gross,
          bonus: r.bonus,
          deductions: r.deductions,
          netPay: r.net_pay,
          period: r.period,
          status: r.status
        });
      }

      // If no saved payslip, we don't return "estimated" values here 
      // because usually the user wants to pull FROM a saved payslip.
      // But we could return 404 with a better message.
      res.status(404).json({ error: `No payslip record found for period ${period}` });

    } catch (err) {
      console.error('[Payslips] GET /:uid Error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.put('/:uid', async (req, res) => {
    try {
      await ensurePayslipTable();
      const { uid } = req.params;
      const {
        gross,
        bonus,
        deductions,
        period,
        confirm = false,
      } = req.body || {};

      console.log(`[Payslips] PUT /${uid} - Period: ${period}, Confirm: ${confirm}`);

      const [ers] = await db.query('SELECT id, name, employment_category FROM employees WHERE uid = ?', [uid]);
      if (ers.length === 0) {
        console.error(`[Payslips] PUT Error: Employee ${uid} not found`);
        return res.status(404).json({ error: 'Employee not found' });
      }
      
      const employee = ers[0];
      const grossN = Number(String(gross).replace(/[^\d.-]/g, '')) || 0;
      const bonusN = Number(String(bonus).replace(/[^\d.-]/g, '')) || 0;
      const dedN = Number(String(deductions).replace(/[^\d.-]/g, '')) || 0;
      const netN = (grossN / 2) + bonusN - dedN;
      const status = confirm ? 'Confirmed' : 'Draft';

      const [result] = await db.query(`
        INSERT INTO payslips (employee_id, gross, bonus, deductions, net_pay, period, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          gross = VALUES(gross),
          bonus = VALUES(bonus),
          deductions = VALUES(deductions),
          net_pay = VALUES(net_pay),
          status = VALUES(status)
      `, [employee.id, grossN, bonusN, dedN, netN, period, status]);

      console.log(`[Payslips] PUT Success: Saved payslip for ${uid} (ID: ${employee.id}) for period ${period}. Rows affected: ${result.affectedRows}`);

      res.json({
        uid,
        name: employee.name,
        gross: `₱${grossN.toLocaleString()}`,
        bonus: `₱${bonusN.toLocaleString()}`,
        deductions: `₱${dedN.toLocaleString()}`,
        netPay: `₱${netN.toLocaleString()}`,
        period,
        status,
        statusClass: confirm ? 'approved' : 'draft'
      });
    } catch (err) {
      console.error('[Payslips] PUT Error:', err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  return router;
};
