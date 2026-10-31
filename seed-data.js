const https = require('https');

const BASE = 'https://fingergate-app.vercel.app';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ raw: body, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function generateMinutiae(seed) {
  const minutiae = [];
  const rng = (s) => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
  for (let i = 0; i < 40; i++) {
    minutiae.push({
      x: Math.floor(rng(seed + i * 7) * 300),
      y: Math.floor(rng(seed + i * 13) * 400),
      type: rng(seed + i) > 0.5 ? 'ridge_ending' : 'bifurcation',
      angle: Math.floor(rng(seed + i * 3) * 360)
    });
  }
  return JSON.stringify({ minutiae });
}

function generateImpostorMinutiae(seed) {
  const minutiae = [];
  const rng = (s) => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
  for (let i = 0; i < 40; i++) {
    minutiae.push({
      x: Math.floor(rng(seed + i * 11 + 500) * 300),
      y: Math.floor(rng(seed + i * 17 + 500) * 400),
      type: rng(seed + i + 200) > 0.5 ? 'ridge_ending' : 'bifurcation',
      angle: Math.floor(rng(seed + i * 5 + 200) * 360)
    });
  }
  return JSON.stringify({ minutiae });
}

const residents = [
  { full_name: 'Juan Dela Cruz', address: 'Blk 1 Lot 5, Tamped, Matalam, NC', contact_number: '09171234567', household_number: 'HH-001' },
  { full_name: 'Maria Santos', address: 'Blk 2 Lot 12, Tamped, Matalam, NC', contact_number: '09181234568', household_number: 'HH-002' },
  { full_name: 'Pedro Reyes', address: 'Blk 3 Lot 8, Tamped, Matalam, NC', contact_number: '09191234569', household_number: 'HH-003' },
  { full_name: 'Ana Garcia', address: 'Blk 1 Lot 3, Tamped, Matalam, NC', contact_number: '09201234570', household_number: 'HH-004' },
  { full_name: 'Roberto Mendoza', address: 'Blk 4 Lot 7, Tamped, Matalam, NC', contact_number: '09211234571', household_number: 'HH-005' },
  { full_name: 'Liza Bautista', address: 'Blk 2 Lot 1, Tamped, Matalam, NC', contact_number: '09221234572', household_number: 'HH-006' },
  { full_name: 'Carlos Villanueva', address: 'Blk 5 Lot 9, Tamped, Matalam, NC', contact_number: '09231234573', household_number: 'HH-007' },
  { full_name: 'Teresa Aquino', address: 'Blk 3 Lot 4, Tamped, Matalam, NC', contact_number: '09241234574', household_number: 'HH-008' },
  { full_name: 'Miguel Torres', address: 'Blk 1 Lot 7, Tamped, Matalam, NC', contact_number: '09251234575', household_number: 'HH-009' },
  { full_name: 'Sofia Ramos', address: 'Blk 6 Lot 2, Tamped, Matalam, NC', contact_number: '09261234576', household_number: 'HH-010' },
  { full_name: 'Jose Lim', address: 'Blk 2 Lot 6, Tamped, Matalam, NC', contact_number: '09271234577', household_number: 'HH-011' },
  { full_name: 'Grace Cruz', address: 'Blk 4 Lot 3, Tamped, Matalam, NC', contact_number: '09281234578', household_number: 'HH-012' },
  { full_name: 'Ricardo Fernando', address: 'Blk 5 Lot 11, Tamped, Matalam, NC', contact_number: '09291234579', household_number: 'HH-013' },
  { full_name: 'Patricia Diaz', address: 'Blk 3 Lot 10, Tamped, Matalam, NC', contact_number: '09301234580', household_number: 'HH-014' },
  { full_name: 'Fernando Navarro', address: 'Blk 1 Lot 9, Tamped, Matalam, NC', contact_number: '09311234581', household_number: 'HH-015' },
  { full_name: 'Isabelle Mercado', address: 'Blk 6 Lot 5, Tamped, Matalam, NC', contact_number: '09321234582', household_number: 'HH-016' },
  { full_name: 'Anthony Pascual', address: 'Blk 2 Lot 8, Tamped, Matalam, NC', contact_number: '09331234583', household_number: 'HH-017' },
  { full_name: 'Camille Rivera', address: 'Blk 4 Lot 1, Tamped, Matalam, NC', contact_number: '09341234584', household_number: 'HH-018' },
  { full_name: 'Dennis Salvador', address: 'Blk 5 Lot 6, Tamped, Matalam, NC', contact_number: '09351234585', household_number: 'HH-019' },
  { full_name: 'Elena Concepcion', address: 'Blk 3 Lot 2, Tamped, Matalam, NC', contact_number: '09361234586', household_number: 'HH-020' },
];

const fingerNames = ['Right Index', 'Right Middle', 'Left Index', 'Left Middle', 'Right Thumb', 'Left Thumb'];
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('=== FingerGate Database Seeder ===\n');

  const login = await request('POST', '/api/auth?action=login', { username: 'Admin', password: 'admin3211' });
  const token = login.token;
  if (!token) { console.error('Login failed:', login); return; }
  console.log('Logged in as Admin\n');

  // 1. Create residents
  console.log('Creating 20 residents...');
  const residentIds = [];
  for (const r of residents) {
    const result = await request('POST', '/api/residents', r, token);
    const id = result.residentId || result.resident_id;
    if (id) {
      residentIds.push(id);
      console.log(`  [${id}] ${r.full_name}`);
    } else {
      console.log(`  SKIP ${r.full_name}: ${JSON.stringify(result)}`);
    }
  }
  console.log(`Created ${residentIds.length} residents\n`);

  // 2. Register fingerprints (one per resident)
  console.log('Registering fingerprints...');
  const fpMap = [];
  for (let i = 0; i < residentIds.length; i++) {
    const rid = residentIds[i];
    const encoding = generateMinutiae(i * 100 + 1);
    const result = await request('POST', '/api/fingerprints', {
      resident_id: rid,
      encoding
    }, token);
    const fpId = result.fingerprintId || result.fingerprint_id;
    if (fpId) {
      fpMap.push({ fingerprintId: fpId, residentId: rid, encoding });
      console.log(`  FP#${fpId} -> Resident#${rid}`);
    } else {
      console.log(`  FAIL resident ${rid}: ${JSON.stringify(result)}`);
    }
  }
  console.log(`Registered ${fpMap.length} fingerprints\n`);

  // 3. Generate access logs via verify endpoint
  console.log('Generating 300 access log entries over 60 days...');
  let genuineAttempts = 0, impostorAttempts = 0;
  let grantedGenuine = 0, deniedGenuine = 0;
  let grantedImpostor = 0, deniedImpostor = 0;
  const speeds = [];

  for (let i = 0; i < 300; i++) {
    const isGenuine = Math.random() > 0.15;
    const fp = isGenuine ? pickRandom(fpMap) : null;
    const encoding = isGenuine ? fp.encoding : generateImpostorMinutiae(i + 1000);
    const direction = Math.random() > 0.5 ? 'Entry' : 'Exit';

    const result = await request('POST', '/api/fingerprints?action=verify', {
      encoding,
      device_id: 1,
      is_genuine: isGenuine ? 1 : 0,
      direction
    }, token);

    if (result.status) {
      if (isGenuine) {
        genuineAttempts++;
        if (result.status === 'Granted') grantedGenuine++;
        else deniedGenuine++;
      } else {
        impostorAttempts++;
        if (result.status === 'Granted') grantedImpostor++;
        else deniedImpostor++;
      }
      if (result.duration) speeds.push(result.duration);
    }

    if ((i + 1) % 50 === 0) console.log(`  Progress: ${i + 1}/300`);
  }

  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  console.log(`\n=== Seed Complete ===`);
  console.log(`Residents: ${residentIds.length}`);
  console.log(`Fingerprints: ${fpMap.length}`);
  console.log(`Access Logs: 300`);
  console.log(`  Genuine: ${genuineAttempts} (${((genuineAttempts / 300) * 100).toFixed(1)}%)`);
  console.log(`  Impostor: ${impostorAttempts} (${((impostorAttempts / 300) * 100).toFixed(1)}%)`);
  console.log(`  Granted: ${grantedGenuine + grantedImpostor}`);
  console.log(`  Denied: ${deniedGenuine + deniedImpostor}`);
  console.log(`  Avg Speed: ${avgSpeed}ms`);

  console.log('\n=== Evaluation Results ===');
  const evalResult = await request('GET', '/api/evaluation', null, token);
  console.log(JSON.stringify(evalResult, null, 2));

  const thresholdResult = await request('GET', '/api/evaluation?type=threshold', null, token);
  console.log('\nThreshold Analysis:');
  console.log(JSON.stringify(thresholdResult, null, 2));
}

main().catch(console.error);
