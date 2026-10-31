/**
 * GreenValley ZKTeco Terminal Sync & Credential Management Utility
 * 
 * Supports:
 * - Device Status & Info
 * - Listing Current Terminal Users
 * - Bulk Syncing GreenValley Residents (21 residents) to ZKTeco Terminal
 * - Registering / Setting User Credentials (PIN, Card, Role)
 * - Remote Triggering Biometric Fingerprint Enrollment (CMD_STARTENROLL)
 * - Attendance Log Extraction & Memory Maintenance
 */

const fs = require('fs');
const path = require('path');
const ZK = require('../backend/node_modules/node-zklib');
const { COMMANDS } = require('../backend/node_modules/node-zklib/constants');

const DEFAULT_IP = '192.168.254.106';
const DEFAULT_PORT = 4370;
const TIMEOUT = 10000;

/**
 * Creates 72-byte binary user record payload for ZKTeco SSR/TFT terminals
 */
function createUserBuffer72({ uid, role = 0, password = '', name = '', cardno = 0, userId = '', group = 1 }) {
  const buf = Buffer.alloc(72, 0);
  buf.writeUInt16LE(Number(uid) & 0xffff, 0);       // 0..2: Internal UID
  buf.writeUInt8(Number(role) & 0xff, 2);          // 2..3: Role/Privilege (0=User, 14=Admin)
  if (password) {
    buf.write(String(password).substring(0, 8), 3, 'ascii'); // 3..11: Password PIN (max 8 chars)
  }
  // Sanitize name: ASCII only, max 24 chars
  const cleanName = String(name || '').replace(/[^\x20-\x7E]/g, '').trim().substring(0, 24);
  buf.write(cleanName, 11, 'ascii');               // 11..35: Name
  buf.writeUInt32LE(Number(cardno) || 0, 35);      // 35..39: RFID Card number
  buf.writeUInt8(Number(group) || 1, 39);          // 39..40: Group
  // 40..48: Timezone / reserved padding
  buf.write(String(userId).substring(0, 24), 48, 'ascii'); // 48..72: UserID / Display PIN
  return buf;
}

/**
 * Connects to ZKTeco terminal
 */
async function connectTerminal(ip = DEFAULT_IP, port = DEFAULT_PORT) {
  console.log(`Connecting to ZKTeco terminal at ${ip}:${port}...`);
  const zk = new ZK(ip, port, TIMEOUT, 4000);
  await zk.createSocket();
  console.log(`Connected to ZKTeco via ${zk.connectionType.toUpperCase()}!`);
  return zk;
}

/**
 * Safely writes a user to the terminal
 */
async function writeUser(zk, userData) {
  const buf = createUserBuffer72(userData);
  const res = await zk.zklibTcp.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
  return res;
}

/**
 * Deletes a user by internal UID
 */
async function deleteUser(zk, uid) {
  const delBuf = Buffer.alloc(2);
  delBuf.writeUInt16LE(Number(uid) & 0xffff, 0);
  return await zk.zklibTcp.executeCmd(COMMANDS.CMD_DELETE_USER, delBuf);
}

/**
 * Commands device to flush and refresh user database
 */
async function refreshDevice(zk) {
  await zk.zklibTcp.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
}

/**
 * Triggers physical sensor enrollment for a user on the terminal
 */
async function startEnrollment(zk, userId, fingerIndex = 0) {
  // Cancel any ongoing capture
  try {
    await zk.zklibTcp.executeCmd(COMMANDS.CMD_CANCELCAPTURE, '');
  } catch (e) {}

  const enrollBuf = Buffer.alloc(26, 0);
  enrollBuf.write(String(userId).substring(0, 24), 0, 'ascii');
  enrollBuf.writeUInt8(Number(fingerIndex) & 0xff, 24); // Finger index 0..9
  enrollBuf.writeUInt8(1, 25);                          // Flag 1

  console.log(`Triggering fingerprint enrollment for User ID [${userId}], finger [${fingerIndex}] on device LCD...`);
  const res = await zk.zklibTcp.executeCmd(COMMANDS.CMD_STARTENROLL, enrollBuf);
  return res;
}

// -------------------------------------------------------------
// CLI Actions
// -------------------------------------------------------------

async function showInfo(ip, port) {
  const zk = await connectTerminal(ip, port);
  try {
    const info = await zk.getInfo();
    console.log('\n=== ZKTECO DEVICE STATUS ===');
    console.log(`IP Address   : ${ip}:${port}`);
    console.log(`Total Users  : ${info.userCounts}`);
    console.log(`Log Counts   : ${info.logCounts.toLocaleString()} / ${info.logCapacity.toLocaleString()} (${((info.logCounts / info.logCapacity) * 100).toFixed(1)}% full)`);
  } finally {
    await zk.disconnect();
  }
}

async function listUsers(ip, port) {
  const zk = await connectTerminal(ip, port);
  try {
    const res = await zk.getUsers();
    console.log(`\n=== TERMINAL REGISTERED USERS (${res.data.length}) ===`);
    console.log('--------------------------------------------------------------------------------');
    console.log('UID   | UserID (PIN) | Name                     | Role      | Password | Card No');
    console.log('--------------------------------------------------------------------------------');
    res.data.sort((a,b) => a.uid - b.uid);
    for (const u of res.data) {
      const uidStr = String(u.uid).padEnd(5);
      const userPin = String(u.userId).padEnd(12);
      const name = String(u.name || '').padEnd(24);
      const roleStr = (u.role === 14 ? 'Admin' : 'Resident').padEnd(9);
      const pass = String(u.password || '').padEnd(8);
      const card = String(u.cardno || 0);
      console.log(`${uidStr} | ${userPin} | ${name} | ${roleStr} | ${pass} | ${card}`);
    }
    console.log('--------------------------------------------------------------------------------');
  } finally {
    await zk.disconnect();
  }
}

async function syncResidents(ip, port, { clean = false, defaultPin = '1234' } = {}) {
  // Load GreenValley backup residents
  const backupFiles = fs.readdirSync(path.join(__dirname, '../backup'))
    .filter(f => f.startsWith('greenvalley_backup_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    throw new Error('No greenvalley_backup_*.json found in backup/ directory!');
  }

  const latestBackupPath = path.join(__dirname, '../backup', backupFiles[0]);
  console.log(`Loading resident dataset from: ${latestBackupPath}`);
  const backup = JSON.parse(fs.readFileSync(latestBackupPath, 'utf8'));
  const residents = backup.residents || [];

  if (residents.length === 0) {
    throw new Error('No residents found in backup file!');
  }

  residents.sort((a, b) => a.resident_id - b.resident_id);
  console.log(`Found ${residents.length} GreenValley residents to sync.`);

  const zk = await connectTerminal(ip, port);
  try {
    // 1. Fetch current device users
    const currentUsersRes = await zk.getUsers();
    const currentUsers = currentUsersRes.data || [];
    console.log(`Terminal currently has ${currentUsers.length} users.`);

    // 2. If clean mode requested, remove old users
    if (clean) {
      console.log(`\n[CLEAN MODE ACTIVE] Removing ${currentUsers.length} old users from terminal memory...`);
      for (const u of currentUsers) {
        process.stdout.write(`  Removing UID ${u.uid} (${u.name})...\r`);
        await deleteUser(zk, u.uid);
      }
      console.log(`\nOld users cleared successfully.`);
    }

    // 3. Write each GreenValley resident
    console.log(`\n[SYNCING RESIDENTS] Writing ${residents.length} GreenValley residents into terminal...`);
    let synced = 0;
    for (let i = 0; i < residents.length; i++) {
      const r = residents[i];
      // Internal UID: 1..21 (must fit uint16)
      const uid = i + 1;
      const userId = String(r.resident_id);
      const name = r.full_name;
      const role = 0; // Resident
      const password = defaultPin; // Default PIN so they can test/login on keypad
      const cardno = 0;

      await writeUser(zk, {
        uid,
        role,
        password,
        name,
        cardno,
        userId,
        group: 1
      });

      synced++;
      console.log(`  [${synced}/${residents.length}] Synced UID ${uid} -> Resident ID: ${userId} (${name}) | PIN: ${password}`);
    }

    // 4. Refresh terminal to commit changes to flash
    console.log('\nRefreshing terminal memory and saving changes...');
    await refreshDevice(zk);

    // 5. Verify synced users
    const verifyRes = await zk.getUsers();
    console.log(`\nVerification: Terminal now has ${verifyRes.data.length} users registered!`);
    console.log('Sample verified users:');
    verifyRes.data.slice(0, 5).forEach(u => {
      console.log(`  UID: ${u.uid} | PIN/ID: ${u.userId} | Name: ${u.name} | Password: ${u.password}`);
    });

    console.log('\nSync completed successfully!');
  } finally {
    await zk.disconnect();
  }
}

async function registerSingleUser(ip, port, { uid, userId, name, pin = '', role = 0, card = 0 }) {
  if (!uid || !name) {
    throw new Error('Both --uid and --name are required.');
  }

  const zk = await connectTerminal(ip, port);
  try {
    console.log(`Registering user UID: ${uid}, ID: ${userId || uid}, Name: "${name}", PIN: "${pin}"...`);
    await writeUser(zk, {
      uid: Number(uid),
      userId: String(userId || uid),
      name,
      password: String(pin),
      role: Number(role),
      cardno: Number(card)
    });

    await refreshDevice(zk);
    console.log('User registered and refreshed successfully!');
  } finally {
    await zk.disconnect();
  }
}

async function triggerEnroll(ip, port, userId, fingerIndex = 0) {
  const zk = await connectTerminal(ip, port);
  try {
    await startEnrollment(zk, userId, fingerIndex);
    console.log(`\nEnrollment mode activated on terminal!`);
    console.log(`Please ask Resident with User ID [${userId}] to place their finger on the sensor 3 times.`);
  } finally {
    await zk.disconnect();
  }
}

async function clearLogs(ip, port) {
  const zk = await connectTerminal(ip, port);
  try {
    console.log('Clearing old attendance logs from terminal memory...');
    await zk.clearAttendanceLog();
    console.log('Attendance logs cleared! Memory is now clean and ready for GreenValley punches.');
    const info = await zk.getInfo();
    console.log(`Log Counts now: ${info.logCounts} / ${info.logCapacity}`);
  } finally {
    await zk.disconnect();
  }
}

// -------------------------------------------------------------
// Entry Point
// -------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'info';

  // Parse optional flags
  let ip = DEFAULT_IP;
  let port = DEFAULT_PORT;
  let clean = false;
  let defaultPin = '1234';
  let uid = null;
  let userId = null;
  let name = null;
  let pin = '';
  let finger = 0;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--ip' && args[i+1]) ip = args[++i];
    if (args[i] === '--port' && args[i+1]) port = Number(args[++i]);
    if (args[i] === '--clean') clean = true;
    if (args[i] === '--pin' && args[i+1]) { pin = args[++i]; defaultPin = pin; }
    if (args[i] === '--uid' && args[i+1]) uid = Number(args[++i]);
    if (args[i] === '--id' && args[i+1]) userId = args[++i];
    if (args[i] === '--name' && args[i+1]) name = args[++i];
    if (args[i] === '--finger' && args[i+1]) finger = Number(args[++i]);
  }

  try {
    switch (command) {
      case 'info':
      case 'status':
        await showInfo(ip, port);
        break;
      case 'list':
        await listUsers(ip, port);
        break;
      case 'sync':
      case 'sync-residents':
        await syncResidents(ip, port, { clean, defaultPin });
        break;
      case 'register':
      case 'set-user':
        await registerSingleUser(ip, port, { uid: uid || userId, userId: userId || uid, name, pin, role: 0, card: 0 });
        break;
      case 'enroll':
        const targetId = userId || uid || args[1];
        if (!targetId) {
          console.error('Please specify the User ID to enroll: node scripts/zk_terminal_sync.js enroll --id <userId>');
          process.exit(1);
        }
        await triggerEnroll(ip, port, targetId, finger);
        break;
      case 'clear-logs':
        await clearLogs(ip, port);
        break;
      default:
        console.log(`
Usage:
  node scripts/zk_terminal_sync.js <command> [options]

Commands:
  info / status                Show device information & log capacity
  list                         List all registered users on the terminal
  sync-residents [--clean]     Sync 21 GreenValley residents into terminal (use --clean to wipe old users)
  set-user --uid <n> --name <s> Register or update a user profile / credential
  enroll --id <userId>         Trigger biometric sensor enrollment on terminal LCD
  clear-logs                   Clear old attendance log memory on terminal
        `);
    }
  } catch (err) {
    console.error('Error executing ZKTeco command:', err.message || err);
    process.exit(1);
  }
}

main();
