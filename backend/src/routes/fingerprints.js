const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/resident/:residentId', async (req, res) => {
  try {
    const [fingerprints] = await pool.query(
      'SELECT * FROM fingerprint_data WHERE resident_id = ?',
      [req.params.residentId]
    );
    res.json(fingerprints);
  } catch (error) {
    console.error('Error fetching fingerprints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', requireRole(['Super']), async (req, res) => {
  try {
    const { resident_id, encoding, reference_image } = req.body;
    
    if (!resident_id || !encoding) {
      return res.status(400).json({ error: 'Resident ID and fingerprint encoding are required' });
    }
    
    const [resident] = await pool.query(
      'SELECT * FROM residents WHERE resident_id = ?',
      [resident_id]
    );
    
    if (resident.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO fingerprint_data (resident_id, encoding, reference_image) VALUES (?, ?, ?)',
      [resident_id, encoding, reference_image]
    );
    
    await pool.query(
      'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'REGISTER_FINGERPRINT', `Registered fingerprint for resident ID: ${resident_id}`]
    );
    
    res.status(201).json({
      message: 'Fingerprint registered successfully',
      fingerprintId: result.insertId
    });
  } catch (error) {
    console.error('Error registering fingerprint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const startTime = Date.now();
    const { encoding, device_id, is_genuine, direction } = req.body;
    
    if (!encoding) {
      return res.status(400).json({ error: 'Fingerprint encoding is required' });
    }
    
    const [allFingerprints] = await pool.query(`
      SELECT fd.*, r.full_name, r.status 
      FROM fingerprint_data fd 
      JOIN residents r ON fd.resident_id = r.resident_id 
      WHERE r.status = 'Active'
    `);
    
    if (allFingerprints.length === 0) {
      return res.status(404).json({ error: 'No registered fingerprints found' });
    }
    
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.6;
    
    for (const fp of allFingerprints) {
      const score = calculateSimilarity(encoding, fp.encoding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fp;
      }
    }
    
    const status = bestScore >= threshold ? 'Granted' : 'Denied';
    const duration = Date.now() - startTime;
    const logDirection = direction === 'Exit' ? 'Exit' : 'Entry';
    
    const [logResult] = await pool.query(
      'INSERT INTO access_logs (resident_id, status, direction, accuracy, device_id, confidence_score, verification_duration_ms, is_genuine) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [bestMatch ? bestMatch.resident_id : null, status, logDirection, bestScore, device_id || 1, bestScore, duration, is_genuine !== undefined ? is_genuine : null]
    );
    
    const verificationResult = {
      status,
      confidence: bestScore,
      duration,
      resident: bestMatch ? {
        id: bestMatch.resident_id,
        name: bestMatch.full_name
      } : null,
      logId: logResult.insertId,
      timestamp: new Date().toISOString()
    };
    
    const io = req.app.get('io');
    if (io) {
      io.emit('new-verification', verificationResult);
      io.to('dashboard').emit('dashboard-update', verificationResult);
    }
    
    res.json(verificationResult);
  } catch (error) {
    console.error('Error verifying fingerprint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:fingerprintId', requireRole(['Super']), async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT * FROM fingerprint_data WHERE fingerprint_id = ?',
      [req.params.fingerprintId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Fingerprint not found' });
    }
    
    await pool.query(
      'DELETE FROM fingerprint_data WHERE fingerprint_id = ?',
      [req.params.fingerprintId]
    );
    
    res.json({ message: 'Fingerprint deleted successfully' });
  } catch (error) {
    console.error('Error deleting fingerprint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function calculateSimilarity(encoding1, encoding2) {
  if (!encoding1 || !encoding2) return 0;
  if (encoding1 === encoding2) return 1.0;

  try {
    const data1 = typeof encoding1 === 'string' ? JSON.parse(encoding1) : encoding1;
    const data2 = typeof encoding2 === 'string' ? JSON.parse(encoding2) : encoding2;

    // 1. Direct hardware biometric token / credentialId match (e.g., WebAuthn, Serial Box ID)
    if (data1.token && data2.token && data1.token === data2.token) return 1.0;
    if (data1.credentialId && data2.credentialId && data1.credentialId === data2.credentialId) return 1.0;
    if (data1.template && data2.template && data1.template === data2.template) return 1.0;

    // 2. Minutiae spatial distance matching
    if (data1.minutiae && data2.minutiae && Array.isArray(data1.minutiae) && Array.isArray(data2.minutiae)) {
      let matches = 0;
      const threshold = 20;

      for (const m1 of data1.minutiae) {
        for (const m2 of data2.minutiae) {
          const distance = Math.sqrt(
            Math.pow(m1.x - m2.x, 2) + Math.pow(m1.y - m2.y, 2)
          );
          if (distance < threshold) {
            matches++;
            break;
          }
        }
      }

      const total = Math.max(data1.minutiae.length, data2.minutiae.length);
      const minutiaeScore = total > 0 ? matches / total : 0;
      if (minutiaeScore > 0) return minutiaeScore;
    }

    // 3. Fallback normalized template comparison
    const str1 = String(data1.template || data1.token || encoding1);
    const str2 = String(data2.template || data2.token || encoding2);
    if (str1 === str2) return 1.0;

    return 0;
  } catch (error) {
    return encoding1 === encoding2 ? 1.0 : 0;
  }
}

module.exports = router;
