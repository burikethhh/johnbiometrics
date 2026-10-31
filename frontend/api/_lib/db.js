const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    };

    if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) {
      config.ssl = { rejectUnauthorized: true };
    }

    pool = mysql.createPool(config);
  }
  return pool;
}

module.exports = { getPool };
