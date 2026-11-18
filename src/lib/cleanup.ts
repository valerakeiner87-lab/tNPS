// ============================================================
// v3.0.5 — Limpieza automática de datos antiguos
// ============================================================
// Se ejecuta al iniciar el servidor y luego cada 24 horas.
// Borra:
// - Partidas de juego > 90 días
// - Notificaciones leídas > 30 días
// - Respuestas de formulario > 6 meses
// - Audit log > 6 meses

import { db } from './db';

const UN_DIA = 24 * 60 * 60 * 1000;
const UN_MES = 30 * UN_DIA;

export async function limpiarDatosAntiguos(): Promise<{
  partidasJuego: number;
  notificaciones: number;
  respuestasForm: number;
  auditLog: number;
}> {
  // v3.0.6: NO ejecutar si DATABASE_URL no está configurada (build time)
  if (!process.env.DATABASE_URL) {
    return { partidasJuego: 0, notificaciones: 0, respuestasForm: 0, auditLog: 0 };
  }

  const ahora = new Date();
  const hace90Dias = new Date(ahora.getTime() - 90 * UN_DIA);
  const hace30Dias = new Date(ahora.getTime() - 30 * UN_DIA);
  const hace6Meses = new Date(ahora.getTime() - 6 * UN_MES);

  let partidasJuego = 0;
  let notificaciones = 0;
  let respuestasForm = 0;
  let auditLog = 0;

  try {
    // Partidas de juego > 90 días
    const r1 = await db.partidaJuego.deleteMany({
      where: { createdAt: { lt: hace90Dias } },
    });
    partidasJuego = r1.count;
  } catch (e) {
    console.warn('Limpieza partidasJuego falló:', e);
  }

  try {
    // Notificaciones leídas > 30 días
    const r2 = await db.notificacionATC.deleteMany({
      where: {
        leida: true,
        createdAt: { lt: hace30Dias },
      },
    });
    notificaciones = r2.count;
  } catch (e) {
    console.warn('Limpieza notificaciones falló:', e);
  }

  try {
    // Respuestas de formulario > 6 meses
    const r3 = await db.respuestaFormulario.deleteMany({
      where: { createdAt: { lt: hace6Meses } },
    });
    respuestasForm = r3.count;
  } catch (e) {
    console.warn('Limpieza respuestasForm falló:', e);
  }

  try {
    // Audit log > 6 meses
    const r4 = await db.auditLog.deleteMany({
      where: { createdAt: { lt: hace6Meses } },
    });
    auditLog = r4.count;
  } catch (e) {
    console.warn('Limpieza auditLog falló:', e);
  }

  const total = partidasJuego + notificaciones + respuestasForm + auditLog;
  if (total > 0) {
    console.log(`🧹 Limpieza automática: ${total} registros borrados (partidas: ${partidasJuego}, notifs: ${notificaciones}, respuestas: ${respuestasForm}, audit: ${auditLog})`);
  }

  return { partidasJuego, notificaciones, respuestasForm, auditLog };
}

/** Inicia el cron de limpieza (cada 24 horas) */
export function iniciarLimpiezaAutomatica() {
  // v3.0.6: NO iniciar si DATABASE_URL no está configurada (build time)
  if (!process.env.DATABASE_URL) {
    return;
  }
  // Ejecutar inmediatamente al iniciar
  limpiarDatosAntiguos().catch(() => undefined);
  // Luego cada 24 horas
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      limpiarDatosAntiguos().catch(() => undefined);
    }, 24 * 60 * 60 * 1000); // 24 horas
  }
}
