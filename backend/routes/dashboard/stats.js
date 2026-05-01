const express = require('express');
module.exports = (db) => {
  const router = express.Router();
  router.get('/', async (_req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          SUM(CASE WHEN employment_category='Job Order' THEN 1 ELSE 0 END) AS jobOrderCount,
          SUM(CASE WHEN employment_category='Regular Employees' THEN 1 ELSE 0 END) AS regularEmployeeCount,
          SUM(CASE WHEN employment_category='Admin' THEN 1 ELSE 0 END) AS adminCount,
          COUNT(*) AS totalEmployees
        FROM employees
      `);
      res.json(rows[0] || {});
    } catch (_e) {
      res.json({ jobOrderCount: 0, regularEmployeeCount: 0, adminCount: 0, totalEmployees: 0 });
    }
  });
  return router;
};
