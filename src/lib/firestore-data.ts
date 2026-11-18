// ============================================================
// ATC Digital — Wrapper de datos (delegado a Server Actions Neon)
// Archivo: src/lib/firestore-data.ts
// ============================================================
// Este archivo ya NO usa Firebase. Todas las funciones delegan
// a las Server Actions en src/app/actions/neon-actions.ts, que
// ejecutan contra la BD real (SQLite en dev local, PostgreSQL/Neon
// en producción HuggingFace).
// ============================================================

'use client';

import type {
  AnalisisAlerta,
  AsesorHC,
  DatosTMO,
  Encuesta,
  MetadataCarga,
  DatosHorasRobot,
  DatosBitacora,
} from './types';
import {
  getEncuestas as actionGetEncuestas,
  getEncuestasDesde as actionGetEncuestasDesde,
  saveEncuestas as actionSaveEncuestas,
  removeDuplicados as actionRemoveDuplicados,
  getAsesoresHC as actionGetAsesoresHC,
  saveAsesoresHC as actionSaveAsesoresHC,
  buscarAsesor as actionBuscarAsesor,
  getMetadata as actionGetMetadata,
  saveMetadata as actionSaveMetadata,
  getTMO as actionGetTMO,
  saveTMO as actionSaveTMO,
  getAnalisisAlertas as actionGetAnalisisAlertas,
  saveAnalisisAlertas as actionSaveAnalisisAlertas,
  borrarDatos as actionBorrarDatos,
  getAdherencia as actionGetAdherencia,
  saveAdherencia as actionSaveAdherencia,
  getHorasRobot as actionGetHorasRobot,
  saveHorasRobot as actionSaveHorasRobot,
  getBitacora as actionGetBitacora,
  saveBitacora as actionSaveBitacora,
} from '@/app/actions/neon-actions';
import type {
  Novedad,
  SugerenciaTurno,
  NominaDiaria,
} from './neon-data';

export interface EstadisticaDiferencial {
  recibidas: number;
  nuevas: number;
  omitidas: number;
  actualizadas?: number;
}

// ------------------------------------------------------------
// Encuestas
// ------------------------------------------------------------

export async function guardarEncuestas(encuestas: Encuesta[]): Promise<void> {
  await actionSaveEncuestas(encuestas);
}

export async function guardarEncuestasDiferencial(
  todasNuevas: Encuesta[],
  _existentes: Encuesta[]
): Promise<EstadisticaDiferencial> {
  const res = await actionSaveEncuestas(todasNuevas);
  return {
    recibidas: todasNuevas.length,
    nuevas: res.nuevas ?? 0,
    omitidas: res.omitidas ?? 0,
  };
}

export async function leerEncuestas(): Promise<Encuesta[]> {
  return await actionGetEncuestas();
}

// v3.0.1: query optimizada para asesores — solo SUS encuestas
export async function leerEncuestasAsesor(loginNormalizado: string): Promise<Encuesta[]> {
  const { getEncuestasAsesor } = await import('@/app/actions/neon-actions');
  return await getEncuestasAsesor(loginNormalizado);
}

// v3.0.1: query optimizada por área
export async function leerEncuestasArea(area: string): Promise<Encuesta[]> {
  const { getEncuestasArea } = await import('@/app/actions/neon-actions');
  return await getEncuestasArea(area);
}

export async function leerEncuestasDesde(ts: number): Promise<Encuesta[]> {
  return await actionGetEncuestasDesde(ts);
}

export async function borrarEncuestas(): Promise<number> {
  await actionBorrarDatos('encuestas', '');
  return 0;
}

export function deduplicarEncuestas(encuestas: Encuesta[]): Encuesta[] {
  const porTransaccion = new Map<string, Encuesta>();
  const sinTransaccion: Encuesta[] = [];
  for (const e of encuestas) {
    const idTrans = (e.idTransaccion || '').trim();
    if (!idTrans) { sinTransaccion.push(e); continue; }
    if (!porTransaccion.has(idTrans)) porTransaccion.set(idTrans, e);
  }
  return [...porTransaccion.values(), ...sinTransaccion];
}

export async function eliminarEncuestasDuplicadas(
  _progreso?: (p: number, t: number) => void
): Promise<{ totalDocs: number; duplicadosBorrados: number; idTransaccionUnicos: number }> {
  const res = await actionRemoveDuplicados();
  return {
    totalDocs: res.total,
    duplicadosBorrados: res.borrados,
    idTransaccionUnicos: res.total - res.borrados,
  };
}

// ------------------------------------------------------------
// Asesores HC
// ------------------------------------------------------------

export async function guardarAsesoresHC(asesores: AsesorHC[]): Promise<void> {
  await actionSaveAsesoresHC(asesores);
}

export async function guardarAsesoresHCDiferencial(
  todosNuevos: AsesorHC[],
  _existentes: AsesorHC[]
): Promise<EstadisticaDiferencial> {
  await actionSaveAsesoresHC(todosNuevos);
  return { recibidas: todosNuevos.length, nuevas: todosNuevos.length, omitidas: 0 };
}

export async function leerAsesoresHC(): Promise<AsesorHC[]> {
  return await actionGetAsesoresHC();
}

export async function leerAsesoresHCDesde(_ts: number): Promise<AsesorHC[]> {
  return await actionGetAsesoresHC();
}

export async function borrarAsesoresHC(): Promise<number> {
  await actionBorrarDatos('hc', '');
  return 0;
}

export async function buscarAsesorHC(login: string, documento: string): Promise<AsesorHC | null> {
  return await actionBuscarAsesor(login, documento);
}

// ------------------------------------------------------------
// TMO
// ------------------------------------------------------------

export async function guardarTMO(datos: DatosTMO): Promise<void> {
  await actionSaveTMO(datos);
}

export async function leerTMO(): Promise<DatosTMO | null> {
  return await actionGetTMO();
}

export async function borrarTMO(): Promise<void> {
  await actionBorrarDatos('tmo', '');
}

// ------------------------------------------------------------
// Metadata
// ------------------------------------------------------------

export async function guardarMetadata(meta: MetadataCarga): Promise<void> {
  await actionSaveMetadata(meta);
}

export async function leerMetadata(): Promise<MetadataCarga | null> {
  return await actionGetMetadata();
}

// ------------------------------------------------------------
// Análisis de alertas
// ------------------------------------------------------------

export async function guardarAnalisisAlertas(analisis: AnalisisAlerta[]): Promise<void> {
  await actionSaveAnalisisAlertas(analisis);
}

export async function leerAnalisisAlertas(): Promise<AnalisisAlerta[]> {
  return await actionGetAnalisisAlertas();
}

// ------------------------------------------------------------
// Migración (no-op en client; la migración real se hace vía scripts)
// ------------------------------------------------------------

export async function migrarLogins(
  _fn: (s: string) => string,
  _progreso?: (r: number, t: number) => void
): Promise<{ encuestasMigradas: number; hcMigrados: number }> {
  return { encuestasMigradas: 0, hcMigrados: 0 };
}

// ------------------------------------------------------------
// Admin — zona de peligro
// ------------------------------------------------------------

export async function borrarTodaLaBase(): Promise<void> {
  await actionBorrarDatos('todo', '');
}

// ------------------------------------------------------------
// v3.2.0 — Adherencia
// ------------------------------------------------------------

export async function leerAdherencia(): Promise<any> {
  return await actionGetAdherencia();
}

export async function guardarAdherencia(datos: any): Promise<void> {
  await actionSaveAdherencia(datos);
}

// ------------------------------------------------------------
// v3.3.0 — Nómina y Gestión Operativa
// Wrappers cliente que delegan a las Server Actions.
// ------------------------------------------------------------

// Novedades
export async function leerNovedades(documento?: string): Promise<Novedad[]> {
  const { getNovedades } = await import('@/app/actions/neon-actions');
  return await getNovedades(documento);
}

export async function guardarNovedad(novedad: Novedad): Promise<void> {
  const { saveNovedad } = await import('@/app/actions/neon-actions');
  await saveNovedad(novedad);
}

export async function actualizarNovedad(
  id: string,
  estado: string,
  respuesta?: string | null
): Promise<void> {
  const { actualizarNovedad } = await import('@/app/actions/neon-actions');
  await actualizarNovedad(id, estado, respuesta);
}

// v3.4.2 — Horas Robot
export async function leerHorasRobot(): Promise<DatosHorasRobot | null> {
  const { getHorasRobot } = await import('@/app/actions/neon-actions');
  return await getHorasRobot();
}

export async function guardarHorasRobot(datos: DatosHorasRobot): Promise<void> {
  const { saveHorasRobot } = await import('@/app/actions/neon-actions');
  await saveHorasRobot(datos);
}

// v3.4.2 — Bitácora
export async function leerBitacora(): Promise<DatosBitacora | null> {
  const { getBitacora } = await import('@/app/actions/neon-actions');
  return await getBitacora();
}

export async function guardarBitacora(datos: DatosBitacora): Promise<void> {
  const { saveBitacora } = await import('@/app/actions/neon-actions');
  await saveBitacora(datos);
}

// Sugerencias de Turno
export async function leerSugerenciasTurno(semana?: string): Promise<SugerenciaTurno[]> {
  const { getSugerenciasTurno } = await import('@/app/actions/neon-actions');
  return await getSugerenciasTurno(semana);
}

export async function guardarSugerenciaTurno(sugerencia: SugerenciaTurno): Promise<void> {
  const { saveSugerenciaTurno } = await import('@/app/actions/neon-actions');
  await saveSugerenciaTurno(sugerencia);
}

export async function actualizarSugerenciaTurno(id: string, estado: string): Promise<void> {
  const { actualizarSugerenciaTurno } = await import('@/app/actions/neon-actions');
  await actualizarSugerenciaTurno(id, estado);
}

// Nómina Diaria
export async function leerNominaDiaria(documento?: string): Promise<NominaDiaria[]> {
  const { getNominaDiaria } = await import('@/app/actions/neon-actions');
  return await getNominaDiaria(documento);
}

export async function guardarNominaDiaria(registro: NominaDiaria): Promise<void> {
  const { saveNominaDiaria } = await import('@/app/actions/neon-actions');
  await saveNominaDiaria(registro);
}

export async function actualizarNominaDiaria(
  documento: string,
  fecha: string,
  tiempoAjustado: number,
  valorMonetario: number,
  estado: string
): Promise<void> {
  const { actualizarNominaDiaria } = await import('@/app/actions/neon-actions');
  await actualizarNominaDiaria(documento, fecha, tiempoAjustado, valorMonetario, estado);
}

