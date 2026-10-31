const fs = require('fs');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const pool = require('../backend/src/config/db');

async function dumpDatabase() {
  const [tables] = await pool.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  
  let sql = '-- FingerGate Database Export\n-- Generated: ' + new Date().toISOString() + '\n\n';
  sql += 'CREATE DATABASE IF NOT EXISTS `fingergate`;\nUSE `fingergate`;\n\nSET FOREIGN_KEY_CHECKS = 0;\n\n';

  for (const table of tableNames) {
    const [[createRes]] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
    sql += `-- Table: ${table}\n`;
    sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    sql += createRes['Create Table'] + ';\n\n';

    // We export up to 100 recent access_logs so the file doesn't bloat with 90k old rows
    const query = table === 'access_logs'
      ? `SELECT * FROM \`${table}\` ORDER BY log_id DESC LIMIT 200`
      : `SELECT * FROM \`${table}\``;

    const [rows] = await pool.query(query);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const values = chunk.map(row => {
          const vals = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            const s = String(val)
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
            return `'${s}'`;
          });
          return `(${vals.join(', ')})`;
        });
        sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n${values.join(',\n')};\n\n`;
      }
    }
  }

  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  const outDir = path.join(__dirname, '..', 'database');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'fingergate_export.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log(`Successfully exported database to ${outPath} (${(sql.length / 1024).toFixed(1)} KB)`);
  pool.end();
}

dumpDatabase().catch(err => {
  console.error('Database dump failed:', err);
  pool.end();
  process.exit(1);
});
