require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./src/routes/auth');
const residentRoutes = require('./src/routes/residents');
const fingerprintRoutes = require('./src/routes/fingerprints');
const accessLogRoutes = require('./src/routes/accessLogs');
const dashboardRoutes = require('./src/routes/dashboard');
const deviceRoutes = require('./src/routes/devices');
const evaluationRoutes = require('./src/routes/evaluation');
const zkRoutes = require('./src/routes/zkteco');
const sseRoutes = require('./src/routes/sse');
const { runMigrations } = require('./src/database/migrate');

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001';

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
}));
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Vercel-serverless URL adapter: the frontend was written for /api/x?action=y query-style
// function URLs; Express uses subroutes. Rewrite inline so both styles hit the same code.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') || req.path === '/api/health') return next();
  const q = req.query;
  let target = null;
  if (typeof q.action === 'string' && q.action) {
    target = req.path + '/' + q.action;
    delete q.action;
  } else if (typeof q.residentId === 'string' && q.residentId) {
    target = req.path + '/resident/' + q.residentId;
  } else if (typeof q.fingerprintId === 'string' && q.fingerprintId) {
    target = req.path + '/' + q.fingerprintId;
  } else if (typeof q.id === 'string' && q.id && req.method !== 'POST') {
    target = req.path + '/' + q.id;
  }
  if (target && target !== req.path) {
    req.url = target;
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/fingerprints', fingerprintRoutes);
app.use('/api/access-logs', accessLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/zkteco', zkRoutes);
app.use('/api/sse', sseRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the built React app when present (all-local demo, single origin)
const path = require('path');
const fs = require('fs');
const FRONTEND_BUILD = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'user:', socket.user?.username);

  socket.on('join-room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, async () => {
  console.log(`FingerGate server running on port ${PORT}`);
  try {
    await runMigrations();
  } catch (err) {
    console.error('Startup migrations failed:', err.message);
  }

  // Auto-poll the ZKTeco terminal: new scans flow into access_logs and out to
  // SSE/Socket.io clients continuously. Disable with ZK_POLL_MS=0.
  // 1. Zero-Latency Real-Time Event Listener via TCP CMD_REG_EVENT
  try {
    const { startRealtimeListener } = require('./src/services/zkRealtime');
    startRealtimeListener({ io });
  } catch (err) {
    console.error('Failed to initialize ZKTeco real-time listener:', err.message);
  }

  // 2. Fallback periodic sync: catches missed events if laptop slept/disconnected.
  const POLL_MS = Number(process.env.ZK_POLL_MS ?? 30000);
  if (POLL_MS > 0) {
    console.log(`ZKTeco backup-sync enabled: every ${POLL_MS}ms`);
    setInterval(() => {
      const { importLogs } = require('./src/services/zkLogImporter');
      importLogs({ sinceMs: Date.now() - 5 * 60 * 1000, io })
        .then(stats => {
          if (stats.imported > 0) {
            console.log(`[backup-sync] imported ${stats.imported} new terminal events`);
          }
        })
        .catch(err => {
          // Quiet by default — terminal offline outside demo windows is normal noise.
          if (process.env.ZK_DEBUG) console.error('[backup-sync]', err.message);
        });
    }, POLL_MS);
  }
});

module.exports = { app, server, io };
