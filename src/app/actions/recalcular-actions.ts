// src/app/actions/recalcular-actions.ts
'use server';

/**
 * v3.1.2 — Server Action para recalcular ATC de los últimos N días
 * basado en las encuestas de Qualtrics (promotor, pasivo, detractor).
 * Omite puntos de juegos, ajustes admin, logros, formularios, etc.
 */
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { randomUUID } from 'crypto';

/**
 * Recalcula los ATC de un asesor específico basándose en sus encuestas
 * de los últimos N días. Solo cuenta promotores, pasivos y detractores
 * (no juegos, no formularios, no logros, no ajustes admin).
 * 
 * @param loginNormalizado - login del asesor
 * @param dias - número de días hacia atrás (default 3)
 * @returns resumen del recálculo
 */
export async function recalcularATCAsesorAction(
  loginNormalizado: string,
  dias: number = 3
): Promise<{ ok: boolean; error?: string; resumen?: any }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    // 1. Calcular fecha de hace N días
    const ahora = new Date();
    const fechaLimite = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
    const fechaLimiteStr = fechaLimite.toISOString().slice(0, 10);

    // 2. Leer encuestas del asesor en ese rango
    const encuestas = await db.encuesta.findMany({
      where: {
        loginNormalizado,
        fechaDia: { gte: fechaLimiteStr },
      },
      orderBy: { fechaDia: 'asc' },
      select: { id: true, fechaDia: true, grupo: true, tnps: true, hora: true },
    });

    if (encuestas.length === 0) {
      return {
        ok: true,
        resumen: {
          loginNormalizado,
          dias,
          encuestas: 0,
          promotores: 0,
          pasivos: 0,
          detractores: 0,
          atcCalculado: 0,
          mensaje: 'No hay encuestas en el período especificado.',
        },
      };
    }

    // 3. Leer config ATC para los puntos
    const config = await db.configATC.findUnique({ where: { id: 'global' } });
    const puntosPromotor = config?.puntosPromotor ?? 1;
    const puntosPromotorRacha = config?.puntosPromotorRacha ?? 2;
    const puntosPasivo = config?.puntosPasivo ?? 0;
    const puntosDetractor = config?.puntosDetractor ?? -1;
    const rachaVentanaMin = config?.rachaVentanaMinutos ?? 60;
    const rachaVentanaMs = rachaVentanaMin * 60 * 1000;

    // 4. Calcular ATC basado en encuestas (igual que atc-engine.ts)
    let atcCalculado = 0;
    let promotores = 0;
    let pasivos = 0;
    let detractores = 0;
    let promotoresRacha = 0;
    let ultimaPromocionTs: number | null = null;

    for (const e of encuestas) {
      let monto = 0;
      switch (e.grupo) {
        case 'Promotor': {
          // Verificar racha: si el promotor anterior fue hace < ventanaMin minutos
          const ts = new Date(e.fechaDia + 'T' + String(e.hora).padStart(2, '0') + ':00:00').getTime();
          if (ultimaPromocionTs !== null && ts - ultimaPromocionTs > 0 && ts - ultimaPromocionTs <= rachaVentanaMs) {
            monto = puntosPromotorRacha;
            promotoresRacha++;
          } else {
            monto = puntosPromotor;
          }
          ultimaPromocionTs = ts;
          promotores++;
          break;
        }
        case 'Pasivo': {
          monto = puntosPasivo;
          pasivos++;
          ultimaPromocionTs = null; // pasivo rompe racha
          break;
        }
        case 'Detractor': {
          monto = puntosDetractor;
          detractores++;
          ultimaPromocionTs = null; // detractor rompe racha
          break;
        }
      }
      atcCalculado += monto;
    }

    // 5. Leer wallet actual
    const wallet = await db.walletATC.findUnique({ where: { loginNormalizado } });
    const saldoAnterior = wallet ? wallet.saldo : 0;

    // 6. Leer transacciones NO de encuestas en el período (juegos, formularios, logros, ajustes admin, canjes)
    // para sumarlas al nuevo saldo
    const transaccionesNoEncuesta = await db.transaccionATC.findMany({
      where: {
        loginNormalizado,
        tipo: { in: ['JUEGO', 'FORMULARIO', 'LOGRO', 'STREAK_BONUS', 'AJUSTE_ADMIN', 'CANJE', 'CANJE_RACHA', 'APELACION_GANADA', 'APELACION_PERDIDA', 'SALDO_INICIAL'] },
        creado: { gte: fechaLimiteStr },
      },
      select: { monto: true, tipo: true },
    });

    let atcNoEncuesta = 0;
    for (const t of transaccionesNoEncuesta) {
      atcNoEncuesta += t.monto;
    }

    // 7. El nuevo saldo = saldo anterior - ATC de encuestas ya contados + ATC recalculado
    // Primero necesitamos saber cuántos ATC de encuestas ya estaban contados en el período
    const transaccionesEncuesta = await db.transaccionATC.findMany({
      where: {
        loginNormalizado,
        tipo: { in: ['PROMOTOR', 'PROMOTOR_RACHA', 'PASIVO', 'DETRACTOR_ASESOR', 'DETRACTOR_SERVICIO', 'DETRACTOR_INDETERMINADO'] },
        creado: { gte: fechaLimiteStr },
      },
      select: { monto: true },
    });

    let atcEncuestaPrevio = 0;
    for (const t of transaccionesEncuesta) {
      atcEncuestaPrevio += t.monto;
    }

    // Nuevo saldo = saldo actual - ATC encuesta previo + ATC recalculado
    const saldoNuevo = saldoAnterior - atcEncuestaPrevio + atcCalculado;

    // 8. Actualizar wallet
    if (wallet) {
      await db.walletATC.update({
        where: { loginNormalizado },
        data: {
          saldo: saldoNuevo,
          actualizado: new Date().toISOString(),
        },
      });
    }

    // 9. Registrar transacción de ajuste
    const diferencia = saldoNuevo - saldoAnterior;
    if (diferencia !== 0) {
      await db.transaccionATC.create({
        data: {
          id: randomUUID(),
          loginNormalizado,
          tipo: 'AJUSTE_ADMIN',
          monto: diferencia,
          descripcion: `Recálculo ATC últimos ${dias} días (${promotores}P/${pasivos}Pa/${detractores}D) — por ${session.username}`,
          semanaISO: new Date().toISOString().slice(0, 10),
          fecha: new Date().toISOString(),
          creado: new Date().toISOString(),
          procesadoPor: session.username,
          saldoAnterior,
          saldoNuevo,
        },
      });
    }

    // 10. Auditoría
    try {
      await audit({
        userId: session.userId,
        username: session.username,
        accion: 'update',
        tabla: 'atc_wallets',
        registroId: loginNormalizado,
        descripcion: `Recálculo ATC ${dias} días para ${loginNormalizado}: ${encuestas.length} encuestas, ${promotores}P/${pasivos}Pa/${detractores}D. Saldo: ${saldoAnterior} → ${saldoNuevo} (diff: ${diferencia >= 0 ? '+' : ''}${diferencia})`,
      });
    } catch {}

    return {
      ok: true,
      resumen: {
        loginNormalizado,
        dias,
        encuestas: encuestas.length,
        promotores,
        promotoresRacha,
        pasivos,
        detractores,
        atcCalculado,
        atcEncuestaPrevio,
        atcNoEncuesta,
        saldoAnterior,
        saldoNuevo,
        diferencia,
        mensaje: `Recálculo completado: ${encuestas.length} encuestas procesadas. Saldo: ${saldoAnterior} → ${saldoNuevo} (${diferencia >= 0 ? '+' : ''}${diferencia})`,
      },
    };
  } catch (err) {
    console.error('Error recalcularATCAsesorAction:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Error al recalcular: ${msg}` };
  }
}

/**
 * Recalcula ATC de TODOS los asesores de los últimos N días.
 */
export async function recalcularATCTodosAction(
  dias: number = 3
): Promise<{ ok: boolean; error?: string; resumen?: any }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false, error: 'Sin permisos' };
  }

  try {
    const wallets = await db.walletATC.findMany({ select: { loginNormalizado: true } });
    let procesados = 0;
    let errores = 0;
    const detalles: any[] = [];

    for (const w of wallets) {
      const result = await recalcularATCAsesorAction(w.loginNormalizado, dias);
      if (result.ok) {
        procesados++;
        if (result.resumen?.diferencia !== 0) {
          detalles.push(result.resumen);
        }
      } else {
        errores++;
      }
    }

    return {
      ok: true,
      resumen: {
        totalAsesores: wallets.length,
        procesados,
        errores,
        conCambios: detalles.length,
        detalles,
      },
    };
  } catch (err) {
    return { ok: false, error: 'Error al recalcular todos' };
  }
}
