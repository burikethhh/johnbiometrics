const { corsHeaders } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const headers = corsHeaders(req.headers?.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FingerGate API',
    version: '1.0.0'
  });
};
