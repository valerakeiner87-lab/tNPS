// DROP todas las tablas en las 7 BDs Neon para que prisma db push
// cree todo limpio sin conflictos.
//
// Como el usuario dijo "no vamos a migrar los datos, vamos a agregar
// los datos de nuevo", dropear todo es seguro.
//
// Usa CASCADE para que se borren en orden correcto sin importar foreign keys.

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

// SQL para dropear TODAS las tablas del schema public con CASCADE
const DROP_ALL_SQL = `
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  -- También dropear secuencias y tipos por si acaso
  FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
  END LOOP;
  FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;
`;

(async () => {
  console.log('=== DROPEANDO TODAS LAS TABLAS EN 7 BDs NEON ===\n');
  let okCount = 0;
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const host = url.split('@')[1]?.split('/')[0];
    console.log(`=== BD ${i + 1}: ${host} ===`);
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 15000,
      query_timeout: 30000,
    });
    const t0 = Date.now();
    try {
      await client.connect();

      // Contar tablas antes
      const before = await client.query(`
        SELECT count(*) as n FROM pg_tables WHERE schemaname = 'public'
      `);
      const beforeCount = parseInt(before.rows[0].n, 10);

      // Dropear todo
      await client.query(DROP_ALL_SQL);

      // Contar tablas después
      const after = await client.query(`
        SELECT count(*) as n FROM pg_tables WHERE schemaname = 'public'
      `);
      const afterCount = parseInt(after.rows[0].n, 10);

      const dt = Date.now() - t0;
      console.log(`  ✅ ${beforeCount} tablas → ${afterCount} tablas (${dt}ms)`);
      okCount++;
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    } finally {
      try { await client.end(); } catch {}
    }
  }
  console.log(`\n=== RESUMEN: ${okCount}/${URLS.length} BDs limpiadas ===`);
  console.log('\nAhora prisma db push creara todas las tablas limpias sin conflictos.');
})();
