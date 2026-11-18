// Test de las 8 nuevas BDs Neon — verifica conexión y cuenta tablas
const { Client } = require('pg');

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
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
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
      const r = await client.query('SELECT NOW() as now, current_database() as db');
      console.log(`✅ OK en ${Date.now() - t0}ms — DB: ${r.rows[0].db}`);
      // Contar tablas existentes
      try {
        const t = await client.query(`
          SELECT count(*) as n FROM information_schema.tables
          WHERE table_schema = 'public'
        `);
        console.log(`   Tablas en public: ${t.rows[0].n}`);
      } catch (e) {
        console.log('   (no pude contar tablas:', e.message.substring(0, 80), ')');
      }
    } catch (e) {
      console.log(`❌ Error en ${Date.now() - t0}ms: ${e.message.substring(0, 200)}`);
    } finally {
      try { await client.end(); } catch {}
    }
  }
})();
