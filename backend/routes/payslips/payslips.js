const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const PAYSLIP_TEMPLATE_PATH = path.resolve(__dirname, '..', '..', 'uploads', 'pay slip.xlsx');

module.exports = (state, db) => {
  const router = express.Router();

  router.get('/export-xlsx', async (req, res) => {
    const { uid, period } = req.query;
    
    if (!uid || !period) {
      return res.status(400).json({ error: 'UID and Period are required' });
    }

    try {
      const templatePath = PAYSLIP_TEMPLATE_PATH;
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

      // Keep the template labels intact and populate only value cells.
      worksheet.getCell('C3').value = period; // <MONTH/YEAR>
      worksheet.getCell('B5').value = r.name || ''; // EMPLOYEE NAME
      worksheet.getCell('B6').value = r.uid || '';  // ID NUMBER
      worksheet.getCell('B7').value = r.employment_category || ''; // POSITION

      // Earnings values (template formulas use A11 + A15 for gross pay)
      const grossNum = Number(r.gross || 0);
      const bonus = Number(r.bonus || 0);
      const deductions = Number(r.deductions || 0);
      const basicSalary = grossNum / 2;
      const premium = r.employment_category !== 'Job Order' ? (grossNum * 0.2) / 2 : 0;
      const netBeforeTax = basicSalary + premium + bonus;
      const tax2 = netBeforeTax * 0.02;
      const tax3 = netBeforeTax * 0.03;
      const totalTax = tax2 + tax3;
      const netPay = Number(r.net_pay || 0);

      worksheet.getCell('A11').value = basicSalary;  // Basic Salary amount
      worksheet.getCell('A15').value = premium + bonus; // Premium + bonus before gross total
      worksheet.getCell('C14').value = netBeforeTax; // Net Before Tax

      // Deductions values
      worksheet.getCell('C12').value = deductions; // GTECMPC Loan / general deductions
      worksheet.getCell('C16').value = tax2;       // Withholding Tax 2%
      worksheet.getCell('C17').value = tax3;       // Withholding Tax 3%
      worksheet.getCell('C19').value = totalTax;   // Total Tax Deduction
      worksheet.getCell('C21').value = netPay;     // NET PAY

      // Fetch signatories
      const [signatoryRows] = await db.query(`
        SELECT r.role_name, n.name 
        FROM signatory_roles r
        JOIN signatory_names n ON r.current_name_id = n.id
        WHERE r.role_name = 'Administrative Officer II'
      `);
      
      if (signatoryRows.length > 0) {
        const signatory = signatoryRows[0];
        const nameCell = worksheet.getCell('B27');
        const posCell = worksheet.getCell('B28');
        
        nameCell.value = signatory.name;
        posCell.value = signatory.role_name;
        
        nameCell.font = { name: 'Arial', size: 10, bold: true };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        posCell.font = { name: 'Arial', size: 10 };
        posCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Formatting
      const currencyCells = ['A11', 'A15', 'C12', 'C14', 'C16', 'C17', 'C19', 'C21'];
      currencyCells.forEach(cellAddr => {
        const cell = worksheet.getCell(cellAddr);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });

      const filename = `Payslip_${r.name.replace(/\s+/g, '_')}_${period}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
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
    const { uid } = req.params;
    const { period, gross, bonus, deductions, netPay, confirm = false } = req.body || {};

    try {
      await ensurePayslipTable();

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
