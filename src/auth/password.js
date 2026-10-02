import crypto from 'node:crypto';

const KEYLEN = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION }, (err, key) => {
      if (err) reject(err); else resolve(key.toString('hex'));
    });
  });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt}$${derived}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, n, r, p, salt, expected] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !expected) return false;
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: Number(n), r: Number(r), p: Number(p) }, (err, key) => {
      if (err) reject(err); else resolve(key.toString('hex'));
    });
  });
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
