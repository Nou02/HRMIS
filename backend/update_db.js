const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hrmis'
  });

  try {
    console.log('Adding overtime_hours to payroll_records...');
    await db.query(`
      ALTER TABLE payroll_records 
      ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(10,2) DEFAULT 0.00
    `);
    console.log('Success!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.end();
  }
}

run();
