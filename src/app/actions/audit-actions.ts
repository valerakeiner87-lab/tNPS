// src/app/actions/audit-actions.ts
'use server';

import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { audit, leerAuditLog } from '@/lib/audit';
import { randomUUID } from 'crypto';

export async function getAuditLogAction(filtros: { username?: string; accion?: string; limite?: number }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return [];
  return await leerAuditLog(filtros);
}

export async function auditAction(params: {
  accion: string;
  tabla?: string;
  registroId?: string;
  descripcion: string;
}) {
  const session = await getSession();
  if (!session) return;
  await audit({
    userId: session.userId,
    username: session.username,
    accion: params.accion,
    tabla: params.tabla,
    registroId: params.registroId,
    descripcion: params.descripcion,
  });
}

// ============================================================
// Torneos
// ============================================================

export async function listarTorneosAction() {
  const session = await getSession();
  if (!session) return [];
  return await db.torneo.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function guardarTorneoAction(torneo: {
  id?: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  area: string;
  fechaInicio: string;
  fechaFin: string;
  activo?: boolean;
  premio?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false, error: 'Sin permisos' };
  }
  try {
    const id = torneo.id || randomUUID();
    await db.torneo.upsert({
      where: { id },
      create: {
        id,
        nombre: torneo.nombre,
        descripcion: torneo.descripcion || '',
        tipo: torneo.tipo,
        area: torneo.area,
        fechaInicio: torneo.fechaInicio,
        fechaFin: torneo.fechaFin,
        activo: torneo.activo ?? true,
        premio: torneo.premio || '',
      },
      update: {
        nombre: torneo.nombre,
        descripcion: torneo.descripcion || '',
        tipo: torneo.tipo,
        area: torneo.area,
        fechaInicio: torneo.fechaInicio,
        fechaFin: torneo.fechaFin,
        activo: torneo.activo ?? true,
        premio: torneo.premio || '',
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al guardar torneo' };
  }
}

export async function eliminarTorneoAction(id: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false };
  }
  await db.torneo.delete({ where: { id } });
  return { ok: true };
}

// ============================================================
// Streaks (rachas)
// ============================================================

export async function getStreaksAction(loginNormalizado?: string) {
  const session = await getSession();
  if (!session) return [];
  const where: any = {};
  if (loginNormalizado) {
    where.loginNormalizado = loginNormalizado;
  } else if (session.role === 'ASESOR') {
    where.loginNormalizado = session.username;
  }
  return await db.streakAsesor.findMany({ where, orderBy: { contador: 'desc' } });
}

export async function actualizarStreakAction(params: {
  loginNormalizado: string;
  tipo: string;
  contador: number;
  ultimaFecha: string;
}): Promise<{ ok: boolean; atcBonus?: number }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const id = `streak_${params.loginNormalizado}_${params.tipo}`;
  const existing = await db.streakAsesor.findUnique({ where: { id } });
  const mejorRacha = existing ? Math.max(existing.mejorRacha, params.contador) : params.contador;

  // Otorgar ATC bonus cada 3, 5, 7, 10... rachas
  let atcBonus = 0;
  if (params.contador > 0 && params.contador % 3 === 0 && (!existing || existing.contador < params.contador)) {
    atcBonus = params.contador * 2; // 6, 10, 14, ... ATC
  }

  await db.streakAsesor.upsert({
    where: { id },
    create: {
      id,
      loginNormalizado: params.loginNormalizado,
      tipo: params.tipo,
      contador: params.contador,
      mejorRacha,
      ultimaFecha: params.ultimaFecha,
      atcBonus: existing ? existing.atcBonus + atcBonus : atcBonus,
    },
    update: {
      contador: params.contador,
      mejorRacha,
      ultimaFecha: params.ultimaFecha,
      atcBonus: existing ? existing.atcBonus + atcBonus : atcBonus,
    },
  });

  if (atcBonus > 0) {
    // Otorgar ATC al asesor
    const wallet = await db.walletATC.findUnique({ where: { loginNormalizado: params.loginNormalizado } });
    if (wallet) {
      await db.walletATC.update({
        where: { loginNormalizado: params.loginNormalizado },
        data: { saldo: wallet.saldo + atcBonus },
      });
    }
    await db.transaccionATC.create({
      data: {
        id: randomUUID(),
        loginNormalizado: params.loginNormalizado,
        tipo: 'STREAK_BONUS',
        monto: atcBonus,
        descripcion: `Bonus por racha de ${params.contador} (${params.tipo})`,
        semanaISO: new Date().toISOString().slice(0, 10),
        fecha: new Date().toISOString(),
        creado: new Date().toISOString(),
        procesadoPor: 'streak',
        saldoAnterior: existing ? existing.atcBonus : 0,
        saldoNuevo: (existing ? existing.atcBonus : 0) + atcBonus,
      },
    });
  }

  return { ok: true, atcBonus };
}
