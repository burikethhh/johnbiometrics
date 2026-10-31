-- FingerGate Database Export
-- Generated: 2026-10-31T03:34:55.693Z

CREATE DATABASE IF NOT EXISTS `fingergate`;
USE `fingergate`;

SET FOREIGN_KEY_CHECKS = 0;

-- Table: access_logs
DROP TABLE IF EXISTS `access_logs`;
CREATE TABLE `access_logs` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) DEFAULT NULL,
  `log_time` datetime DEFAULT current_timestamp(),
  `status` enum('Granted','Denied') NOT NULL,
  `direction` enum('Entry','Exit') DEFAULT 'Entry',
  `accuracy` float DEFAULT 0,
  `visitor_id` int(11) DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL,
  `confidence_score` float DEFAULT 0,
  `verification_duration_ms` int(11) DEFAULT 0,
  `is_genuine` tinyint(1) DEFAULT NULL,
  `scan_quality` float DEFAULT 0,
  `terminal_user_id` varchar(24) DEFAULT NULL,
  `device_ip` varchar(45) DEFAULT NULL,
  `source_ref` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_source_ref` (`source_ref`)
) ENGINE=InnoDB AUTO_INCREMENT=31240 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

INSERT INTO `access_logs` (`log_id`, `resident_id`, `log_time`, `status`, `direction`, `accuracy`, `visitor_id`, `device_id`, `confidence_score`, `verification_duration_ms`, `is_genuine`, `scan_quality`, `terminal_user_id`, `device_ip`, `source_ref`) VALUES
(31239, 18, '2026-10-31 03:38:56', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '18', '192.168.254.106', '192.168.254.106:18:1793417936000'),
(31238, 90005, '2026-10-31 03:34:44', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417684000'),
(31237, 18, '2026-10-31 03:34:39', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '18', '192.168.254.106', '192.168.254.106:18:1793417679000'),
(31236, 18, '2026-10-31 03:33:00', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '18', '192.168.254.106', '192.168.254.106:18:1793417580000'),
(31235, 90005, '2026-10-31 03:31:54', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417514000'),
(31234, 90005, '2026-10-31 03:31:54', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417514000'),
(31233, 90005, '2026-10-31 03:31:54', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417514000'),
(31232, 90005, '2026-10-31 03:31:54', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417514000'),
(31231, 90005, '2026-10-31 03:31:54', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '90005', '192.168.254.106', '192.168.254.106:90005:1793417514000'),
(31230, 17, '2026-10-31 03:00:03', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415603000'),
(31229, 17, '2026-10-31 03:00:03', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415603000'),
(31228, 17, '2026-10-31 03:00:03', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415603000'),
(31227, 17, '2026-10-31 03:00:03', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415603000'),
(31226, 17, '2026-10-31 03:00:03', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415603000'),
(1, 17, '2026-10-31 02:50:37', 'Granted', 'Entry', 1, NULL, 1, 1, 0, 1, 0, '17', '192.168.254.106', '192.168.254.106:17:1793415037000');

-- Table: audit_log
DROP TABLE IF EXISTS `audit_log`;
CREATE TABLE `audit_log` (
  `audit_id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `details` text DEFAULT NULL,
  `timestamp` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `system_admins` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

INSERT INTO `audit_log` (`audit_id`, `admin_id`, `action`, `details`, `timestamp`) VALUES
(1, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:29:46'),
(2, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:32:17'),
(3, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:33:15'),
(4, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:33:59'),
(5, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:34:37'),
(6, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:35:51'),
(7, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:36:40'),
(8, 1, 'ZK_ENROLL', 'Started terminal enrollment for resident 17 (John Mark Quia) on 192.168.254.106', '2026-10-31 02:36:40'),
(9, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:39:43'),
(11, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 02:41:50'),
(12, 2, 'LOGIN', 'User e2etest logged in', '2026-10-31 02:44:10'),
(15, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 02:48:53'),
(16, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 02:49:30'),
(17, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 02:50:08'),
(18, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 02:51:07'),
(19, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 02:51:51'),
(20, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:07:00'),
(21, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:07:42'),
(22, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:09:03'),
(23, 1, 'ZK_CONNECT', 'Connected & bound ZKTeco terminal to 192.168.254.106:4370', '2026-10-31 03:09:38'),
(24, 1, 'ZK_CONNECT', 'Connected & bound ZKTeco terminal to 192.168.254.106:4370', '2026-10-31 03:09:38'),
(25, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:10:06'),
(26, 1, 'ZK_CONNECT', 'Connected & bound ZKTeco terminal to 192.168.254.106:4370', '2026-10-31 03:10:32'),
(27, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:15:30'),
(28, 1, 'REGISTER_RESIDENT', 'Registered resident: Test Resident One', '2026-10-31 03:15:30'),
(29, 1, 'DELETE_RESIDENT', 'Deleted resident ID: 90002', '2026-10-31 03:15:30'),
(30, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:15:48'),
(31, 1, 'REGISTER_RESIDENT', 'Registered resident: Test Resident Two', '2026-10-31 03:15:48'),
(32, 1, 'DELETE_RESIDENT', 'Deleted resident ID: 90003', '2026-10-31 03:15:48'),
(33, 1, 'LOGIN', 'User Admin logged in', '2026-10-31 03:16:13'),
(34, 1, 'REGISTER_RESIDENT', 'Registered resident: Test Resident Three', '2026-10-31 03:16:21'),
(35, 1, 'DELETE_RESIDENT', 'Deleted resident ID: 90004', '2026-10-31 03:16:21'),
(36, 1, 'REGISTER_RESIDENT', 'Registered resident: Christian Keth Aguacito', '2026-10-31 03:18:14'),
(37, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:18:46'),
(38, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:18:47'),
(39, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:18:48'),
(40, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:18:50'),
(41, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:18:51'),
(42, 1, 'ZK_ENROLL', 'Started terminal enrollment for resident 18 (Ronald Nicor Pascua) on 192.168.254.106', '2026-10-31 03:19:13'),
(43, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:19:56'),
(44, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:21:32'),
(45, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:21:40'),
(46, NULL, 'ZK_IMPORT', 'Imported 1 terminal access events from 192.168.254.106', '2026-10-31 03:25:48');

-- Table: devices
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `device_id` int(11) NOT NULL AUTO_INCREMENT,
  `location` varchar(100) NOT NULL,
  `device_status` enum('Active','Inactive') DEFAULT 'Active',
  `scanner_model` varchar(100) DEFAULT NULL,
  `usb_port` varchar(50) DEFAULT NULL,
  `calibration_date` datetime DEFAULT NULL,
  PRIMARY KEY (`device_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

INSERT INTO `devices` (`device_id`, `location`, `device_status`, `scanner_model`, `usb_port`, `calibration_date`) VALUES
(1, 'Main Gate', 'Active', 'ZKTeco Terminal (LAN)', '192.168.254.106:4370', '2026-10-31 03:10:32');

-- Table: fingerprint_data
DROP TABLE IF EXISTS `fingerprint_data`;
CREATE TABLE `fingerprint_data` (
  `fingerprint_id` int(11) NOT NULL AUTO_INCREMENT,
  `resident_id` int(11) NOT NULL,
  `encoding` text NOT NULL,
  `reference_image` varchar(225) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`fingerprint_id`),
  KEY `resident_id` (`resident_id`),
  CONSTRAINT `fingerprint_data_ibfk_1` FOREIGN KEY (`resident_id`) REFERENCES `residents` (`resident_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- Table: residents
DROP TABLE IF EXISTS `residents`;
CREATE TABLE `residents` (
  `resident_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `date_registered` datetime DEFAULT current_timestamp(),
  `status` enum('Active','Blocked') DEFAULT 'Active',
  `contact_number` varchar(20) DEFAULT NULL,
  `household_number` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`resident_id`)
) ENGINE=InnoDB AUTO_INCREMENT=90006 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

INSERT INTO `residents` (`resident_id`, `full_name`, `address`, `date_registered`, `status`, `contact_number`, `household_number`) VALUES
(1, 'Juan Dela Cruz', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(2, 'Maria Santos', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(3, 'Pedro Reyes', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(4, 'Ana Garcia', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(5, 'Roberto Mendoza', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(6, 'Liza Bautista', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(7, 'Carlos Villanueva', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(8, 'Teresa Aquino', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(9, 'Miguel Torres', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(10, 'Sofia Ramos', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(11, 'Kenneth Roy Bulawan Algo', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(12, 'Ryan Ber D. Alojado', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(13, 'Ricardo Fernando', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(14, 'Ailen Pasigay', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(15, 'Jan Floyd Alcueba Algon', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(16, 'Roberto N. Aligarbes', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(17, 'John Mark Quia', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(18, 'Ronald Nicor Pascua', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(19, 'Kenneth Oyco', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(20, 'Elna Pascua Alcueba', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(90001, 'Jeff Rey Salcedo', NULL, '2026-10-31 02:36:08', 'Active', NULL, NULL),
(90005, 'Christian Keth Aguacito', 'Kalawag 2', '2026-10-31 03:17:43', 'Active', '09497833448', '1123');

-- Table: system_admins
DROP TABLE IF EXISTS `system_admins`;
CREATE TABLE `system_admins` (
  `admin_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(225) NOT NULL,
  `role` enum('Super','Staff') DEFAULT 'Staff',
  `failed_attempts` int(11) DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

INSERT INTO `system_admins` (`admin_id`, `username`, `password_hash`, `role`, `failed_attempts`, `locked_until`, `created_at`) VALUES
(1, 'Admin', '$2a$10$bI8zirWVpyY99XLqoRBDge7cRvq0Qge12G8GHYvzFJr/ea1RJFUaK', 'Super', 0, NULL, '2026-10-31 02:25:24'),
(2, 'e2etest', '$2a$12$hCWGcUHmW6ZmfmoZU0oEZ.lh2zdZ8OD35Zkk2NKfn2IaIvsXGStAO', 'Super', 0, NULL, '2026-10-31 02:44:00');

-- Table: visitors
DROP TABLE IF EXISTS `visitors`;
CREATE TABLE `visitors` (
  `visitor_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `purpose_of_visit` varchar(255) DEFAULT NULL,
  `person_to_visit` varchar(100) DEFAULT NULL,
  `fingerprint_data` text DEFAULT NULL,
  `time_in` datetime DEFAULT current_timestamp(),
  `time_out` datetime DEFAULT NULL,
  PRIMARY KEY (`visitor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

SET FOREIGN_KEY_CHECKS = 1;
