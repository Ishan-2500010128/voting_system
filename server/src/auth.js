import jwt from 'jsonwebtoken';

export const signToken = (u) =>
  jwt.sign({ id: u.id, role: u.role, voterId: u.voterId }, process.env.JWT_SECRET, { expiresIn: '2h' });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  // Query token is only for the SSE stream, since EventSource cannot set headers.
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'This area is for admins only.' });
