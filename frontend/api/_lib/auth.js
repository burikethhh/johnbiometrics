const jwt = require('jsonwebtoken');

function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { user: decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 403 };
  }
}

function requireRole(user, roles) {
  if (!user || !roles.includes(user.role)) {
    return { error: 'Insufficient permissions', status: 403 };
  }
  return { ok: true };
}

function corsHeaders(origin) {
  const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'http://localhost:3001',
    'https://frontend-lake-seven-59.vercel.app',
    'https://fingergate-app.vercel.app',
  ].filter(Boolean);

  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowed || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function handleOptions(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers?.origin),
    });
  }
  return null;
}

module.exports = { authenticateToken, requireRole, corsHeaders, handleOptions };
