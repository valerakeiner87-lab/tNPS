// src/app/api/reportes/route.ts
// API para exportar reportes en CSV
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') || 'tnps';

  try {
    let csv = '';
    let filename = '';

    switch (tipo) {
      case 'tnps':
        csv = await reporteTNPS();
        filename = 'reporte_tnps.csv';
        break;
      case 'atc':
        csv = await reporteATC();
        filename = 'reporte_atc.csv';
        break;
      case 'canjes':
        csv = await reporteCanjes();
        filename = 'reporte_canjes.csv';
        break;
      case 'formularios':
        csv = await reporteFormularios();
        filename = 'reporte_formularios.csv';
        break;
      default:
        return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Error generando reporte:', err);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}

function escapeCSV(value: any): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function reporteTNPS(): Promise<string> {
  const encuestas = await db.encuesta.findMany({
    select: {
      fechaDia: true, loginNormalizado: true, grupo: true, tnps: true, razon: true,
      area: true, linea: true, canal: true,
      indiceTiempo: true, indiceConocimiento: true, indiceSolucion: true, indiceAmabilidad: true, indicePromedio: true,
    },
    orderBy: { fechaDia: 'desc' },
    take: 5000,
  });
  const headers = ['Fecha', 'Login', 'Grupo', 'TNPS', 'Área', 'Línea', 'Canal', 'Índice Tiempo', 'Índice Conocimiento', 'Índice Solución', 'Índice Amabilidad', 'Índice Promedio', 'Razón'];
  const rows = encuestas.map(e => [
    e.fechaDia, e.loginNormalizado, e.grupo, e.tnps, e.area, e.linea, e.canal,
    e.indiceTiempo ?? '', e.indiceConocimiento ?? '', e.indiceSolucion ?? '',
    e.indiceAmabilidad ?? '', e.indicePromedio ?? '', e.razon,
  ].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function reporteATC(): Promise<string> {
  const txs = await db.transaccionATC.findMany({ orderBy: { creado: 'desc' }, take: 2000 });
  const headers = ['Fecha', 'Login', 'Tipo', 'Monto', 'Semana', 'Descripción', 'Encuesta ID'];
  const rows = txs.map(t => [t.creado ?? '', t.loginNormalizado, t.tipo, t.monto, t.semanaISO, t.descripcion, t.encuestaId ?? ''].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function reporteCanjes(): Promise<string> {
  const canjes = await db.canjeATC.findMany({ orderBy: { solicitado: 'desc' }, take: 2000 });
  const headers = ['Solicitado', 'Login', 'Asesor', 'Premio', 'Costo ATC', 'Estado', 'Resuelto', 'Resuelto Por', 'Comentario'];
  const rows = canjes.map(c => [c.solicitado, c.loginNormalizado, c.nombreAsesor, c.premioNombre, c.costoATC, c.estado, c.resuelto ?? '', c.resueltoPor ?? '', c.comentario ?? ''].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function reporteFormularios(): Promise<string> {
  const respuestas = await db.respuestaFormulario.findMany({ orderBy: { createdAt: 'desc' }, take: 2000 });
  const headers = ['Fecha', 'Login', 'Formulario ID', 'Pregunta ID', 'Respuesta', 'Correcta', 'ATC Otorgado', 'Intento'];
  const rows = respuestas.map(r => [r.createdAt.toISOString(), r.loginNormalizado, r.formularioId, r.preguntaId, r.respuesta, r.correcta ? 'Sí' : 'No', r.atcOtorgado, r.intento].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}
