'use server';

/**
 * Server Actions para ATC Digital · Claro Guatemala
 * Archivo: src/app/actions/neon-actions.ts
 *
 * Estas acciones se ejecutan en el servidor y encapsulan todas
 * las operaciones de base de datos. El cliente las invoca directamente.
 */

import {
  leerEncuestasNeon,
  leerEncuestasAsesorNeon,
  leerEncuestasAreaNeon,
  leerEncuestasNeonDesde,
  guardarEncuestasNeon,
  eliminarDuplicadosNeon,
  leerAsesoresHCNeon,
  leerAsesorHCNeon,
  guardarAsesoresHCNeon,
  buscarAsesorHCNeon,
  crearUsuariosDesdeHCNeon,
  crearUsuariosDesdeEncuestasNeon,
  leerMetadataNeon,
  guardarMetadataNeon,
  leerTMONeon,
  guardarTMONeon,
  leerWalletsNeon,
  guardarWalletNeon,
  reiniciarWalletsNeon,
  leerTransaccionesNeon,
  guardarTransaccionNeon,
  leerEncuestasProcesadasATCNeon,
  leerPremiosNeon,
  leerTodosPremiosNeon,
  guardarPremioNeon,
  eliminarPremioNeon,
  leerCanjesNeon,
  crearCanjeNeon,
  resolverCanjeNeon,
  leerApelacionesNeon,
  crearApelacionNeon,
  resolverApelacionNeon,
  leerNotificacionesNeon,
  crearNotificacionNeon,
  marcarNotificacionLeidaNeon,
  marcarTodasLeidasNeon,
  leerConfigNeon,
  guardarConfigNeon,
  leerBeaconATCNeon,
  actualizarBeaconATCNeon,
  leerAnalisisAlertasNeon,
  guardarAnalisisAlertasNeon,
  borrarEncuestasNeon,
  borrarAsesoresHCNeon,
  borrarTMONeon,
  borrarTodaLaBaseNeon,
  borrarAdherenciaNeon,
  verificarConexionNeon,
  leerAdherenciaNeon,
  guardarAdherenciaNeon,
  // v3.3.0: Nómina y Gestión Operativa
  leerNovedadesNeon,
  guardarNovedadNeon,
  actualizarNovedadNeon,
  leerSugerenciasTurnoNeon,
  guardarSugerenciaTurnoNeon,
  actualizarSugerenciaTurnoNeon,
  leerNominaDiariaNeon,
  guardarNominaDiariaNeon,
  actualizarNominaDiariaNeon,
  // v3.4.2: Horas Robot y Bitácora
  leerHorasRobotNeon,
  guardarHorasRobotNeon,
  borrarHorasRobotNeon,
  leerBitacoraNeon,
  guardarBitacoraNeon,
  borrarBitacoraNeon,
} from '@/lib/neon-data';
import type { Novedad, SugerenciaTurno, NominaDiaria } from '@/lib/neon-data';
import { getSession } from '@/lib/session';
import type { Encuesta, AsesorHC, MetadataCarga, DatosTMO, DatosHorasRobot, DatosBitacora } from '@/lib/types';
import type { PremioATC, WalletATC, CanjeATC, ApelacionATC, NotificacionATC, ConfigATC, TransaccionATC } from '@/lib/atc-types';

// ============================================================
// Encuestas
// ============================================================

export async function getEncuestas(): Promise<Encuesta[]> {
  return await leerEncuestasNeon();
}

// v3.0.1: query optimizada para asesores — solo SUS encuestas
export async function getEncuestasAsesor(loginNormalizado: string): Promise<Encuesta[]> {
  return await leerEncuestasAsesorNeon(loginNormalizado);
}

// v3.0.1: query optimizada por área
export async function getEncuestasArea(area: string): Promise<Encuesta[]> {
  return await leerEncuestasAreaNeon(area);
}

export async function getEncuestasDesde(ts: number): Promise<Encuesta[]> {
  return await leerEncuestasNeonDesde(ts);
}

export async function saveEncuestas(encuestas: Encuesta[]) {
  const res = await guardarEncuestasNeon(encuestas);
  return { ok: true, ...res };
}

export async function removeDuplicados() {
  return await eliminarDuplicadosNeon();
}

// ============================================================
// Asesores HC
// ============================================================

export async function getAsesoresHC(): Promise<AsesorHC[]> {
  return await leerAsesoresHCNeon();
}

export async function buscarAsesor(loginNormalizado: string, documento: string) {
  return await buscarAsesorHCNeon(loginNormalizado, documento);
}

export async function saveAsesoresHC(asesores: AsesorHC[]) {
  await guardarAsesoresHCNeon(asesores);
  return { ok: true, count: asesores.length };
}

// v3.0.3: Crear usuarios automáticamente desde HC
export async function crearUsuariosDesdeHC(asesores: AsesorHC[]) {
  return await crearUsuariosDesdeHCNeon(asesores);
}

// v3.0.3: Crear usuarios desde encuestas (fallback)
export async function crearUsuariosDesdeEncuestas(encuestas: Encuesta[]) {
  return await crearUsuariosDesdeEncuestasNeon(encuestas);
}

// ============================================================
// Metadata y TMO
// ============================================================

export async function getMetadata(): Promise<MetadataCarga | null> {
  return await leerMetadataNeon();
}

export async function saveMetadata(meta: any) {
  await guardarMetadataNeon(meta);
  return { ok: true };
}

export async function getTMO() {
  return await leerTMONeon();
}

export async function saveTMO(tmo: any) {
  await guardarTMONeon(tmo);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Wallets
// ============================================================

export async function getWallets(): Promise<WalletATC[]> {
  return await leerWalletsNeon();
}

export async function saveWallet(wallet: WalletATC) {
  await guardarWalletNeon(wallet);
  return { ok: true };
}

export async function reiniciarWalletsAction(saldoInicial: number) {
  const semanaActual = new Date().toISOString().slice(0, 10);
  await reiniciarWalletsNeon(saldoInicial, semanaActual);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Transacciones
// ============================================================

export async function getTransacciones(login?: string): Promise<TransaccionATC[]> {
  return await leerTransaccionesNeon(login);
}

export async function saveTransaccion(t: TransaccionATC) {
  await guardarTransaccionNeon(t);
  return { ok: true };
}

// v3.0.1: leer encuestas ya procesadas en ATC (para dedupe al recargar Qualtrics)
export async function getEncuestasProcesadasATC(): Promise<string[]> {
  const set = await leerEncuestasProcesadasATCNeon();
  return Array.from(set);
}

// ============================================================
// Sistema ATC — Premios
// ============================================================

export async function getPremios(): Promise<PremioATC[]> {
  return await leerPremiosNeon();
}

export async function getTodosPremios(): Promise<PremioATC[]> {
  return await leerTodosPremiosNeon();
}

export async function savePremio(p: PremioATC) {
  await guardarPremioNeon(p);
  return { ok: true };
}

export async function removePremio(id: string) {
  await eliminarPremioNeon(id);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Canjes
// ============================================================

export async function getCanjes(login?: string): Promise<CanjeATC[]> {
  return await leerCanjesNeon(login);
}

export async function crearCanje(c: CanjeATC) {
  await crearCanjeNeon(c);
  return { ok: true };
}

export async function resolverCanje(id: string, estado: 'aprobado' | 'rechazado', comentario?: string) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  await resolverCanjeNeon(id, estado, session.userId, comentario);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Apelaciones
// ============================================================

export async function getApelaciones(login?: string): Promise<ApelacionATC[]> {
  return await leerApelacionesNeon(login);
}

export async function crearApelacion(a: ApelacionATC) {
  await crearApelacionNeon(a);
  return { ok: true };
}

export async function resolverApelacion(id: string, aprobada: boolean, respuesta: string, puntosAplicados?: number) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  await resolverApelacionNeon(id, aprobada, respuesta, session.userId, puntosAplicados);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Notificaciones
// ============================================================

export async function getNotificaciones(paraAdmin: boolean, paraLogin?: string): Promise<NotificacionATC[]> {
  return await leerNotificacionesNeon(paraAdmin, paraLogin);
}

export async function crearNotificacion(n: NotificacionATC) {
  await crearNotificacionNeon(n);
  return { ok: true };
}

export async function marcarNotificacionLeida(id: string) {
  await marcarNotificacionLeidaNeon(id);
  return { ok: true };
}

export async function marcarTodasLeidas(paraLogin?: string, paraAdmin?: boolean) {
  await marcarTodasLeidasNeon(paraLogin, paraAdmin);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Config
// ============================================================

export async function getConfig(): Promise<ConfigATC | null> {
  return await leerConfigNeon();
}

export async function saveConfig(c: ConfigATC) {
  await guardarConfigNeon(c);
  return { ok: true };
}

// ============================================================
// Sistema ATC — Beacon
// ============================================================

export async function getBeacon() {
  return { ts: await leerBeaconATCNeon() };
}

export async function actualizarBeacon(ts: string) {
  await actualizarBeaconATCNeon(ts);
  return { ok: true };
}

// ============================================================
// Análisis de alertas
// ============================================================

export async function getAnalisisAlertas() {
  return await leerAnalisisAlertasNeon();
}

export async function saveAnalisisAlertas(analisis: any[]) {
  await guardarAnalisisAlertasNeon(analisis);
  return { ok: true };
}

// ============================================================
// Zona de peligro (borrados)
// ============================================================

export async function borrarDatos(tipo: 'encuestas' | 'hc' | 'tmo' | 'adherencia' | 'horas-robot' | 'bitacora' | 'todo', clave: string = '') {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  // v3.2.1: clave administrativa para operaciones destructivas
  const CLAVE_ADMIN = 'Colombia110*';
  if (clave !== CLAVE_ADMIN) {
    throw new Error('Clave administrativa incorrecta.');
  }
  // Registrar en audit log
  try {
    const { audit } = await import('@/lib/audit');
    await audit({
      userId: session.userId,
      username: session.username,
      accion: 'delete',
      tabla: tipo,
      descripcion: `Borrado de datos: ${tipo} — por ${session.username}`,
    });
  } catch {}
  switch (tipo) {
    case 'encuestas': await borrarEncuestasNeon(); break;
    case 'hc': await borrarAsesoresHCNeon(); break;
    case 'tmo': await borrarTMONeon(); break;
    case 'adherencia': await borrarAdherenciaNeon(); break;
    case 'horas-robot': await borrarHorasRobotNeon(); break;
    case 'bitacora': await borrarBitacoraNeon(); break;
    case 'todo': await borrarTodaLaBaseNeon(); break;
  }
  return { ok: true };
}

// ============================================================
// Salud
// ============================================================

export async function ping() {
  return { ok: await verificarConexionNeon(), timestamp: new Date().toISOString() };
}

// ============================================================
// v3.0 — TMO Diario, ConfigTMOLinea, Archivos, Reset masivo
// ============================================================

import {
  guardarTMODailyNeon,
  leerTMODailyAsesorNeon,
  leerTMODailyMesActualNeon,
  leerTMOPromedioAsesorNeon,
  leerConfigTMOLineasNeon,
  guardarConfigTMOLineaNeon,
  leerUmbralTMOLineaNeon,
  leerEncuestaPorIdNeon,
  calcularRendimientoAsesorNeon,
  guardarArchivoNeon,
  leerArchivoNeon,
  actualizarAvatarUsuarioNeon,
  actualizarImagenPremioNeon,
  resetPasswordMasivoNeon,
} from '@/lib/neon-data';

// TMO diario
export async function guardarTMODaily(registros: any[]) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  return await guardarTMODailyNeon(registros);
}

export async function getTMODailyAsesor(loginOrDocumento: string) {
  return await leerTMODailyAsesorNeon(loginOrDocumento);
}

export async function getTMODailyMesActual(area?: string) {
  return await leerTMODailyMesActualNeon(area);
}

export async function getTMOPromedioAsesor(loginOrDocumento: string, dias: number = 7) {
  return { tmo: await leerTMOPromedioAsesorNeon(loginOrDocumento, dias) };
}

// ConfigTMOLinea
export async function getConfigTMOLineas() {
  return await leerConfigTMOLineasNeon();
}

export async function saveConfigTMOLinea(id: string, tmoMaximo: number, descripcion?: string) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  await guardarConfigTMOLineaNeon(id, tmoMaximo, descripcion);
  return { ok: true };
}

// Encuesta detalle (popup)
export async function getEncuestaDetalle(id: string) {
  return await leerEncuestaPorIdNeon(id);
}

// Rendimiento asesor
export async function getRendimientoAsesor(loginNormalizado: string, area: 'digital' | 'telefonico' = 'digital') {
  return await calcularRendimientoAsesorNeon(loginNormalizado, area);
}

// Archivos (avatares, imágenes de premios)
export async function subirArchivo(params: {
  tipo: 'avatar' | 'premio' | 'general';
  ownerId?: string;
  nombre: string;
  mime: string;
  size: number;
  data: string; // base64
}) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  const buffer = Buffer.from(params.data, 'base64');
  const id = await guardarArchivoNeon({
    tipo: params.tipo,
    ownerId: params.ownerId,
    nombre: params.nombre,
    mime: params.mime,
    size: params.size,
    data: buffer,
  });
  // Si es avatar, actualizar el usuario; si es premio, actualizar el premio
  if (params.tipo === 'avatar' && session.userId) {
    await actualizarAvatarUsuarioNeon(session.userId, id);
  }
  if (params.tipo === 'premio' && params.ownerId) {
    await actualizarImagenPremioNeon(params.ownerId, id);
  }
  return { ok: true, id };
}

// Reset password masivo
export async function resetPasswordMasivo(params: {
  filtro: 'todos' | 'area' | 'lob';
  area?: string;
  lob?: string;
  nuevoPassword: string;
  excluirAdmins?: boolean;
}) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN') {
    return { ok: false, error: 'Solo los administradores pueden hacer reset masivo de contraseñas.' };
  }
  if (!params.nuevoPassword || params.nuevoPassword.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  const result = await resetPasswordMasivoNeon(params);
  return { ok: true, ...result };
}

// ============================================================
// v3.2.0 — Adherencia
// ============================================================

export async function getAdherencia() {
  return await leerAdherenciaNeon();
}

export async function saveAdherencia(datos: any) {
  await guardarAdherenciaNeon(datos);
  return { ok: true };
}

// ============================================================
// v3.4.2 — Horas Robot y Bitácora (persistencia en BD)
// ============================================================

export async function getHorasRobot(): Promise<DatosHorasRobot | null> {
  return await leerHorasRobotNeon();
}

export async function saveHorasRobot(datos: DatosHorasRobot) {
  await guardarHorasRobotNeon(datos);
  return { ok: true };
}

export async function getBitacora(): Promise<DatosBitacora | null> {
  return await leerBitacoraNeon();
}

export async function saveBitacora(datos: DatosBitacora) {
  await guardarBitacoraNeon(datos);
  return { ok: true };
}

// ============================================================
// v3.3.0 — Nómina y Gestión Operativa
// ============================================================

// Novedades
export async function getNovedades(documento?: string): Promise<Novedad[]> {
  return await leerNovedadesNeon(documento);
}

export async function saveNovedad(novedad: Novedad) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  await guardarNovedadNeon(novedad);
  return { ok: true };
}

export async function actualizarNovedad(
  id: string,
  estado: string,
  respuesta?: string | null
) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  await actualizarNovedadNeon(id, estado, session.userId, respuesta ?? null);
  return { ok: true };
}

// Sugerencias de Turno
export async function getSugerenciasTurno(semana?: string): Promise<SugerenciaTurno[]> {
  return await leerSugerenciasTurnoNeon(semana);
}

export async function saveSugerenciaTurno(sugerencia: SugerenciaTurno) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  await guardarSugerenciaTurnoNeon(sugerencia);
  return { ok: true };
}

export async function actualizarSugerenciaTurno(id: string, estado: string) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  await actualizarSugerenciaTurnoNeon(id, estado);
  return { ok: true };
}

// Nómina Diaria
export async function getNominaDiaria(documento?: string): Promise<NominaDiaria[]> {
  return await leerNominaDiariaNeon(documento);
}

export async function saveNominaDiaria(registro: NominaDiaria) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  await guardarNominaDiariaNeon(registro);
  return { ok: true };
}

export async function actualizarNominaDiaria(
  documento: string,
  fecha: string,
  tiempoAjustado: number,
  valorMonetario: number,
  estado: string
) {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  if (session.role !== 'ADMIN' && session.role !== 'SUPERVISOR') {
    throw new Error('Permisos insuficientes');
  }
  await actualizarNominaDiariaNeon(
    documento,
    fecha,
    tiempoAjustado,
    valorMonetario,
    estado,
    session.userId
  );
  return { ok: true };
}

