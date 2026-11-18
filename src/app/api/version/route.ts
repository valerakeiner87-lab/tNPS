// ============================================================
// v3.0.9 — Sistema de versión para detectar deploys nuevos
// ============================================================
// El servidor expone /api/version con un timestamp de build.
// El cliente lo compara con localStorage al arrancar.
// Si cambió, fuerza un hard reload (limpiando caché).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUILD_VERSION = Date.now().toString();

export async function GET() {
  return NextResponse.json({
    version: BUILD_VERSION,
    timestamp: new Date().toISOString(),
  });
}
