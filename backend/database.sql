CREATE DATABASE IF NOT EXISTS hrmis;
USE hrmis;

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  department_project VARCHAR(120),
  employment_category VARCHAR(80),
  certifications TEXT,
  avatar_url VARCHAR(255),
  pds_available TINYINT(1) DEFAULT 0,
  id_view_available TINYINT(1) DEFAULT 0,
  pds_file_path VARCHAR(255),
  id_file_path VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_emp_name ON employees(name);
CREATE INDEX idx_emp_dept ON employees(department_project);
CREATE INDEX idx_emp_category ON employees(employment_category);

CREATE TABLE IF NOT EXISTS time_off_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  uid VARCHAR(50),
  name VARCHAR(120),
  type_of_leave VARCHAR(60) NOT NULL,
  leave_status VARCHAR(60),
  offset_hours INT DEFAULT 0,
  offset_status VARCHAR(60),
  request_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tor_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX idx_tor_employee ON time_off_requests(employee_id);
CREATE INDEX idx_tor_uid ON time_off_requests(uid);
CREATE INDEX idx_tor_name ON time_off_requests(name);
CREATE INDEX idx_tor_type ON time_off_requests(type_of_leave);
CREATE INDEX idx_tor_status ON time_off_requests(leave_status);

CREATE TABLE IF NOT EXISTS gatepasses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  uid VARCHAR(50),
  name VARCHAR(120),
  official_type VARCHAR(100),
  official_purpose TEXT,
  personal_type VARCHAR(100),
  personal_purpose TEXT,
  date DATE,
  est_start_time TIME,
  est_end_time TIME,
  act_start_time TIME,
  act_end_time TIME,
  venue VARCHAR(255),
  approved_by VARCHAR(120),
  status VARCHAR(40),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gate_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX idx_gate_employee ON gatepasses(employee_id);
CREATE INDEX idx_gate_status ON gatepasses(status);
CREATE INDEX idx_gate_date ON gatepasses(date);

CREATE TABLE IF NOT EXISTS payroll_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  base_salary DECIMAL(12,2) DEFAULT 0.00,
  overtime_amount DECIMAL(12,2) DEFAULT 0.00,
  deduction DECIMAL(12,2) DEFAULT 0.00,
  net_pay DECIMAL(12,2) DEFAULT 0.00,
  status VARCHAR(40),
  period VARCHAR(60),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX idx_payroll_employee ON payroll_records(employee_id);
CREATE INDEX idx_payroll_status ON payroll_records(status);

CREATE TABLE IF NOT EXISTS payslips (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  gross DECIMAL(12,2) DEFAULT 0.00,
  bonus DECIMAL(12,2) DEFAULT 0.00,
  deductions DECIMAL(12,2) DEFAULT 0.00,
  net_pay DECIMAL(12,2) DEFAULT 0.00,
  period VARCHAR(60),
  status VARCHAR(40),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payslip_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX idx_payslip_employee ON payslips(employee_id);
CREATE INDEX idx_payslip_status ON payslips(status);

CREATE TABLE IF NOT EXISTS timekeeping_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE,
  clock_in TIME,
  clock_out TIME,
  total_time_minutes INT DEFAULT 0,
  total_late_minutes INT DEFAULT 0,
  total_overtime_minutes INT DEFAULT 0,
  status VARCHAR(40),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_time_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX idx_time_employee ON timekeeping_records(employee_id);
CREATE INDEX idx_time_status ON timekeeping_records(status);
CREATE INDEX idx_time_date ON timekeeping_records(date);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120),
  role VARCHAR(40),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_accounts_role ON accounts(role);

CREATE TABLE IF NOT EXISTS overtime_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hourly_rate DECIMAL(10,2) NOT NULL
);

-- INSERT INITIAL ADMIN ACCOUNT (Optional, use your preferred username/password)
-- INSERT INTO accounts (username, password_hash, role, email) VALUES ('admin', 'admin123', 'admin', 'admin@example.com');

