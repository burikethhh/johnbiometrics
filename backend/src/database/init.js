const pool = require('../config/db');

const schema = `
CREATE DATABASE IF NOT EXISTS fingergate;
USE fingergate;

CREATE TABLE IF NOT EXISTS residents (
  resident_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  date_registered DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Active', 'Blocked') DEFAULT 'Active',
  contact_number VARCHAR(20),
  household_number VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS fingerprint_data (
  fingerprint_id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT NOT NULL,
  encoding TEXT NOT NULL,
  reference_image VARCHAR(225),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT,
  log_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Granted', 'Denied') NOT NULL,
  direction ENUM('Entry', 'Exit') DEFAULT 'Entry',
  accuracy FLOAT DEFAULT 0.0,
  visitor_id INT,
  device_id INT,
  confidence_score FLOAT DEFAULT 0.0,
  verification_duration_ms INT DEFAULT 0,
  is_genuine TINYINT(1) DEFAULT NULL,
  scan_quality FLOAT DEFAULT 0.0,
  terminal_user_id VARCHAR(24) DEFAULT NULL,
  device_ip VARCHAR(45) DEFAULT NULL,
  source_ref VARCHAR(64) DEFAULT NULL,
  INDEX idx_source_ref (source_ref)
);

CREATE TABLE IF NOT EXISTS system_admins (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(225) NOT NULL,
  role ENUM('Super', 'Staff') DEFAULT 'Staff',
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visitors (
  visitor_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  purpose_of_visit VARCHAR(255),
  person_to_visit VARCHAR(100),
  fingerprint_data TEXT,
  time_in DATETIME DEFAULT CURRENT_TIMESTAMP,
  time_out DATETIME
);

CREATE TABLE IF NOT EXISTS devices (
  device_id INT AUTO_INCREMENT PRIMARY KEY,
  location VARCHAR(100) NOT NULL,
  device_status ENUM('Active', 'Inactive') DEFAULT 'Active',
  scanner_model VARCHAR(100),
  usb_port VARCHAR(50),
  calibration_date DATETIME
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT,
  action VARCHAR(255) NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES system_admins(admin_id) ON DELETE SET NULL
);
`;

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    const initDb = schema.split('CREATE DATABASE IF NOT EXISTS fingergate;')[0];
    await connection.query('CREATE DATABASE IF NOT EXISTS fingergate');
    await connection.query('USE fingergate');
    
    const statements = schema.split(';').filter(s => 
      s.trim() && !s.includes('CREATE DATABASE')
    );
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    
    const [admins] = await connection.query('SELECT COUNT(*) as count FROM system_admins');
    if (admins[0].count === 0) {
      const bcrypt = require('bcryptjs');
      const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME;
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
      if (defaultUsername && defaultPassword) {
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);
        await connection.query(
          'INSERT INTO system_admins (username, password_hash, role) VALUES (?, ?, ?)',
          [defaultUsername, hashedPassword, 'Super']
        );
        console.log(`Default admin created: ${defaultUsername}`);
      } else {
        console.log('No DEFAULT_ADMIN_USERNAME/DEFAULT_ADMIN_PASSWORD set. Skipping default admin creation.');
      }
    }
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
