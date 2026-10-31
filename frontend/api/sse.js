const { corsHeaders, authenticateToken } = require('./_lib/auth');

// In-memory store for recent verifications (per function instance)
let recentVerifications = [];

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers?.origin);

  if (req.method === 'OPTIONS') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  // SSE endpoint
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...headers
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const interval = setInterval(() => {
      // Check for new verifications
      if (global.__verificationQueue && global.__verificationQueue.length > 0) {
        const newVerifications = global.__verificationQueue.splice(0);
        for (const v of newVerifications) {
          res.write(`data: ${JSON.stringify({ type: 'new-verification', data: v })}\n\n`);
        }
      }

      // Send heartbeat
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 3000);

    req.on('close', () => {
      clearInterval(interval);
    });

    return;
  }

  // POST endpoint to broadcast verification results
  if (req.method === 'POST') {
    const auth = authenticateToken(req);
    if (auth.error) {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      return res.status(auth.status).json({ error: auth.error });
    }

    const verification = req.body;
    global.__verificationQueue = global.__verificationQueue || [];
    global.__verificationQueue.push(verification);

    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
