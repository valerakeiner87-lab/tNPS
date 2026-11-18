// ============================================================
// tNPS Digital Claro Guatemala — Tipos del sistema ATC
// Archivo: src/lib/atc-types.ts
// ATC: moneda interna de incentivos para asesores.
// ============================================================

export type TipoTransaccion =
  | 'SALDO_INICIAL'
  | 'PROMOTOR'
  | 'PROMOTOR_RACHA'
  | 'PASIVO'
  | 'DETRACTOR_ASESOR'
  | 'DETRACTOR_SERVICIO'
  | 'DETRACTOR_INDETERMINADO'
  | 'AJUSTE_ADMIN'
  | 'CANJE'
  | 'CANJE_RACHA'
  | 'APELACION_GANADA'
  | 'APELACION_PERDIDA'
  | 'JUEGO'
  | 'FORMULARIO'
  | 'LOGRO'
  | 'STREAK_BONUS';

export type EstadoCanje = 'pendiente' | 'aprobado' | 'rechazado';
export type EstadoApelacion = 'pendiente' | 'aprobada' | 'rechazada';

export interface TransaccionATC {
  id: string;
  loginNormalizado: string;
  tipo: TipoTransaccion;
  monto: number; // Positivo o negativo
  descripcion: string;
  encuestaId?: string; // Referencia a la encuesta origen
  semanaISO: string; // Semana ISO en que ocurrió (ej. 2026-W35)
  fecha: string; // ISO timestamp del evento origen
  creado?: string; // ISO timestamp de la escritura (para delta sync)
  procesadoPor?: string; // UID o 'auto'
}

export interface StatsAcumuladas {
  totalPromotores: number;
  totalPasivos: number;
  totalDetractores: number;
  totalGanado: number; // Suma de todos los ingresos históricos
  totalGastado: number; // Suma de canjes
  mejorRacha: number;
}

export interface MetricaSemanal {
  semanaISO: string;
  promotores: number;
  pasivos: number;
  detractores: number;
  ganado: number;
  gastado: number;
}

export interface WalletATC {
  loginNormalizado: string;
  nombre: string;
  saldo: number;
  semanaActual: string; // Semana ISO actual
  stats: StatsAcumuladas;
  rachaActual: number;
  ultimaPromocionTs?: number; // Para lógica de racha (<1h)
  metricasSemanales: MetricaSemanal[];
  actualizado: string; // ISO timestamp
}

export interface PremioATC {
  id: string;
  nombre: string;
  descripcion: string;
  costoATC: number;
  categoria: string;
  emoji: string;
  stock: number;
  umbralDiario: number;
  umbralSemanal: number;
  autoAprobacion: boolean;
  activo: boolean;
  creado: string;
  actualizado?: string;
  imagenUrl?: string;
  area?: 'digital' | 'telefonico' | 'ambas';
  tmoMaximoRequerido?: number | null;
  lineaRequerida?: string | null;
  // v3.0.4: duración del premio y límite de reclamos por asesor
  duracionTipo?: 'hora' | 'dia' | 'semana' | 'mes' | null;
  duracionValor?: number; // cantidad (ej: 2 horas, 1 dia)
  maxReclamosPorAsesor?: number; // 0 = ilimitado
  // v3.0.7: Canje por racha de promotores
  canjePorRacha?: boolean;
  promotoresRequeridosRacha?: number; // default 3
  tipoCanje?: 'monedas' | 'racha' | 'ambas'; // default 'monedas'
}

export interface CanjeATC {
  id: string;
  loginNormalizado: string;
  nombreAsesor: string;
  premioId: string;
  premioNombre: string;
  premioEmoji: string;
  costoATC: number;
  estado: EstadoCanje;
  solicitado: string; // ISO
  actualizado?: string; // ISO de la última modificación (delta sync)
  resuelto?: string; // ISO
  resueltoPor?: string; // UID del admin
  comentario?: string;
}

export interface ApelacionATC {
  id: string;
  loginNormalizado: string;
  nombreAsesor: string;
  encuestaId: string;
  motivo: string;
  clasificacionOriginal: string; // 'indeterminado' | 'asesor' | 'servicio'
  // Datos de la encuesta apelada (para que el supervisor la revise
  // sin salir de la vista de apelaciones)
  encuestaScore?: number; // Score tNPS (0-10)
  encuestaRazon?: string; // Razón del detractor
  encuestaComentario?: string; // Comentario de solución (truncado)
  encuestaFecha?: string; // Fecha del día de la encuesta
  estado: EstadoApelacion;
  creado: string; // ISO
  actualizado?: string; // ISO de la última modificación (delta sync)
  resuelto?: string;
  resueltoPor?: string;
  respuesta?: string;
  puntosAplicados?: number; // Delta de ATC aplicado al resolver
}

export type TipoNotificacion =
  | 'apelacion_nueva'
  | 'apelacion_resuelta'
  | 'canje_nuevo'
  | 'canje_resuelto'
  | 'carga_completada'
  | 'wallet_reset'
  | 'info';

export interface NotificacionATC {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  paraLogin?: string; // Login del asesor destinatario
  paraAdmin?: boolean; // Si va a la campana del supervisor
  leida: boolean;
  creado: string;
  data?: Record<string, unknown>;
}

export interface ConfigATC {
  sistemaATCActivo: boolean;
  saldoInicial: number;
  puntosPromotor: number;
  puntosPromotorRacha: number;
  puntosPasivo: number;
  // v3.0: unificado (sin distinción asesor/servicio)
  puntosDetractor: number;
  rachaVentanaMinutos: number;
  diaReinicioSemana: number; // 0 = domingo
  horaReinicio: number; // 23
  minutoReinicio: number; // 59
  ultimaSemanaReiniciada?: string;
  /** Días de caducidad de ATC no canjeado. 0 = sin caducidad. */
  caducidadDias?: number;
}

export const CONFIG_ATC_DEFAULT: ConfigATC = {
  sistemaATCActivo: true,
  saldoInicial: 50,
  puntosPromotor: 1,
  puntosPromotorRacha: 2,
  puntosPasivo: 0,
  puntosDetractor: -1,
  rachaVentanaMinutos: 60,
  diaReinicioSemana: 0,
  horaReinicio: 23,
  minutoReinicio: 59,
  caducidadDias: 0,
};

// ============================================================
// Logros / Medallas
// ============================================================

export interface Logro {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  categoria: 'tnps' | 'racha' | 'atc' | 'apelacion' | 'canje' | 'general';
  puntosRecompensa: number;
}

export interface UsuarioLogro {
  id: string;
  userId: string;
  logroId: string;
  otorgadoEn: string;
  // Datos del logro (join)
  logro?: Logro;
}

/** Catálogo ampliado de logros v3.0 */
export const LOGROS_CATALOGO: Logro[] = [
  // === TNPS ===
  { id: 'logro_primer_promotor', clave: 'primer_promotor', nombre: 'Primer Promotor', descripcion: 'Recibiste tu primera encuesta promotor', emoji: '⭐', categoria: 'tnps', puntosRecompensa: 5 },
  { id: 'logro_10_promotores', clave: '10_promotores', nombre: '10 Promotores', descripcion: 'Acumulaste 10 encuestas promotor', emoji: '🌟', categoria: 'tnps', puntosRecompensa: 15 },
  { id: 'logro_50_promotores', clave: '50_promotores', nombre: '50 Promotores', descripcion: 'Acumulaste 50 encuestas promotor', emoji: '💫', categoria: 'tnps', puntosRecompensa: 30 },
  { id: 'logro_100_promotores', clave: '100_promotores', nombre: 'Centurión', descripcion: 'Acumulaste 100 encuestas promotor', emoji: '🏆', categoria: 'tnps', puntosRecompensa: 50 },
  { id: 'logro_promotor_dia', clave: 'promotor_dia', nombre: 'Estrella del Día', descripcion: 'Más promotores del día en tu área', emoji: '✨', categoria: 'tnps', puntosRecompensa: 20 },
  { id: 'logro_promotor_semana', clave: 'promotor_semana', nombre: 'Estrella de la Semana', descripcion: 'Más promotores de la semana en tu área', emoji: '🌠', categoria: 'tnps', puntosRecompensa: 40 },
  // === Rachas ===
  { id: 'logro_racha_3', clave: 'racha_3', nombre: 'En Racha', descripcion: '3 promotores seguidos (menos de 1h entre cada uno)', emoji: '🔥', categoria: 'racha', puntosRecompensa: 10 },
  { id: 'logro_racha_5', clave: 'racha_5', nombre: 'Imparable', descripcion: '5 promotores seguidos', emoji: '⚡', categoria: 'racha', puntosRecompensa: 25 },
  { id: 'logro_racha_10', clave: 'racha_10', nombre: 'Legendario', descripcion: '10 promotores seguidos', emoji: '💎', categoria: 'racha', puntosRecompensa: 100 },
  { id: 'logro_mas_rachas_semana', clave: 'mas_rachas_semana', nombre: 'Rey de las Rachas', descripcion: 'Más rachas de la semana en tu área', emoji: '👑', categoria: 'racha', puntosRecompensa: 50 },
  // === ATC / Canjes ===
  { id: 'logro_primer_canje', clave: 'primer_canje', nombre: 'Primer Canje', descripcion: 'Canjeaste tu primer premio', emoji: '🎁', categoria: 'canje', puntosRecompensa: 5 },
  { id: 'logro_5_canjes', clave: '5_canjes', nombre: 'Comprador Compulsivo', descripcion: 'Canjeaste 5 premios', emoji: '🛍️', categoria: 'canje', puntosRecompensa: 15 },
  { id: 'logro_mas_canjes_semana', clave: 'mas_canjes_semana', nombre: 'Top Shopper', descripcion: 'Más premios canjeados en la semana', emoji: '🛒', categoria: 'canje', puntosRecompensa: 30 },
  { id: 'logro_ahorrador', clave: 'ahorrador', nombre: 'Ahorrador', descripcion: 'Acumulaste más de 200 ATC sin canjear', emoji: '🐷', categoria: 'atc', puntosRecompensa: 20 },
  { id: 'logro_rico', clave: 'rico', nombre: 'Millonario ATC', descripcion: 'Acumulaste más de 500 ATC', emoji: '💰', categoria: 'atc', puntosRecompensa: 50 },
  // === General ===
  { id: 'logro_perfil_completo', clave: 'perfil_completo', nombre: 'Perfil Completo', descripcion: 'Completaste tu perfil con foto y bio', emoji: '📸', categoria: 'general', puntosRecompensa: 10 },
  { id: 'logro_avatar_personalizado', clave: 'avatar_personalizado', nombre: 'Selfie Pro', descripcion: 'Subiste tu foto de perfil', emoji: '🤳', categoria: 'general', puntosRecompensa: 5 },
  { id: 'logro_sin_detractores_semana', clave: 'sin_detractores_semana', nombre: 'Semana Perfecta', descripcion: 'Una semana completa sin detractores', emoji: '🎯', categoria: 'tnps', puntosRecompensa: 40 },
  { id: 'logro_indice_alto', clave: 'indice_alto', nombre: 'Excelencia en Servicio', descripcion: 'Tu índice promedio supera 4.5', emoji: '🎖️', categoria: 'tnps', puntosRecompensa: 30 },
  { id: 'logro_tmo_bueno', clave: 'tmo_bueno', nombre: 'Efficiente', descripcion: 'Tu TMO promedio está por debajo del umbral de tu línea', emoji: '⏱️', categoria: 'general', puntosRecompensa: 25 },
];

/** Reglas de negocio ATC dinámicas (generadas a partir de ConfigATC) */
export function generarReglasATC(config: ConfigATC): Array<{ evento: string; puntos: string; detalle: string }> {
  const signo = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  return [
    { evento: 'Saldo inicial semanal', puntos: `+${config.saldoInicial} ATC`, detalle: `Se reinicia cada domingo ${String(config.horaReinicio).padStart(2, '0')}:${String(config.minutoReinicio).padStart(2, '0')}` },
    { evento: 'Promotor (score 9-10)', puntos: `${signo(config.puntosPromotor)} ATC`, detalle: 'Por cada encuesta promotor' },
    { evento: 'Promotor con racha', puntos: `${signo(config.puntosPromotorRacha)} ATC`, detalle: `Si el promotor anterior fue hace < ${config.rachaVentanaMinutos} min` },
    { evento: 'Pasivo (score 7-8)', puntos: `${signo(config.puntosPasivo)} ATC`, detalle: 'Por cada encuesta pasiva' },
    { evento: 'Detractor (score 0-6)', puntos: `${signo(config.puntosDetractor)} ATC`, detalle: 'Por cada encuesta detractor' },
  ];
}

/** Semana ISO actual (ej. "2026-W35") */
export function semanaISOActual(fecha: Date = new Date()): string {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSem = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSem);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${semana.toString().padStart(2, '0')}`;
}
