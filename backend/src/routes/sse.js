const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { bus } = require('../services/zkLogImporter');

// Server-Sent Events stream. The frontend's sseService.js expects:
//   GET /api/sse?token=<jwt>  → messages shaped { type, data }
router.get('/', (req, res) => {
  let user;
  try {
    user = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', user: user.username })}\n\n`);

  const onEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'new-verification', data })}\n\n`);
    } catch (e) { /* client gone */ }
  };
  bus.on('new-verification', onEvent);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (e) { /* ignore */ }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('new-verification', onEvent);
    try { res.end(); } catch (e) { /* ignore */ }
  });
});

module.exports = router;
