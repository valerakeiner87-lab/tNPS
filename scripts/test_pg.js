// Test directo de conexión PostgreSQL usando 'pg' (sin Prisma) para ver el error real.
const { Client } = require('pg');

const BD_URLS = [
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-raspy-cloud-b5tlrb2d-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-misty-morning-b5rsb8v1-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-morning-butterfly-b5ptbl2p-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
];

(async () => {
  for (let i = 0; i < BD_URLS.length; i++) {
    const url = BD_URLS[i];
    const host = url.split('@')[1]?.split('/')[0];
    console.log(`\n=== BD ${i + 1}: ${host} ===`);
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      query_timeout: 15000,
    });
    const t0 = Date.now();
    try {
      await client.connect();
      console.log(`✅ Conectado en ${Date.now() - t0}ms`);
      const r = await client.query('SELECT NOW() as now, current_database() as db, current_user as user');
      console.log('  Row:', r.rows[0]);
      const rUsers = await client.query('SELECT count(*) as n FROM users');
      console.log('  Users count:', rUsers.rows[0].n);
      const rHC = await client.query('SELECT count(*) as n FROM asesores_h_c');
      console.log('  AsesoresHC count:', rHC.rows[0].n);
      const rAdmin = await client.query("SELECT id, username, name, role, activo, debe_cambiar_password FROM users WHERE role ILIKE '%admin%' LIMIT 5");
      console.log('  Admins:', rAdmin.rows);
    } catch (e) {
      console.log(`❌ Error en ${Date.now() - t0}ms:`, e.message);
      if (e.code) console.log('  code:', e.code);
    } finally {
      try { await client.end(); } catch {}
    }
  }
})();
