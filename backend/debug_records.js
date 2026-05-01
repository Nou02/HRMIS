const db = require('./db');

async function debugRecords() {
  try {
    console.log('--- ALL RECORDS IN DB ---');
    const [all] = await db.query('SELECT id, employee_id, DATE(created_at) as created_date, created_at FROM timekeeping_records');
    console.table(all);

    const dates = ['2026-04-27', '2026-04-28'];
    for (const d of dates) {
      console.log(`\n--- Testing Subquery for ${d} ---`);
      const [sub] = await db.query(`
        SELECT MAX(id) as max_id, employee_id 
        FROM timekeeping_records 
        WHERE DATE(created_at) = ?
        GROUP BY employee_id
      `, [d]);
      console.table(sub);

      console.log(`\n--- Testing Full JOIN for ${d} ---`);
      const [rows] = await db.query(`
        SELECT 
          e.uid, 
          tk.id as tk_id,
          DATE(tk.created_at) as tk_date
        FROM employees e
        LEFT JOIN (
          SELECT * FROM timekeeping_records 
          WHERE id IN (
            SELECT MAX(id) FROM timekeeping_records 
            WHERE DATE(created_at) = ?
            GROUP BY employee_id
          )
        ) tk ON e.id = tk.employee_id
      `, [d]);
      console.table(rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugRecords();
