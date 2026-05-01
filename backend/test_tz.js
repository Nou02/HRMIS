const db = require('./db');

async function testTimezoneFix() {
  const date27 = '2026-04-27';
  const date28 = '2026-04-28';

  try {
    console.log(`--- Testing CONVERT_TZ for ${date27} ---`);
    const [rows27] = await db.query(`
      SELECT 
        e.uid, 
        tk.id as tk_id,
        tk.created_at as raw_created_at,
        DATE(CONVERT_TZ(tk.created_at, '+00:00', '+08:00')) as local_date
      FROM employees e
      LEFT JOIN (
        SELECT * FROM timekeeping_records 
        WHERE id IN (
          SELECT MAX(id) FROM timekeeping_records 
          WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?
          GROUP BY employee_id
        )
      ) tk ON e.id = tk.employee_id
    `, [date27]);
    console.table(rows27);

    console.log(`\n--- Testing CONVERT_TZ for ${date28} ---`);
    const [rows28] = await db.query(`
      SELECT 
        e.uid, 
        tk.id as tk_id,
        tk.created_at as raw_created_at,
        DATE(CONVERT_TZ(tk.created_at, '+00:00', '+08:00')) as local_date
      FROM employees e
      LEFT JOIN (
        SELECT * FROM timekeeping_records 
        WHERE id IN (
          SELECT MAX(id) FROM timekeeping_records 
          WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?
          GROUP BY employee_id
        )
      ) tk ON e.id = tk.employee_id
    `, [date28]);
    console.table(rows28);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testTimezoneFix();
