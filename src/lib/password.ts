// ============================================================
// Hashing de passwords sin bcryptjs (usa crypto nativo de Node)
// ============================================================
// bcryptjs causaba stack overflow en el servidor standalone de
// Next.js. Esta implementación usa scrypt de crypto que es nativo
// y no tiene problemas de recursión.
//
// Los hashes generados tienen el formato: scrypt$<salt>$<hash>
// y son compatibles con verificaciones futuras.
// ============================================================
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

// Lazy import bcryptjs only when needed (for legacy hashes)
let bcryptjsModule: typeof import('bcryptjs') | null = null;
async function getBcryptjs() {
  if (!bcryptjsModule) {
    bcryptjsModule = await import('bcryptjs');
  }
  return bcryptjsModule;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    // Si el hash almacenado es de bcrypt (empieza con $2), no podemos
    // verificarlo con scrypt. Retornamos false para forzar reset.
    if (stored.startsWith('$2')) {
      // Intentar verificar con bcrypt si está disponible (sync API)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const bcrypt = require('bcryptjs');
        return bcrypt.compareSync(password, stored);
      } catch {
        return false;
      }
    }

    // Hash scrypt: scrypt$<salt>$<hash>
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
