const express = require('express');

module.exports = (state) => {
  const router = express.Router();
  router.get('/', (_req, res) => {
    const { employees } = state;
    const jobOrderCount = employees.filter((e) => e.employmentCategory === 'Job Order').length;
    const regularEmployeeCount = employees.filter((e) => e.employmentCategory === 'Regular Employees').length;
    const technicalOpsDivisions = employees.filter((e) => e.employmentCategory === 'Technical Operations Divisions').length;
    const adminCount = employees.filter((e) => e.employmentCategory === 'Admin').length;
    const totalEmployees = employees.length;
    res.json({
      jobOrderCount,
      regularEmployeeCount,
      technicalOpsDivisions,
      adminCount,
      totalEmployees,
    });
  });
  return router;
};
