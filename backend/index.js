const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, name);
  },
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadDir));

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

app.get('/api/stats', (_req, res) => {
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

app.get('/api/employees', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const name = (req.query.name || '').toString().toLowerCase();
  const sort = (req.query.sort || '').toString();
  let list = employees.slice();
  if (q) {
    list = list.filter(
      (e) =>
        e.uid.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.departmentProject.toLowerCase().includes(q)
    );
  }
  if (name) {
    list = list.filter((e) => e.name.toLowerCase().includes(name));
  }
  if (sort === 'department_asc') {
    list.sort((a, b) => a.departmentProject.localeCompare(b.departmentProject));
  }
  if (sort === 'name_asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  res.json(list);
});

app.post('/api/employees', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), (req, res) => {
  const {
    uid,
    name,
    departmentProject,
    employmentCategory,
    certifications = [],
    pdsAvailable = false,
    idViewAvailable = false,
    avatarUrl = '',
  } = req.body || {};
  if (!uid || !name) {
    return res.status(400).json({ error: 'uid and name are required' });
  }
  const existing = employees.find((e) => e.uid === uid);
  if (existing) {
    return res.status(409).json({ error: 'Employee with uid already exists' });
  }
  const pdsFile = req.files?.pdsFile?.[0];
  const idFile = req.files?.idFile?.[0];
  const emp = {
    uid,
    name,
    departmentProject:
      departmentProject || '',
    employmentCategory: employmentCategory || '',
    certifications: Array.isArray(certifications)
      ? certifications
      : String(certifications)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    pdsAvailable: pdsFile ? true : !!pdsAvailable,
    idViewAvailable: idFile ? true : !!idViewAvailable,
    pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : null,
    idFilePath: idFile ? `/uploads/${idFile.filename}` : null,
    avatarUrl,
  };
  employees.push(emp);
  saveEmployees();
  res.status(201).json(emp);
});

app.put('/api/employees/:uid', upload.fields([{ name: 'pdsFile', maxCount: 1 }, { name: 'idFile', maxCount: 1 }]), (req, res) => {
  const { uid } = req.params;
  const idx = employees.findIndex((e) => e.uid === uid);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const cur = employees[idx];
  const {
    name = cur.name,
    departmentProject = cur.departmentProject,
    employmentCategory = cur.employmentCategory,
    certifications = cur.certifications,
    pdsAvailable = cur.pdsAvailable,
    idViewAvailable = cur.idViewAvailable,
    avatarUrl = cur.avatarUrl,
  } = req.body || {};
  const pdsFile = req.files?.pdsFile?.[0];
  const idFile = req.files?.idFile?.[0];
  employees[idx] = {
    uid,
    name,
    departmentProject,
    employmentCategory,
    certifications:
      Array.isArray(certifications) ? certifications : String(certifications).split(',').map((s) => s.trim()).filter(Boolean),
    pdsAvailable: pdsFile ? true : !!pdsAvailable,
    idViewAvailable: idFile ? true : !!idViewAvailable,
    pdsFilePath: pdsFile ? `/uploads/${pdsFile.filename}` : cur.pdsFilePath || null,
    idFilePath: idFile ? `/uploads/${idFile.filename}` : cur.idFilePath || null,
    avatarUrl,
  };
  saveEmployees();
  res.json(employees[idx]);
});

app.get('/api/applications', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const sort = (req.query.sort || '').toString();
  let list = applications.slice();
  if (q) {
    list = list.filter(
      (a) =>
        a.uid.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.typeOfLeave.toLowerCase().includes(q) ||
        a.leaveStatus.toLowerCase().includes(q)
    );
  }
  if (sort === 'name_asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === 'type_asc') {
    list.sort((a, b) => (a.typeOfLeave || '').localeCompare(b.typeOfLeave || ''));
  }
  res.json(list);
});

app.post('/api/applications', (req, res) => {
  const {
    uid,
    name,
    typeOfLeave,
    leaveStatus,
    offsetHours = 0,
    offsetStatus,
  } = req.body || {};
  if (!uid || !name || !typeOfLeave) {
    return res.status(400).json({ error: 'uid, name, and typeOfLeave are required' });
  }
  const hours = Number(offsetHours || 0);
  if (hours && hours < 2) {
    return res.status(400).json({ error: 'offsetHours must be at least 2' });
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const appRec = {
    id,
    uid,
    name,
    typeOfLeave,
    leaveStatus: leaveStatus || '',
    offsetHours: hours,
    offsetStatus: offsetStatus || '',
    offset: hours ? `${hours}h` : '',
  };
  applications.push(appRec);
  res.status(201).json(appRec);
});

app.put('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  const idx = applications.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const cur = applications[idx];
  const {
    uid = cur.uid,
    name = cur.name,
    typeOfLeave = cur.typeOfLeave,
    leaveStatus = cur.leaveStatus,
    offsetHours = cur.offsetHours,
    offsetStatus = cur.offsetStatus,
  } = req.body || {};
  const hours = Number(offsetHours || 0);
  if (hours && hours < 2) {
    return res.status(400).json({ error: 'offsetHours must be at least 2' });
  }
  applications[idx] = {
    id,
    uid,
    name,
    typeOfLeave,
    leaveStatus,
    offsetHours: hours,
    offsetStatus,
    offset: hours ? `${hours}h` : '',
  };
  res.json(applications[idx]);
});

app.get('/api/payroll/summary', (_req, res) => {
  const totalEmployees = payrollRecords.length || employees.length;
  const basePayroll = payrollRecords.reduce((sum, r) => sum + (Number(r.baseSalary) || 0), 0);
  const totalOvertime = payrollRecords.reduce((sum, r) => sum + (Number(r.overtimeAmount) || 0), 0);
  res.json({
    totalEmployees,
    basePayroll: basePayroll ? `₱${basePayroll.toLocaleString()}` : '—',
    totalOvertime: totalOvertime ? `₱${totalOvertime.toLocaleString()}` : '—',
    period: '—',
  });
});

app.get('/api/payroll/records', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const sort = (req.query.sort || '').toString();
  const onlyGenerated = String(req.query.only_generated || '').toLowerCase() === 'true';
  let list = payrollRecords.length
    ? payrollRecords.slice()
    : employees.map((e) => ({
        employeeId: e.uid,
        employeeName: e.name,
        baseSalary: '-',
        overtime: '-',
        deduction: '-',
        netPay: '-',
        status: 'Draft',
        statusClass: 'draft',
      }));
  if (q) {
    list = list.filter(
      (r) =>
        (r.employeeId || '').toLowerCase().includes(q) ||
        (r.employeeName || '').toLowerCase().includes(q)
    );
  }
  if (sort === 'name_asc') {
    list.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
  }
  if (onlyGenerated) {
    list = list.filter((r) => (r.status || '').toLowerCase() === 'generated');
  }
  res.json(list);
});

app.get('/api/payslips', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const sort = (req.query.sort || '').toString();
  const onlyConfirmed = String(req.query.only_confirmed || '').toLowerCase() === 'true';
  let list = payslips.length
    ? payslips.slice()
    : employees.map((e) => ({
        id: e.uid,
        uid: e.uid,
        name: e.name,
        role: '',
        gross: '—',
        bonus: '—',
        deductions: '—',
        netPay: '—',
        period: '—',
        status: 'Draft',
      }));
  if (onlyConfirmed) {
    // when onlyConfirmed requested, do not return drafts/fallback
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
});

app.post('/api/payroll/generate', (_req, res) => {
  payrollRecords.length = 0;
  payslips.length = 0;
  employees.forEach((e) => {
    payrollRecords.push({
      employeeId: e.uid,
      employeeName: e.name,
      baseSalary: '-',
      overtime: '-',
      deduction: '-',
      netPay: '-',
      status: 'Generated',
      statusClass: 'approved',
    });
    payslips.push({
      id: e.uid,
      uid: e.uid,
      name: e.name,
      role: '',
      gross: '—',
      bonus: '—',
      deductions: '—',
      netPay: '—',
      period: '—',
      status: 'Draft',
    });
  });
  res.json({ ok: true, count: employees.length });
});

app.put('/api/payroll/records/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const idx = payrollRecords.findIndex((r) => r.employeeId === employeeId);
  const cur = idx !== -1 ? payrollRecords[idx] : {
    employeeId,
    employeeName: '',
    baseSalary: '-',
    overtime: '-',
    deduction: '-',
    netPay: '-',
    status: 'Generated',
    statusClass: 'approved',
  };
  const {
    employeeName = cur.employeeName,
    baseSalary = cur.baseSalary,
    overtime = cur.overtime,
    deduction = cur.deduction,
    netPay,
    status = cur.status,
  } = req.body || {};
  const baseN = Number(String(baseSalary).replace(/[^\d.-]/g, '')) || 0;
  const otN = Number(String(overtime).replace(/[^\d.-]/g, '')) || 0;
  const dedN = Number(String(deduction).replace(/[^\d.-]/g, '')) || 0;
  const computedNet = baseN || otN || dedN ? (baseN + otN - dedN) : null;
  const rec = {
    employeeId,
    employeeName,
    baseSalary: baseN ? `₱${baseN.toLocaleString()}` : baseSalary,
    overtime: otN ? `₱${otN.toLocaleString()}` : overtime,
    deduction: dedN ? `₱${dedN.toLocaleString()}` : deduction,
    netPay: typeof netPay !== 'undefined' ? netPay : (computedNet ? `₱${computedNet.toLocaleString()}` : cur.netPay),
    status,
    statusClass: (status || '').toLowerCase() === 'generated' ? 'approved' : 'review',
  };
  if (idx === -1) {
    payrollRecords.push(rec);
  } else {
    payrollRecords[idx] = rec;
  }
  res.json(rec);
});
app.put('/api/payslips/:uid', (req, res) => {
  const { uid } = req.params;
  const idx = payslips.findIndex((p) => p.uid === uid);
  const cur = idx !== -1 ? payslips[idx] : { uid, name: '', role: '' };
  const {
    name = cur.name,
    role = cur.role,
    gross = cur.gross,
    bonus = cur.bonus,
    deductions = cur.deductions,
    period = cur.period,
    confirm = false,
  } = req.body || {};
  const grossN = Number(String(gross).replace(/[^\d.-]/g, '')) || 0;
  const bonusN = Number(String(bonus).replace(/[^\d.-]/g, '')) || 0;
  const dedN = Number(String(deductions).replace(/[^\d.-]/g, '')) || 0;
  const netN = grossN + bonusN - dedN;
  const rec = {
    id: uid,
    uid,
    name,
    role,
    gross: grossN ? `₱${grossN.toLocaleString()}` : gross,
    bonus: bonusN ? `₱${bonusN.toLocaleString()}` : bonus,
    deductions: dedN ? `₱${dedN.toLocaleString()}` : deductions,
    netPay: netN ? `₱${netN.toLocaleString()}` : cur.netPay || '—',
    period,
    status: confirm ? 'Confirmed' : (cur.status || 'Draft'),
    statusClass: confirm ? 'approved' : (cur.statusClass || 'draft'),
  };
  if (idx === -1) {
    payslips.push(rec);
  } else {
    payslips[idx] = rec;
  }
  res.json(rec);
});
app.get('/api/timekeeping/summary', (_req, res) => {
  const totalAttendance = timekeepingRecords.length || employees.length;
  const totalLate = timekeepingRecords.filter((r) => r.status === 'Late').length;
  const totalAbsent = timekeepingRecords.filter((r) => r.status === 'Absent').length;
  const totalOvertimeMinutes = timekeepingRecords.reduce((sum, r) => {
    const val = String(r.totalOvertime || '').trim();
    if (!val) return sum;
    if (val.endsWith('m')) return sum + Number(val.slice(0, -1)) || 0;
    if (val.endsWith('h')) return sum + (Number(val.slice(0, -1)) || 0) * 60;
    return sum;
  }, 0);
  const hours = Math.floor(totalOvertimeMinutes / 60);
  res.json({
    totalAttendance,
    totalLate,
    totalAbsent,
    totalOvertime: hours ? `${hours}h` : '—',
    calendar: 'Oct 2023',
  });
});

app.get('/api/timekeeping', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  const sort = (req.query.sort || '').toString();
  const status = (req.query.status || '').toString();
  let list = timekeepingRecords.length
    ? timekeepingRecords.slice()
    : employees.map((e) => ({
        uid: e.uid,
        name: e.name,
        clockIn: '-',
        clockOut: '-',
        totalTime: '-',
        totalLate: '-',
        totalOvertime: '-',
        status: 'Absent',
        statusClass: 'draft',
      }));
  if (status) {
    list = list.filter((r) => (r.status || '') === status);
  }
  if (q) {
    list = list.filter(
      (r) =>
        (r.uid || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q)
    );
  }
  if (sort === 'name_asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  res.json(list);
});

app.post('/api/timekeeping', (req, res) => {
  const { uid, name, clockIn = '', clockOut = '', status = 'Present' } = req.body || {};
  if (!uid || !name) return res.status(400).json({ error: 'uid and name are required' });
  const totalTime = (clockIn && clockOut) ? '8h 00m' : '-';
  const rec = {
    uid,
    name,
    clockIn,
    clockOut,
    totalTime,
    totalLate: status === 'Late' ? '15m' : '0m',
    totalOvertime: '0m',
    status,
    statusClass:
      status === 'Present'
        ? 'approved'
        : status === 'Late'
        ? 'review'
        : status === 'Travel'
        ? 'review'
        : status === 'HalfDay'
        ? 'review'
        : 'draft',
  };
  timekeepingRecords.push(rec);
  res.status(201).json(rec);
});
const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
