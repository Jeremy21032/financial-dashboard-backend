const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.GRADUATION_JWT_SECRET || 'graduation-dev-secret-change-me';
const API_KEY = process.env.GRADUATION_API_KEY;
const JWT_REQUIRED = process.env.GRADUATION_JWT_REQUIRED !== 'false';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function signGraduationToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

function isGraduationAdmin(user) {
  return (user?.roles || []).some((r) => r.role === 'graduation_admin');
}

function isReadonlyUser(user) {
  if (isGraduationAdmin(user)) return false;
  return (user?.roles || []).some((r) => r.role === 'readonly');
}

function canWrite(user) {
  return isGraduationAdmin(user);
}

/** Rutas /auth/login y /auth/register (con setup key) */
function graduationAuth(req, res, next) {
  const path = req.path || '';
  const isPublicAuth =
    req.method === 'POST' &&
    (path === '/auth/login' || path.endsWith('/login') || path === '/auth/register' || path.endsWith('/register'));

  if (isPublicAuth) {
    return next();
  }

  if (API_KEY) {
    const key = req.headers['x-graduation-api-key'];
    if (key !== API_KEY) {
      return res.status(401).json({ error: 'API key inválida o ausente' });
    }
  }

  if (JWT_REQUIRED) {
    const user = verifyTokenFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Sesión requerida. Inicie sesión nuevamente.' });
    }
    req.graduationUser = user;
  } else {
    const user = verifyTokenFromRequest(req);
    if (user) req.graduationUser = user;
  }

  next();
}

/** Bloquea POST/PUT/DELETE para usuarios readonly */
function blockReadonlyWrites(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) {
    return next();
  }

  const path = req.path || '';
  if (path.startsWith('/auth') && (path.includes('/login') || path.includes('/register'))) {
    return next();
  }

  if (!req.graduationUser) {
    if (JWT_REQUIRED) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }
    return next();
  }

  if (!canWrite(req.graduationUser)) {
    return res.status(403).json({
      error: 'Su cuenta solo tiene permiso de lectura. Contacte al administrador.',
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.graduationUser) {
    return res.status(401).json({ error: 'Sesión requerida' });
  }
  if (!isGraduationAdmin(req.graduationUser)) {
    return res.status(403).json({ error: 'Se requiere rol de administrador' });
  }
  next();
}

module.exports = {
  graduationAuth,
  blockReadonlyWrites,
  requireAdmin,
  signGraduationToken,
  JWT_SECRET,
  isGraduationAdmin,
  isReadonlyUser,
  canWrite,
  verifyTokenFromRequest,
};
