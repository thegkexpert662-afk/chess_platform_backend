import { pool } from '../config/db.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken } from '../middleware/auth.js';

export async function registerUser({ username, email, password }) {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    'INSERT INTO users (username,email,password_hash) VALUES ($1,$2,$3) RETURNING id,username,email,role,rating,created_at',
    [username.toLowerCase(), email.toLowerCase(), passwordHash]
  );
  const user = result.rows[0];
  return { user, token: signAccessToken(user) };
}

export async function loginUser({ login, password }) {
  const result = await pool.query(
    'SELECT id,username,email,password_hash,role,rating,created_at FROM users WHERE username=$1 OR email=$1',
    [login.toLowerCase()]
  );
  if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  const { password_hash, ...user } = result.rows[0];
  return { user, token: signAccessToken(user) };
}
