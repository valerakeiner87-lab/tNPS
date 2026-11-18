'use server';

/**
 * Server Actions para gestión de premios ATC.
 * Usa Prisma (compatible con SQLite dev y PostgreSQL prod).
 * Permisos: SUPERVISOR y ADMIN pueden CRUD de premios.
 */

import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { randomUUID } from 'crypto';
import type { PremioATC, ConfigATC } from '@/lib/atc-types';
import { semanaISOActual } from '@/lib/atc-types';

function canManagePremios(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'SUPERVISOR' || r === 'ADMIN';
}

export async function guardarPremioAction(
  premio: Partial<PremioATC>
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await getSession();
  if (!session || !canManagePremios(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden gestionar premios.' };
  }

  if (!premio.nombre || !premio.nombre.trim()) {
    return { ok: false, error: 'El nombre del premio es obligatorio.' };
  }

  const id = premio.id || randomUUID();
  // Normaliza el área: si no viene o es inválida, default a 'ambas'
  const areaPremio: 'digital' | 'telefonico' | 'ambas' =
    premio.area === 'digital' || premio.area === 'telefonico' || premio.area === 'ambas'
      ? premio.area
      : 'ambas';
  // v3.0: TMO máximo requerido + línea requerida + imagen URL
  const tmoMaximoRequerido =
    typeof premio.tmoMaximoRequerido === 'number' && premio.tmoMaximoRequerido > 0
      ? premio.tmoMaximoRequerido
      : null;
  const lineaRequerida =
    typeof premio.lineaRequerida === 'string' && premio.lineaRequerida.trim().length > 0
      ? premio.lineaRequerida.trim()
      : null;
  const imagenUrl = premio.imagenUrl ?? null;
  // v3.0.4: duración del premio + límite de reclamos por asesor
  const duracionTipoRaw = (premio as any).duracionTipo;
  const duracionTipo =
    typeof duracionTipoRaw === 'string' &&
    ['hora', 'dia', 'semana', 'mes'].includes(duracionTipoRaw)
      ? duracionTipoRaw
      : null;
  const duracionValor =
    typeof (premio as any).duracionValor === 'number' && (premio as any).duracionValor > 0
      ? Math.max(0, Math.floor((premio as any).duracionValor))
      : 0;
  const maxReclamosPorAsesor =
    typeof (premio as any).maxReclamosPorAsesor === 'number' &&
    (premio as any).maxReclamosPorAsesor > 0
      ? Math.max(0, Math.floor((premio as any).maxReclamosPorAsesor))
      : 0;
  // v3.0.7: Canje por racha
  const canjePorRacha = Boolean((premio as any).canjePorRacha);
  const promotoresRequeridosRacha =
    typeof (premio as any).promotoresRequeridosRacha === 'number' &&
    (premio as any).promotoresRequeridosRacha > 0
      ? Math.max(1, Math.floor((premio as any).promotoresRequeridosRacha))
      : 3;
  const tipoCanjeRaw = (premio as any).tipoCanje;
  const tipoCanje =
    typeof tipoCanjeRaw === 'string' && ['monedas', 'racha', 'ambas'].includes(tipoCanjeRaw)
      ? tipoCanjeRaw
      : 'monedas';

  try {
    await db.premioATC.upsert({
      where: { id },
      create: {
        id,
        nombre: premio.nombre || '',
        descripcion: premio.descripcion || '',
        costoATC: premio.costoATC ?? 10,
        categoria: premio.categoria || 'General',
        emoji: premio.emoji || '🎁',
        stock: premio.stock ?? -1,
        umbralDiario: premio.umbralDiario ?? 0,
        umbralSemanal: premio.umbralSemanal ?? 0,
        autoAprobacion: premio.autoAprobacion ?? false,
        area: areaPremio,
        tmoMaximoRequerido,
        lineaRequerida,
        imagenUrl,
        duracionTipo,
        duracionValor,
        maxReclamosPorAsesor,
        canjePorRacha,
        promotoresRequeridosRacha,
        tipoCanje,
        activo: premio.activo ?? true,
        creado: premio.creado || new Date().toISOString(),
        actualizado: new Date().toISOString(),
      },
      update: {
        nombre: premio.nombre || '',
        descripcion: premio.descripcion || '',
        costoATC: premio.costoATC ?? 10,
        categoria: premio.categoria || 'General',
        emoji: premio.emoji || '🎁',
        stock: premio.stock ?? -1,
        umbralDiario: premio.umbralDiario ?? 0,
        umbralSemanal: premio.umbralSemanal ?? 0,
        autoAprobacion: premio.autoAprobacion ?? false,
        area: areaPremio,
        tmoMaximoRequerido,
        lineaRequerida,
        imagenUrl,
        duracionTipo,
        duracionValor,
        maxReclamosPorAsesor,
        canjePorRacha,
        promotoresRequeridosRacha,
        tipoCanje,
        activo: premio.activo ?? true,
        actualizado: new Date().toISOString(),
      },
    });
    return { ok: true, id };
  } catch (err) {
    console.error('Error guardarPremioAction:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Error al guardar el premio: ${msg}` };
  }
}

export async function eliminarPremioAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManagePremios(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden eliminar premios.' };
  }

  try {
    await db.premioATC.delete({ where: { id } });
    return { ok: true };
  } catch (err) {
    console.error('Error eliminarPremioAction:', err);
    return { ok: false, error: 'Error al eliminar el premio.' };
  }
}

export async function leerPremiosAction(): Promise<PremioATC[]> {
  const session = await getSession();
  // Área del usuario (digital | telefonico). Default 'digital' si no hay sesión.
  const areaUsuario = session?.area || 'digital';

  try {
    // Filtro por área: mostrar premios del área del usuario + 'ambas'
    const rows = await db.premioATC.findMany({
      where: {
        activo: true,
        OR: [{ area: areaUsuario }, { area: 'ambas' }],
      },
      orderBy: { costoATC: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      costoATC: r.costoATC,
      categoria: r.categoria || 'General',
      emoji: r.emoji || '🎁',
      stock: r.stock ?? -1,
      umbralDiario: r.umbralDiario ?? 0,
      umbralSemanal: r.umbralSemanal ?? 0,
      autoAprobacion: r.autoAprobacion ?? false,
      activo: r.activo ?? true,
      creado: r.creado,
      actualizado: r.actualizado || undefined,
      area: (r.area as 'digital' | 'telefonico' | 'ambas') || 'ambas',
      tmoMaximoRequerido: r.tmoMaximoRequerido ?? null,
      lineaRequerida: r.lineaRequerida ?? null,
      imagenUrl: r.imagenUrl ?? null,
      // v3.0.4: duración + límite reclamos
      duracionTipo: (r.duracionTipo as any) ?? null,
      duracionValor: r.duracionValor ?? 0,
      maxReclamosPorAsesor: r.maxReclamosPorAsesor ?? 0,
      // v3.0.7: canje por racha
      canjePorRacha: (r as any).canjePorRacha ?? false,
      promotoresRequeridosRacha: (r as any).promotoresRequeridosRacha ?? 3,
      tipoCanje: (r as any).tipoCanje ?? 'monedas',
    }));
  } catch (err) {
    console.error('Error leerPremiosAction:', err);
    return [];
  }
}

/** Lee TODOS los premios (para el panel de admin, sin filtro de área) */
export async function leerTodosPremiosAction(): Promise<PremioATC[]> {
  const session = await getSession();
  if (!session || !canManagePremios(session.role)) return [];

  try {
    const rows = await db.premioATC.findMany({ orderBy: { creado: 'desc' } });
    return rows.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      costoATC: r.costoATC,
      categoria: r.categoria || 'General',
      emoji: r.emoji || '🎁',
      stock: r.stock ?? -1,
      umbralDiario: r.umbralDiario ?? 0,
      umbralSemanal: r.umbralSemanal ?? 0,
      autoAprobacion: r.autoAprobacion ?? false,
      activo: r.activo ?? true,
      creado: r.creado,
      actualizado: r.actualizado || undefined,
      area: (r.area as 'digital' | 'telefonico' | 'ambas') || 'ambas',
      tmoMaximoRequerido: r.tmoMaximoRequerido ?? null,
      lineaRequerida: r.lineaRequerida ?? null,
      imagenUrl: r.imagenUrl ?? null,
      // v3.0.4: duración + límite reclamos
      duracionTipo: (r.duracionTipo as any) ?? null,
      duracionValor: r.duracionValor ?? 0,
      maxReclamosPorAsesor: r.maxReclamosPorAsesor ?? 0,
      // v3.0.7: canje por racha
      canjePorRacha: (r as any).canjePorRacha ?? false,
      promotoresRequeridosRacha: (r as any).promotoresRequeridosRacha ?? 3,
      tipoCanje: (r as any).tipoCanje ?? 'monedas',
    }));
  } catch (err) {
    console.error('Error leerTodosPremiosAction:', err);
    return [];
  }
}

/**
 * ⚠️ BUG FIX: Reiniciar wallets PRESERVANDO el historial de premios canjeados.
 *
 * Antes, este método borraba `stats` (totalGastado, totalGanado, mejorRacha)
 * y `metricas_semanales`, lo que hacía que los premios canjeados
 * "desaparecieran" del historial del asesor.
 *
 * Ahora SOLO reseteamos:
 * - saldo (vuelve al saldo inicial)
 * - racha_actual (racha semanal)
 * - semana_actual (nueva semana)
 * PRESERVANDO:
 * - stats (historial acumulado de promotores/pasivos/detractores/ganado/gastado)
 * - metricas_semanales (historial de métricas por semana)
 * - ultima_promocion_ts (timestamp de última promoción)
 */
export async function reiniciarWalletsAction(): Promise<{ ok: boolean; error?: string; count?: number }> {
  const session = await getSession();
  if (!session || !canManagePremios(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden reiniciar wallets.' };
  }

  try {
    // Leer config para obtener saldo inicial
    const config = await db.configATC.findUnique({ where: { id: 'global' } });
    const saldoInicial = config?.saldoInicial ?? 50;
    const semanaActual = semanaISOActual();

    // ✅ FIX: Preservamos stats y metricas_semanales (historial de premios)
    const result = await db.walletATC.updateMany({
      data: {
        saldo: saldoInicial,
        rachaActual: 0,
        semanaActual: semanaActual,
        actualizado: new Date().toISOString(),
      },
    });
    return { ok: true, count: result.count };
  } catch (err) {
    console.error('Error reiniciarWalletsAction:', err);
    return { ok: false, error: 'Error al reiniciar wallets.' };
  }
}

export async function actualizarConfigAction(
  config: Partial<ConfigATC> & { caducidadDias?: number }
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManagePremios(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden cambiar la configuración.' };
  }

  try {
    // v3.0: puntosDetractor unificado
    await db.configATC.upsert({
      where: { id: 'global' },
      create: {
        sistemaATCActivo: config.sistemaATCActivo ?? true,
        saldoInicial: config.saldoInicial ?? 50,
        puntosPromotor: config.puntosPromotor ?? 1,
        puntosPromotorRacha: config.puntosPromotorRacha ?? 2,
        puntosPasivo: config.puntosPasivo ?? 0,
        puntosDetractor: (config as any).puntosDetractor ?? -1,
        rachaVentanaMinutos: config.rachaVentanaMinutos ?? 60,
        diaReinicioSemana: 0,
        horaReinicio: 23,
        minutoReinicio: 59,
      },
      update: {
        sistemaATCActivo: config.sistemaATCActivo ?? true,
        saldoInicial: config.saldoInicial ?? 50,
        puntosPromotor: config.puntosPromotor ?? 1,
        puntosPromotorRacha: config.puntosPromotorRacha ?? 2,
        puntosPasivo: config.puntosPasivo ?? 0,
        puntosDetractor: (config as any).puntosDetractor ?? -1,
        rachaVentanaMinutos: config.rachaVentanaMinutos ?? 60,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error('Error actualizarConfigAction:', err);
    return { ok: false, error: 'Error al actualizar configuración.' };
  }
}
