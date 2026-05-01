const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('Failed to load .env from:', envPath);
} else {
  console.log('.env loaded successfully from:', envPath);
  console.log('DB_HOST is set to:', process.env.DB_HOST);
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
const db = require('./db');

// Routes by module
const healthRouter = require('./routes/health/db')(db);
const dashboardRouter = require('./routes/dashboard/stats')(db);
const employeesRouter = require('./routes/employees/employees')(upload, db);
const timeOffRequestsRouter = require('./routes/applications/applications')(db);
const gatepassesRouter = require('./routes/gatepasses/gatepasses')(db);
const payrollRouter = require('./routes/payroll/payroll')(state, db);
const payslipsRouter = require('./routes/payslips/payslips')(state, db);
const timekeepingRouter = require('./routes/timekeeping/timekeeping')(state, db);
const overtimeRouter = require('./routes/overtime/overtime')(state, db);
const landingRouter = require('./routes/landing/landing')();
const authRouter = require('./routes/auth/auth')(db);

app.use('/api/stats', dashboardRouter);
app.use('/api/health', healthRouter);
app.use('/api/landing', landingRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/applications', timeOffRequestsRouter);
app.use('/api/gatepasses', gatepassesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/payslips', payslipsRouter);
app.use('/api/timekeeping', timekeepingRouter);
app.use('/api/overtime', overtimeRouter);
app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 5176;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
