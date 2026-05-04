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

      // Get global hourly rate for OT if needed
      const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const globalHourlyRate = parseFloat(rateRows[0]?.hourly_rate || 200);

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
        const netPay = gross - deduction;

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
           { key: 'R', value: deduction }, // Total Deductions
           { key: 'S', value: netPay },    // Net Amount Due
         ];

         cells.forEach(cell => {
           const targetCell = worksheet.getCell(`${cell.key}${rowIndex}`);
           targetCell.value = cell.value;
           
           // Apply formatting to make it fit and look professional
           targetCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
           
           // Apply number format to currency cells
           if (['F', 'G', 'H', 'M', 'R', 'S'].includes(cell.key)) {
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
      
      // Seed default rate if missing
      const [rows] = await db.query('SELECT id FROM overtime_settings WHERE id = 1');
      if (rows.length === 0) {
        await db.query('INSERT INTO overtime_settings (id, hourly_rate) VALUES (1, 200.00)');
        console.log('DEBUG: Created default overtime settings (₱200/hr)');
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
      console.log('DEBUG: Ensured overtime_entries table exists');

    } catch (err) {
      console.error('DEBUG: Failed to ensure overtime tables:', err.message);
    }
  }
  ensureOvertimeTables();

  router.get('/summary', async (req, res) => {
    console.log('-------------------------------------------');
    console.log('DEBUG: GET /summary called');
    console.log('DEBUG: Query Params:', req.query);
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
          // Get all employees and their payroll records for the ACTIVE period only
          const [employees] = await db.query(`
            SELECT e.id, e.uid, e.employment_category, p.base_salary, p.overtime_amount, p.deduction, p.status
            FROM employees e
            LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
          `, [activePeriod]);

          // Get hourly rate
          const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
          const globalHourlyRate = parseFloat(rateRows[0]?.hourly_rate || 200);

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
    console.log('-------------------------------------------');
    console.log('DEBUG: GET /records called');
    console.log('DEBUG: Query Params:', req.query);
    const q = (req.query.q || '').toString();
    const sort = (req.query.sort || '').toString();
    const period = (req.query.period || '').toString();
    const department = (req.query.department || '').toString();
    const status = (req.query.status || '').toString();
    const statusVal = (status === 'undefined' || status === 'null') ? '' : status;
    const onlyGenerated = String(req.query.only_generated || '').toLowerCase() === 'true';

    try {
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

      // If we have a period filter, we only want to see records for that period.
      // However, we want to see ALL employees.
      // So we move period filtering to the JOIN or handle NULLs.
      
      let query = `
        SELECT 
          e.uid AS employeeId, 
          e.name AS employeeName, 
          e.avatar_url AS avatarUrl,
          e.employment_category AS employmentCategory,
          e.department_project AS departmentProject,
          p.base_salary AS baseSalary,
          p.overtime_amount AS overtime,
          p.deduction AS deduction,
          p.net_pay AS netPay,
          p.status AS status,
          p.period AS period
        FROM employees e
        LEFT JOIN (
          SELECT p1.*
          FROM payroll_records p1
          INNER JOIN (
            SELECT employee_id, MAX(id) as max_id
            FROM payroll_records
            GROUP BY employee_id
          ) p2 ON p1.id = p2.max_id
        ) p ON e.id = p.employee_id
      `;

      if (period) {
        const periodPattern = period.includes('%') ? period : `%${period}%`;
        // Move period to the JOIN for records to avoid duplicates and show everyone
        query = `
          SELECT 
            e.uid AS employeeId, 
            e.name AS employeeName, 
            e.avatar_url AS avatarUrl, 
            e.employment_category AS employmentCategory,
            e.department_project AS departmentProject,
            p.base_salary AS baseSalary,
            p.overtime_amount AS overtime,
            p.deduction AS deduction,
            p.net_pay AS netPay,
            p.status AS status,
            p.period AS period
          FROM employees e
          LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
        `;
        params.unshift(periodPattern); // Add period as first param
      }

      if (statusVal && statusVal !== 'All') {
        if (statusVal === 'Draft') {
          whereClauses.push(`(p.status = 'Draft' OR p.status IS NULL)`);
        } else {
          whereClauses.push(`p.status = ?`);
          params.push(statusVal);
        }
      }

      if (onlyGenerated) {
        whereClauses.push(`p.status = 'Generated'`);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }

      if (sort === 'name_asc') {
        query += ` ORDER BY e.name ASC`;
      } else {
        query += ` ORDER BY e.id DESC`;
      }

      const [rows] = await db.query(query, params);

      // If period is provided, fetch on-the-fly overtime calculations for preview
      let estimatedOT = {};
      if (period) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          const [rateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
          const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 200);

          // Get manual OT entries for the period
          const [otEntries] = await db.query(
            `SELECT employee_id, SUM(hours) as totalHours 
             FROM overtime_entries 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );

          // Get timekeeping OT for the period
          const [tkEntries] = await db.query(
            `SELECT employee_id, SUM(total_overtime_minutes) as totalMinutes 
             FROM timekeeping_records 
             WHERE date >= ? AND date <= ? 
             GROUP BY employee_id`,
            [periodInfo.startDate, periodInfo.endDate]
          );

          otEntries.forEach(row => {
            const empId = row.employee_id;
            estimatedOT[empId] = (estimatedOT[empId] || 0) + parseFloat(row.totalHours || 0);
          });
          tkEntries.forEach(row => {
            const empId = row.employee_id;
            estimatedOT[empId] = (estimatedOT[empId] || 0) + (parseFloat(row.totalMinutes || 0) / 60);
          });

          // Store hours instead of multiplying by global rate yet
          // (We will use per-employee rate if available)
        }
      }

      // Get internal numeric IDs for employees to match with OT data
      const [empIdMapRows] = await db.query('SELECT id, uid FROM employees');
      const uidToId = {};
      empIdMapRows.forEach(e => {
        uidToId[e.uid] = e.id;
      });

      const [globalRateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      const globalHourlyRate = parseFloat(globalRateRows[0]?.hourly_rate || 200);

      const list = rows.map(r => {
        const internalId = uidToId[r.employeeId];
        const liveOTHours = estimatedOT[internalId] || 0;
        
        // Determine status
        const isPreview = (r.status === null);
        const status = r.status || (isPreview ? 'Preview' : 'Draft');
        
        // Use database values or 0 for preview (removed automatic fallback)
        let baseSalaryNum = parseFloat(r.baseSalary || 0);
        let deductionNum = parseFloat(r.deduction || 0);
        let overtimeRate = parseFloat(r.overtime || 0);
        
        // If overtimeRate is still 0, use global fallback for OT rate only
        if (overtimeRate === 0) overtimeRate = globalHourlyRate;

        // Calculate OT Amount: Rate * Hours
        const calculatedOTAmount = overtimeRate * liveOTHours;
        
        // Calculate netPay: 
        // If it's a finalized record (Generated/Updated), we use the stored netPay from DB.
        // If it's a Preview/Draft, we calculate it live.
        let netPayNum = parseFloat(r.netPay || 0);
        if (status === 'Preview' || status === 'Draft') {
          let currentBase = baseSalaryNum;
          if (r.employmentCategory && r.employmentCategory !== 'Job Order') {
            currentBase = currentBase * 1.2;
          }
          netPayNum = (currentBase / 2) + calculatedOTAmount - deductionNum;
        }

        return {
          employeeId: r.employeeId || r.uid,
          employeeName: r.employeeName || r.name,
          avatarUrl: r.avatarUrl,
          employmentCategory: r.employmentCategory || r.employment_category,
          departmentProject: r.departmentProject || r.department_project || r.departmentproject || 'Unassigned',
          baseSalary: baseSalaryNum ? `₱${Number(baseSalaryNum).toLocaleString()}` : '-',
          overtime: overtimeRate ? `₱${Number(overtimeRate).toLocaleString()}` : '-',
          overtimeHours: liveOTHours,
          overtimeAmount: calculatedOTAmount,
          deduction: deductionNum ? `₱${Number(deductionNum).toLocaleString()}` : '-',
          netPay: netPayNum ? `₱${Number(netPayNum).toLocaleString()}` : '-',
          status: status + (status === 'Draft' || status === 'Preview' ? ' (NEW)' : ''),
          statusClass: status.toLowerCase() === 'generated' ? 'approved' : (status.toLowerCase() === 'preview' ? 'preview' : 'draft'),
          period: r.period || period,
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

    console.log(`DEBUG: GET /records/${employeeId}?period=${period}`);

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
      
      // If we found a persisted record for this period
      if (r.id) {
        // Calculate overtime amount if possible
        let otAmount = 0;
        const periodInfo = parsePeriod(r.period);
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
          const totalHours = parseFloat(otRows[0].totalHours || 0) + (parseFloat(tkRows[0].totalOTMinutes || 0) / 60);
          otAmount = totalHours * parseFloat(r.overtime_amount || 0);
        }

        return res.json({
          employeeId: r.uid,
          employeeName: r.name,
          baseSalary: r.base_salary,
          overtime: r.overtime_amount,
          overtimeAmount: otAmount,
          deduction: r.deduction,
          netPay: r.net_pay,
          status: r.status,
          period: r.period
        });
      }

      // 2. If no persisted record, return "Preview" data with empty/zero values for new periods
      // (Removed automatic fallback to recent salaries as per user request)
      const internalId = r.internal_id;
      let estimatedOTAmount = 0;
      let baseSalaryNum = 0;
      let deductionNum = 0;
      let overtimeRate = 0;

      // Get global rate for OT fallback only
      const [globalRateRows] = await db.query('SELECT hourly_rate FROM overtime_settings WHERE id = 1');
      overtimeRate = parseFloat(globalRateRows[0]?.hourly_rate || 200);

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
      const hourlyRate = parseFloat(rateRows[0]?.hourly_rate || 200);

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
        const calculatedOTValue = totalHours * rateToStore;

        const recent = salaryMap[emp.id] || { base: 0, ded: 0 };
        const baseSalary = recent.base;
        const deduction = recent.ded;

        let currentBase = parseFloat(baseSalary || 0);
        if (emp.employment_category && emp.employment_category !== 'Job Order') {
          currentBase = currentBase * 1.2;
        }

        const netPay = (currentBase / 2) + calculatedOTValue - parseFloat(deduction);

        const [existing] = await db.query(`SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, [emp.id, period || '']);
        
        if (existing.length === 0) {
          await db.query(`
            INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period)
            VALUES (?, ?, ?, ?, ?, 'Generated', ?)
          `, [emp.id, baseSalary, rateToStore, deduction, netPay, period || '']);
        } else {
          await db.query(`
            UPDATE payroll_records 
            SET status = 'Generated', overtime_amount = ?, net_pay = (
              CASE 
                WHEN ? != 'Job Order' THEN (base_salary * 1.2) / 2
                ELSE base_salary / 2
              END
            ) + ? - deduction 
            WHERE employee_id = ? AND period = ?
          `, [rateToStore, emp.employment_category, calculatedOTValue, emp.id, period || '']);
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
      deduction,
      status = 'Updated',
      period,
    } = req.body || {};

    try {
      // Get numeric ID from UID
      const [empRows] = await db.query(`SELECT id, employment_category FROM employees WHERE uid = ?`, [employeeId]);
      if (empRows.length === 0) return res.status(404).json({ error: 'Employee not found' });
      const empId = empRows[0].id;
      const empCategory = empRows[0].employment_category;

      const baseN = Number(String(baseSalary || 0).replace(/[^\d.-]/g, '')) || 0;
      const otRateN = Number(String(overtime || 0).replace(/[^\d.-]/g, '')) || 0;
      const dedN = Number(String(deduction || 0).replace(/[^\d.-]/g, '')) || 0;

      // To calculate correct netPay, we need to know the overtime hours for this period
      let calculatedOTAmount = 0;
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
        await db.query(`
          INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [empId, baseN, otRateN, dedN, netPay, status, period || '']);
      } else {
        await db.query(`
          UPDATE payroll_records 
          SET base_salary = ?, overtime_amount = ?, deduction = ?, net_pay = ?, status = ?
          WHERE employee_id = ? AND period = ?
        `, [baseN, otRateN, dedN, netPay, status, empId, period || '']);
      }

      res.json({
        employeeId,
        baseSalary: `₱${baseN.toLocaleString()}`,
        overtime: `₱${otRateN.toLocaleString()}`,
        deduction: `₱${dedN.toLocaleString()}`,
        netPay: `₱${netPay.toLocaleString()}`,
        status,
        period: period || '',
      });
    } catch (e) {
      console.error('Payroll update error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  });

  return router;
};
