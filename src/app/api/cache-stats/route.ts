// API Route: /api/cache-stats
// Devuelve estadísticas del caché del lado servidor.
// Solo accesible para ADMIN/SUPERVISOR.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCacheStats, getCacheKeys } from '@/lib/server-cache';

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

    const stats = getCacheStats();
    return NextResponse.json({
      ok: true,
      ...stats,
      keys: getCacheKeys(),
      verificadoEn: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
