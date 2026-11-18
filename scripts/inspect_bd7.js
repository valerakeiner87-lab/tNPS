// Investigar BD 7 — ver qué tablas tiene y arreglar conflicto
const { Client } = require('pg');
const URL = 'postgresql://neondb_owner:npg_yrto7l6FpGKd@ep-royal-sky-amu52xjn-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

(async () => {
  const client = new Client({ connectionString: URL, connectionTimeoutMillis: 15000, query_timeout: 30000 });
  await client.connect();
  const r = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position
  `);
  console.log('Tablas y columnas en BD 7:');
  let current = '';
  for (const row of r.rows) {
    if (row.table_name !== current) {
      console.log(`\n  ${row.table_name}:`);
      current = row.table_name;
    }
    console.log(`    - ${row.column_name}`);
  }
  await client.end();
})();
