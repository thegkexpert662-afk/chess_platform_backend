import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: '15m', issuer: 'chess-platform' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});
  }
  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret, {issuer:'chess-platform'});
    next();
  } catch {
    res.status(401).json({error:{code:'INVALID_TOKEN',message:'Invalid or expired token'}});
  }
}
