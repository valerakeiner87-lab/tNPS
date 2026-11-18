// src/app/actions/racha-actions.ts
'use server';

/**
 * v3.0.7 — Server Actions para rachas de promotores y canje por racha
 */
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { randomUUID } from 'crypto';

/**
 * Calcula las rachas de promotores de un asesor desde el 17/09/2026.
 * Una racha = 3+ promotores seguidos en el mismo día, sin detractor ni pasivo en medio.
 * Devuelve cuántas rachas tiene disponibles para canjear.
 */
export async function calcularRachasDisponiblesAction(loginNormalizado: string): Promise<{
  rachasDisponibles: number;
  totalRachasHistoricas: number;
  mejorRacha: number;
  detalles: Array<{ fecha: string; rachas: number; promotores: number }>;
}> {
  const session = await getSession();
  if (!session) return { rachasDisponibles: 0, totalRachasHistoricas: 0, mejorRacha: 0, detalles: [] };

  // Fecha de inicio: 17/09/2026
  const fechaInicio = '2026-09-17';

  // Leer encuestas del asesor desde esa fecha
  const encuestas = await db.encuesta.findMany({
    where: {
      loginNormalizado,
      fechaDia: { gte: fechaInicio },
    },
    orderBy: { fechaDia: 'asc' },
    select: { fechaDia: true, grupo: true, hora: true },
  });

  // Agrupar por día
  const porDia = new Map<string, string[]>();
  for (const e of encuestas) {
    if (!porDia.has(e.fechaDia)) porDia.set(e.fechaDia, []);
    porDia.get(e.fechaDia)!.push(e.grupo);
  }

  let totalRachas = 0;
  let mejorRacha = 0;
  const detalles: Array<{ fecha: string; rachas: number; promotores: number }> = [];

  for (const [fecha, grupos] of porDia.entries()) {
    let rachaActual = 0;
    let rachasDelDia = 0;
    let promotoresDelDia = 0;

    for (const grupo of grupos) {
      if (grupo === 'Promotor') {
        rachaActual++;
        promotoresDelDia++;
        if (rachaActual >= 3) {
          rachasDelDia++;
          totalRachas++;
          rachaActual = 0; // Reiniciar después de contar una racha
        }
      } else {
        // Detractor o Pasivo rompe la racha
        rachaActual = 0;
      }
    }

    mejorRacha = Math.max(mejorRacha, rachaActual);
    if (rachasDelDia > 0) {
      detalles.push({ fecha, rachas: rachasDelDia, promotores: promotoresDelDia });
    }
  }

  // Leer cuántas rachas ya canjeó (de transacciones ATC)
  const canjesPrevios = await db.transaccionATC.count({
    where: {
      loginNormalizado,
      tipo: 'CANJE_RACHA',
    },
  });

  const rachasDisponibles = Math.max(0, totalRachas - canjesPrevios);

  return {
    rachasDisponibles,
    totalRachasHistoricas: totalRachas,
    mejorRacha,
    detalles,
  };
}

/**
 * Canjear un premio por racha (sin gastar ATC)
 */
export async function canjearPorRachaAction(premioId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ASESOR') {
    return { ok: false, error: 'Solo los asesores pueden canjear.' };
  }

  const premio = await db.premioATC.findUnique({ where: { id: premioId } });
  if (!premio || !premio.activo || !premio.canjePorRacha) {
    return { ok: false, error: 'Este premio no está disponible para canje por racha.' };
  }

  // Verificar rachas disponibles
  const { rachasDisponibles } = await calcularRachasDisponiblesAction(session.username);
  if (rachasDisponibles <= 0) {
    return { ok: false, error: 'No tienes rachas disponibles para canjear.' };
  }

  // Crear canje
  const canjeId = randomUUID();
  await db.canjeATC.create({
    data: {
      id: canjeId,
      loginNormalizado: session.username,
      nombreAsesor: session.name || session.username,
      premioId: premio.id,
      premioNombre: premio.nombre,
      premioEmoji: premio.emoji,
      costoATC: 0, // Canje por racha, no cuesta ATC
      estado: premio.autoAprobacion ? 'aprobado' : 'pendiente',
      solicitado: new Date().toISOString(),
    },
  });

  // Registrar transacción de racha (para descontar de las disponibles)
  await db.transaccionATC.create({
    data: {
      id: randomUUID(),
      loginNormalizado: session.username,
      tipo: 'CANJE_RACHA',
      monto: 0,
      descripcion: `Canje por racha: ${premio.nombre}`,
      semanaISO: new Date().toISOString().slice(0, 10),
      fecha: new Date().toISOString(),
      creado: new Date().toISOString(),
      procesadoPor: 'racha',
    },
  });

  return { ok: true };
}

// ============================================================
// Configuración de juegos
// ============================================================

export async function getConfigJuegosAction(): Promise<any[]> {
  const session = await getSession();
  if (!session) return [];

  let configs = await db.configJuego.findMany({ orderBy: { juego: 'asc' } });
  if (configs.length === 0) {
    // Crear configs por defecto
    const juegosDefault = [
      { juego: 'culebrita', descripcion: '🐍 Culebrita clásica' },
      { juego: 'breakout', descripcion: '🧱 Breakout' },
      { juego: 'sudoku', descripcion: '🔢 Sudoku' },
      { juego: 'solitario', descripcion: '🃏 Solitario' },
    ];
    for (const j of juegosDefault) {
      await db.configJuego.upsert({
        where: { juego: j.juego },
        create: { id: randomUUID(), juego: j.juego, descripcion: j.descripcion, atcPorPartida: 1, atcMaximoDiario: 10 },
        update: {},
      });
    }
    configs = await db.configJuego.findMany({ orderBy: { juego: 'asc' } });
  }
  return configs;
}

export async function saveConfigJuegoAction(params: {
  id: string;
  activo: boolean;
  areaActiva: string;
  atcPorPartida: number;
  atcMaximoDiario: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false, error: 'Sin permisos' };
  }
  try {
    await db.configJuego.update({
      where: { id: params.id },
      data: {
        activo: params.activo,
        areaActiva: params.areaActiva,
        atcPorPartida: params.atcPorPartida,
        atcMaximoDiario: params.atcMaximoDiario,
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al guardar configuración' };
  }
}
