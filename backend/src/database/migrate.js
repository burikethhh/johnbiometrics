const pool = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function ensureAccessLogColumns() {
  const columns = [
    ['terminal_user_id', 'VARCHAR(24) NULL'],
    ['device_ip', 'VARCHAR(45) NULL'],
    ['source_ref', 'VARCHAR(64) NULL']
  ];
  for (const [name, definition] of columns) {
    if (!(await columnExists('access_logs', name))) {
      await pool.query(`ALTER TABLE access_logs ADD COLUMN ${name} ${definition}`);
      console.log(`Migration: added access_logs.${name}`);
    }
  }
  await pool.query('ALTER TABLE access_logs ADD INDEX idx_source_ref (source_ref)').catch(() => {});
}

async function runMigrations() {
  try {
    await ensureAccessLogColumns();
  } catch (error) {
    console.error('Database migration failed:', error.message);
    throw error;
  }
}

module.exports = { runMigrations };
