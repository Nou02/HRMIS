const express = require('express');

module.exports = (state, db) => {
  const router = express.Router();
  const { payrollRecords } = state;

  router.get('/summary', async (req, res) => {
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
      
      const [[{ basePayroll, totalOvertime }]] = await db.query(`
        SELECT 
          SUM(p.base_salary) as basePayroll, 
          SUM(p.overtime_amount) as totalOvertime 
        FROM employees e
        LEFT JOIN payroll_records p ON e.id = p.employee_id
        ${payrollWhereSql}
      `, payrollParams);
      
      res.json({
        totalEmployees: totalEmployees || 0,
        basePayroll: basePayroll ? `₱${Number(basePayroll).toLocaleString()}` : '₱0',
        totalOvertime: totalOvertime ? `₱${Number(totalOvertime).toLocaleString()}` : '₱0',
        period: period || '—',
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
          (p.base_salary - p.deduction) AS netPay,
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
            (p.base_salary - p.deduction) AS netPay,
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

      const list = rows.map(r => ({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        avatarUrl: r.avatarUrl,
        baseSalary: r.baseSalary ? `₱${Number(r.baseSalary).toLocaleString()}` : '-',
        overtime: r.overtime ? `₱${Number(r.overtime).toLocaleString()}` : '-',
        deduction: r.deduction ? `₱${Number(r.deduction).toLocaleString()}` : '-',
        netPay: r.netPay ? `₱${Number(r.netPay).toLocaleString()}` : '-',
        status: r.status || 'Draft',
        statusClass: (r.status || 'Draft').toLowerCase() === 'generated' ? 'approved' : 'draft',
      }));

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
      
      for (const emp of employees) {
        const [existing] = await db.query(`SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, [emp.id, period || '']);
        
        if (existing.length === 0) {
          await db.query(`
            INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period)
            VALUES (?, 0, 0, 0, 0, 'Generated', ?)
          `, [emp.id, period || '']);
        } else {
          await db.query(`
            UPDATE payroll_records SET status = 'Generated' WHERE employee_id = ? AND period = ?
          `, [emp.id, period || '']);
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
      const otN = Number(String(overtime || 0).replace(/[^\d.-]/g, '')) || 0;
      const dedN = Number(String(deduction || 0).replace(/[^\d.-]/g, '')) || 0;
      const netPay = baseN - dedN;

      // Upsert into payroll_records for the specific period
      const [existing] = await db.query(
        `SELECT id FROM payroll_records WHERE employee_id = ? AND period = ?`, 
        [empId, period || '']
      );
      
      if (existing.length === 0) {
        await db.query(`
          INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [empId, baseN, otN, dedN, netPay, status, period || '']);
      } else {
        await db.query(`
          UPDATE payroll_records 
          SET base_salary = ?, overtime_amount = ?, deduction = ?, net_pay = ?, status = ?
          WHERE employee_id = ? AND period = ?
        `, [baseN, otN, dedN, netPay, status, empId, period || '']);
      }

      res.json({
        employeeId,
        baseSalary: `₱${baseN.toLocaleString()}`,
        overtime: `₱${otN.toLocaleString()}`,
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
