// Script para sembrar datos de ejemplo en SQLite (desarrollo local)
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🌱 Sembrando datos de ejemplo en SQLite...');

  // Crear usuarios de ejemplo
  const users = [
    { username: 'admin', password: 'admin123', name: 'Administrador', role: 'ADMIN', area: 'digital', email: 'admin@claro.com.gt', documento: 'admin-001' },
    { username: 'supervisor', password: 'super123', name: 'Supervisor Digital', role: 'SUPERVISOR', area: 'digital', email: 'supervisor@claro.com.gt', documento: 'sup-001' },
    { username: 'suptelefonico', password: 'super123', name: 'Supervisor Telefónico', role: 'SUPERVISOR', area: 'telefonico', email: 'suptel@claro.com.gt', documento: 'sup-002' },
    { username: 'jperez', password: '1234', name: 'Juan Pérez', role: 'ASESOR', area: 'digital', email: 'jperez@claro.com.gt', documento: '1234567890101' },
    { username: 'mgomez', password: '1234', name: 'María Gómez', role: 'ASESOR', area: 'digital', email: 'mgomez@claro.com.gt', documento: '1234567890102' },
    { username: 'clopez', password: '1234', name: 'Carlos López', role: 'ASESOR', area: 'digital', email: 'clopez@claro.com.gt', documento: '1234567890103' },
    { username: 'aruiz', password: '1234', name: 'Ana Ruiz', role: 'ASESOR', area: 'telefonico', email: 'aruiz@claro.com.gt', documento: '1234567890104' },
    { username: 'lramirez', password: '1234', name: 'Luis Ramírez', role: 'ASESOR', area: 'telefonico', email: 'lramirez@claro.com.gt', documento: '1234567890105' },
  ];

  for (const u of users) {
    const id = randomUUID();
    const hash = hashPassword(u.password);
    await db.user.upsert({
      where: { username: u.username },
      create: {
        id,
        username: u.username,
        passwordHash: hash,
        name: u.name,
        role: u.role,
        area: u.area,
        email: u.email,
        documento: u.documento,
        loginNormalizado: u.username,
        activo: true,
      },
      update: {
        passwordHash: hash,
        name: u.name,
        role: u.role,
        area: u.area,
        email: u.email,
        documento: u.documento,
        loginNormalizado: u.username,
        activo: true,
      },
    });
    console.log(`  ✓ Usuario: ${u.username} (${u.role} / ${u.area})`);
  }

  // Crear config ATC
  await db.configATC.upsert({
    where: { id: 'global' },
    create: { id: 'global' },
    update: {},
  });
  console.log('  ✓ Config ATC global');

  // Crear asesores HC
  const asesoresHC = [
    { documento: '1234567890101', nombre: 'Juan Pérez', login: 'jperez', lob: 'Móvil', linea: 'Móvil', supervisor: 'Supervisor Digital', ciudad: 'Guatemala', sede: 'Central' },
    { documento: '1234567890102', nombre: 'María Gómez', login: 'mgomez', lob: 'Móvil', linea: 'Móvil', supervisor: 'Supervisor Digital', ciudad: 'Guatemala', sede: 'Central' },
    { documento: '1234567890103', nombre: 'Carlos López', login: 'clopez', lob: 'Fijo Soporte', linea: 'Fijo Soporte', supervisor: 'Supervisor Digital', ciudad: 'Mixco', sede: 'Norte' },
    { documento: '1234567890104', nombre: 'Ana Ruiz', login: 'aruiz', lob: 'Fijo Información', linea: 'Fijo Información', supervisor: 'Supervisor Telefónico', ciudad: 'Guatemala', sede: 'Central' },
    { documento: '1234567890105', nombre: 'Luis Ramírez', login: 'lramirez', lob: 'Móvil', linea: 'Móvil', supervisor: 'Supervisor Telefónico', ciudad: 'Villa Nueva', sede: 'Sur' },
  ];

  for (const a of asesoresHC) {
    await db.asesorHC.upsert({
      where: { documento: a.documento },
      create: {
        documento: a.documento,
        nombre: a.nombre,
        loginNormalizado: a.login,
        loginAib: a.login,
        cargo: 'Asesor',
        lob: a.lob,
        linea: a.linea,
        supervisor: a.supervisor,
        ciudad: a.ciudad,
        sede: a.sede,
        areas: JSON.stringify(['digital', 'telefonico']),
      },
      update: {},
    });
    console.log(`  ✓ Asesor HC: ${a.nombre}`);
  }

  // Crear wallets ATC para los asesores
  const wallets = [
    { login: 'jperez', nombre: 'Juan Pérez', saldo: 75, promotores: 5, pasivos: 2, detractores: 1, gastado: 30, racha: 3 },
    { login: 'mgomez', nombre: 'María Gómez', saldo: 120, promotores: 8, pasivos: 1, detractores: 0, gastado: 10, racha: 5 },
    { login: 'clopez', nombre: 'Carlos López', saldo: 45, promotores: 3, pasivos: 4, detractores: 2, gastado: 25, racha: 0 },
    { login: 'aruiz', nombre: 'Ana Ruiz', saldo: 95, promotores: 6, pasivos: 3, detractores: 1, gastado: 15, racha: 2 },
    { login: 'lramirez', nombre: 'Luis Ramírez', saldo: 60, promotores: 4, pasivos: 2, detractores: 1, gastado: 20, racha: 1 },
  ];

  for (const w of wallets) {
    const stats = {
      totalPromotores: w.promotores,
      totalPasivos: w.pasivos,
      totalDetractores: w.detractores,
      totalGanado: w.saldo + w.gastado,
      totalGastado: w.gastado,
      mejorRacha: Math.max(w.racha, 5),
    };
    await db.walletATC.upsert({
      where: { loginNormalizado: w.login },
      create: {
        loginNormalizado: w.login,
        nombre: w.nombre,
        saldo: w.saldo,
        semanaActual: '2026-W36',
        stats: JSON.stringify(stats),
        rachaActual: w.racha,
        metricasSemanales: JSON.stringify([
          { semanaISO: '2026-W35', promotores: 3, pasivos: 1, detractores: 0, ganado: 30, gastado: 10 },
          { semanaISO: '2026-W36', promotores: w.promotores - 3, pasivos: w.pasivos - 1, detractores: w.detractores, ganado: w.saldo - 50, gastado: w.gastado },
        ]),
        actualizado: new Date().toISOString(),
      },
      update: {},
    });
    console.log(`  ✓ Wallet: ${w.nombre} (saldo ${w.saldo})`);
  }

  // Crear premios de ejemplo
  const premios = [
    { id: randomUUID(), nombre: 'Café Starbucks', emoji: '☕', costo: 30, categoria: 'Alimentos', stock: 50 },
    { id: randomUUID(), nombre: 'Vale Google Play $5', emoji: '🎮', costo: 50, categoria: 'Tecnología', stock: 20 },
    { id: randomUUID(), nombre: 'Pizza Personal', emoji: '🍕', costo: 40, categoria: 'Alimentos', stock: 30 },
    { id: randomUUID(), nombre: 'Medio Día Libre', emoji: '🏖️', costo: 150, categoria: 'Beneficios', stock: 5 },
    { id: randomUUID(), nombre: 'Audífonos Bluetooth', emoji: '🎧', costo: 200, categoria: 'Tecnología', stock: 10 },
    { id: randomUUID(), nombre: 'Caja de Chocolates', emoji: '🍫', costo: 60, categoria: 'Alimentos', stock: 25 },
    { id: randomUUID(), nombre: 'Camiseta Claro', emoji: '👕', costo: 100, categoria: 'Ropa', stock: 15 },
    { id: randomUUID(), nombre: 'Power Bank', emoji: '🔋', costo: 180, categoria: 'Tecnología', stock: 8 },
  ];

  for (const p of premios) {
    await db.premioATC.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        nombre: p.nombre,
        emoji: p.emoji,
        costoATC: p.costo,
        categoria: p.categoria,
        stock: p.stock,
        creado: new Date().toISOString(),
        activo: true,
        autoAprobacion: false,
      },
      update: {},
    });
    console.log(`  ✓ Premio: ${p.emoji} ${p.nombre} (${p.costo} ATC)`);
  }

  // Crear canjes de ejemplo
  const canjes = [
    { login: 'jperez', nombre: 'Juan Pérez', premio: premios[0], estado: 'aprobado', solicitado: '2026-09-01T10:00:00Z' },
    { login: 'jperez', nombre: 'Juan Pérez', premio: premios[2], estado: 'pendiente', solicitado: '2026-09-08T15:00:00Z' },
    { login: 'mgomez', nombre: 'María Gómez', premio: premios[1], estado: 'aprobado', solicitado: '2026-09-02T11:00:00Z' },
    { login: 'mgomez', nombre: 'María Gómez', premio: premios[5], estado: 'pendiente', solicitado: '2026-09-09T09:00:00Z' },
    { login: 'clopez', nombre: 'Carlos López', premio: premios[0], estado: 'rechazado', solicitado: '2026-09-05T14:00:00Z' },
    { login: 'aruiz', nombre: 'Ana Ruiz', premio: premios[2], estado: 'aprobado', solicitado: '2026-09-03T16:00:00Z' },
  ];

  for (const c of canjes) {
    await db.canjeATC.create({
      data: {
        id: randomUUID(),
        loginNormalizado: c.login,
        nombreAsesor: c.nombre,
        premioId: c.premio.id,
        premioNombre: c.premio.nombre,
        premioEmoji: c.premio.emoji,
        costoATC: c.premio.costo,
        estado: c.estado,
        solicitado: c.solicitado,
        actualizado: new Date().toISOString(),
      },
    }).catch(() => {});
  }
  console.log(`  ✓ ${canjes.length} canjes de ejemplo`);

  // Crear transacciones de ejemplo
  const transacciones = [
    { login: 'jperez', tipo: 'SALDO_INICIAL', monto: 50, descripcion: 'Saldo inicial semanal' },
    { login: 'jperez', tipo: 'PROMOTOR', monto: 10, descripcion: 'Encuesta promotor #1' },
    { login: 'jperez', tipo: 'PROMOTOR_RACHA', monto: 15, descripcion: 'Promotor con racha (<1h)' },
    { login: 'jperez', tipo: 'PROMOTOR', monto: 10, descripcion: 'Encuesta promotor #2' },
    { login: 'jperez', tipo: 'DETRACTOR_ASESOR', monto: -5, descripcion: 'Detractor atribuible al asesor' },
    { login: 'jperez', tipo: 'CANJE', monto: -30, descripcion: 'Canje: Café Starbucks' },
    { login: 'mgomez', tipo: 'SALDO_INICIAL', monto: 50, descripcion: 'Saldo inicial semanal' },
    { login: 'mgomez', tipo: 'PROMOTOR', monto: 10, descripcion: 'Encuesta promotor #1' },
    { login: 'mgomez', tipo: 'PROMOTOR', monto: 10, descripcion: 'Encuesta promotor #2' },
    { login: 'mgomez', tipo: 'PROMOTOR_RACHA', monto: 15, descripcion: 'Promotor con racha' },
    { login: 'mgomez', tipo: 'CANJE', monto: -50, descripcion: 'Canje: Vale Google Play $5' },
  ];

  for (const t of transacciones) {
    await db.transaccionATC.create({
      data: {
        id: randomUUID(),
        loginNormalizado: t.login,
        tipo: t.tipo,
        monto: t.monto,
        descripcion: t.descripcion,
        semanaISO: '2026-W36',
        fecha: new Date().toISOString(),
        creado: new Date().toISOString(),
      },
    }).catch(() => {});
  }
  console.log(`  ✓ ${transacciones.length} transacciones de ejemplo`);

  // Crear encuestas de ejemplo
  const encuestas = [
    { id: randomUUID(), usuario: 'jperez', login: 'jperez', score: 10, grupo: 'Promotor', linea: 'Móvil', area: 'digital', razon: 'Excelente servicio' },
    { id: randomUUID(), usuario: 'jperez', login: 'jperez', score: 9, grupo: 'Promotor', linea: 'Móvil', area: 'digital', razon: 'Muy bueno' },
    { id: randomUUID(), usuario: 'jperez', login: 'jperez', score: 7, grupo: 'Pasivo', linea: 'Móvil', area: 'digital', razon: 'Normal' },
    { id: randomUUID(), usuario: 'jperez', login: 'jperez', score: 5, grupo: 'Detractor', linea: 'Móvil', area: 'digital', razon: 'Lento y confuso' },
    { id: randomUUID(), usuario: 'mgomez', login: 'mgomez', score: 10, grupo: 'Promotor', linea: 'Móvil', area: 'digital', razon: 'Genial' },
    { id: randomUUID(), usuario: 'mgomez', login: 'mgomez', score: 10, grupo: 'Promotor', linea: 'Móvil', area: 'digital', razon: 'Excelente atención' },
    { id: randomUUID(), usuario: 'mgomez', login: 'mgomez', score: 9, grupo: 'Promotor', linea: 'Móvil', area: 'digital', razon: 'Muy satisfecho' },
    { id: randomUUID(), usuario: 'clopez', login: 'clopez', score: 6, grupo: 'Detractor', linea: 'Fijo Soporte', area: 'digital', razon: 'No resolvieron mi problema' },
    { id: randomUUID(), usuario: 'clopez', login: 'clopez', score: 8, grupo: 'Pasivo', linea: 'Fijo Soporte', area: 'digital', razon: 'Aceptable' },
    { id: randomUUID(), usuario: 'clopez', login: 'clopez', score: 4, grupo: 'Detractor', linea: 'Fijo Soporte', area: 'digital', razon: 'Pésimo servicio' },
    { id: randomUUID(), usuario: 'aruiz', login: 'aruiz', score: 9, grupo: 'Promotor', linea: 'Fijo Información', area: 'telefonico', razon: 'Muy amable' },
    { id: randomUUID(), usuario: 'aruiz', login: 'aruiz', score: 10, grupo: 'Promotor', linea: 'Fijo Información', area: 'telefonico', razon: 'Excelente' },
    { id: randomUUID(), usuario: 'aruiz', login: 'aruiz', score: 8, grupo: 'Pasivo', linea: 'Fijo Información', area: 'telefonico', razon: 'Regular' },
    { id: randomUUID(), usuario: 'lramirez', login: 'lramirez', score: 7, grupo: 'Pasivo', linea: 'Móvil', area: 'telefonico', razon: 'Normal' },
    { id: randomUUID(), usuario: 'lramirez', login: 'lramirez', score: 10, grupo: 'Promotor', linea: 'Móvil', area: 'telefonico', razon: 'Muy bueno' },
    { id: randomUUID(), usuario: 'lramirez', login: 'lramirez', score: 9, grupo: 'Promotor', linea: 'Móvil', area: 'telefonico', razon: 'Satisfecho' },
  ];

  for (const e of encuestas) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 14));
    await db.encuesta.create({
      data: {
        id: e.id,
        idTransaccion: e.id,
        fechaDia: fecha.toISOString().slice(0, 10),
        fechaInicio: fecha.toISOString(),
        fechaRegistro: fecha.toISOString(),
        hora: fecha.getHours(),
        horaExacta: `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`,
        franjaHoraria: fecha.getHours() < 12 ? 'mañana' : fecha.getHours() < 19 ? 'tarde' : 'noche',
        grupo: e.grupo,
        tnps: e.score,
        razon: e.razon,
        comentarioSolucion: '',
        comentarioAdicional: '',
        canal: e.area === 'digital' ? 'web' : 'telefono',
        medioContacto: e.area === 'digital' ? 'chat' : 'voz',
        unidad: 'Contact Center',
        cola: e.linea,
        linea: e.linea,
        usuario: e.usuario,
        loginNormalizado: e.login,
        segmento: 'general',
        area: e.area,
        savedAtTs: BigInt(Date.now()),
      },
    }).catch(() => {});
  }
  console.log(`  ✓ ${encuestas.length} encuestas de ejemplo`);

  // Metadata
  await db.metadataCarga.upsert({
    where: { id: 'carga_actual' },
    create: {
      id: 'carga_actual',
      fechaCarga: new Date().toISOString(),
      fechaCargaTs: BigInt(Date.now()),
      totalEncuestas: encuestas.length,
      totalAsesoresHC: asesoresHC.length,
      archivoHCNombre: 'hc-sample.xlsx',
      archivoQualtricsNombre: 'qualtrics-sample.xlsx',
      cargadoPor: 'admin',
      cargadoPorUid: 'system',
    },
    update: {},
  });
  console.log('  ✓ Metadata de carga');

  // Notificaciones de ejemplo
  const notifs = [
    { tipo: 'info', titulo: 'Bienvenido a ATC Digital', mensaje: 'Sistema de incentivos y métricas para asesores Claro Guatemala.', paraAdmin: true },
    { tipo: 'canje_nuevo', titulo: 'Nuevo canje solicitado', mensaje: 'Juan Pérez solicitó: Pizza Personal 🍕', paraAdmin: true },
    { tipo: 'canje_nuevo', titulo: 'Nuevo canje solicitado', mensaje: 'María Gómez solicitó: Caja de Chocolates 🍫', paraAdmin: true },
    { tipo: 'info', titulo: 'Sistema reiniciado', mensaje: 'Se ha reiniciado el sistema ATC con datos de ejemplo.', paraAdmin: true },
  ];
  for (const n of notifs) {
    await db.notificacionATC.create({
      data: {
        id: randomUUID(),
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        paraAdmin: n.paraAdmin,
        leida: false,
        creado: new Date().toISOString(),
      },
    });
  }
  console.log(`  ✓ ${notifs.length} notificaciones de ejemplo`);

  // Beacon
  await db.beaconATC.upsert({
    where: { id: 'beacon' },
    create: { id: 'beacon', ts: new Date().toISOString() },
    update: { ts: new Date().toISOString() },
  });
  console.log('  ✓ Beacon ATC');

  // v3.0: Sembrar logros del catálogo ampliado
  const { LOGROS_CATALOGO } = await import('../src/lib/atc-types');
  for (const logro of LOGROS_CATALOGO) {
    await db.logro.upsert({
      where: { id: logro.id },
      create: {
        id: logro.id,
        clave: logro.clave,
        nombre: logro.nombre,
        descripcion: logro.descripcion,
        emoji: logro.emoji,
        categoria: logro.categoria,
        puntosRecompensa: logro.puntosRecompensa,
      },
      update: {
        clave: logro.clave,
        nombre: logro.nombre,
        descripcion: logro.descripcion,
        emoji: logro.emoji,
        categoria: logro.categoria,
        puntosRecompensa: logro.puntosRecompensa,
      },
    });
  }
  console.log(`  ✓ ${LOGROS_CATALOGO.length} logros del catálogo v3.0`);

  // v3.0: Sembrar ConfigTMOLinea por defecto
  const LINEAS_TMO = [
    { linea: 'WhatsApp Fijo Soporte', area: 'digital' },
    { linea: 'WhatsApp Fijo Información', area: 'digital' },
    { linea: 'WhatsApp Móvil', area: 'digital' },
    { linea: 'Móvil Telefónico', area: 'telefonico' },
    { linea: 'Fijo Información Telefónico', area: 'telefonico' },
    { linea: 'Fijo Soporte Telefónico', area: 'telefonico' },
  ];
  for (const l of LINEAS_TMO) {
    const id = `cfg_tmo_${l.linea.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await db.configTMOLinea.upsert({
      where: { id },
      create: {
        id,
        linea: l.linea,
        lineaNormalizada: l.linea.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        area: l.area,
        tmoMaximo: 600,
        descripcion: `TMO máximo para ${l.linea}`,
      },
      update: {},
    });
  }
  console.log(`  ✓ ${LINEAS_TMO.length} configuraciones TMO por línea`);

  console.log('\n✅ Datos sembrados exitosamente!');
  console.log('\n📋 Credenciales de acceso:');
  console.log('  • admin / admin123        (Administrador)');
  console.log('  • supervisor / super123    (Supervisor Digital)');
  console.log('  • suptelefonico / super123 (Supervisor Telefónico)');
  console.log('  • jperez / 1234            (Asesor Digital)');
  console.log('  • aruiz / 1234             (Asesor Telefónico)');
}

main()
  .catch((err) => {
    console.error('❌ Error sembrando datos:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
