// ============================================================
// tNPS Digital Claro Guatemala — Tipos centrales
// Archivo: src/lib/types.ts
// ============================================================

/** Área de operación: solo Digital (WhatsApp/chat).
 *  v3.3.0: Telefónico fue removido; solo se opera Digital. */
export type Area = 'digital';

export type GrupoTNPS = 'Promotor' | 'Pasivo' | 'Detractor';
export type Linea = 'Fijo Soporte' | 'Fijo Información' | 'Móvil';
export type FranjaHoraria = 'madrugada' | 'mañana' | 'mediodia' | 'tarde' | 'noche';
export type Granularidad = 'dia' | 'semana' | 'mes';

/** Límite máximo de TMO por interacción (segundos) */
export const TMO_LIMITE_SEGUNDOS = 970;

export const LINEAS: Linea[] = ['Fijo Soporte', 'Fijo Información', 'Móvil'];

export const FRANJAS: { id: FranjaHoraria; label: string; rango: string }[] = [
  { id: 'madrugada', label: 'Madrugada', rango: '00:00 – 05:59' },
  { id: 'mañana', label: 'Mañana', rango: '06:00 – 11:59' },
  { id: 'mediodia', label: 'Mediodía', rango: '12:00 – 14:59' },
  { id: 'tarde', label: 'Tarde', rango: '15:00 – 18:59' },
  { id: 'noche', label: 'Noche', rango: '19:00 – 23:59' },
];

/** Encuesta individual proveniente del archivo Qualtrics */
export interface Encuesta {
  id: string;
  idTransaccion: string;
  /** ID de interacción (en Digital = idTransaccion; en Telefónico puede ser
   *  un campo separado como ID_INTERACCION o REFERENCIA_EXTERNA) */
  idInteraccion?: string;
  fechaDia: string; // YYYY-MM-DD
  fechaInicio: string; // ISO timestamp
  fechaRegistro: string; // ISO timestamp
  hora: number; // 0-23
  horaExacta: string; // HH:MM
  franjaHoraria: FranjaHoraria;
  grupo: GrupoTNPS;
  tnps: number; // 0-10
  razon: string;
  comentarioSolucion: string;
  comentarioAdicional: string;
  canal: string;
  medioContacto: string;
  unidad: string; // Fijo/Móvil
  cola: string; // Cola original (ej. GT_WA_Hogar_Soporte)
  linea: Linea;
  usuario: string; // Usuario original (CLAROGT_xxx)
  loginNormalizado: string;
  segmento: string;
  idCliente: string;
  productoFamilia: string;
  nivel1: string;
  nivel2: string;
  nivel3: string;
  nivel4: string;
  nivel5: string;
  // Resultado del análisis de alertas
  alertaAgresiva?: boolean;
  alertaRazon?: string;
  alertaSeveridad?: 'leve' | 'moderada' | 'alta';
  // Timestamp de guardado (para delta sync)
  savedAtTs?: number;
  // Área: digital o telefonico (para separar las dos líneas de negocio)
  area?: Area;
  // Índices (1-5 o null). Para digital: tiempo, conocimiento, solucion.
  // Para telefonico: amabilidad, conocimiento, solucion.
  indiceTiempo?: number | null;
  indiceConocimiento?: number | null;
  indiceSolucion?: number | null;
  indiceAmabilidad?: number | null;
  indicePromedio?: number | null;
}

/** Asesor del Health Check (HC) */
export interface AsesorHC {
  documento: string;
  nombre: string;
  usuarioCic: string; // Login normalizado (ej. kevin.camargo)
  usuarioGen: string;
  loginAib: string;
  cargo: string;
  lob: string; // Línea de negocio original (ej. WHATSAPP FIJO SOPORTE)
  linea?: Linea;
  supervisor: string;
  jefeOperacion: string;
  fechaIngreso: string;
  fechaNacimiento?: string; // ISO date string (YYYY-MM-DD) o DD/MM/YYYY — extraído del HC
  ciudad: string;
  sede: string;
  genero: string;
  tipoContrato: string;
  modalidad: string;
  contratacion: string;
  email: string;
  telefono: string;
  origen: 'ACTIVOS' | 'TRANSICIONES' | string;
  loginNormalizado: string;
  savedAtTs?: number;
  // Área(s) en las que el asesor opera (puede estar en ambas a la vez)
  areas?: Area[];
}

/** KPIs calculados a partir de un conjunto de encuestas */
export interface KPIS {
  total: number;
  promotores: number;
  pasivos: number;
  detractores: number;
  tNPS: number; // ((P - D) / Total) * 100
  scorePromedio: number;
  pctPromotores: number;
  pctPasivos: number;
  pctDetractores: number;
}

/** Cruce de Encuesta[] + AsesorHC con métricas tNPS por asesor */
export interface AsesorConsolidado {
  loginNormalizado: string;
  nombre: string;
  documento: string;
  linea: Linea;
  supervisor: string;
  sede: string;
  lob: string;
  cargo: string;
  fechaIngreso: string;
  origenHC: boolean; // Si se encontró en el HC
  encuestas: Encuesta[];
  kpis: KPIS;
  alertas: number; // Cantidad de encuestas con alerta agresiva
  tieneAlertas: boolean;
}

/** Contenedor principal para la UI */
export interface DatosProcesados {
  encuestas: Encuesta[];
  asesoresHC: AsesorHC[];
  asesoresConsolidados: AsesorConsolidado[];
  kpisGlobal: KPIS;
  kpisPorLinea: Record<Linea, KPIS>;
  totales: { encuestas: number; asesores: number; lineas: number };
}

/** Un día de TMO para un asesor (formato compacto para Firestore) */
export interface DiaTMO {
  f: string; // fecha YYYY-MM-DD
  t: number; // TMO promedio en segundos
  i: number; // interacciones
}

/** Datos TMO de un asesor */
export interface AsesorTMO {
  loginNormalizado: string;
  nombreGenesys: string;
  nombreHC: string;
  documento: string;
  tmoPromedio: number; // segundos
  totalInteracciones: number;
  diasConDatos: number;
  sobreLimite: boolean; // Excede 970 segundos
  tmoPorDia: DiaTMO[];
}

/** Datos TMO procesados */
export interface DatosTMO {
  fechaProcesamiento: string;
  archivoNombre: string;
  totalAsesores: number;
  promedioGeneral: number; // segundos
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  asesores: AsesorTMO[];
}

/** Índice de DatosTMO para búsqueda rápida por login */
export interface DatosTMOIndexado extends DatosTMO {
  indicePorLogin: Record<string, AsesorTMO>;
}

/** Punto en la serie temporal de tendencia */
export interface PuntoTendencia {
  fecha: string; // Etiqueta (YYYY-MM-DD, ISO week o YYYY-MM)
  tNPS: number;
  total: number;
  promotores: number;
  pasivos: number;
  detractores: number;
}

/** KPIs por franja horaria */
export interface FranjaKPI {
  franja: FranjaHoraria;
  label: string;
  kpis: KPIS;
}

/** KPIs por tipificación (nivel 1-5) */
export interface TipificacionKPI {
  valor: string;
  kpis: KPIS;
}

/** Insight generado por los análisis de patrones */
export interface Insight {
  tipo: 'franja' | 'tipificacion' | 'dolor' | 'info';
  titulo: string;
  descripcion: string;
  severidad: 'positivo' | 'advertencia' | 'critico' | 'info';
}

/** Filtro de fechas para las encuestas */
export interface FiltroFecha {
  tipo: 'todo' | 'rango' | 'mes' | 'dia' | 'anio';
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  valor?: string; // mes YYYY-MM o día YYYY-MM-DD o año YYYY
}

/** Metadatos de la última carga */
export interface MetadataCarga {
  fechaCarga: string;
  fechaCargaTs: number;
  totalEncuestas: number;
  totalAsesoresHC: number;
  archivoHCNombre: string;
  archivoQualtricsNombre: string;
  cargadoPor: string;
  cargadoPorUid: string;
  escrituraDiferencial?: string;
}

/** Resultado de un análisis de alerta individual */
export interface AnalisisAlerta {
  encuestaId: string;
  agresivo: boolean;
  razon: string;
  severidad: 'leve' | 'moderada' | 'alta';
}

/** Perfil del usuario autenticado en la app */
export type RolUsuario = 'asesor' | 'supervisor' | 'admin';

export interface PerfilUsuario {
  uid: string;
  email: string | null;
  rol: RolUsuario;
  loginNormalizado?: string; // Para asesor
  nombre?: string;
  documento?: string;
  puedeEscribir: boolean;
  esAdmin: boolean;
  // Área seleccionada en el login (digital | telefonico)
  area?: Area;
  /** Si true, el usuario debe cambiar su contraseña (primer login o reset). */
  debeCambiarPassword?: boolean;
}

// ============================================================
// v3.0 — Tipos nuevos para TMO diario, índices, temas, umbrales
// ============================================================

/** Línea de atención normalizada para umbrales TMO.
 *  v3.3.0: Las líneas telefónicas se mantienen por compatibilidad con datos
 *  históricos, pero el área operativa ahora es solo Digital. */
export type LineaAtencion =
  | 'WhatsApp Fijo Soporte'
  | 'WhatsApp Fijo Información'
  | 'WhatsApp Móvil'
  | 'Móvil Telefónico'
  | 'Fijo Información Telefónico'
  | 'Fijo Soporte Telefónico';

/** Configuración de umbral TMO por línea */
export interface ConfigTMOLinea {
  id: string;
  linea: string;
  lineaNormalizada: string;
  area: Area | '';
  tmoMaximo: number; // segundos
  descripcion?: string;
}

/** TMO diario de un asesor (para trend line) */
export interface TMOAsesorDaily {
  id: string;
  documento: string;
  nombreAsesor: string;
  loginNormalizado: string;
  lob: string;
  supervisor: string;
  fecha: string; // YYYY-MM-DD
  semana: string; // S1, S2, etc.
  mes: string; // septiembre, etc.
  interacciones: number;
  manejoTotal: number; // segundos
  tmo: number; // segundos
  meta: number; // segundos
  // v3.3.0: el área TMO conserva 'telefonico' por compatibilidad con datos
  // históricos (los archivos TMO no separan por área). El tipo NO usa `Area`
  // (que ahora es solo 'digital') para evitar errores de tipos al asignar
  // valores derivados del LOB.
  area: 'digital' | 'telefonico' | '';
}

/** Punto en la serie temporal de tendencia TMO */
export interface PuntoTendenciaTMO {
  fecha: string; // YYYY-MM-DD
  tmo: number; // segundos
  interacciones: number;
}

/** Tipo de tema visual */
export type TipoTema = 'light' | 'dark';

/** Paleta de color del tema */
export type PaletaColor = 'claro' | 'femenino' | 'masculino' | 'ocean' | 'sunset';

/** Configuración de tema del usuario */
export interface ConfigTema {
  tipo: TipoTema;
  paleta: PaletaColor;
}

/** Detalle de rendimiento del asesor (para perfil) */
export interface RendimientoAsesor {
  promedioTiempoCalificacion: number; // segundos promedio entre respuesta y registro
  frecuenciaRespuestaHoras: number; // cada cuántas horas en promedio responde
  totalEncuestas: number;
  puntoFuerte: string; // cualidad destacada según análisis de comentarios
  puntoFuerteEmoji: string;
  indicePromedio: number | null; // promedio de los 3 índices
  indiceTiempo: number | null;
  indiceConocimiento: number | null;
  indiceSolucion: number | null;
  indiceAmabilidad: number | null;
  tmoPromedio: number | null; // segundos
  tmoTendencia: PuntoTendenciaTMO[]; // TMO por día del mes actual
  tnpsTendencia: PuntoTendencia[]; // tNPS acumulado por día
}

/** Detalle completo de una encuesta para el popup */
export interface EncuestaDetalle {
  id: string;
  idTransaccion: string;
  fechaDia: string;
  fechaInicio: string;
  fechaRegistro: string;
  horaExacta: string;
  grupo: GrupoTNPS;
  tnps: number;
  razon: string;
  comentarioSolucion: string;
  comentarioAdicional: string;
  canal: string;
  medioContacto: string;
  unidad: string;
  cola: string;
  linea: Linea | string;
  usuario: string;
  loginNormalizado: string;
  idCliente: string;
  productoFamilia: string;
  nivel1: string;
  nivel2: string;
  nivel3: string;
  nivel4: string;
  nivel5: string;
  area?: Area;
  // Índices
  indiceTiempo?: number | null;
  indiceConocimiento?: number | null;
  indiceSolucion?: number | null;
  indiceAmabilidad?: number | null;
  indicePromedio?: number | null;
}

// ============================================================
// v3.2.0 — Métricas de Adherencia (Adherencia Noviembre.xlsx)
// ============================================================

/** Métricas diarias de adherencia por asesor */
export interface MetricaAdherencia {
  documento: string;
  nombre: string;
  loginNormalizado: string;
  lob: string;
  supervisor: string;
  fecha: string; // YYYY-MM-DD
  semana: string;
  // Métricas principales
  interacciones: number;
  tmo: number; // segundos
  pph: number; // parts per hour
  occ: number; // % occupancy
  adh: number; // % adherence
  utl: number; // % utilization
  abs: number; // % ausentismo
  // Excesos (en segundos)
  excesoBreak: number;
  excesoBano: number;
  excesoCapa: number;
  // Horas
  horasFact: number;
  horasUtl: number;
  interactuando: number;
  inactivo: number;
  // Asistencia
  asistencia: string; // "Asisto" | "Descanso" | "Ausente"
  llegada: string; // "A tiempo" | "Tarde" | "Antes de tiempo" | "Descanso"
  ausente: boolean;
  tipoFacturable: string; // "PPH" | "PPM"
}

/** Snapshot completo de adherencia */
export interface DatosAdherencia {
  fechaProcesamiento: string;
  archivoNombre: string;
  totalRegistros: number;
  fechaInicio: string;
  fechaFin: string;
  metricas: MetricaAdherencia[];
}

// ============================================================
// v3.4.0 — Horas Robot (Horas robot.xlsx · hoja "Horas Genesys")
// ============================================================

/** Registro individual de Horas Robot por asesor por día */
export interface RegistroHorasRobot {
  documento: string;
  nombre: string;
  usuarioCic: string;
  fecha: string; // YYYY-MM-DD
  lob: string;
  supervisor: string;
  tipoCalculo: string; // Digital, BO4, Suite, etc.
  /** Tiempo programado en segundos (columna Program_Time / Program.) */
  programTime: number;
  /** Horas a pagar en segundos (columna Horas a pagar) */
  horasAPagar: number;
  /** Horas facturables en segundos (columna Horas fact) */
  horasFact: number;
  /** Inicio programado ISO datetime (columna Start_Date) */
  startDate: string | null;
  /** Fin programado ISO datetime (columna End_Date) */
  endDate: string | null;
  /** Entrada real ISO datetime (columna Entrada_Real) */
  entradaReal: string | null;
  /** Salida real ISO datetime (columna Salida_Real) */
  salidaReal: string | null;
  /** Tiempo de conexión total en segundos */
  tiempoConexion: number;
  /** Faltante = Program_Time − Horas a pagar (en segundos). >= 0 */
  faltante: number;
  /** Exceso si horas a pagar > program_time (en segundos) */
  exceso: number;
  /** v3.4.6: Auxiliares (en segundos) desde Horas Genesys */
  disponible: number;
  enCola: number;
  capacitacion: number;
  comida: number;
  descanso: number;
  reunion: number;
  inactivo: number;
  ausente: number;
  ocupado: number;
}

/** Snapshot de Horas Robot */
export interface DatosHorasRobot {
  fechaProcesamiento: string;
  archivoNombre: string;
  totalRegistros: number;
  fechaInicio: string;
  fechaFin: string;
  registros: RegistroHorasRobot[];
}

// ============================================================
// v3.4.0 — Bitácora de Deslogueos Autorizados
// (Bitacora Deslogueos Autorizados · hoja "Deslogueos Autorizados")
// ============================================================

/** Registro individual de un deslogueo autorizado */
export interface DeslogueoAutorizado {
  fecha: string; // YYYY-MM-DD
  dia: number;
  mes: number;
  skill: string;
  documento: string;
  nombre: string;
  supervisor: string;
  horaIngreso: string; // HH:MM
  horaDeslogueo: string; // HH:MM
  horaSalida: string; // HH:MM (Hora de salida programada)
  diferencia: string; // HH:MM (DIFERENCIA)
  ahorro: string; // HH:MM (AHORRO)
  novedad: string | null;
  tipoContrato: string;
}

/** Snapshot de la bitácora de deslogueos */
export interface DatosBitacora {
  fechaProcesamiento: string;
  archivoNombre: string;
  totalRegistros: number;
  deslogueos: DeslogueoAutorizado[];
}

/** Marca de tiempo helpers */
export function ahora(): number {
  return Date.now();
}

/** Determina la franja horaria a partir de la hora (0-23) */
export function franjaDeHora(hora: number): FranjaHoraria {
  if (hora < 6) return 'madrugada';
  if (hora < 12) return 'mañana';
  if (hora < 15) return 'mediodia';
  if (hora < 19) return 'tarde';
  return 'noche';
}

/** Determina el grupo tNPS a partir del score */
export function grupoDeScore(score: number): GrupoTNPS {
  if (score >= 9) return 'Promotor';
  if (score >= 7) return 'Pasivo';
  return 'Detractor';
}
