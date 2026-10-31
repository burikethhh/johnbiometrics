# FingerGate (GreenValley) — Complete System Transfer & Deployment Guide

This guide contains everything required to transfer, set up, and run the **FingerGate Biometric Access Control System** on another laptop or PC.

---

## 1. System Overview

- **Architecture:** Unified Single-Origin Local Application.
- **Backend & API:** Node.js + Express + Socket.IO + Server-Sent Events (port `3000`).
- **Frontend:** React SPA (pre-compiled into `frontend/build` and served directly by Express).
- **Database:** Local MySQL / MariaDB (`fingergate` database on port `3306`).
- **Hardware Integration:** ZKTeco MB460 Multi-Biometric Terminal communicating via binary TCP socket on port `4370`.
- **Default Application URL:** `http://localhost:3000`
- **Default Admin Login:**
  - **Username:** `Admin`
  - **Password:** `Admin123!`

---

## 2. Requirements on the New Laptop

1. **Operating System:** Windows 10 / 11 (recommended), macOS, or Linux.
2. **Node.js:** v18.x or v20.x LTS ([Download Node.js](https://nodejs.org/)).
3. **Database (MySQL or MariaDB):**
   - **Option A (Easiest):** [XAMPP](https://www.apachefriends.org/) (Start the MySQL service).
   - **Option B:** Standalone MySQL Server (v8.0+ or v5.7+).
   - **Option C:** Portable MariaDB included in `.localdb` (for Windows).

---

## 3. Step-by-Step Transfer Instructions

### Step 1: Copy Project Files
Copy the entire `GreenValley` project folder to the new laptop (e.g. to `C:\Projects\GreenValley` or `D:\GreenValley`).

### Step 2: Database Initialization
Choose one of the following methods to prepare the database on the new laptop:

#### Method A: Using XAMPP / phpMyAdmin (Recommended)
1. Open XAMPP Control Panel and start **MySQL**.
2. Open your browser and go to `http://localhost/phpmyadmin`.
3. Click **New** on the left sidebar, enter database name: `fingergate`, and click **Create**.
4. Click on the `fingergate` database, go to the **Import** tab.
5. Click **Choose File**, select `database/fingergate_export.sql` from the project folder, and click **Import**.

#### Method B: Using MySQL Command Line
Run the following in PowerShell / Command Prompt:
```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS fingergate;"
mysql -u root -p fingergate < database\fingergate_export.sql
```

#### Method C: Using Node Init Script
From the project folder, run:
```powershell
npm run db:init
```

---

### Step 3: Configure Environment (`.env`)
Verify `backend/.env` exists. If not, copy it from `backend/.env.example`:
```powershell
copy backend\.env.example backend\.env
```
Ensure the database credentials match your local MySQL configuration:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fingergate
PORT=3000
```
*(If your MySQL `root` user has a password, enter it in `DB_PASSWORD`)*.

---

### Step 4: Install Dependencies (If not already copied)
If `node_modules` was excluded during file transfer, install packages with one command:
```powershell
npm run install:all
```

---

### Step 5: Start the System

#### 1-Click Launch (Windows)
Double-click:
```text
start-fingergate.bat
```
This script automatically starts the backend server and opens `http://localhost:3000` in your default browser.

#### Terminal Launch
```powershell
npm start
```
Open your browser and navigate to:
**`http://localhost:3000`**

---

## 4. Connecting the ZKTeco MB460 Terminal on Any Router / Network

Whether you connect via school/office Wi-Fi, a home router, or a phone mobile hotspot:

1. **Connect Devices to the Same Network:**
   - Connect the laptop to the router (via Wi-Fi or Ethernet cable).
   - Connect the ZKTeco MB460 to the same router (via LAN cable into the router's LAN port, or via Wi-Fi under `Menu -> Comm. -> Wireless Network`).
2. **Open the Devices Screen:**
   - Log in to FingerGate (`http://localhost:3000`).
   - In the left sidebar, click **Devices**.
3. **1-Click Auto-Scan:**
   - In the **ZKTeco Direct-Connect** card at the top, click **"Auto-Scan Router"**.
   - The system sweeps the local IPv4 subnet (254 addresses) in ~2.4 seconds and automatically detects the terminal.
4. **Connect & Bind:**
   - Click **"Connect & Save IP"**.
   - The system verifies communication, updates the database, and immediately launches the **zero-delay real-time event listener**!

---

## 5. System Features & CRUD Verification

### A. Residents Management (`/residents`)
- **Add Resident:**
  - Input Full Name, Household #, Address, and Contact Number.
  - **Biometric Enrollment on Registration:** Toggle on "Enroll Fingerprint on Registration" with method set to "ZKTeco Terminal".
  - Clicking Save automatically pushes the resident into the MB460 memory and prompts the terminal LCD with voice guidance: *"Please place your finger"* (3 touches to enroll).
- **Edit Resident:**
  - Update any personal information.
  - Changes to resident name are synced live to the MB460.
- **Account Status (1-Click Revoke / Restore):**
  - Toggle between **Active** and **Blocked** from the table or edit modal.
  - Setting a resident to **Blocked** immediately removes them from the MB460 memory so the physical door lock relay will **not** unlock for them.
  - Setting back to **Active** restores their access.
- **Delete Resident:**
  - Deletes resident from MySQL, cleans up biometric records, and purges the user from physical terminal memory.

### B. Live Real-Time Access & Dashboard (`/dashboard`)
- **Zero Latency Push:**
  - The backend maintains an open TCP event stream (`CMD_REG_EVENT`) with the MB460.
  - Whenever a resident scans their finger, face, or RFID card, the punch event arrives at the server and displays on the screen in **$< 20\text{ ms}$**!
- **Fallback Backup Sync:**
  - If the laptop sleeps or the network temporarily hiccups, a 30-second background sync catches any punches stored in the terminal's offline buffer.

### C. Access Logs (`/access-logs`)
- Filter by date range, Entry/Exit direction, and status (Granted vs. Denied).
- Real-time search by resident name.
- 1-click **Export to CSV**.

### D. Devices (`/devices`)
- Visual terminal status chip (Online, resident count, log buffer count).
- 1-click router subnet sweep.
- Quick action tools: Test Connection, Sync Residents, Pull Logs, and Clear Buffer.

### E. Evaluation (`/evaluation`)
- Accuracy rate, False Acceptance Rate (FAR), False Rejection Rate (FRR), and average recognition speed (ms) benchmarked from real terminal punch transactions.

---

## 6. Troubleshooting FAQ

### Q: "Account locked due to too many failed attempts"
Run this command from the project root:
```powershell
node -e "const pool = require('./backend/src/config/db'); pool.query('UPDATE system_admins SET failed_attempts = 0, locked_until = NULL WHERE username = \"Admin\"').then(() => { console.log('Admin unlocked!'); pool.end(); });"
```

### Q: Port 3000 is already in use
To stop any lingering background Node processes:
```powershell
.\stop-fingergate.bat
```
Or check what process is using port 3000:
```powershell
netstat -ano | findstr :3000
```

### Q: Terminal status shows Offline
1. Check that the MB460 screen is on and shows an IP address (`Menu -> Comm. -> Ethernet`).
2. Verify laptop and terminal are on the same subnet (e.g., laptop is `192.168.1.50`, terminal is `192.168.1.106`).
3. Click **"Auto-Scan Router"** on the Devices screen to find its current assigned IP.

