// API route para servir archivos subidos (avatares, imágenes de premios)
// Ruta: /api/archivos/[id]
import { NextRequest, NextResponse } from 'next/server';
import { leerArchivoNeon } from '@/lib/neon-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }
    const archivo = await leerArchivoNeon(id);
    if (!archivo) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
    // Devolver la imagen con el MIME correcto
    const data = archivo.data as Uint8Array;
    // Convertir Uint8Array a ArrayBuffer para NextResponse (BodyInit acepta ArrayBufferView)
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': archivo.mime || 'image/png',
        'Cache-Control': 'public, max-age=86400', // 1 día
        'Content-Length': String(archivo.size || data.byteLength),
      },
    });
  } catch (err) {
    console.error('Error /api/archivos/[id]:', err);
    return NextResponse.json({ error: 'Error al obtener archivo' }, { status: 500 });
  }
}
