const mysql = require('mysql2/promise');
require('dotenv').config();

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'hrmis',
} = process.env;

async function fix() {
  const db = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    console.log('Checking for date column...');
    const [cols] = await db.query("SHOW COLUMNS FROM timekeeping_records LIKE 'date'");
    if (cols.length === 0) {
      console.log('Adding date column...');
      await db.query('ALTER TABLE timekeeping_records ADD COLUMN date DATE AFTER employee_id');
    }

    console.log('Migrating data from created_at to date...');
    await db.query('UPDATE timekeeping_records SET date = DATE(created_at) WHERE date IS NULL');

    console.log('Cleaning up old constraints and columns...');
    try {
      await db.query('ALTER TABLE timekeeping_records DROP INDEX unique_emp_date_ref');
    } catch (e) { console.log('Constraint unique_emp_date_ref not found or already dropped.'); }
    
    try {
      await db.query('ALTER TABLE timekeeping_records DROP COLUMN date_ref');
    } catch (e) { console.log('Column date_ref not found or already dropped.'); }

    console.log('Adding unique constraint unique_emp_date...');
    // Remove duplicates first
    await db.query(`
      DELETE t1 FROM timekeeping_records t1
      INNER JOIN timekeeping_records t2 
      WHERE t1.id < t2.id 
      AND t1.employee_id = t2.employee_id 
      AND t1.date = t2.date
    `);
    
    try {
      await db.query('ALTER TABLE timekeeping_records ADD UNIQUE KEY unique_emp_date (employee_id, date)');
    } catch (e) { console.log('Constraint unique_emp_date already exists.'); }

    console.log('Final check of records:');
    const [rows] = await db.query('SELECT id, employee_id, date, created_at FROM timekeeping_records');
    console.table(rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
