const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const employeesFile = path.join(dataDir, 'employees.json');

let employees = [];
try {
  if (fs.existsSync(employeesFile)) {
    const raw = fs.readFileSync(employeesFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) employees = parsed;
  }
} catch (_e) {
  employees = [];
}
function saveEmployees() {
  try {
    fs.writeFileSync(employeesFile, JSON.stringify(employees, null, 2));
  } catch (_e) {}
}

const applications = [];
const payrollRecords = [];
const payslips = [];
const timekeepingRecords = [];
const gatepasses = [];

module.exports = {
  employees,
  saveEmployees,
  applications,
  payrollRecords,
  payslips,
  timekeepingRecords,
  gatepasses,
};
