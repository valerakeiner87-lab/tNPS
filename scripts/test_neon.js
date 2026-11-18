// Test de conexión a las 3 BDs Neon configuradas en src/lib/db.ts
// y prueba de login para los usuarios conocidos.

const { PrismaClient } = require('@prisma/client');
const { verifyPassword, hashPassword } = require('./password_test');

const BD_URLS = [
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-raspy-cloud-b5tlrb2d-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-misty-morning-b5rsb8v1-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
  'postgresql://neondb_owner:npg_eSjgm91YxEZJ@ep-morning-butterfly-b5ptbl2p-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
];

async function probarBD(label, url) {
  const client = new PrismaClient({
    log: ['error'],
    datasources: { db: { url } },
  });
  const t0 = Date.now();
  try {
    await Promise.race([
      client.$queryRaw`SELECT 1 as ok`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 15s')), 15000)),
    ]);
    const dt = Date.now() - t0;

    // Contar usuarios
    let nUsers = 0;
    let nAsesoresHC = 0;
    let nEncuestas = 0;
    let adminUser = null;
    try { nUsers = await client.user.count(); } catch (e) {}
    try { nAsesoresHC = await client.asesorHC.count(); } catch (e) {}
    try { nEncuestas = await client.encuesta.count(); } catch (e) {}
    try {
      adminUser = await client.user.findFirst({
        where: { role: { in: ['ADMIN', 'admin', 'ADMINISTRADOR'] } },
        select: { id: true, username: true, name: true, role: true, activo: true, debeCambiarPassword: true },
      });
    } catch (e) {}

    console.log(`\n✅ ${label} — CONEXIÓN OK (${dt}ms)`);
    console.log(`   Host: ${url.split('@')[1]?.split('/')[0]}`);
    console.log(`   Users: ${nUsers} | AsesoresHC: ${nAsesoresHC} | Encuestas: ${nEncuestas}`);
    if (adminUser) {
      console.log(`   Admin:`, JSON.stringify(adminUser, null, 0));
    } else {
      console.log(`   Admin: (no encontrado)`);
    }
    return { ok: true, nUsers, nAsesoresHC, nEncuestas, adminUser, client };
  } catch (err) {
    const dt = Date.now() - t0;
    console.log(`\n❌ ${label} — FALLÓ (${dt}ms): ${err.message?.substring(0, 200)}`);
    await client.$disconnect().catch(() => {});
    return { ok: false, error: err.message };
  }
}

async function testLogin(client, username, password) {
  try {
    const u = await client.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() },
          { loginNormalizado: username.toLowerCase() },
        ],
        activo: true,
      },
    });
    if (!u) return { ok: false, error: 'Usuario no encontrado' };
    const valid = verifyPassword(password, u.passwordHash);
    return { ok: valid, user: { id: u.id, username: u.username, role: u.role, name: u.name }, error: valid ? null : 'Contraseña incorrecta' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  console.log('=== TEST NEON DATABASES ===\n');
  let primeraOK = null;
  for (let i = 0; i < BD_URLS.length; i++) {
    const res = await probarBD(`BD ${i + 1}`, BD_URLS[i]);
    if (res.ok && !primeraOK) primeraOK = res;
    if (res.ok) await res.client.$disconnect().catch(() => {});
  }

  if (!primeraOK) {
    console.log('\n❌ NINGUNA BD RESPONDE');
    process.exit(1);
  }

  // Reabrir conexión a la primera BD OK para probar login
  console.log('\n=== TEST LOGIN ===\n');
  const client = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: BD_URLS[0] } },
  });

  // Usuarios comunes a probar (admin + muestra)
  const usuariosProbar = [
    { user: 'admin', pass: 'admin123' },
    { user: 'admin', pass: 'Admin123!' },
    { user: 'admin', pass: 'clarocontactcenterprodca' },
    { user: 'moises.rocha', pass: '12345' },
  ];

  // Buscar todos los usuarios activos para mostrar
  try {
    const all = await client.user.findMany({
      where: { activo: true },
      select: { username: true, role: true, name: true, debeCambiarPassword: true },
      take: 20,
      orderBy: { role: 'asc' },
    });
    console.log('Usuarios activos en BD 1 (primeros 20):');
    all.forEach(u => console.log(`  - ${u.username} | ${u.role} | ${u.name} | debeCambiarPwd: ${u.debeCambiarPassword}`));
  } catch (e) {
    console.log('No pude listar usuarios:', e.message);
  }

  for (const { user, pass } of usuariosProbar) {
    const r = await testLogin(client, user, pass);
    if (r.ok) {
      console.log(`✅ Login OK: ${user} → ${JSON.stringify(r.user)}`);
    } else {
      console.log(`❌ Login ${user}/${pass}: ${r.error}`);
    }
  }

  await client.$disconnect();
  console.log('\n=== FIN TEST ===');
})().catch(e => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
