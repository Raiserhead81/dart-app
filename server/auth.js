// Auth-Helfer: bcrypt-Hashing, Tokens, Freundescodes.
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';

const BCRYPT_ROUNDS = 11;

export function hashPassword(pw) {
  return bcrypt.hashSync(String(pw), BCRYPT_ROUNDS);
}
export function checkPassword(pw, hash) {
  try { return bcrypt.compareSync(String(pw), hash); } catch (e) { return false; }
}
export function newToken() {
  return randomBytes(32).toString('hex');
}
export function newFriendCode(db) {
  for (let i = 0; i < 50; i++) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const hit = db.prepare('SELECT 1 FROM users WHERE friend_code=?').get(code);
    if (!hit) return code;
  }
  throw new Error('kein Freundescode frei');
}
