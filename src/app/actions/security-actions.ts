// src/app/actions/security-actions.ts
'use server';

/**
 * v3.0.6 — Server Actions para preguntas de seguridad y restablecimiento de contraseña
 */
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { randomUUID, createHmac } from 'crypto';
import { audit } from '@/lib/audit';
import { PREGUNTAS_PREDETERMINADAS } from '@/lib/preguntas-predeterminadas';

const JWT_SECRET = process.env.JWT_SECRET || 'tnps-digital-claro-gt-secret-key-change-in-production-2026';

/** Hashea una respuesta de seguridad (normalizada a minúsculas sin espacios) */
function hashRespuesta(respuesta: string): string {
  const normalizada = respuesta.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHmac('sha256', JWT_SECRET).update(normalizada).digest('hex');
}

// ============================================================
// Guardar preguntas de seguridad
// ============================================================

export async function guardarPreguntasSeguridadAction(params: {
  pregunta1: string;
  respuesta1: string;
  pregunta2: string;
  respuesta2: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No hay sesión.' };
  if (!params.pregunta1?.trim() || !params.respuesta1?.trim() ||
      !params.pregunta2?.trim() || !params.respuesta2?.trim()) {
    return { ok: false, error: 'Todas las preguntas y respuestas son obligatorias.' };
  }
  if (params.pregunta1 === params.pregunta2) {
    return { ok: false, error: 'Las dos preguntas deben ser diferentes.' };
  }
  try {
    // Borrar preguntas anteriores si existen
    await db.preguntaSeguridad.deleteMany({ where: { userId: session.userId } });
    // Guardar las 2 nuevas
    await db.preguntaSeguridad.create({
      data: {
        id: randomUUID(),
        userId: session.userId,
        pregunta: params.pregunta1.trim(),
        respuestaHash: hashRespuesta(params.respuesta1),
        orden: 1,
      },
    });
    await db.preguntaSeguridad.create({
      data: {
        id: randomUUID(),
        userId: session.userId,
        pregunta: params.pregunta2.trim(),
        respuestaHash: hashRespuesta(params.respuesta2),
        orden: 2,
      },
    });
    await audit({
      userId: session.userId,
      username: session.username,
      accion: 'create',
      tabla: 'preguntas_seguridad',
      descripcion: 'Preguntas de seguridad asignadas',
    });
    return { ok: true };
  } catch (err) {
    console.error('Error guardando preguntas de seguridad:', err);
    return { ok: false, error: 'Error al guardar las preguntas.' };
  }
}

// ============================================================
// Verificar si el usuario tiene preguntas de seguridad
// ============================================================

export async function tienePreguntasSeguridadAction(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const count = await db.preguntaSeguridad.count({
    where: { userId: session.userId },
  });
  return count >= 2;
}

// ============================================================
// Obtener preguntas de un usuario (para responderlas)
// ============================================================

export async function getPreguntasSeguridadAction(username: string, documento: string): Promise<{
  ok: boolean;
  error?: string;
  preguntas?: string[];
  userId?: string;
}> {
  if (!username?.trim() || !documento?.trim()) {
    return { ok: false, error: 'Usuario y cédula son obligatorios.' };
  }
  const user = username.trim().toLowerCase();
  const u = await db.user.findFirst({
    where: {
      OR: [
        { username: user },
        { loginNormalizado: user },
        { email: user },
      ],
      documento: documento.trim(),
      activo: true,
    },
    select: { id: true, username: true },
  });
  if (!u) {
    return { ok: false, error: 'Usuario o cédula incorrectos.' };
  }
  const preguntas = await db.preguntaSeguridad.findMany({
    where: { userId: u.id },
    orderBy: { orden: 'asc' },
    select: { pregunta: true },
  });
  if (preguntas.length < 2) {
    return { ok: false, error: 'No has configurado preguntas de seguridad. Contacta a tu supervisor.' };
  }
  return {
    ok: true,
    preguntas: preguntas.map(p => p.pregunta),
    userId: u.id,
  };
}

// ============================================================
// Verificar respuestas y cambiar contraseña
// ============================================================

export async function verificarRespuestasYCambiarPasswordAction(params: {
  userId: string;
  respuestas: string[];
  nuevaPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.userId || !params.respuestas || params.respuestas.length < 2) {
    return { ok: false, error: 'Datos incompletos.' };
  }
  if (!params.nuevaPassword || params.nuevaPassword.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  try {
    const preguntasDB = await db.preguntaSeguridad.findMany({
      where: { userId: params.userId },
      orderBy: { orden: 'asc' },
    });
    if (preguntasDB.length < 2) {
      return { ok: false, error: 'No hay preguntas configuradas.' };
    }
    // Verificar cada respuesta
    for (let i = 0; i < 2; i++) {
      const hashIngresado = hashRespuesta(params.respuestas[i] || '');
      if (hashIngresado !== preguntasDB[i].respuestaHash) {
        return { ok: false, error: `La respuesta ${i + 1} es incorrecta.` };
      }
    }
    // Cambiar contraseña
    const hash = hashPassword(params.nuevaPassword);
    await db.user.update({
      where: { id: params.userId },
      data: { passwordHash: hash, debeCambiarPassword: false },
    });
    const u = await db.user.findUnique({ where: { id: params.userId }, select: { username: true } });
    await audit({
      userId: params.userId,
      username: u?.username || 'unknown',
      accion: 'update',
      tabla: 'users',
      descripcion: 'Contraseña restablecida vía preguntas de seguridad',
    });
    return { ok: true };
  } catch (err) {
    console.error('Error verificando respuestas:', err);
    return { ok: false, error: 'Error al verificar respuestas.' };
  }
}

// ============================================================
// Supervisor: resetear preguntas de un asesor
// ============================================================

export async function resetPreguntasSeguridadAction(userId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return { ok: false, error: 'Sin permisos.' };
  }
  try {
    await db.preguntaSeguridad.deleteMany({ where: { userId } });
    // Marcar debeCambiarPassword para que el asesor tenga que configurar todo de nuevo
    await db.user.update({
      where: { id: userId },
      data: { debeCambiarPassword: true },
    });
    const u = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    await audit({
      userId: session.userId,
      username: session.username,
      accion: 'delete',
      tabla: 'preguntas_seguridad',
      registroId: userId,
      descripcion: `Preguntas de seguridad reseteadas para ${u?.username || userId}`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al resetear preguntas.' };
  }
}

// ============================================================
// Supervisor: verificar si un asesor tiene preguntas
// ============================================================

export async function asesorTienePreguntasAction(userId: string): Promise<boolean> {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR')) {
    return false;
  }
  const count = await db.preguntaSeguridad.count({ where: { userId } });
  return count >= 2;
}
