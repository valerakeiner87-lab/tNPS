// password_test.js — adaptador CJS para test_neon.js
const { scryptSync, randomBytes, timingSafeEqual } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    if (!stored) return false;
    if (stored.startsWith('$2')) {
      try {
        const bcrypt = require('bcryptjs');
        return bcrypt.compareSync(password, stored);
      } catch {
        return false;
      }
    }
    if (stored.startsWith('scrypt$')) {
      const parts = stored.split('$');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const storedHash = parts[2];
      const hash = scryptSync(password, salt, 64).toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const storedBuf = Buffer.from(storedHash, 'hex');
      if (hashBuf.length !== storedBuf.length) return false;
      return timingSafeEqual(hashBuf, storedBuf);
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
