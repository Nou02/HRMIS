const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();
  const { payrollRecords } = state;

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

      if (period) {
        const periodPattern = period.includes('%') ? period : `%${period}%`;
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
      
      // Get base salary and overtime from DB
      const [[{ basePayroll, totalOvertime }]] = await db.query(`
        SELECT 
          SUM(p.base_salary / 2) as basePayroll, 
          SUM(p.overtime_amount) as totalOvertime 
        FROM employees e
        LEFT JOIN payroll_records p ON e.id = p.employee_id
        ${payrollWhereSql}
      `, payrollParams);

      // Calculate live summary if we are in a state that shows live values
      let finalBase = parseFloat(basePayroll || 0);
      let finalOT = parseFloat(totalOvertime || 0);

      if (period && (statusVal === '' || statusVal === 'All' || statusVal === 'Draft')) {
        const periodInfo = parsePeriod(period);
        if (periodInfo) {
          // Get all employees and their most recent salaries
          const [employees] = await db.query(`
            SELECT e.id, e.uid, p.base_salary, p.overtime_amount, p.deduction, p.status
            FROM employees e
            LEFT JOIN payroll_records p ON e.id = p.employee_id AND p.period LIKE ?
          `, [period]);

          // Get most recent salaries for fallback
          const [recentSalaries] = await db.query(`
            SELECT p1.employee_id, p1.base_salary, p1.deduction, p1.overtime_amount
            FROM payroll_records p1
            INNER JOIN (
              SELECT employee_id, MAX(id) as max_id
              FROM payroll_records
              GROUP BY employee_id
            ) p2 ON p1.id = p2.max_id
          `);
          const salaryMap = {};
          recentSalaries.forEach(s => {
            salaryMap[s.employee_id] = { base: s.base_salary, ded: s.deduction, otRate: s.overtime_amount };
          });

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

          // Recalculate totals based on the same logic as /records
          finalBase = 0;
          finalOT = 0;

          employees.forEach(e => {
            // Apply filters (department/q) if they exist
            // (Note: in a real app we'd do this in the SQL, but for the summary we'll just sum all for now
            // or we could refine the SQL above to include the filters)
            
            let base = e.base_salary;
            if (e.status === null || e.status === 'Draft') {
              if (!base || parseFloat(base) === 0) base = salaryMap[e.id]?.base || 0;
            }
            
            let otRate = e.overtime_amount;
            if (e.status === null || e.status === 'Draft') {
              if (!otRate || parseFloat(otRate) === 0) otRate = salaryMap[e.id]?.otRate || 0;
            }
            if (!otRate || parseFloat(otRate) === 0) otRate = globalHourlyRate;

            const calculatedOTAmount = (liveOTMap[e.id] || 0) * otRate;

            finalBase += parseFloat(base || 0) / 2;
            finalOT += calculatedOTAmount;
          });
        }
      }
      
      res.json({
        totalEmployees: totalEmployees || 0,
        basePayroll: finalBase ? `₱${Number(finalBase).toLocaleString()}` : '₱0',
        totalOvertime: finalOT ? `₱${Number(finalOT).toLocaleString()}` : '₱0',
        period: period || '—',
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

      // Also get the most recent base salary for employees who don't have a record for this period yet
      const [recentSalaries] = await db.query(`
        SELECT p1.employee_id, p1.base_salary, p1.deduction, p1.overtime_amount
        FROM payroll_records p1
        INNER JOIN (
          SELECT employee_id, MAX(id) as max_id
          FROM payroll_records
          GROUP BY employee_id
          ) p2 ON p1.id = p2.max_id
      `);
      const salaryMap = {};
      recentSalaries.forEach(s => {
        salaryMap[s.employee_id] = { base: s.base_salary, ded: s.deduction, otRate: s.overtime_amount };
      });

      // Get internal numeric IDs for employees to match with OT/Salary data
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
        const recentBase = salaryMap[internalId]?.base || 0;
        const recentDed = salaryMap[internalId]?.ded || 0;
        const recentOTRate = salaryMap[internalId]?.otRate || 0;
        
        // Determine status
        const isPreview = (r.status === null);
        const status = r.status || (isPreview ? 'Preview' : 'Draft');
        
        // Fallback to recent salary if DB value is 0 for non-finalized records
        let baseSalaryNum = parseFloat(r.baseSalary || 0);
        let deductionNum = parseFloat(r.deduction || 0);
        let overtimeRate = parseFloat(r.overtime || 0);
        
        if (status === 'Preview' || status === 'Draft') {
          if (baseSalaryNum === 0) baseSalaryNum = parseFloat(recentBase || 0);
          if (deductionNum === 0) deductionNum = parseFloat(recentDed || 0);
          if (overtimeRate === 0) overtimeRate = parseFloat(recentOTRate || 0);
        }

        // If overtimeRate is still 0, use global fallback
        if (overtimeRate === 0) overtimeRate = globalHourlyRate;

        // Calculate OT Amount: Rate * Hours
        const calculatedOTAmount = overtimeRate * liveOTHours;
        
        // Calculate netPay: 
        // If it's a finalized record (Generated/Updated), we use the stored netPay from DB.
        // If it's a Preview/Draft, we calculate it live.
        let netPayNum = parseFloat(r.netPay || 0);
        if (status === 'Preview' || status === 'Draft') {
          netPayNum = (baseSalaryNum / 2) + calculatedOTAmount - deductionNum;
        }

        return {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          avatarUrl: r.avatarUrl,
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

  router.post('/generate', async (req, res) => {
    const { period } = req.body || {};
    try {
      const [employees] = await db.query(`SELECT id, uid, name FROM employees`);
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
        const netPay = (parseFloat(baseSalary) / 2) + calculatedOTValue - parseFloat(deduction);

        const [existing] = await db.query(`SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, [emp.id, period || '']);
        
        if (existing.length === 0) {
          await db.query(`
            INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period)
            VALUES (?, ?, ?, ?, ?, 'Generated', ?)
          `, [emp.id, baseSalary, rateToStore, deduction, netPay, period || '']);
        } else {
          await db.query(`
            UPDATE payroll_records 
            SET status = 'Generated', overtime_amount = ?, net_pay = (base_salary / 2) + ? - deduction 
            WHERE employee_id = ? AND period = ?
          `, [rateToStore, calculatedOTValue, emp.id, period || '']);
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
      const [empRows] = await db.query(`SELECT id FROM employees WHERE uid = ?`, [employeeId]);
      if (empRows.length === 0) return res.status(404).json({ error: 'Employee not found' });
      const empId = empRows[0].id;

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

      const netPay = (baseN / 2) + calculatedOTAmount - dedN;

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
