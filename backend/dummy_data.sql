-- Dummy Data for HRMIS Database

-- 1. Overtime Settings
INSERT INTO overtime_settings (id, hourly_rate) VALUES (1, 200.00)
ON DUPLICATE KEY UPDATE hourly_rate = VALUES(hourly_rate);

-- 2. Admin Account (password: admin123)
-- Hash generated via bcrypt
INSERT INTO accounts (username, password_hash, email, role) 
VALUES ('admin', '$2b$10$UoW0o7zWvW0o7zWvW0o7zuV7zWvW0o7zWvW0o7zWvW0o7zWvW0o7z', 'admin@example.com', 'admin')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

-- 3. Employees
INSERT INTO employees (uid, name, department_project, employment_category, certifications) VALUES
('EMP671781', 'Bob Smith', 'Office of the Regional Director', 'Regular', 'Standard Onboarding'),
('EMP497179', 'Edward Brown', 'IT Operations', 'Contractual', 'Standard Onboarding'),
('EMP503118', 'Hannah Rodriguez', 'Technical Support', 'Job Order', 'Standard Onboarding'),
('FW3621', 'Sarah Cruz', 'Free Wi-Fi', 'Regular', 'Free Wi-Fi Specialist'),
('FW9358', 'Mark Bautista', 'Free Wi-Fi', 'Contractual', 'Free Wi-Fi Specialist'),
('EMP571893', 'Ian Garcia', 'Office of the Regional Director', 'Regular', 'Standard Onboarding');

-- 4. Payroll Records (Example for April 1-15, 2026)
-- Assuming IDs 1-6 for the employees above
INSERT INTO payroll_records (employee_id, base_salary, overtime_amount, deduction, net_pay, status, period) VALUES
(1, 30000.00, 200.00, 2500.00, 12500.00, 'Generated', 'P1-2026-04'),
(2, 40000.00, 200.00, 2500.00, 21500.00, 'Generated', 'P1-2026-04'),
(3, 30000.00, 200.00, 2500.00, 12500.00, 'Generated', 'P1-2026-04'),
(4, 50000.00, 200.00, 2500.00, 22500.00, 'Generated', 'P1-2026-04'),
(5, 35000.00, 200.00, 2500.00, 15000.00, 'Generated', 'P1-2026-04'),
(6, 45000.00, 200.00, 2500.00, 24500.00, 'Generated', 'P1-2026-04');

-- 5. Payslips (Example for April 1-15, 2026)
INSERT INTO payslips (employee_id, gross, bonus, deductions, net_pay, period, status) VALUES
(1, 15000.00, 0.00, 2500.00, 12500.00, 'P1-2026-04', 'Confirmed'),
(2, 24000.00, 0.00, 2500.00, 21500.00, 'P1-2026-04', 'Confirmed'),
(3, 15000.00, 0.00, 2500.00, 12500.00, 'P1-2026-04', 'Confirmed'),
(4, 30000.00, 0.00, 2500.00, 27500.00, 'P1-2026-04', 'Confirmed'),
(5, 17500.00, 0.00, 2500.00, 15000.00, 'P1-2026-04', 'Confirmed'),
(6, 27000.00, 0.00, 2500.00, 24500.00, 'P1-2026-04', 'Confirmed');
