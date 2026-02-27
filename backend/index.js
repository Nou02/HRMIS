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

// Shared state across routes
const state = require('./state');

// Routes by module
const dashboardRouter = require('./routes/dashboard/stats')(state);
const employeesRouter = require('./routes/employees/employees')(upload, state);
const applicationsRouter = require('./routes/applications/applications')(state);
const gatepassesRouter = require('./routes/gatepasses/gatepasses')(state);
const payrollRouter = require('./routes/payroll/payroll')(state);
const payslipsRouter = require('./routes/payslips/payslips')(state);
const timekeepingRouter = require('./routes/timekeeping/timekeeping')(state);
const landingRouter = require('./routes/landing/landing')();

app.use('/api/stats', dashboardRouter);
app.use('/api/landing', landingRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/gatepasses', gatepassesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/payslips', payslipsRouter);
app.use('/api/timekeeping', timekeepingRouter);

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
