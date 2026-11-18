// src/app/actions/learning-actions.ts
'use server';

/**
 * v3.0.4 — Server Actions para formularios de aprendizaje
 */
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { randomUUID } from 'crypto';

function canManage(session: any): boolean {
  return session?.role === 'ADMIN' || session?.role === 'SUPERVISOR';
}

// ============================================================
// Formularios
// ============================================================

export interface FormularioData {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  diseño: string;
  maxIntentos: number;
  atcPorRespuesta: number;
  atcBonus: number;
  activo: boolean;
  imagenUrl?: string | null;
  asignacionTipo: string;
  asignacionValor?: string | null;
  preguntas?: PreguntaData[];
}

export interface PreguntaData {
  id?: string;
  formularioId?: string;
  tipo: string;
  enunciado: string;
  opciones: string[];
  respuestaCorrecta: number;
  esVerdadero?: boolean | null;
  respuestaTexto?: string | null;
  explicacion: string;
  imagenUrl?: string | null;
  orden: number;
}

export async function listarFormulariosAction(): Promise<FormularioData[]> {
  const session = await getSession();
  if (!session) return [];
  const forms = await db.formulario.findMany({
    orderBy: { createdAt: 'desc' },
    include: { preguntas: true },
  });
  return forms.map((f: any) => ({
    id: f.id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    categoria: f.categoria,
    diseño: f.diseño,
    maxIntentos: f.maxIntentos,
    atcPorRespuesta: f.atcPorRespuesta,
    atcBonus: f.atcBonus,
    activo: f.activo,
    imagenUrl: f.imagenUrl,
    asignacionTipo: f.asignacionTipo,
    asignacionValor: f.asignacionValor,
    preguntas: f.preguntas.map((p: any) => ({
      id: p.id,
      formularioId: p.formularioId,
      tipo: p.tipo,
      enunciado: p.enunciado,
      opciones: JSON.parse(p.opciones || '[]'),
      respuestaCorrecta: p.respuestaCorrecta,
      esVerdadero: p.esVerdadero,
      respuestaTexto: p.respuestaTexto,
      explicacion: p.explicacion,
      imagenUrl: p.imagenUrl,
      orden: p.orden,
    })),
  }));
}

export async function listarFormulariosAsesorAction(loginNormalizado: string, area: string): Promise<FormularioData[]> {
  const session = await getSession();
  if (!session) return [];
  const forms = await db.formulario.findMany({
    where: { activo: true },
    orderBy: { createdAt: 'desc' },
    include: { preguntas: true },
  });
  return forms
    .filter((f: any) => {
      if (f.asignacionTipo === 'todos') return true;
      if (f.asignacionTipo === 'asesor') return f.asignacionValor === loginNormalizado;
      if (f.asignacionTipo === 'area') return f.asignacionValor === area;
      if (f.asignacionTipo === 'linea') return true; // TODO: cruzar con HC
      return false;
    })
    .map((f: any) => ({
      id: f.id,
      titulo: f.titulo,
      descripcion: f.descripcion,
      categoria: f.categoria,
      diseño: f.diseño,
      maxIntentos: f.maxIntentos,
      atcPorRespuesta: f.atcPorRespuesta,
      atcBonus: f.atcBonus,
      activo: f.activo,
      imagenUrl: f.imagenUrl,
      asignacionTipo: f.asignacionTipo,
      asignacionValor: f.asignacionValor,
      preguntas: f.preguntas.map((p: any) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: JSON.parse(p.opciones || '[]'),
        respuestaCorrecta: p.respuestaCorrecta,
        esVerdadero: p.esVerdadero,
        explicacion: p.explicacion,
        imagenUrl: p.imagenUrl,
        orden: p.orden,
      })),
    }));
}

export async function guardarFormularioAction(form: FormularioData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await getSession();
  if (!session || !canManage(session)) {
    return { ok: false, error: 'Sin permisos' };
  }
  try {
    const id = form.id || randomUUID();
    await db.formulario.upsert({
      where: { id },
      create: {
        id,
        titulo: form.titulo,
        descripcion: form.descripcion,
        categoria: form.categoria,
        diseño: form.diseño,
        maxIntentos: form.maxIntentos,
        atcPorRespuesta: form.atcPorRespuesta,
        atcBonus: form.atcBonus,
        activo: form.activo,
        imagenUrl: form.imagenUrl || null,
        asignacionTipo: form.asignacionTipo,
        asignacionValor: form.asignacionValor || null,
      },
      update: {
        titulo: form.titulo,
        descripcion: form.descripcion,
        categoria: form.categoria,
        diseño: form.diseño,
        maxIntentos: form.maxIntentos,
        atcPorRespuesta: form.atcPorRespuesta,
        atcBonus: form.atcBonus,
        activo: form.activo,
        imagenUrl: form.imagenUrl || null,
        asignacionTipo: form.asignacionTipo,
        asignacionValor: form.asignacionValor || null,
      },
    });
    // Si vienen preguntas, reemplazar todas
    if (form.preguntas && form.preguntas.length > 0) {
      await db.preguntaFormulario.deleteMany({ where: { formularioId: id } });
      for (const p of form.preguntas) {
        await db.preguntaFormulario.create({
          data: {
            id: randomUUID(),
            formularioId: id,
            tipo: p.tipo,
            enunciado: p.enunciado,
            opciones: JSON.stringify(p.opciones || []),
            respuestaCorrecta: p.respuestaCorrecta ?? 0,
            esVerdadero: p.esVerdadero ?? null,
            respuestaTexto: p.respuestaTexto || null,
            explicacion: p.explicacion || '',
            imagenUrl: p.imagenUrl || null,
            orden: p.orden ?? 0,
          },
        });
      }
    }
    return { ok: true, id };
  } catch (err) {
    console.error('Error guardando formulario:', err);
    return { ok: false, error: 'Error al guardar formulario' };
  }
}

export async function eliminarFormularioAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManage(session)) {
    return { ok: false, error: 'Sin permisos' };
  }
  try {
    await db.preguntaFormulario.deleteMany({ where: { formularioId: id } });
    await db.respuestaFormulario.deleteMany({ where: { formularioId: id } });
    await db.formulario.delete({ where: { id } });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Error al eliminar' };
  }
}

export async function toggleFormularioActivoAction(id: string, activo: boolean): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !canManage(session)) return { ok: false };
  await db.formulario.update({ where: { id }, data: { activo } });
  return { ok: true };
}

// ============================================================
// Respuestas
// ============================================================

export async function responderFormularioAction(params: {
  formularioId: string;
  respuestas: Array<{ preguntaId: string; respuesta: string; correcta: boolean }>;
}): Promise<{ ok: boolean; atcGanado: number; correctas: number; total: number }> {
  const session = await getSession();
  if (!session) return { ok: false, atcGanado: 0, correctas: 0, total: 0 };
  const form = await db.formulario.findUnique({ where: { id: params.formularioId } });
  if (!form || !form.activo) return { ok: false, atcGanado: 0, correctas: 0, total: 0 };

  // Verificar intentos
  const intentosPrevios = await db.respuestaFormulario.findMany({
    where: { formularioId: params.formularioId, loginNormalizado: session.username },
    distinct: ['intento'],
    select: { intento: true },
  });
  const intentoActual = intentosPrevios.length + 1;
  if (form.maxIntentos > 0 && intentoActual > form.maxIntentos) {
    return { ok: false, atcGanado: 0, correctas: 0, total: 0 };
  }

  let correctas = 0;
  let atcGanado = 0;
  for (const r of params.respuestas) {
    const correcta = r.correcta;
    if (correcta) {
      correctas++;
      atcGanado += form.atcPorRespuesta;
    }
    await db.respuestaFormulario.create({
      data: {
        id: randomUUID(),
        formularioId: params.formularioId,
        preguntaId: r.preguntaId,
        loginNormalizado: session.username,
        respuesta: r.respuesta,
        correcta,
        atcOtorgado: correcta ? form.atcPorRespuesta : 0,
        intento: intentoActual,
      },
    });
  }
  // Bonus si todas correctas
  const total = params.respuestas.length;
  if (correctas === total && total > 0) {
    atcGanado += form.atcBonus;
  }
  // Otorgar ATC al asesor
  if (atcGanado > 0 && session.role === 'ASESOR') {
    const wallet = await db.walletATC.findUnique({ where: { loginNormalizado: session.username } });
    const saldoAnterior = wallet ? wallet.saldo : 0;
    const saldoNuevo = saldoAnterior + atcGanado;
    if (wallet) {
      await db.walletATC.update({
        where: { loginNormalizado: session.username },
        data: { saldo: saldoNuevo },
      });
    } else {
      await db.walletATC.create({
        data: {
          loginNormalizado: session.username,
          nombre: session.name || session.username,
          saldo: atcGanado,
          semanaActual: '',
        },
      });
    }
    // Registrar transacción con tipo específico y saldo anterior/nuevo
    await db.transaccionATC.create({
      data: {
        id: randomUUID(),
        loginNormalizado: session.username,
        tipo: 'FORMULARIO',
        monto: atcGanado,
        descripcion: `ATC ganados en formulario: ${form.titulo} (${correctas}/${total} correctas)`,
        semanaISO: new Date().toISOString().slice(0, 10),
        fecha: new Date().toISOString(),
        creado: new Date().toISOString(),
        procesadoPor: 'formulario',
        saldoAnterior,
        saldoNuevo,
      },
    });
  }
  return { ok: true, atcGanado, correctas, total };
}

// ============================================================
// ConfigReinicioMoneda
// ============================================================

export async function getConfigReinicioMonedaAction(): Promise<any> {
  const session = await getSession();
  if (!session) return null;
  let cfg = await db.configReinicioMoneda.findUnique({ where: { id: 'global' } });
  if (!cfg) {
    cfg = await db.configReinicioMoneda.create({
      data: { id: 'global', tipo: 'semana', valor: 50, diaSemana: 0, hora: 0, diaMes: 1, activo: true },
    });
  }
  return cfg;
}

export async function saveConfigReinicioMonedaAction(cfg: {
  tipo: string;
  valor: number;
  diaSemana: number;
  hora: number;
  diaMes: number;
  activo: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManage(session)) return { ok: false, error: 'Sin permisos' };
  await db.configReinicioMoneda.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      tipo: cfg.tipo,
      valor: cfg.valor,
      diaSemana: cfg.diaSemana,
      hora: cfg.hora,
      diaMes: cfg.diaMes,
      activo: cfg.activo,
    },
    update: {
      tipo: cfg.tipo,
      valor: cfg.valor,
      diaSemana: cfg.diaSemana,
      hora: cfg.hora,
      diaMes: cfg.diaMes,
      activo: cfg.activo,
    },
  });
  return { ok: true };
}

// ============================================================
// Juegos
// ============================================================

export async function guardarPartidaJuegoAction(params: {
  juego: string;
  puntaje: number;
  nivel: number;
  duracionSeg: number;
  ganado: boolean;
  atcGanado: number;
  datos?: any;
}): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  // v3.1.1: Los juegos ya NO otorgan ATC — son solo para entretenimiento en tiempo de ocio.
  // Se registra la partida para estadísticas pero NO se modifica la wallet ni se crean transacciones.
  await db.partidaJuego.create({
    data: {
      id: randomUUID(),
      juego: params.juego,
      loginNormalizado: session.username,
      puntaje: params.puntaje,
      nivel: params.nivel,
      duracionSeg: params.duracionSeg,
      ganado: params.ganado,
      atcGanado: 0, // Siempre 0 — los juegos no dan ATC
      datos: JSON.stringify(params.datos || {}),
    },
  });

  // v3.1.1: NO otorgar ATC — los juegos son solo para ocio
  // El bloque que actualizaba la wallet y creaba transacciones ATC fue removido.

  return { ok: true };
}

export async function listarPartidasJuegoAction(juego?: string): Promise<any[]> {
  const session = await getSession();
  if (!session) return [];
  const where: any = {};
  if (juego) where.juego = juego;
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    where.loginNormalizado = session.username;
  }
  return await db.partidaJuego.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
