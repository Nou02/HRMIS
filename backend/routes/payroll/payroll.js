const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

module.exports = (state, db) => {
  const router = express.Router();
  const { payrollRecords } = state;

  router.get('/export-xlsx', async (req, res) => {
    const { period, department } = req.query;
    console.log(`[Payroll Export] Request for Period: ${period}, Dept: ${department}`);
    
    if (!period || !department) {
      return res.status(400).json({ error: 'Period and Department are required' });
    }

    try {
      const templatePath = path.join(__dirname, '../../uploads/Payroll.xlsx');
      if (!fs.existsSync(templatePath)) {
        console.error(`[Payroll Export] Template not found at: ${templatePath}`);
        return res.status(404).json({ error: 'Template file Payroll.xlsx not found in uploads folder' });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
      const worksheet = workbook.getWorksheet(1); 

      worksheet.getCell('C15').value = department;

      // Fill the period header (assuming Row 5, Column G based on visual)
      const periodInfo = parsePeriod(period);
      if (periodInfo) {
        const start = new Date(periodInfo.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const end = new Date(periodInfo.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        worksheet.getCell('G5').value = `${start} - ${end}`;
      }

      // Fetch employees and their payroll data
      const [rows] = await db.query(`
        SELECT 
          e.id, e.name, e.uid, e.employment_category,
          p.base_salary, p.overtime_amount as ot_rate, p.deduction, p.net_pay, p.status
        FROM employees e
        LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
        WHERE e.department_project = ?
        ORDER BY e.name ASC
      `, [`%${period}%`, department]);

      console.log(`[Payroll Export] Found ${rows.length} employees for export`);

      // Fetch signatories
      const [signatoryRows] = await db.query(`
        SELECT r.role_name, n.name 
        FROM signatory_roles r
        JOIN signatory_names n ON r.current_name_id = n.id
      `);
      const signatories = {};
      signatoryRows.forEach(s => {
        signatories[s.role_name] = s.name;
      });

      // Place signatories in the correct cells
       if (signatories['Administrative Officer II']) {
         worksheet.getCell('C29').value = signatories['Administrative Officer II'];
       }
       if (signatories['Officer-in-Charge, Region IV-A']) {
         worksheet.getCell('M29').value = signatories['Officer-in-Charge, Region IV-A'];
       }
       if (signatories['OIC- Accountant']) {
         worksheet.getCell('C36').value = signatories['OIC- Accountant'];
       }
       if (signatories['Cashier II']) {
         worksheet.getCell('M36').value = signatories['Cashier II'];
       }

      // Get global hourly rate for OT if needed
      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const globalHourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowIndex = 16 + i;
        
        // Calculate values
        const base = parseFloat(r.base_salary || 0);
        const isNotJobOrder = r.employment_category && r.employment_category !== 'Job Order';
        
        const basicPay = base / 2;
        const premium = isNotJobOrder ? (base * 0.2) / 2 : 0;
        const deduction = parseFloat(r.deduction || 0);
        
        // Get actual OT hours for this period to calculate Gross
        let otAmount = 0;
        if (periodInfo) {
          const [otRows] = await db.query(
            `SELECT COALESCE(SUM(hours), 0) as totalHours FROM overtime_entries WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [r.id, periodInfo.startDate, periodInfo.endDate]
          );
          const [tkRows] = await db.query(
            `SELECT COALESCE(SUM(total_overtime_minutes), 0) as totalOTMinutes FROM timekeeping_records WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [r.id, periodInfo.startDate, periodInfo.endDate]
          );
          const totalHours = parseFloat(otRows[0].totalHours || 0) + (parseFloat(tkRows[0].totalOTMinutes || 0) / 60);
          const otRate = parseFloat(r.ot_rate || globalHourlyRate);
          otAmount = totalHours * otRate;
        }

        const gross = basicPay + premium + otAmount;
        const tax2 = gross * 0.02;
        const tax3 = gross * 0.03;
        const taxWithheld = tax2 + tax3; // Column P
        const gtecmpc = parseFloat(r.deduction || 0); // Column Q
        // Total Deductions = sum of Column N (tax2), O (tax3), P (taxWithheld), and Q (gtecmpc)
        const totalDeductions = tax2 + tax3 + taxWithheld + gtecmpc; 
        const netPay = gross - totalDeductions;

        // Fill cells
        const cells = [
          { key: 'B', value: i + 1 }, // Serial No.
          { key: 'C', value: r.name }, // Name
          { key: 'D', value: r.employment_category }, // Position (Category)
          { key: 'E', value: r.uid },  // Employee No.
          { key: 'F', value: basicPay }, // Basic Pay
          { key: 'G', value: premium },  // 20% Premium
          { key: 'H', value: base },     // Monthly Salary
          { key: 'M', value: gross },    // Gross Amount
          { key: 'N', value: tax2 },     // Tax 2%
          { key: 'O', value: tax3 },     // Tax 3%
          { key: 'P', value: taxWithheld }, // TAX WITHHELD (N + O)
          { key: 'Q', value: gtecmpc },    // GTECMPC
          { key: 'R', value: totalDeductions }, // Total Deductions (N + O + P + Q)
          { key: 'S', value: netPay },    // Net Amount Due
        ];

         cells.forEach(cell => {
           const targetCell = worksheet.getCell(`${cell.key}${rowIndex}`);
           targetCell.value = cell.value;
           
           // Apply formatting to make it fit and look professional
           targetCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
           
           // Apply number format to currency cells
           if (['F', 'G', 'H', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'].includes(cell.key)) {
             targetCell.numFmt = '#,##0.00';
           }
           
           // Auto-shrink font if content is too long for the cell
           targetCell.font = { size: 9, name: 'Times New Roman' };
         });
       }

       // Final touches: Adjust column widths to fit content better
       // Column C (Name) and D (Position) usually need more space
       worksheet.getColumn('C').width = 25;
       worksheet.getColumn('D').width = 15;
       worksheet.getColumn('E').width = 12;
       // Salary columns (F, G, H, M, R, S)
       ['F', 'G', 'H', 'M', 'R', 'S'].forEach(col => {
         worksheet.getColumn(col).width = 14;
       });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Payroll_${department.replace(/\s+/g, '_')}_${period}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
      console.log(`[Payroll Export] Export successful for ${department}`);
    } catch (err) {
      console.error('[Payroll Export] Error:', err);
      res.status(500).json({ error: 'Failed to export Excel file', details: err.message });
    }
  });

  function parsePeriod(periodStr) {
    if (!periodStr) return null;
    const match = periodStr.match(/^P(\d)-(\d{4})-(\d{2})$/);
    if (!match) return null;
    const periodNum = parseInt(match[1]);
    const year = parseInt(match[2]);
    const month = parseInt(match[3]);
    if (periodNum === 1) {
      return { startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: `${year}-${String(month).padStart(2, '0')}-15` };
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      return { startDate: `${year}-${String(month).padStart(2, '0')}-16`, endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}` };
    }
  }

  // Auto-fix: Ensure overtime tables exist
  async function ensureOvertimeTables() {
    try {
      // Create overtime_settings
      await db.query(`
        CREATE TABLE IF NOT EXISTS overtime_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          hourly_rate DECIMAL(10,2) NOT NULL
        )
      `);
      
      const [rows] = await db.query('SELECT id, hourly_rate FROM overtime_settings WHERE id = 1');
      if (rows.length === 0) {
        await db.query('INSERT INTO overtime_settings (id, hourly_rate) VALUES (1, 0.00)');
      } else if (parseFloat(rows[0].hourly_rate) !== 0) {
        await db.query('UPDATE overtime_settings SET hourly_rate = 0.00 WHERE id = 1');
        await db.query('UPDATE payroll_records SET overtime_amount = 0.00 WHERE overtime_amount != 0');
      }

      // Create overtime_entries (required for summary calculations)
      await db.query(`
        CREATE TABLE IF NOT EXISTS overtime_entries (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          employee_id INT NOT NULL,
          date DATE NOT NULL,
          hours DECIMAL(5,2) NOT NULL DEFAULT 0,
          description VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);


    } catch (err) {
      console.error('DEBUG: Failed to ensure overtime tables:', err.message);
    }
  }
  ensureOvertimeTables();

  router.get('/summary', async (req, res) => {
    const q = (req.query.q || '').toString();
    const period = (req.query.period || '').toString();
    const department = (req.query.department || '').toString();
    const status = (req.query.status || '').toString();
    const statusVal = (status === 'undefined' || status === 'null') ? '' : status;

    try {

      const params = [];
      const whereClauses = [];

      // Determine current period for fallback
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const periodNum = now.getDate() <= 15 ? 1 : 2;
      const defaultPeriod = `P${periodNum}-${currentYear}-${currentMonth}`;
      const activePeriod = period || defaultPeriod;

      if (q) {
        const searchPattern = q.includes('%') ? q : `%${q}%`;
        whereClauses.push(`(e.uid LIKE ? OR e.name LIKE ?)`);
        params.push(searchPattern, searchPattern);
      }

      if (department && department !== 'All Departments') {
        whereClauses.push(`e.department_project = ?`);
        params.push(department);
      }

      const whereSql = whereClauses.length > 0 ? ` WHERE ` + whereClauses.join(' AND ') : '';

      // Count total employees matching search/dept (regardless of payroll record)
      const [[{ totalEmployees }]] = await db.query(`
        SELECT COUNT(DISTINCT e.id) as totalEmployees 
        FROM employees e 
        ${whereSql}
      `, params);
      
      // Calculate totals for payroll records matching the period/status
      const payrollParams = [...params];
      const payrollWhere = [...whereClauses];

      if (activePeriod) {
        const periodPattern = activePeriod.includes('%') ? activePeriod : `%${activePeriod}%`;
        payrollWhere.push(`p.period LIKE ?`);
        payrollParams.push(periodPattern);
      }

      if (statusVal && statusVal !== 'All') {
        if (statusVal === 'Draft') {
          payrollWhere.push(`(p.status = 'Draft' OR p.status IS NULL)`);
        } else {
          payrollWhere.push(`p.status = ?`);
          payrollParams.push(statusVal);
        }
      }

      const payrollWhereSql = payrollWhere.length > 0 ? ` WHERE ` + payrollWhere.join(' AND ') : '';
      
      // Calculate live summary
      let finalBase = 0;
      let finalOT = 0;

      if (activePeriod) {
        const periodInfo = parsePeriod(activePeriod);
        if (periodInfo) {
          // Get filtered employees and their payroll records for the ACTIVE period
          let employeesQuery = `
            SELECT e.id, e.uid, e.employment_category, p.base_salary, p.overtime_amount, p.deduction, p.status
            FROM employees e
            LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
          `;
          
          const summaryParams = [activePeriod ? `%${activePeriod}%` : '%'];
          
          if (whereClauses.length > 0) {
            employeesQuery += ` WHERE ` + whereClauses.join(' AND ');
            summaryParams.push(...params);
          }

          const [employees] = await db.query(employeesQuery, summaryParams);

          // Get hourly rate
          const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
          const globalHourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

          // Get live OT hours
          const [otEntries] = await db.query(
            `SELECT employee_id, SUM(hours) as totalHours 
             FROM overtime_entries 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );
          const [tkEntries] = await db.query(
            `SELECT employee_id, SUM(total_overtime_minutes) as totalMinutes 
             FROM timekeeping_records 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );

          const liveOTMap = {};
          otEntries.forEach(row => liveOTMap[row.employee_id] = (liveOTMap[row.employee_id] || 0) + parseFloat(row.totalHours || 0));
          tkEntries.forEach(row => liveOTMap[row.employee_id] = (liveOTMap[row.employee_id] || 0) + (parseFloat(row.totalMinutes || 0) / 60));

          employees.forEach(e => {
            // Respect status filter if provided
            if (statusVal && statusVal !== 'All') {
              if (statusVal === 'Draft') {
                if (e.status !== null && e.status !== 'Draft') return;
              } else {
                if (e.status !== statusVal) return;
              }
            }

            // Only use base salary if it exists for THIS period
            let base = parseFloat(e.base_salary || 0);
            
            // Overtime rate: Use record rate or global fallback
            let otRate = parseFloat(e.overtime_amount || 0);
            if (otRate === 0) otRate = globalHourlyRate;

            const calculatedOTAmount = (liveOTMap[e.id] || 0) * otRate;

            let currentBase = base;
            if (e.employment_category && e.employment_category !== 'Job Order') {
              currentBase = currentBase * 1.2;
            }

            finalBase += currentBase / 2;
            finalOT += calculatedOTAmount;
          });
        }
      }
      
      res.json({
        totalEmployees: totalEmployees || 0,
        basePayroll: finalBase ? `₱${Number(finalBase).toLocaleString()}` : '₱0',
        totalOvertime: finalOT ? `₱${Number(finalOT).toLocaleString()}` : '₱0',
        period: activePeriod,
      });
    } catch (e) {
      console.error('Payroll summary error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.get('/records', async (req, res) => {
    const q = (req.query.q || '').toString();
    const sort = (req.query.sort || '').toString();
    const period = (req.query.period || '').toString();
    const department = (req.query.department || '').toString();
    const status = (req.query.status || '').toString();
    const statusVal = (status === 'undefined' || status === 'null') ? '' : status;
    const onlyGenerated = String(req.query.only_generated || '').toLowerCase() === 'true';

    try {

      const activePeriod = period || '';
      const params = [];
      const whereClauses = [];

      if (q) {
        const searchPattern = q.includes('%') ? q : `%${q}%`;
        whereClauses.push(`(e.uid LIKE ? OR e.name LIKE ?)`);
        params.push(searchPattern, searchPattern);
      }

      if (department && department !== 'All Departments') {
        whereClauses.push(`e.department_project = ?`);
        params.push(department);
      }

      let query = `
        SELECT 
          e.id AS internalId,
          e.uid AS employeeId, 
          e.name AS employeeName, 
          e.avatar_url AS avatarUrl, 
          e.employment_category AS employmentCategory,
          e.department_project AS departmentProject
        FROM employees e
      `;

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }

      if (sort === 'name_asc') {
        query += ` ORDER BY e.name ASC`;
      } else {
        query += ` ORDER BY e.id DESC`;
      }

      const [employees] = await db.query(query, params);

      // Fetch payroll records for this period
      const [payrollRows] = await db.query(
        `SELECT * FROM payroll_records WHERE period LIKE ?`,
        [activePeriod ? `%${activePeriod}%` : '%']
      );
      const payrollMap = {};
      payrollRows.forEach(p => {
        payrollMap[p.employee_id] = p;
      });

      // Filter by status if needed
      let filteredEmployees = employees;
      if (statusVal && statusVal !== 'All') {
        filteredEmployees = employees.filter(e => {
          const p = payrollMap[e.internalId];
          const s = p ? p.status : 'Draft';
          if (statusVal === 'Draft') return s === 'Draft' || !p;
          return s === statusVal;
        });
      }

      if (onlyGenerated) {
        filteredEmployees = filteredEmployees.filter(e => {
          const p = payrollMap[e.internalId];
          return p && p.status === 'Generated';
        });
      }

      // Fetch historical fallbacks
      let historicalFallbacks = {};
      if (activePeriod) {
        const [fallbackRows] = await db.query(`
          SELECT p1.employee_id, p1.base_salary, p1.overtime_amount, p1.overtime_hours, p1.deduction
          FROM payroll_records p1
          INNER JOIN (
            SELECT employee_id, MAX(id) as max_id
            FROM payroll_records
            WHERE period NOT LIKE ? AND (base_salary > 0 OR overtime_amount > 0 OR deduction > 0)
            GROUP BY employee_id
          ) p2 ON p1.id = p2.max_id
        `, [activePeriod ? `%${activePeriod}%` : '']);
        fallbackRows.forEach(f => {
          historicalFallbacks[f.employee_id] = f;
        });
      }

      // Fetch live overtime
      let estimatedOT = {};
      if (activePeriod) {
        const periodInfo = parsePeriod(activePeriod);
        if (periodInfo) {
          const [otEntries] = await db.query(
            `SELECT employee_id, SUM(hours) as totalHours 
             FROM overtime_entries 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );
          const [tkEntries] = await db.query(
            `SELECT employee_id, SUM(total_overtime_minutes) as totalMinutes 
             FROM timekeeping_records 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );

          otEntries.forEach(row => {
            estimatedOT[row.employee_id] = (estimatedOT[row.employee_id] || 0) + parseFloat(row.totalHours || 0);
          });
          tkEntries.forEach(row => {
            estimatedOT[row.employee_id] = (estimatedOT[row.employee_id] || 0) + (parseFloat(row.totalMinutes || 0) / 60);
          });
        }
      }

      const [globalRateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const globalHourlyRate = parseFloat(globalRateRows[0]?.hourly_rate || 0);

      const list = filteredEmployees.map(e => {
        const empId = e.internalId;
        const r = payrollMap[empId] || {};
        const liveOTHours = estimatedOT[empId] || 0;
        const fallback = historicalFallbacks[empId] || {};
        
        const isTruePreview = !r.id;
        const status = r.status || (isTruePreview ? 'Preview' : 'Draft');

        let baseSalaryNum = r.base_salary !== undefined && r.base_salary !== null ? parseFloat(r.base_salary) : 0;
        if (isTruePreview && baseSalaryNum === 0) baseSalaryNum = parseFloat(fallback.base_salary || 0);

        let deductionNum = r.deduction !== undefined && r.deduction !== null ? parseFloat(r.deduction) : 0;
        if (isTruePreview && deductionNum === 0) deductionNum = parseFloat(fallback.deduction || 0);

        let overtimeRate = r.overtime_amount !== undefined && r.overtime_amount !== null ? parseFloat(r.overtime_amount) : 0;
        if (isTruePreview && overtimeRate === 0) {
          overtimeRate = globalHourlyRate;
        }

        let actualOTHours = r.overtime_hours !== undefined && r.overtime_hours !== null ? parseFloat(r.overtime_hours) : 0;
        if (isTruePreview && actualOTHours === 0) actualOTHours = parseFloat(fallback.overtime_hours || 0);
        if (actualOTHours === 0 && (status === 'Preview' || status === 'Draft')) {
          actualOTHours = liveOTHours;
        }
        
        const calculatedOTAmount = overtimeRate * actualOTHours;
        
        let netPayNum = parseFloat(r.net_pay || 0);
        if (netPayNum === 0 || status === 'Preview' || status === 'Draft') {
          let currentBase = baseSalaryNum;
          if (e.employmentCategory && e.employmentCategory !== 'Job Order') {
            currentBase = currentBase * 1.2;
          }
          netPayNum = (currentBase / 2) + calculatedOTAmount - deductionNum;
        }

        return {
          employeeId: e.employeeId,
          employeeName: e.employeeName,
          avatarUrl: e.avatarUrl,
          employmentCategory: e.employmentCategory,
          departmentProject: e.departmentProject || 'Unassigned',
          baseSalary: baseSalaryNum.toFixed(2),
          overtime: overtimeRate.toFixed(2),
          overtimeHours: actualOTHours,
          overtimeAmount: calculatedOTAmount,
          deduction: deductionNum.toFixed(2),
          netPay: netPayNum.toFixed(2),
          status: status + (status === 'Draft' || status === 'Preview' ? ' (NEW)' : ''),
          statusClass: status.toLowerCase() === 'generated' ? 'approved' : (status.toLowerCase() === 'preview' ? 'preview' : 'draft'),
          period: r.period || activePeriod,
        };
      });

      res.json(list);
    } catch (e) {
      console.error('Payroll records error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.get('/records/:employeeId', async (req, res) => {
    const { employeeId } = req.params; // This is the UID
    const { period } = req.query;

    try {

      const periodPattern = period ? (period.includes('%') ? period : `%${period}%`) : null;
      
      // 1. Try to find a persisted record first
      let query = `
        SELECT p.*, e.id as internal_id, e.name, e.uid, e.employment_category
        FROM employees e
        LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
        WHERE e.uid = ?
      `;
      const [rows] = await db.query(query, [periodPattern, employeeId]);

      if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
      
      const r = rows[0];
      const dbStatus = r.status ? String(r.status) : null;
      
      // If we found a persisted record for this period in the database
      if (r.id) {
        // Calculate overtime amount if possible
        let otAmount = 0;
        const periodInfo = parsePeriod(r.period);
        const rateToUse = parseFloat(r.overtime_amount || 0);
        const hoursToUse = parseFloat(r.overtime_hours || 0);

        if (periodInfo) {
          const [otRows] = await db.query(
            `SELECT COALESCE(SUM(hours), 0) as totalHours 
             FROM overtime_entries 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [r.internal_id, periodInfo.startDate, periodInfo.endDate]
          );
          const [tkRows] = await db.query(
            `SELECT COALESCE(SUM(total_overtime_minutes), 0) as totalOTMinutes 
             FROM timekeeping_records 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [r.internal_id, periodInfo.startDate, periodInfo.endDate]
          );
          
          // Use stored hours if non-zero, otherwise live hours
          let totalHours = hoursToUse;
          if (totalHours === 0) {
             totalHours = parseFloat(otRows[0].totalHours || 0) + (parseFloat(tkRows[0].totalOTMinutes || 0) / 60);
          }
          otAmount = totalHours * rateToUse;
        }

        return res.json({
          employeeId: r.uid,
          employeeName: r.name,
          baseSalary: r.base_salary,
          overtime: r.overtime_amount,
          overtimeHours: r.overtime_hours,
          overtimeAmount: otAmount,
          deduction: r.deduction,
          netPay: r.net_pay,
          status: dbStatus,
          period: r.period
        });
      }

      // 2. If no persisted record, return "Preview" data with fallback to recent values
      const internalId = r.internal_id;
      
      // Get global rate for OT fallback only
      const [globalRateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const globalHourlyRate = parseFloat(globalRateRows[0]?.hourly_rate || 0);

      // Fetch fallback values from most recent record NOT in current period
      const [fallbackRows] = await db.query(
        `SELECT base_salary, deduction, overtime_amount 
         FROM payroll_records 
         WHERE employee_id = ? AND period != ? 
         ORDER BY created_at DESC LIMIT 1`,
        [internalId, period || '']
      );

      const f = fallbackRows[0] || {};
      let baseSalaryNum = parseFloat(f.base_salary || 0);
      let deductionNum = parseFloat(f.deduction || 0);
      let overtimeRate = parseFloat(f.overtime_amount || globalHourlyRate);

      let estimatedOTAmount = 0;
      // Calculate live OT hours if period is provided
      if (period) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          const [otRows] = await db.query(
            `SELECT COALESCE(SUM(hours), 0) as totalHours 
             FROM overtime_entries 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [internalId, periodInfo.startDate, periodInfo.endDate]
          );
          const [tkRows] = await db.query(
            `SELECT COALESCE(SUM(total_overtime_minutes), 0) as totalOTMinutes 
             FROM timekeeping_records 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [internalId, periodInfo.startDate, periodInfo.endDate]
          );
          const liveOTHours = parseFloat(otRows[0].totalHours || 0) + (parseFloat(tkRows[0].totalOTMinutes || 0) / 60);
          estimatedOTAmount = liveOTHours * overtimeRate;
        }
      }

      let currentBase = baseSalaryNum;
      if (r.employment_category && r.employment_category !== 'Job Order') {
        currentBase = currentBase * 1.2;
      }
      const netPayNum = (currentBase / 2) + estimatedOTAmount - deductionNum;

      res.json({
        employeeId: r.uid,
        employeeName: r.name,
        baseSalary: baseSalaryNum,
        overtime: overtimeRate,
        overtimeAmount: estimatedOTAmount,
        deduction: deductionNum,
        netPay: netPayNum,
        status: 'Preview',
        period: period
      });

    } catch (err) {
      console.error('Payroll single record error:', err);
      res.status(500).json({ error: 'db_error' });
    }
  });

  router.post('/generate', async (req, res) => {
    const { period } = req.body || {};
    try {
      const [employees] = await db.query(`SELECT id, uid, name, employment_category FROM employees`);
      const periodInfo = parsePeriod(period);
      
      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 0);

      // Get most recent salaries to pre-fill generated records
      const [recentSalaries] = await db.query(`
        SELECT p1.employee_id, p1.base_salary, p1.deduction
        FROM payroll_records p1
        INNER JOIN (
          SELECT employee_id, MAX(id) as max_id
          FROM payroll_records
          GROUP BY employee_id
        ) p2 ON p1.id = p2.max_id
      `);
      const salaryMap = {};
      recentSalaries.forEach(s => {
        salaryMap[s.employee_id] = { base: s.base_salary, ded: s.deduction };
      });

      for (const emp of employees) {
        let totalHours = 0;
        if (periodInfo) {
          // Get hours from manual overtime entries
          const [otRows] = await db.query(
            `SELECT COALESCE(SUM(hours), 0) as totalHours 
             FROM overtime_entries 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [emp.id, periodInfo.startDate, periodInfo.endDate]
          );
          
          // Get hours from timekeeping records (stored as minutes)
          const [tkRows] = await db.query(
            `SELECT COALESCE(SUM(total_overtime_minutes), 0) as totalOTMinutes 
             FROM timekeeping_records 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [emp.id, periodInfo.startDate, periodInfo.endDate]
          );

          const manualHours = parseFloat(otRows[0].totalHours || 0);
          const tkHours = parseFloat(tkRows[0].totalOTMinutes || 0) / 60;
          totalHours = manualHours + tkHours;
        }
        
        // Use the rate instead of the amount for the overtime_amount column
        const rateToStore = hourlyRate;

        // Fetch the most recent base salary, deduction, and overtime rate for this employee
        // EXCLUDING the current period to avoid self-referencing 0s
        const [recentRecords] = await db.query(
          `SELECT base_salary, deduction, overtime_amount 
           FROM payroll_records 
           WHERE employee_id = ? AND period != ? 
           ORDER BY created_at DESC LIMIT 1`, 
          [emp.id, period || '']
        );
        
        const baseSalary = recentRecords.length > 0 ? recentRecords[0].base_salary : 0;
        const deduction = recentRecords.length > 0 ? recentRecords[0].deduction : 0;
        // Default to global hourly rate (which is now 0)
        const previousRate = hourlyRate; 
        const previousHours = recentRecords.length > 0 ? recentRecords[0].overtime_hours : 0;

        let currentBase = parseFloat(baseSalary || 0);
        if (emp.employment_category && emp.employment_category !== 'Job Order') {
          currentBase = currentBase * 1.2;
        }

        // Use live hours if they exist, otherwise use previous period's hours
        const finalHours = totalHours > 0 ? totalHours : previousHours;
        const calculatedOTValue = finalHours * previousRate;
        const netPay = (currentBase / 2) + calculatedOTValue - parseFloat(deduction);

        const [existing] = await db.query(`SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, [emp.id, period || '']);
        
        if (existing.length === 0) {
          await db.query(`
            INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, overtime_hours, deduction, net_pay, status, period)
            VALUES (?, ?, ?, ?, ?, ?, 'Generated', ?)
          `, [emp.id, baseSalary, previousRate, finalHours, deduction, netPay, period || '']);
        } else {
          // Update existing record: 
          // Only RE-FILL values if they are currently 0 AND the status is NOT 'Updated'
          // We also use a more precise check for 0 to ensure manual 0.00 is preserved
          await db.query(`
            UPDATE payroll_records 
            SET status = 'Generated', 
                base_salary = CASE WHEN status != 'Updated' AND (base_salary IS NULL OR base_salary = 0) THEN ? ELSE base_salary END,
                deduction = CASE WHEN status != 'Updated' AND (deduction IS NULL OR deduction = 0) THEN ? ELSE deduction END,
                overtime_amount = CASE WHEN status != 'Updated' AND (overtime_amount IS NULL OR overtime_amount = 0) THEN ? ELSE overtime_amount END,
                overtime_hours = CASE WHEN status != 'Updated' AND (overtime_hours IS NULL OR overtime_hours = 0) THEN ? ELSE overtime_hours END, 
                net_pay = (
                  CASE 
                    WHEN ? != 'Job Order' THEN (CASE WHEN status != 'Updated' AND (base_salary IS NULL OR base_salary = 0) THEN ? ELSE base_salary END * 1.2) / 2
                    ELSE (CASE WHEN status != 'Updated' AND (base_salary IS NULL OR base_salary = 0) THEN ? ELSE base_salary END) / 2
                  END
                ) + (
                  CASE 
                    WHEN status != 'Updated' AND (overtime_hours IS NULL OR overtime_hours = 0) THEN ? 
                    ELSE overtime_hours 
                  END * 
                  CASE 
                    WHEN status != 'Updated' AND (overtime_amount IS NULL OR overtime_amount = 0) THEN ? 
                    ELSE overtime_amount 
                  END
                ) - (CASE WHEN status != 'Updated' AND (deduction IS NULL OR deduction = 0) THEN ? ELSE deduction END)
            WHERE employee_id = ? AND period = ?
          `, [
            baseSalary, deduction, previousRate, finalHours,
            emp.employment_category, baseSalary, baseSalary, 
            finalHours, previousRate, deduction,
            emp.id, period || ''
          ]);
        }
      }
      
      res.json({ ok: true, count: employees.length });
    } catch (e) {
      console.error('Payroll generate error:', e);
      res.status(500).json({ ok: false, error: 'db_error' });
    }
  });

  router.put('/records/:employeeId', async (req, res) => {
    const { employeeId } = req.params; // This is the UID
    const {
      baseSalary,
      overtime,
      overtimeHours,
      deduction,
      status = 'Updated',
      period,
    } = req.body || {};

    console.log(`[Payroll Update] UID: ${employeeId}, Period: ${period}, Data:`, { baseSalary, overtime, overtimeHours, deduction, status });

    try {
      // Get numeric ID from UID
      const [empRows] = await db.query(`SELECT id, employment_category FROM employees WHERE uid = ?`, [employeeId]);
      if (empRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      const empId = empRows[0].id;
      const empCategory = empRows[0].employment_category;

      const baseN = Number(String(baseSalary || 0).replace(/[^\d.-]/g, '')) || 0;
      const otRateN = Number(String(overtime || 0).replace(/[^\d.-]/g, '')) || 0;
      const otHoursN = Number(String(overtimeHours || 0).replace(/[^\d.-]/g, '')) || 0;
      const dedN = Number(String(deduction || 0).replace(/[^\d.-]/g, '')) || 0;

      // Calculate overtime amount using either manual override or database total
      let calculatedOTAmount = otRateN * otHoursN;
      
      // Fallback to timekeeping logic only if no manual hours provided (optional, but manual takes priority now)
      if (!overtimeHours && overtimeHours !== 0) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          const [otRows] = await db.query(
            `SELECT COALESCE(SUM(hours), 0) as totalHours 
             FROM overtime_entries 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [empId, periodInfo.startDate, periodInfo.endDate]
          );
          const [tkRows] = await db.query(
            `SELECT COALESCE(SUM(total_overtime_minutes), 0) as totalOTMinutes 
             FROM timekeeping_records 
             WHERE employee_id = ? AND date >= ? AND date <= ?`,
            [empId, periodInfo.startDate, periodInfo.endDate]
          );
          const totalHours = parseFloat(otRows[0].totalHours || 0) + (parseFloat(tkRows[0].totalOTMinutes || 0) / 60);
          calculatedOTAmount = totalHours * otRateN;
        }
      }

      let currentBase = baseN;
      if (empCategory && empCategory !== 'Job Order') {
        currentBase = currentBase * 1.2;
      }

      const netPay = (currentBase / 2) + calculatedOTAmount - dedN;

      // Upsert into payroll_records for the specific period
      const [existing] = await db.query(
        `SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, 
        [empId, period || '']
      );
      
      if (existing.length === 0) {
        const [result] = await db.query(`
          INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, overtime_hours, deduction, net_pay, status, period)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [empId, baseN, otRateN, otHoursN, dedN, netPay, status, period || '']);
      } else {
        const [result] = await db.query(`
          UPDATE payroll_records 
          SET base_salary = ?, overtime_amount = ?, overtime_hours = ?, deduction = ?, net_pay = ?, status = ?
          WHERE employee_id = ? AND period = ?
        `, [baseN, otRateN, otHoursN, dedN, netPay, status, empId, period || '']);
      }


      res.json({
        ok: true,
        employeeId,
        baseSalary: baseN,
        overtime: otRateN,
        deduction: dedN,
        netPay: netPay,
        status,
        period: period || '',
      });
    } catch (e) {
      console.error('[Payroll Update] Error:', e);
      res.status(500).json({ error: 'Database update failed', details: e.message });
    }
  });

  return router;
};
