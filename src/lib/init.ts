// ============================================================
// v3.0.6 — Inicialización del servidor
// ============================================================
// Se ejecuta al iniciar el servidor (en runtime, NO en build time)
// para:
// 1. Ejecutar limpieza automática de datos antiguos
// 2. Iniciar el cron de limpieza (cada 24h)
//
// IMPORTANTE: solo se ejecuta si DATABASE_URL está configurada.
// En build time, DATABASE_URL no está disponible, por lo que
// la limpieza se omite para evitar errores de Prisma.

import { iniciarLimpiezaAutomatica } from './cleanup';

let inicializado = false;

export function inicializarServidor() {
  if (inicializado) return;
  inicializado = true;

  // v3.0.6: NO ejecutar limpieza en build time (cuando DATABASE_URL no está)
  // Esto evita errores de Prisma durante `next build`
  if (!process.env.DATABASE_URL) {
    console.log('=== Init: DATABASE_URL no configurada, omitiendo limpieza automática ===');
    return;
  }

  console.log('=== Inicializando servidor v3.0.6 ===');
  iniciarLimpiezaAutomatica();
  console.log('✅ Servidor inicializado: limpieza automática activa');
}
