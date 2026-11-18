// Crear usuario admin en TODAS las BDs nuevas (sin migrar datos)
// Hash precomputado para admin123 con scrypt
const { Client } = require('pg');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const URLS = [
  'postgresql://neondb_owner:npg_eOtcs3rByJG7@ep-frosty-moon-b4vw32xp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_UJsjRQqNp1x2@ep-damp-meadow-b4qa0d1n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gozHd28BDlOe@ep-holy-smoke-b4jwnenr-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gtySUlro37ea@ep-ancient-rain-b490nfti-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_PyzerEG94ZOk@ep-bold-wildflower-b5q3v6zf-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_rD4moHwXuQh2@ep-polished-smoke-b4vwp4xw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
];

const ADMIN_PASSWORD = 'admin123';
const SUPERVISOR_PASSWORD = 'supervisor123';

(async () => {
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const host = url.split('@')[1]?.split('/')[0];
    console.log(`\n=== BD ${i + 1}: ${host} ===`);
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, query_timeout: 30000 });
    try {
      await client.connect();
      // Admin user
      const adminHash = hashPassword(ADMIN_PASSWORD);
      await client.query(`
        INSERT INTO users (id, username, password_hash, name, role, area, documento, email, login_normalizado, activo, debe_cambiar_password, created_at, updated_at)
        VALUES ('admin-001', 'admin', $1, 'Administrador', 'ADMIN', 'digital', '', 'admin@claro.com.gt', 'admin', true, false, now(), now())
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, activo = true, debe_cambiar_password = false, updated_at = now()
      `, [adminHash]);
      console.log(`  ✅ admin/${ADMIN_PASSWORD} creado/actualizado`);

      // Supervisor user
      const supHash = hashPassword(SUPERVISOR_PASSWORD);
      await client.query(`
        INSERT INTO users (id, username, password_hash, name, role, area, documento, email, login_normalizado, activo, debe_cambiar_password, created_at, updated_at)
        VALUES ('supervisor-001', 'supervisor', $1, 'Supervisor Demo', 'SUPERVISOR', 'digital', '', 'supervisor@claro.com.gt', 'supervisor', true, false, now(), now())
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, activo = true, debe_cambiar_password = false, updated_at = now()
      `, [supHash]);
      console.log(`  ✅ supervisor/${SUPERVISOR_PASSWORD} creado/actualizado`);

      // Listar todos
      const r = await client.query('SELECT username, role, activo FROM users ORDER BY role');
      console.log(`  Usuarios en BD: ${r.rows.length}`);
      r.rows.forEach(u => console.log(`    - ${u.username} | ${u.role} | activo=${u.activo}`));
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    } finally {
      try { await client.end(); } catch {}
    }
  }
  console.log('\n=== FIN ===');
})();
