// API Route: /api/db-status
// Devuelve el estado de todas las BDs Neon configuradas.
// Solo accesible para ADMIN/SUPERVISOR.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verificarTodasLasBDs, getBDActivaIndex } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }
    if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
      return NextResponse.json({ ok: false, error: 'Sin permisos' }, { status: 403 });
    }

    // Verificar todas las BDs en paralelo (4s timeout por BD)
    const results = await verificarTodasLasBDs();
    const activas = results.filter(r => r.ok).length;
    const total = results.length;
    const activaIndex = getBDActivaIndex();
    const faltan = total - activas;

    return NextResponse.json({
      ok: true,
      total,
      activas,
      faltan,
      activaIndex,
      bdActiva: results[activaIndex]?.host || 'desconocida',
      // Alerta cuando quedan <= 2 BDs activas (necesita crear más)
      alertaCrearMas: activas <= 2,
      nivelAlerta: activas === 0 ? 'critico' : activas <= 2 ? 'urgente' : activas <= 4 ? 'advertencia' : 'ok',
      bds: results.map(r => ({
        index: r.index,
        host: r.host,
        region: r.region,
        ok: r.ok,
        ms: r.ms,
        error: r.error,
        activa: r.activa,
      })),
      verificadoEn: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error en /api/db-status:', err);
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
