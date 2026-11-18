// Ejecuta `prisma db push` en las 7 BDs Neon para crear todas las tablas.
// Se ejecuta desde fuera del Docker, una sola vez, para que cuando HF
// arranque ya todo esté listo.

const { execSync } = require('child_process');

const URLS = [
  'postgresql://neondb_owner:npg_eOtcs3rByJG7@ep-frosty-moon-b4vw32xp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_UJsjRQqNp1x2@ep-damp-meadow-b4qa0d1n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gozHd28BDlOe@ep-holy-smoke-b4jwnenr-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_gtySUlro37ea@ep-ancient-rain-b490nfti-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_PyzerEG94ZOk@ep-bold-wildflower-b5q3v6zf-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_rD4moHwXuQh2@ep-polished-smoke-b4vwp4xw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
];

(async () => {
  console.log('=== APLICANDO PRISMA DB PUSH A LAS 7 BDs ===\n');
  let okCount = 0;
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const host = url.split('@')[1]?.split('/')[0];
    console.log(`\n=== BD ${i + 1}: ${host} ===`);
    const t0 = Date.now();
    try {
      const output = execSync(
        `DATABASE_URL='${url}' npx prisma db push --accept-data-loss --skip-generate`,
        { encoding: 'utf8', timeout: 120000, cwd: process.cwd() }
      );
      const dt = Date.now() - t0;
      // Solo mostrar últimas líneas
      const lines = output.split('\n').filter(Boolean);
      console.log(lines.slice(-3).join('\n'));
      console.log(`✅ OK en ${dt}ms`);
      okCount++;
    } catch (e) {
      const dt = Date.now() - t0;
      console.log(`❌ Error en ${dt}ms:`, e.message?.substring(0, 300) || String(e));
    }
  }
  console.log(`\n=== RESUMEN: ${okCount}/${URLS.length} BDs con schema aplicado ===`);

  // Ahora crear admin user en todas
  console.log('\n=== CREANDO USUARIOS ADMIN Y SUPERVISOR EN LAS 7 BDs ===\n');
  const { Client } = require('pg');
  const crypto = require('crypto');
  function hashPassword(p) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(p, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  }
  const adminHash = hashPassword('admin123');
  const supHash = hashPassword('supervisor123');

  let userOk = 0;
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const host = url.split('@')[1]?.split('/')[0];
    console.log(`BD ${i + 1}: ${host}`);
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 15000, query_timeout: 30000 });
    try {
      await client.connect();
      // Insertar admin (ON CONFLICT por si ya existe)
      await client.query(`
        INSERT INTO "users" ("id", "username", "password_hash", "name", "role", "area", "login_normalizado", "activo", "debe_cambiar_password", "created_at", "updated_at")
        VALUES ('admin-001', 'admin', $1, 'Administrador', 'ADMIN', 'digital', 'admin', true, false, now(), now())
        ON CONFLICT ("username") DO UPDATE SET "password_hash" = EXCLUDED."password_hash", "role" = EXCLUDED."role", "activo" = true
      `, [adminHash]);
      await client.query(`
        INSERT INTO "users" ("id", "username", "password_hash", "name", "role", "area", "login_normalizado", "activo", "debe_cambiar_password", "created_at", "updated_at")
        VALUES ('supervisor-001', 'supervisor', $1, 'Supervisor Demo', 'SUPERVISOR', 'digital', 'supervisor', true, false, now(), now())
        ON CONFLICT ("username") DO UPDATE SET "password_hash" = EXCLUDED."password_hash", "role" = EXCLUDED."role", "activo" = true
      `, [supHash]);
      console.log(`  ✅ admin + supervisor creados`);
      userOk++;
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    } finally {
      try { await client.end(); } catch {}
    }
  }
  console.log(`\n=== RESUMEN: ${userOk}/${URLS.length} BDs con usuarios creados ===`);
})();
