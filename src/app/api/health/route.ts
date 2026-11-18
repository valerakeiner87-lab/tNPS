// Health check endpoint — usado por Docker HEALTHCHECK y para verificar
// que la BD está conectada.
// v3.2.0: también inicializa la limpieza automática en runtime + muestra BD activa.
import { NextResponse } from 'next/server';
import { checkDatabaseConnection } from '@/lib/db';
import { inicializarServidor } from '@/lib/init';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  inicializarServidor();

  const dbStatus = await checkDatabaseConnection();

  return NextResponse.json({
    ok: dbStatus.ok,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'unknown',
    database: {
      configured: !!process.env.DATABASE_URL || true,
      connected: dbStatus.ok,
      error: dbStatus.error,
      bdActiva: dbStatus.bdActiva,
    },
  }, { status: dbStatus.ok ? 200 : 503 });
}
