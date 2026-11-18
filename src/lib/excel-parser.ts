// ============================================================
// tNPS Digital Claro Guatemala — Parser de archivos Excel/CSV
// Archivo: src/lib/excel-parser.ts
// Parseo 100% en el navegador con SheetJS.
// v3.0: Soporte para índices (TIEMPO/CONOCIMIENTO/SOLUCION/AMABILIDAD),
//       TMO diario por asesor, y detección automática de columnas.
// ============================================================
import * as XLSX from 'xlsx';
import type {
  AsesorHC,
  AsesorTMO,
  DatosTMO,
  DiaTMO,
  Encuesta,
  FranjaHoraria,
  GrupoTNPS,
  Linea,
  TMOAsesorDaily,
  MetricaAdherencia,
  DatosAdherencia,
  RegistroHorasRobot,
  DatosHorasRobot,
  DeslogueoAutorizado,
  DatosBitacora,
} from './types';
import { TMO_LIMITE_SEGUNDOS, franjaDeHora, grupoDeScore } from './types';
import { lineaDeCola, lineaDeLob, lineaDeUnidad, lineaDeUnidadYCola, normalizarLogin, normalizarTexto } from './queue-mapping';

// ------------------------------------------------------------
// Estructura esperada (baseline) del archivo Qualtrics
// ------------------------------------------------------------
// Estas columnas son OBLIGATORIAS para que la app funcione.
// Si Qualtrics las renombra, elimina o agrega nuevas obligatorias,
// el validador avisará al usuario con un mensaje claro.
export const COLUMNAS_QUALTRICS_OBLIGATORIAS: string[] = [
  'fecha de inicio',
  'tnps',
  'grupo tnps',
  'usuario',
  'cola',
  'unidad',
  'id transaccion',
];

// Columnas recomendadas (no rompen la app si faltan, pero se pierde info).
export const COLUMNAS_QUALTRICS_RECOMENDADAS: string[] = [
  'fecha registrada',
  'razon tnps',
  'comentario solucion',
  'comentario adicional',
  'canal',
  'medio contacto',
  'segmento',
  'id cliente',
  'producto familia',
  'nivel 1',
  'nivel 2',
  'nivel 3',
  'nivel 4',
  'nivel 5',
];

export interface ResultadoValidacionEstructura {
  /** true = el archivo se puede procesar normalmente */
  ok: boolean;
  /** true = la estructura cambió respecto al baseline (alerta amarilla) */
  estructuraCambiada: boolean;
  /** columnas obligatorias que faltan */
  faltantesObligatorias: string[];
  /** columnas recomendadas que faltan */
  faltantesRecomendadas: string[];
  /** columnas presentes en el archivo pero NO en el baseline (posibles nuevas) */
  columnasDesconocidas: string[];
  /** lista completa de columnas detectadas (normalizadas) */
  columnasDetectadas: string[];
  /** mensaje legible para el usuario */
  mensaje: string;
  /** sugerencia de acción */
  sugerencia: string;
}

// ------------------------------------------------------------
// Utilidades genéricas
// ------------------------------------------------------------

/** Lee un File y devuelve el workbook de SheetJS (soporta .xlsx/.xls/.csv) */
export async function leerWorkbook(archivo: File): Promise<XLSX.WorkBook> {
  const buffer = await archivo.arrayBuffer();
  // `cellDates: true` convierte fechas Excel a objetos Date.
  // `dense: true` activa el modo denso que es más tolerante a archivos
  // con compresión inusual (evita los warnings "Bad uncompressed size"
  // que aparecen con algunos exports de Qualtrics 2024+).
  return XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
}

/** Normaliza las claves de una fila para búsqueda insensible a mayúsculas/tildes */
function filaNormalizada(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = normalizarTexto(k).replace(/_/g, ' ');
    out[key] = v;
  }
  return out;
}

// ------------------------------------------------------------
// v3.3.0 — Filtro de LOBs permitidos
// Solo se procesan los 4 LOBs habilitados para ATC Digital.
// ------------------------------------------------------------
const LOBS_PERMITIDOS = [
  'REDES SOCIALES PUBLICAS',
  'WHATSAPP FIJO SOPORTE',
  'WHATSAPP FIJO INFORMACION',
  'WHATSAPP MOVIL',
];

function esLobPermitido(lob: string): boolean {
  const norm = normalizarTexto(lob).toUpperCase().trim();
  return LOBS_PERMITIDOS.some(
    (perm) => normalizarTexto(perm).toUpperCase().trim() === norm
  );
}

/** Busca el primer valor no vacío de la fila entre varios nombres de columna posibles */
function valor(row: Record<string, unknown>, ...nombres: string[]): string {
  for (const n of nombres) {
    const v = row[n];
    if (v !== undefined && v !== null && v.toString().trim() !== '') {
      return v.toString().trim();
    }
  }
  return '';
}

/** Busca el valor numérico de la fila entre varios nombres de columna */
function valorNumerico(row: Record<string, unknown>, ...nombres: string[]): number {
  for (const n of nombres) {
    const v = row[n];
    if (v !== undefined && v !== null && v !== '') {
      const num = Number(v);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
}

// ------------------------------------------------------------
// v3.0 — Extracción de índices (TIEMPO/CONOCIMIENTO/SOLUCION/AMABILIDAD)
// ------------------------------------------------------------
// En el archivo Qualtrics de Digital, las columnas 7-9 (sin header) tienen
// valores como 5, 5, "Sí". Estas son las calificaciones de los índices.
// En Telefonico, las columnas se llaman AMABILIDAD, CONOCIMIENTO, SOLUCION.
// El parser es tolerante: busca por nombre de columna Y por posición si
// no encuentra el nombre.

/** Convierte un valor a número 1-5 (o null si no aplica) */
function aIndice(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v >= 1 && v <= 5 ? v : null;
  const s = String(v).trim().toLowerCase();
  // Aceptar "Sí"/"No" como 5/1
  if (s === 'si' || s === 'sí' || s === 'yes') return 5;
  if (s === 'no' || s === 'no') return 1;
  const n = Number(s);
  if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
  return null;
}

/** Extrae los 3 índices de Digital: TIEMPO, CONOCIMIENTO, SOLUCION
 *
 * IMPORTANTE: `row` es la fila normalizada (busca por nombre de columna),
 * `rawRow` es la fila original de SheetJS (busca por posición en columnas
 * sin header como `__EMPTY`, `__EMPTY_1`, `__EMPTY_2`).
 */
function extraerIndicesDigital(
  row: Record<string, unknown>,
  rawRow?: Record<string, unknown>
): {
  tiempo: number | null;
  conocimiento: number | null;
  solucion: number | null;
  promedio: number | null;
} {
  // Buscar por nombre explícito primero
  const tiempo = aIndice(
    row['tiempo'] ?? row['indice tiempo'] ?? row['rapidez'] ?? row['indice rapidez']
  );
  const conocimiento = aIndice(
    row['conocimiento'] ?? row['indice conocimiento'] ?? row['expertise']
  );
  const solucion = aIndice(
    row['solucion'] ?? row['indice solucion'] ?? row['solucion likert']
  );

  // Si no se encontraron por nombre, buscar por posición en columnas sin header
  // en la fila ORIGINAL (sin normalizar). Las claves en rawRow serían
  // "__EMPTY", "__EMPTY_1", "__EMPTY_2" (como las nombra SheetJS).
  if (tiempo === null && conocimiento === null && solucion === null && rawRow) {
    const emptyKeys = Object.keys(rawRow).filter(k => k.startsWith('__EMPTY') || k === '' || k === ' ');
    if (emptyKeys.length >= 3) {
      const v1 = aIndice(rawRow[emptyKeys[0]]);
      const v2 = aIndice(rawRow[emptyKeys[1]]);
      const v3 = aIndice(rawRow[emptyKeys[2]]);
      // Si al menos 2 de los 3 tienen valores numéricos 1-5, los usamos
      const validos = [v1, v2, v3].filter((v): v is number => v !== null);
      if (validos.length >= 2) {
        return {
          tiempo: v1,
          conocimiento: v2,
          solucion: v3,
          promedio: calcularPromedioIndices([v1, v2, v3]),
        };
      }
    }
  }

  return {
    tiempo,
    conocimiento,
    solucion,
    promedio: calcularPromedioIndices([tiempo, conocimiento, solucion]),
  };
}

/** Extrae los 3 índices de Telefonico: AMABILIDAD, CONOCIMIENTO, SOLUCION
 *
 * Igual que extraerIndicesDigital pero con AMABILIDAD en vez de TIEMPO.
 */
function extraerIndicesTelefonico(
  row: Record<string, unknown>,
  rawRow?: Record<string, unknown>
): {
  amabilidad: number | null;
  conocimiento: number | null;
  solucion: number | null;
  promedio: number | null;
} {
  const amabilidad = aIndice(
    row['amabilidad'] ?? row['indice amabilidad'] ?? row['cordialidad']
  );
  const conocimiento = aIndice(
    row['conocimiento'] ?? row['indice conocimiento'] ?? row['expertise']
  );
  const solucion = aIndice(
    row['solucion'] ?? row['indice solucion'] ?? row['solucion likert']
  );

  // Fallback por posición en la fila original
  if (amabilidad === null && conocimiento === null && solucion === null && rawRow) {
    const emptyKeys = Object.keys(rawRow).filter(k => k.startsWith('__EMPTY') || k === '' || k === ' ');
    if (emptyKeys.length >= 3) {
      const v1 = aIndice(rawRow[emptyKeys[0]]);
      const v2 = aIndice(rawRow[emptyKeys[1]]);
      const v3 = aIndice(rawRow[emptyKeys[2]]);
      const validos = [v1, v2, v3].filter((v): v is number => v !== null);
      if (validos.length >= 2) {
        return {
          amabilidad: v1,
          conocimiento: v2,
          solucion: v3,
          promedio: calcularPromedioIndices([v1, v2, v3]),
        };
      }
    }
  }

  return {
    amabilidad,
    conocimiento,
    solucion,
    promedio: calcularPromedioIndices([amabilidad, conocimiento, solucion]),
  };
}

function calcularPromedioIndices(valores: Array<number | null>): number | null {
  const validos = valores.filter((v): v is number => v !== null);
  if (validos.length === 0) return null;
  const suma = validos.reduce((s, v) => s + v, 0);
  return Math.round((suma / validos.length) * 100) / 100;
}

/** Convierte una celda de fecha (serial Excel, Date o string) a Date | null */
function celdaAFecha(celda: unknown): Date | null {
  if (celda === undefined || celda === null || celda === '') return null;
  if (celda instanceof Date && !Number.isNaN(celda.getTime())) return celda;
  if (typeof celda === 'number') {
    // Serial de Excel (días desde 1899-12-30)
    const ms = Math.round((celda - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = celda.toString().trim();
  // ISO
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    d = new Date(anio, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // yyyy/mm/dd
  const m2 = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m2) {
    d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function fechaADia(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fechaAHoraExacta(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ------------------------------------------------------------
// Validador de estructura (Qualtrics)
// ------------------------------------------------------------

/**
 * Lee solo la primera fila del archivo para validar la estructura de
 * columnas sin procesar todo el archivo.
 *
 * Compara contra el baseline (COLUMNAS_QUALTRICS_OBLIGATORIAS y
 * COLUMNAS_QUALTRICS_RECOMENDADAS). Si faltan obligatorias, devuelve ok=false.
 * Si hay columnas nuevas desconocidas, marca estructuraCambiada=true para
 * lanzar la alerta.
 */
export async function validarEstructuraQualtrics(archivo: File): Promise<ResultadoValidacionEstructura> {
  const wb = await leerWorkbook(archivo);
  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) {
    return {
      ok: false,
      estructuraCambiada: false,
      faltantesObligatorias: COLUMNAS_QUALTRICS_OBLIGATORIAS,
      faltantesRecomendadas: COLUMNAS_QUALTRICS_RECOMENDADAS,
      columnasDesconocidas: [],
      columnasDetectadas: [],
      mensaje: 'El archivo no contiene hojas de datos.',
      sugerencia: 'Verifica que el archivo sea el export correcto de Qualtrics.',
    };
  }
  const ws = wb.Sheets[nombreHoja];

  // Obtener encabezados (primera fila)
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
  if (filas.length === 0) {
    return {
      ok: false,
      estructuraCambiada: false,
      faltantesObligatorias: COLUMNAS_QUALTRICS_OBLIGATORIAS,
      faltantesRecomendadas: COLUMNAS_QUALTRICS_RECOMENDADAS,
      columnasDesconocidas: [],
      columnasDetectadas: [],
      mensaje: 'El archivo no contiene filas de datos.',
      sugerencia: 'Verifica que el archivo tenga encabezados en la primera fila.',
    };
  }

  const encabezadosCrudos = Object.keys(filas[0]);
  // Normalizar: minúsculas, sin tildes, _ → espacio
  const encabezadosNorm = new Set<string>();
  const mapaNormalizado = new Map<string, string>(); // norm → crudo (para reportar)
  for (const h of encabezadosCrudos) {
    const norm = normalizarTexto(h).replace(/_/g, ' ').trim();
    if (norm) {
      encabezadosNorm.add(norm);
      mapaNormalizado.set(norm, h);
    }
  }

  // Detectar faltantes
  const faltantesObligatorias = COLUMNAS_QUALTRICS_OBLIGATORIAS.filter((c) => {
    // Coincidencia exacta o "comienza con" (ej. "fecha de inicio (-06:00 gmt)" contiene "fecha de inicio")
    return !Array.from(encabezadosNorm).some((e) => e === c || e.startsWith(c));
  });
  const faltantesRecomendadas = COLUMNAS_QUALTRICS_RECOMENDADAS.filter((c) => {
    return !Array.from(encabezadosNorm).some((e) => e === c || e.startsWith(c));
  });

  // Columnas desconocidas (presentes en el archivo pero no en el baseline)
  const baselineCompleto = new Set<string>([
    ...COLUMNAS_QUALTRICS_OBLIGATORIAS,
    ...COLUMNAS_QUALTRICS_RECOMENDADAS,
    // Variantes conocidas que aparecen en exports históricos
    'fecha de inicio (-06:00 gmt)',
    'fecha registrada (-06:00 gmt)',
    'fecha ultima interaccion (-06:00 gmt)',
    'fecha transaccion',
    'id pais',
    'siglas pais',
    'medio envio',
    'dato contacto',
    'escalado',
    'producto grupo',
    'producto tecnologia',
    'unidad comercial',
    'experiencia',
    'solucion likert',
    'facilidad',
    'funcionamiento',
    'tiempo',
    'conocimiento',
    'solucion',
    'informacion suficiente',
    'canal de la distribucion',
    'duracion (en segundos)',
    'referencia a datos externos',
    'finalizado',
    'progreso',
    'fcr',
    'csat',
    'ces',
    ' recordid',
    ' recordeddate (-06:00 gmt)',
    ' cacheddate (-06:00 gmt)',
    ' sourceid',
    ' sourcemapid',
    ' sourcetype',
    // Variantes alternativas usadas por el parser
    'login normalizado',
    'login_normalizado',
    'user',
    'login',
    'queue',
    'unit',
    'score',
    'puntaje',
    'razon',
    'comentario',
    'medio de contacto',
    'idcliente',
    'codigo cliente',
    'producto',
    'producto/familia',
    'tipificacion 1',
    'tipificacion 2',
    'tipificacion 3',
    'tipificacion 4',
    'tipificacion 5',
    'fecha inicio',
    'fecha dia',
    'hora',
    'hora exacta',
    'grupo',
    'nombre del agente',
    'nombre agente',
    'agente',
    'nombre',
    'nombre genesys',
  ]);
  const columnasDesconocidas = Array.from(encabezadosNorm).filter(
    (e) => !baselineCompleto.has(e) && !Array.from(baselineCompleto).some((b) => e.startsWith(b) || b.startsWith(e))
  );

  const ok = faltantesObligatorias.length === 0;
  const estructuraCambiada = columnasDesconocidas.length > 0 || faltantesObligatorias.length > 0;

  let mensaje = 'Estructura correcta.';
  let sugerencia = '';
  if (faltantesObligatorias.length > 0) {
    mensaje = `Faltan columnas obligatorias: ${faltantesObligatorias.join(', ')}.`;
    sugerencia =
      'Qualtrics cambió la estructura del archivo. Revisa el mapeo en src/lib/excel-parser.ts antes de cargarlo.';
  } else if (columnasDesconocidas.length > 0) {
    mensaje = `Se detectaron ${columnasDesconocidas.length} columna(s) nueva(s) en el archivo. La app puede procesarlo, pero revisa si Qualtrics modificó la estructura.`;
    sugerencia = 'Revisa las columnas nuevas; si son relevantes, agrega su mapeo en excel-parser.ts.';
  }

  return {
    ok,
    estructuraCambiada,
    faltantesObligatorias,
    faltantesRecomendadas,
    columnasDesconocidas,
    columnasDetectadas: Array.from(encabezadosNorm).sort(),
    mensaje,
    sugerencia,
  };
}

// ------------------------------------------------------------
// Parser Qualtrics
// ------------------------------------------------------------

/**
 * Parsea el archivo de encuestas Qualtrics.
 * Una sola hoja; las columnas se buscan por nombre (el orden no importa).
 *
 * El parser es tolerante: si la estructura cambia pero las columnas
 * obligatorias siguen presentes, igual procesa el archivo.
 */
export async function parsearQualtrics(archivo: File): Promise<Encuesta[]> {
  const wb = await leerWorkbook(archivo);
  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) throw new Error('El archivo Qualtrics no contiene hojas de datos.');
  const ws = wb.Sheets[nombreHoja];
  // Usar `blankrows: false` para saltar filas completamente vacías
  // que a veces aparecen en exports de Qualtrics con celdas combinadas.
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, blankrows: false });

  const encuestas: Encuesta[] = [];
  let contador = 0;
  let filasVacias = 0;

  for (const fila of filas) {
    const row = filaNormalizada(fila);

    // Detección robusta de fila vacía: si no hay TNPS ni USUARIO ni ID_TRANSACCION,
    // la fila está vacía y se salta.
    const tnpsStr = valor(row, 'tnps', 'score', 'puntaje');
    const tnpsRaw = valorNumerico(row, 'tnps', 'score', 'puntaje');
    const loginCrudo = valor(row, 'login normalizado', 'login_normalizado', 'usuario', 'user', 'login');
    const idTransaccion = valor(row, 'id transaccion', 'idtransaccion', 'transaccion');

    if (tnpsStr === '' && !loginCrudo && !idTransaccion) {
      filasVacias++;
      continue;
    }

    // Si TNPS es 0 pero el grupo TNPS dice Detractor, igual lo procesamos
    // (es una calificación válida de 0).
    // Solo saltamos si TNPS es 0 Y el campo grupo también está vacío Y no hay comentario.
    if (
      tnpsStr === '' &&
      !valor(row, 'grupo tnps', 'grupo') &&
      !valor(row, 'razon tnps', 'razon') &&
      !valor(row, 'comentario solucion', 'comentario')
    ) {
      filasVacias++;
      continue;
    }

    const loginNormalizado = normalizarLogin(loginCrudo);

    const fechaInicioCelda =
      row['fecha de inicio (-06:00 gmt)'] ?? row['fecha de inicio'] ?? row['fecha inicio'];
    const fechaInicioDate = celdaAFecha(fechaInicioCelda);
    const fechaRegistroDate =
      celdaAFecha(row['fecha registrada (-06:00 gmt)']) ??
      celdaAFecha(row['fecha registrada']) ??
      celdaAFecha(row['fecha registro']) ??
      celdaAFecha(row['fecha dia']) ??
      fechaInicioDate;

    let fechaDia = '';
    let hora = 0;
    let horaExacta = '';
    if (fechaInicioDate) {
      fechaDia = fechaADia(fechaInicioDate);
      hora = fechaInicioDate.getHours();
      horaExacta = fechaAHoraExacta(fechaInicioDate);
    } else {
      fechaDia = valor(row, 'fecha dia', 'fecha registrada', 'fecha registro');
      const horaStr = valor(row, 'hora', 'hora exacta');
      if (horaStr) {
        const mh = horaStr.match(/^(\d{1,2})/);
        hora = mh ? Number(mh[1]) : 0;
        horaExacta = horaStr;
      }
    }

    const grupoRaw = normalizarTexto(valor(row, 'grupo tnps', 'grupo'));
    let grupo: GrupoTNPS;
    if (grupoRaw.startsWith('prom')) grupo = 'Promotor';
    else if (grupoRaw.startsWith('pas')) grupo = 'Pasivo';
    else if (grupoRaw.startsWith('det')) grupo = 'Detractor';
    else grupo = grupoDeScore(tnpsRaw);

    const cola = valor(row, 'cola', 'queue');
    const unidad = valor(row, 'unidad', 'unit');
    // Combinar unidad + cola para detectar correctamente Fijo Información
    // (la unidad solo dice "Fijo", la cola dice "GT_WA_Fijo_Informacion")
    const linea: Linea = lineaDeUnidadYCola(unidad, cola);

    const tnps = Math.max(0, Math.min(10, tnpsRaw));
    const franja: FranjaHoraria = franjaDeHora(hora);

    // ID estable basado en idTransaccion (UUID de Qualtrics) para que la
    // misma encuesta tenga siempre el mismo ID entre uploads. Si por
    // algún motivo idTransaccion está vacío, se usa un fallback con el
    // contador + el login + la fecha + la hora exacta (único por fila).
    const idEstable = idTransaccion
      ? `enc_${idTransaccion}`
      : `enc_${contador}_${loginNormalizado}_${fechaDia}_${horaExacta}`;

    // v3.0: Extraer índices de Digital (TIEMPO, CONOCIMIENTO, SOLUCION)
    // Pasamos la fila original (fila) además de la normalizada (row) para
    // poder buscar las columnas sin header (__EMPTY, __EMPTY_1, __EMPTY_2).
    const indices = extraerIndicesDigital(row, fila);

    encuestas.push({
      id: idEstable,
      idTransaccion,
      // En Digital, el ID de interacción es el mismo ID_TRANSACCION
      idInteraccion: idTransaccion,
      fechaDia,
      fechaInicio: fechaInicioDate ? fechaInicioDate.toISOString() : fechaDia,
      fechaRegistro: fechaRegistroDate ? fechaRegistroDate.toISOString() : fechaDia,
      hora,
      horaExacta,
      franjaHoraria: franja,
      grupo,
      tnps,
      razon: valor(row, 'razon tnps', 'razon'),
      comentarioSolucion: valor(row, 'comentario solucion', 'comentario'),
      comentarioAdicional: valor(row, 'comentario adicional'),
      canal: valor(row, 'canal'),
      medioContacto: valor(row, 'medio contacto', 'medio de contacto'),
      unidad,
      cola,
      linea,
      usuario: loginCrudo,
      loginNormalizado,
      segmento: valor(row, 'segmento'),
      idCliente: valor(row, 'id cliente', 'idcliente', 'codigo cliente'),
      productoFamilia: valor(row, 'producto familia', 'producto/familia', 'producto'),
      nivel1: valor(row, 'nivel 1', 'tipificacion 1'),
      nivel2: valor(row, 'nivel 2', 'tipificacion 2'),
      nivel3: valor(row, 'nivel 3', 'tipificacion 3'),
      nivel4: valor(row, 'nivel 4', 'tipificacion 4'),
      nivel5: valor(row, 'nivel 5', 'tipificacion 5'),
      area: 'digital',
      // v3.0: índices
      indiceTiempo: indices.tiempo,
      indiceConocimiento: indices.conocimiento,
      indiceSolucion: indices.solucion,
      indiceAmabilidad: null,
      indicePromedio: indices.promedio,
    });
    contador++;
  }

  if (filasVacias > 0) {
    console.info(`[Qualtrics] ${filasVacias} fila(s) vacía(s) omitida(s) de ${filas.length} total.`);
  }

  return encuestas;
}

// ------------------------------------------------------------
// Parser Qualtrics Telefónico (109 columnas, formato distinto)
// ------------------------------------------------------------

/**
 * Parsea el archivo de encuestas Qualtrics del área Telefónica.
 *
 * Diferencias con Digital:
 * - Columnas con guiones bajos: ID_TRANSACCION, USUARIO_USUARIO, NIVEL_1,
 *   MEDIO_CONTACTO, ID_CLIENTE, MEDIO_ENVIO, SIGLAS_PAIS, ID_PAIS, etc.
 * - USUARIO_USUARIO tiene el login del asesor (puede traer CLAROGT_ prefijo).
 * - UNIDAD_INICIAL y SERVICIO_INICIAL reemplazan a UNIDAD y COLA.
 * - SOLUCION COMENTARIO (con espacio) reemplaza a COMENTARIO SOLUCION.
 * - FECHA INICIAL (-06:00 GMT) reemplaza a FECHA DE INICIO.
 * - GRUPO tNPS y tNPS (minúsculas) en lugar de GRUPO TNPS / TNPS mayúsculas.
 * - ID_TRANSACCION es el identificador único (no hay ID_INTERACCION).
 *
 * El parser es tolerante: si una columna falta, usa string vacío.
 */
export async function parsearQualtricsTelefonico(archivo: File): Promise<Encuesta[]> {
  const wb = await leerWorkbook(archivo);
  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) throw new Error('El archivo Qualtrics (Telefónico) no contiene hojas de datos.');
  const ws = wb.Sheets[nombreHoja];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, blankrows: false });

  const encuestas: Encuesta[] = [];
  let contador = 0;
  let filasVacias = 0;

  for (const fila of filas) {
    const row = filaNormalizada(fila);

    // En Telefónico: TNPS en minúscula, RAZON tNPS, GRUPO tNPS
    const tnpsStr = valor(row, 'tnps', 'score', 'puntaje');
    const tnpsRaw = valorNumerico(row, 'tnps', 'score', 'puntaje');
    // USUARIO_USUARIO es el login; a veces trae prefijo CLAROGT_
    const loginCrudo = valor(
      row,
      'usuario usuario',
      'usuario_usuario',
      'usuario',
      'user',
      'login',
      'usuario id'
    );
    const idTransaccion = valor(row, 'id transaccion', 'id_transaccion', 'idtransaccion', 'transaccion');

    if (tnpsStr === '' && !loginCrudo && !idTransaccion) {
      filasVacias++;
      continue;
    }
    if (
      tnpsStr === '' &&
      !valor(row, 'grupo tnps', 'grupo') &&
      !valor(row, 'razon tnps', 'razon') &&
      !valor(row, 'solucion comentario', 'comentario solucion', 'comentario')
    ) {
      filasVacias++;
      continue;
    }

    const loginNormalizado = normalizarLogin(loginCrudo);

    // Fechas: FECHA INICIAL (-06:00 GMT), FECHA REGISTRO (-06:00 GMT), FECHA FINAL
    const fechaInicioCelda =
      row['fecha inicial (-06:00 gmt)'] ?? row['fecha inicial'] ?? row['fecha inicio'];
    const fechaInicioDate = celdaAFecha(fechaInicioCelda);
    const fechaRegistroDate =
      celdaAFecha(row['fecha registro (-06:00 gmt)']) ??
      celdaAFecha(row['fecha registrada']) ??
      celdaAFecha(row['fecha registro']) ??
      fechaInicioDate;

    let fechaDia = '';
    let hora = 0;
    let horaExacta = '';
    if (fechaInicioDate) {
      fechaDia = fechaADia(fechaInicioDate);
      hora = fechaInicioDate.getHours();
      horaExacta = fechaAHoraExacta(fechaInicioDate);
    } else {
      fechaDia = valor(row, 'fecha dia', 'fecha transaccion', 'fecha registrada');
      const horaStr = valor(row, 'hora', 'hora exacta');
      if (horaStr) {
        const mh = horaStr.match(/^(\d{1,2})/);
        hora = mh ? Number(mh[1]) : 0;
        horaExacta = horaStr;
      }
    }

    const grupoRaw = normalizarTexto(valor(row, 'grupo tnps', 'grupo'));
    let grupo: GrupoTNPS;
    if (grupoRaw.startsWith('prom')) grupo = 'Promotor';
    else if (grupoRaw.startsWith('pas')) grupo = 'Pasivo';
    else if (grupoRaw.startsWith('det')) grupo = 'Detractor';
    else grupo = grupoDeScore(tnpsRaw);

    // UNIDAD_INICIAL → Fijo/Móvil; SERVICIO_INICIAL → cola
    const unidad = valor(row, 'unidad inicial', 'unidad', 'unit');
    const cola = valor(row, 'servicio inicial', 'cola', 'queue');
    // En Telefónico, la unidad suele ser solo "Fijo" sin distinguir
    // Soporte vs Información. Usamos lineaDeUnidadYCola que combina
    // ambos para detectar correctamente "Fijo Información".
    const linea: Linea = lineaDeUnidadYCola(unidad, cola);

    const tnps = Math.max(0, Math.min(10, tnpsRaw));
    const franja: FranjaHoraria = franjaDeHora(hora);

    const idEstable = idTransaccion
      ? `enc_${idTransaccion}`
      : `enc_tel_${contador}_${loginNormalizado}_${fechaDia}_${horaExacta}`;

    // En Telefónico, REFERENCIA_EXTERNA es el ID de interacción con el
    // cliente (número de teléfono o ID de llamada). Si no existe, usamos
    // el ID_TRANSACCION como fallback.
    const idInteraccion = valor(row, 'referencia externa', 'referencia_externa', 'id interaccion', 'id_interaccion') || idTransaccion;

    // v3.0: Extraer índices de Telefonico (AMABILIDAD, CONOCIMIENTO, SOLUCION)
    // Pasamos la fila original (fila) además de la normalizada (row).
    const indicesTel = extraerIndicesTelefonico(row, fila);

    encuestas.push({
      id: idEstable,
      idTransaccion,
      idInteraccion,
      fechaDia,
      fechaInicio: fechaInicioDate ? fechaInicioDate.toISOString() : fechaDia,
      fechaRegistro: fechaRegistroDate ? fechaRegistroDate.toISOString() : fechaDia,
      hora,
      horaExacta,
      franjaHoraria: franja,
      grupo,
      tnps,
      razon: valor(row, 'razon tnps', 'razon'),
      // En Telefónico el campo se llama "SOLUCION COMENTARIO" (orden invertido)
      comentarioSolucion: valor(row, 'solucion comentario', 'comentario solucion', 'comentario'),
      comentarioAdicional: valor(row, 'comentario adicional'),
      canal: valor(row, 'canal'),
      medioContacto: valor(row, 'medio contacto', 'medio de contacto', 'medio_contacto'),
      unidad,
      cola,
      linea,
      usuario: loginCrudo,
      loginNormalizado,
      segmento: valor(row, 'segmento'),
      idCliente: valor(row, 'id cliente', 'idcliente', 'id cliente', 'id_cliente'),
      productoFamilia: valor(row, 'producto familia', 'producto/familia', 'producto'),
      nivel1: valor(row, 'nivel 1', 'nivel_1', 'tipificacion 1'),
      nivel2: valor(row, 'nivel 2', 'nivel_2', 'tipificacion 2'),
      nivel3: valor(row, 'nivel 3', 'nivel_3', 'tipificacion 3'),
      nivel4: valor(row, 'nivel 4', 'nivel_4', 'tipificacion 4'),
      nivel5: valor(row, 'nivel 5', 'nivel_5', 'tipificacion 5'),
      area: 'digital',
      // v3.0: índices
      indiceTiempo: null,
      indiceConocimiento: indicesTel.conocimiento,
      indiceSolucion: indicesTel.solucion,
      indiceAmabilidad: indicesTel.amabilidad,
      indicePromedio: indicesTel.promedio,
    });
    contador++;
  }

  if (filasVacias > 0) {
    console.info(`[Qualtrics-Tel] ${filasVacias} fila(s) vacía(s) omitida(s) de ${filas.length} total.`);
  }

  return encuestas;
}

// ------------------------------------------------------------
// Parser HC (Health Check)
// ------------------------------------------------------------

/**
 * Parsea el archivo HC con las hojas ACTIVOS y TRANSICIONES.
 * La primera fila es título; la segunda contiene los encabezados.
 * Se detecta automáticamente la fila que contiene "DOCUMENTO" o "DOCUMENTO SP".
 */
export async function parsearHC(archivo: File): Promise<AsesorHC[]> {
  const wb = await leerWorkbook(archivo);
  const asesores: AsesorHC[] = [];
  const vistos = new Set<string>();

  for (const nombreHoja of wb.SheetNames) {
    const origen =
      normalizarTexto(nombreHoja).includes('transic') ? 'TRANSICIONES' : 'ACTIVOS';
    if (!normalizarTexto(nombreHoja).includes('activ') && origen !== 'TRANSICIONES') continue;

    const ws = wb.Sheets[nombreHoja];
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: false });

    // Buscar fila de encabezados
    let filaEncabezados = -1;
    for (let i = 0; i < Math.min(matriz.length, 10); i++) {
      const celdas = (matriz[i] || []).map((c) => normalizarTexto(String(c ?? '')));
      if (celdas.some((c) => c === 'documento' || c === 'documento sp' || c.startsWith('documento'))) {
        filaEncabezados = i;
        break;
      }
    }
    if (filaEncabezados < 0) continue;

    const encabezados = (matriz[filaEncabezados] || []).map((c) => normalizarTexto(String(c ?? '')).replace(/_/g, ' '));

    for (let i = filaEncabezados + 1; i < matriz.length; i++) {
      const filaCruda = matriz[i] || [];
      if (filaCruda.every((c) => c === '' || c === null || c === undefined)) continue;

      const row: Record<string, unknown> = {};
      encabezados.forEach((h, idx) => {
        if (h) row[h] = filaCruda[idx];
      });

      const documento = valor(row, 'documento sp', 'documento', 'doc', 'no documento', 'dpi');
      const nombre = valor(row, 'nombre', 'nombre completo', 'nombre asesor', 'asesor');
      const usuarioCic = normalizarLogin(valor(row, 'usuario cic', 'usuariocic', 'usuario', 'login cic'));
      if (!documento && !usuarioCic) continue;

      const clave = documento || usuarioCic;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const lob = valor(row, 'lob', 'linea de negocio', 'area');
      // v3.3.0: Solo se procesan los 4 LOBs permitidos.
      // Algunas filas HC pueden no tener LOB; en ese caso se conservan.
      if (lob && !esLobPermitido(lob)) continue;
      const linea = lineaDeLob(lob) ?? undefined;

      asesores.push({
        documento,
        nombre,
        usuarioCic,
        usuarioGen: valor(row, 'usuario gen', 'usuariogen', 'usuario genesys'),
        loginAib: valor(row, 'login aib', 'loginaib', 'aib'),
        cargo: valor(row, 'cargo', 'puesto', 'posicion'),
        lob,
        linea,
        supervisor: valor(row, 'supervisor', 'supervisor nombre', 'jefe inmediato'),
        jefeOperacion: valor(row, 'jefe de operacion', 'jefe operacion', 'jefe de operaciones'),
        fechaIngreso: valor(row, 'fecha ingreso', 'fecha de ingreso', 'ingreso'),
        fechaNacimiento: valor(
          row,
          'fecha nacimiento',
          'fecha de nacimiento',
          'fecha nac',
          'nacimiento',
          'cumpleanos',
          'cumpleaños',
          'fecha cumple',
          'born date',
          'birthdate',
          'fecha de nac'
        ),
        ciudad: valor(row, 'ciudad'),
        sede: valor(row, 'sede'),
        genero: valor(row, 'genero', 'sexo'),
        tipoContrato: valor(row, 'tipo de contrato', 'tipo contrato'),
        modalidad: valor(row, 'modalidad', 'modalidad de trabajo'),
        contratacion: valor(row, 'contratacion', 'contratación', 'tipo contratacion'),
        email: valor(row, 'e-mail', 'email', 'correo', 'correo electronico'),
        telefono: valor(row, 'telefono', 'teléfono', 'celular'),
        origen,
        loginNormalizado: usuarioCic,
      });
    }
  }

  return asesores;
}

// ------------------------------------------------------------
// Parser TMO (Tiempo Medio Operativo)
// ------------------------------------------------------------

/**
 * Parsea el archivo TMO.
 * Hoja "BD NEW": columnas `Nombre del agente`, `Inicio del intervalo`,
 * `Manejo` (cantidad de interacciones), `Manejo total` (tiempo en ms).
 * Hoja "Activos1" (opcional): mapea nombre Genesys → USUARIO CIC.
 * Fórmula: TMO (segundos) = (Manejo_total / 1000) / Manejo
 */
export async function parsearTMO(archivo: File, asesoresHC: AsesorHC[] = []): Promise<DatosTMO> {
  const wb = await leerWorkbook(archivo);

  // 1. Buscar hoja "Activos1" para mapear Nombre Genesys → usuarioCic
  const mapaActivos = new Map<string, { usuarioCic: string; nombre: string; documento: string }>();
  for (const nombreHoja of wb.SheetNames) {
    if (!normalizarTexto(nombreHoja).replace(/\s/g, '').includes('activos')) continue;
    const ws = wb.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, blankrows: false });
    for (const fila of filas) {
      const row = filaNormalizada(fila);
      const nombreAgente = valor(row, 'nombre del agente', 'nombre agente', 'nombre', 'agente', 'nombre genesys');
      const usuarioCic = normalizarLogin(valor(row, 'usuario cic', 'usuariocic', 'usuario', 'login'));
      if (nombreAgente && usuarioCic) {
        mapaActivos.set(normalizarTexto(nombreAgente), {
          usuarioCic,
          nombre: valor(row, 'nombre', 'nombre completo', 'nombre asesor') || nombreAgente,
          documento: valor(row, 'documento sp', 'documento', 'doc'),
        });
      }
    }
  }

  // 2. Buscar hoja "BD NEW"
  let hojaBD: XLSX.WorkSheet | null = null;
  for (const nombreHoja of wb.SheetNames) {
    if (normalizarTexto(nombreHoja).replace(/[\s_-]/g, '').includes('bdnew')) {
      hojaBD = wb.Sheets[nombreHoja];
      break;
    }
  }
  if (!hojaBD) {
    // Fallback: primera hoja que no sea Activos
    for (const nombreHoja of wb.SheetNames) {
      if (!normalizarTexto(nombreHoja).replace(/\s/g, '').includes('activos')) {
        hojaBD = wb.Sheets[nombreHoja];
        break;
      }
    }
  }
  if (!hojaBD) throw new Error('No se encontró la hoja "BD NEW" en el archivo TMO.');

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hojaBD, { defval: '', raw: false, blankrows: false });

  // 3. Acumular por (agente, día): sumar Manejo y Manejo total
  interface Acum {
    manejo: number;
    manejoTotal: number; // ms
  }
  const porAgenteDia = new Map<string, Map<string, Acum>>(); // agente → día → acum
  const nombresGenesys = new Map<string, string>(); // agenteKey → nombre original

  for (const fila of filas) {
    const row = filaNormalizada(fila);
    const nombreAgente = valor(row, 'nombre del agente', 'nombre agente', 'agente', 'nombre');
    if (!nombreAgente) continue;

    const fechaCelda = row['inicio del intervalo'] ?? row['inicio intervalo'] ?? row['fecha'];
    const fecha = celdaAFecha(fechaCelda);
    if (!fecha) continue;
    const dia = fechaADia(fecha);

    const manejo = Math.round(valorNumerico(row, 'manejo', 'interacciones', 'handle'));
    const manejoTotalMs = valorNumerico(row, 'manejo total', 'manejo_total', 'tiempo total', 'tiempo manejo total');

    const agenteKey = normalizarTexto(nombreAgente);
    if (!porAgenteDia.has(agenteKey)) {
      porAgenteDia.set(agenteKey, new Map());
      nombresGenesys.set(agenteKey, nombreAgente);
    }
    const porDia = porAgenteDia.get(agenteKey)!;
    const acum = porDia.get(dia) ?? { manejo: 0, manejoTotal: 0 };
    acum.manejo += manejo;
    acum.manejoTotal += manejoTotalMs;
    porDia.set(dia, acum);
  }

  // 4. Cruzar con Activos1 (y fallback por nombre contra el HC)
  const hcPorNombre = new Map<string, AsesorHC>();
  for (const a of asesoresHC) {
    hcPorNombre.set(normalizarTexto(a.nombre), a);
    if (a.usuarioGen) hcPorNombre.set(normalizarTexto(a.usuarioGen), a);
  }

  const asesores: AsesorTMO[] = [];
  let fechaMin = '';
  let fechaMax = '';

  for (const [agenteKey, porDia] of porAgenteDia.entries()) {
    const nombreGenesys = nombresGenesys.get(agenteKey) || agenteKey;

    let loginNormalizado = '';
    let nombreHC = '';
    let documento = '';

    const activo = mapaActivos.get(agenteKey);
    if (activo) {
      loginNormalizado = activo.usuarioCic;
      nombreHC = activo.nombre;
      documento = activo.documento;
    } else {
      // Fallback: cruce por nombre contra el HC
      const hc = hcPorNombre.get(agenteKey);
      if (hc) {
        loginNormalizado = hc.usuarioCic;
        nombreHC = hc.nombre;
        documento = hc.documento;
      } else {
        loginNormalizado = normalizarLogin(nombreGenesys);
      }
    }

    // Calcular TMO por día y total ponderado
    const dias: DiaTMO[] = [];
    let totalManejo = 0;
    let totalManejoTotalMs = 0;

    const diasOrdenados = Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dia, acum] of diasOrdenados) {
      if (acum.manejo > 0) {
        const tmoDia = acum.manejoTotal / 1000 / acum.manejo;
        dias.push({ f: dia, t: Math.round(tmoDia * 10) / 10, i: acum.manejo });
        totalManejo += acum.manejo;
        totalManejoTotalMs += acum.manejoTotal;
        if (!fechaMin || dia < fechaMin) fechaMin = dia;
        if (!fechaMax || dia > fechaMax) fechaMax = dia;
      }
    }

    const tmoPromedio = totalManejo > 0 ? totalManejoTotalMs / 1000 / totalManejo : 0;

    asesores.push({
      loginNormalizado,
      nombreGenesys,
      nombreHC,
      documento,
      tmoPromedio: Math.round(tmoPromedio * 10) / 10,
      totalInteracciones: totalManejo,
      diasConDatos: dias.length,
      sobreLimite: tmoPromedio > TMO_LIMITE_SEGUNDOS,
      tmoPorDia: dias,
    });
  }

  asesores.sort((a, b) => a.tmoPromedio - b.tmoPromedio);

  const promedioGeneral =
    asesores.length > 0
      ? Math.round((asesores.reduce((s, a) => s + a.tmoPromedio, 0) / asesores.length) * 10) / 10
      : 0;

  return {
    fechaProcesamiento: new Date().toISOString(),
    archivoNombre: archivo.name,
    totalAsesores: asesores.length,
    promedioGeneral,
    fechaInicio: fechaMin,
    fechaFin: fechaMax,
    asesores,
  };
}

// ============================================================
// v3.0 — Parser TMO Diario (para BD y trend lines)
// ============================================================
// Devuelve registros TMO por asesor por día, listos para guardar en la
// tabla `tmo_asesor_daily`. A diferencia de `parsearTMO` que devuelve
// un snapshot agregado, esta función devuelve TODOS los registros diarios.
// También devuelve el snapshot agregado (DatosTMO) para compatibilidad.

export interface ResultadoTMODaily {
  snapshot: DatosTMO;
  registros: TMOAsesorDaily[];
}

/**
 * Determina el área (digital/telefonico) basándose en el LOB.
 * v3.3.0: El área operativa es solo 'digital'. Para mantener
 * compatibilidad con datos históricos TMO y tests, la función sigue
 * retornando un string ('digital' | 'telefonico' | '') — no usa el
 * tipo `Area` de la app.
 */
export function areaDeLob(lob: string): 'digital' | 'telefonico' | '' {
  const l = normalizarTexto(lob);
  if (!l) return '';
  // Si contiene "whatsapp" o "wa" → digital
  if (l.includes('whatsapp') || l.includes('wa') || l.includes('chat') || l.includes('digital')) {
    return 'digital';
  }
  // Si contiene "voz", "telefono", "fijo info tel", "fijo soporte tel", "movil tel" → telefonico
  if (l.includes('voz') || l.includes('telefono') || l.includes('telefonico') ||
      l.includes('fijo info tel') || l.includes('fijo soporte tel') || l.includes('movil tel') ||
      l.includes('backoffice') || l.includes('llamada')) {
    return 'telefonico';
  }
  // Default: ambos (vacío) — el supervisor cargará el TMO y se aplicará a ambas áreas
  return '';
}

/** Parsea el archivo TMO y devuelve registros diarios por asesor + snapshot agregado */
export async function parsearTMODaily(archivo: File, asesoresHC: AsesorHC[] = []): Promise<ResultadoTMODaily> {
  const wb = await leerWorkbook(archivo);

  // 1. Buscar hoja "Activos1" para mapeo Nombre Genesys → usuarioCic
  const mapaActivos = new Map<string, { usuarioCic: string; nombre: string; documento: string }>();
  for (const nombreHoja of wb.SheetNames) {
    if (!normalizarTexto(nombreHoja).replace(/\s/g, '').includes('activos')) continue;
    const ws = wb.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, blankrows: false });
    for (const fila of filas) {
      const row = filaNormalizada(fila);
      const nombreAgente = valor(row, 'nombre del agente', 'nombre agente', 'nombre', 'agente', 'nombre genesys');
      const usuarioCic = normalizarLogin(valor(row, 'usuario cic', 'usuariocic', 'usuario', 'login'));
      if (nombreAgente && usuarioCic) {
        mapaActivos.set(normalizarTexto(nombreAgente), {
          usuarioCic,
          nombre: valor(row, 'nombre', 'nombre completo', 'nombre asesor') || nombreAgente,
          documento: valor(row, 'documento sp', 'documento', 'doc'),
        });
      }
    }
  }

  // 2. Buscar hoja "BD NEW"
  let hojaBD: XLSX.WorkSheet | null = null;
  for (const nombreHoja of wb.SheetNames) {
    if (normalizarTexto(nombreHoja).replace(/[\s_-]/g, '').includes('bdnew')) {
      hojaBD = wb.Sheets[nombreHoja];
      break;
    }
  }
  if (!hojaBD) {
    for (const nombreHoja of wb.SheetNames) {
      if (!normalizarTexto(nombreHoja).replace(/\s/g, '').includes('activos')) {
        hojaBD = wb.Sheets[nombreHoja];
        break;
      }
    }
  }
  if (!hojaBD) throw new Error('No se encontró la hoja "BD NEW" en el archivo TMO.');

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hojaBD, { defval: '', raw: false, blankrows: false });

  // 3. Acumular por (agente, día)
  interface AcumDia {
    documento: string;
    nombreAsesor: string;
    loginNormalizado: string;
    lob: string;
    supervisor: string;
    manejo: number;
    manejoTotal: number;
    semana: string;
    mes: string;
    meta: number;
  }
  const porAgenteDia = new Map<string, Map<string, AcumDia>>(); // agenteKey → día → acum

  // Mapa HC por nombre y por documento
  const hcPorNombre = new Map<string, AsesorHC>();
  const hcPorDocumento = new Map<string, AsesorHC>();
  for (const a of asesoresHC) {
    hcPorNombre.set(normalizarTexto(a.nombre), a);
    if (a.usuarioGen) hcPorNombre.set(normalizarTexto(a.usuarioGen), a);
    if (a.documento) hcPorDocumento.set(a.documento, a);
  }

  const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  for (const fila of filas) {
    const row = filaNormalizada(fila);
    const nombreAgente = valor(row, 'nombre del agente', 'nombre agente', 'agente', 'nombre');
    if (!nombreAgente) continue;

    const fechaCelda = row['inicio del intervalo'] ?? row['inicio intervalo'] ?? row['fecha'];
    const fecha = celdaAFecha(fechaCelda);
    if (!fecha) continue;
    const dia = fechaADia(fecha);
    const mes = MESES_ES[fecha.getMonth()] || '';

    const manejo = Math.round(valorNumerico(row, 'manejo', 'interacciones', 'handle'));
    const manejoTotalMs = valorNumerico(row, 'manejo total', 'manejo_total', 'tiempo total', 'tiempo manejo total');
    const lob = valor(row, 'lob', 'linea de negocio', 'skill');
    const supervisor = valor(row, 'supervisor', 'sup');
    const semana = valor(row, 'semana', 'sem');
    const meta = valorNumerico(row, 'meta', 'objetivo');
    const documentoCsv = valor(row, 'documento', 'doc', 'cedula');

    const agenteKey = normalizarTexto(nombreAgente);
    if (!porAgenteDia.has(agenteKey)) porAgenteDia.set(agenteKey, new Map());
    const porDia = porAgenteDia.get(agenteKey)!;

    const existente = porDia.get(dia);
    if (existente) {
      existente.manejo += manejo;
      existente.manejoTotal += manejoTotalMs;
    } else {
      // Resolver login y documento desde Activos o HC
      let loginNormalizado = '';
      let documentoFinal = documentoCsv;
      let nombreHC = nombreAgente;
      const activo = mapaActivos.get(agenteKey);
      if (activo) {
        loginNormalizado = activo.usuarioCic;
        nombreHC = activo.nombre;
        documentoFinal = documentoFinal || activo.documento;
      } else {
        const hc = hcPorNombre.get(agenteKey) ?? (documentoFinal ? hcPorDocumento.get(documentoFinal) : undefined);
        if (hc) {
          loginNormalizado = hc.usuarioCic || hc.loginNormalizado;
          nombreHC = hc.nombre;
          documentoFinal = documentoFinal || hc.documento;
        } else {
          loginNormalizado = normalizarLogin(nombreAgente);
        }
      }

      porDia.set(dia, {
        documento: documentoFinal,
        nombreAsesor: nombreHC,
        loginNormalizado,
        lob,
        supervisor,
        manejo,
        manejoTotal: manejoTotalMs,
        semana,
        mes,
        meta,
      });
    }
  }

  // 4. Construir registros diarios (TMOAsesorDaily[]) y snapshot (AsesorTMO[])
  const registros: TMOAsesorDaily[] = [];
  const asesoresSnapshot: AsesorTMO[] = [];
  let fechaMin = '';
  let fechaMax = '';

  for (const [agenteKey, porDia] of porAgenteDia.entries()) {
    const nombreGenesys = agenteKey;
    const primerDia = porDia.values().next().value;
    const nombreAsesor = primerDia?.nombreAsesor || nombreGenesys;
    const loginNormalizado = primerDia?.loginNormalizado || normalizarLogin(nombreGenesys);
    const documento = primerDia?.documento || '';
    const lob = primerDia?.lob || '';
    const supervisor = primerDia?.supervisor || '';
    const meta = primerDia?.meta || 0;
    const area = areaDeLob(lob);

    const dias: DiaTMO[] = [];
    let totalManejo = 0;
    let totalManejoTotalMs = 0;

    const diasOrdenados = Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dia, acum] of diasOrdenados) {
      if (acum.manejo > 0) {
        const tmoDia = acum.manejoTotal / 1000 / acum.manejo;
        const id = `tmo_${documento || loginNormalizado}_${dia}`;
        registros.push({
          id,
          documento,
          nombreAsesor,
          loginNormalizado,
          lob,
          supervisor,
          fecha: dia,
          semana: acum.semana,
          mes: acum.mes,
          interacciones: acum.manejo,
          manejoTotal: acum.manejoTotal / 1000, // guardar en segundos
          tmo: Math.round(tmoDia * 10) / 10,
          meta,
          area,
        });
        dias.push({ f: dia, t: Math.round(tmoDia * 10) / 10, i: acum.manejo });
        totalManejo += acum.manejo;
        totalManejoTotalMs += acum.manejoTotal;
        if (!fechaMin || dia < fechaMin) fechaMin = dia;
        if (!fechaMax || dia > fechaMax) fechaMax = dia;
      }
    }

    const tmoPromedio = totalManejo > 0 ? totalManejoTotalMs / 1000 / totalManejo : 0;
    asesoresSnapshot.push({
      loginNormalizado,
      nombreGenesys,
      nombreHC: nombreAsesor,
      documento,
      tmoPromedio: Math.round(tmoPromedio * 10) / 10,
      totalInteracciones: totalManejo,
      diasConDatos: dias.length,
      sobreLimite: tmoPromedio > TMO_LIMITE_SEGUNDOS,
      tmoPorDia: dias,
    });
  }

  asesoresSnapshot.sort((a, b) => a.tmoPromedio - b.tmoPromedio);
  const promedioGeneral =
    asesoresSnapshot.length > 0
      ? Math.round((asesoresSnapshot.reduce((s, a) => s + a.tmoPromedio, 0) / asesoresSnapshot.length) * 10) / 10
      : 0;

  const snapshot: DatosTMO = {
    fechaProcesamiento: new Date().toISOString(),
    archivoNombre: archivo.name,
    totalAsesores: asesoresSnapshot.length,
    promedioGeneral,
    fechaInicio: fechaMin,
    fechaFin: fechaMax,
    asesores: asesoresSnapshot,
  };

  return { snapshot, registros };
}

// ============================================================
// v3.2.0 — Parser de Adherencia (Adherencia Noviembre.xlsx)
// ============================================================

/** Convierte un tiempo "H:MM:SS" a segundos */
function tiempoASegundos(tiempo: string | number | null | undefined): number {
  if (tiempo === null || tiempo === undefined || tiempo === '*' || tiempo === '') return 0;
  if (typeof tiempo === 'number') return Math.round(tiempo);
  const s = String(tiempo).trim();
  if (s === '*' || s === '-') return 0;
  const partes = s.split(':');
  if (partes.length === 3) {
    return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
  }
  if (partes.length === 2) {
    return parseInt(partes[0]) * 60 + parseInt(partes[1]);
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

/** Convierte un tiempo "H:MM:SS" a horas decimales */
function tiempoAHoras(tiempo: string | number | null | undefined): number {
  return tiempoASegundos(tiempo) / 3600;
}

/** Normaliza una fecha "2026/11/1" → "2026-11-01" */
function normalizarFecha(fecha: string | number | null | undefined): string {
  if (!fecha) return '';
  const s = String(fecha).trim();
  // Formato YYYY/MM/DD
  const match = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  // Formato YYYY-MM-DD
  const match2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match2) {
    return `${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`;
  }
  // Intentar parsear como Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

export async function parsearAdherencia(archivo: File): Promise<DatosAdherencia> {
  const wb = await leerWorkbook(archivo);

  // Buscar hoja PROGRAMACION
  let hoja: XLSX.WorkSheet | null = null;
  for (const nombreHoja of wb.SheetNames) {
    if (normalizarTexto(nombreHoja).includes('programac')) {
      hoja = wb.Sheets[nombreHoja];
      break;
    }
  }
  if (!hoja) {
    // Fallback: primera hoja
    hoja = wb.Sheets[wb.SheetNames[0]];
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: '',
    raw: false,
    blankrows: false,
  });

  const metricas: MetricaAdherencia[] = [];
  let fechaMin = '';
  let fechaMax = '';

  for (const fila of filas) {
    const row = filaNormalizada(fila);

    const documento = valor(row, 'id');
    const nombre = valor(row, 'namefull', 'nombre completo', 'nombre');
    const fecha = normalizarFecha(valor(row, 'date'));
    const concept = valor(row, 'concept');

    // Saltar filas sin documento o sin fecha
    if (!documento || !fecha) continue;

    const lob = valor(row, 'lob');
    // v3.3.0: Solo se procesan los 4 LOBs permitidos en Adherencia.
    if (!esLobPermitido(lob)) continue;
    const supervisor = valor(row, 'supervisor');
    const semana = valor(row, 'semana');

    // Solo procesar PROGRAMACION (no DESCANSO ni NO PROGRAMADO)
    if (concept && !normalizarTexto(concept).includes('programac')) continue;

    // Métricas desde columnas
    const manejo = valorNumerico(row, 'manejo');
    const manejoTotal = tiempoASegundos(valor(row, 'manejo total'));
    const horasFact = tiempoAHoras(valor(row, 'horas fact', 'horas fact.'));
    const horasUtl = tiempoAHoras(valor(row, 'horas utl'));
    const interactuando = tiempoASegundos(valor(row, 'interactuando'));
    const inactivo = tiempoASegundos(valor(row, 'inactivo'));
    const programTime = tiempoASegundos(valor(row, 'program time', 'program.'));
    const tiempoDepurado = tiempoASegundos(valor(row, 'tiempo depurado'));

    // Excesos
    const excesoBreak = tiempoASegundos(valor(row, 'exceso break'));
    const excesoBano = tiempoASegundos(valor(row, 'exceso bano', 'exceso baño'));
    const excesoCapa = tiempoASegundos(valor(row, 'exceso capa'));

    // Asistencia
    const asistencia = valor(row, 'asistencia');
    const llegada = valor(row, 'llegada');
    const ausente = valorNumerico(row, 'ausente') === 1;
    const tipoFacturable = valor(row, 'tipo facturable');

    // Calcular métricas derivadas
    const tmo = manejo > 0 ? Math.round(manejoTotal / manejo) : 0;
    const pph = horasFact > 0 ? manejo / horasFact : 0;
    const occ = horasUtl > 0 ? (interactuando / horasUtl) * 100 : 0;
    const adh = programTime > 0 ? (horasFact * 3600 / programTime) * 100 : 0;
    const utl = tiempoDepurado > 0 ? (horasUtl * 3600 / tiempoDepurado) * 100 : 0;
    // %ABS se calcula a nivel agregado, por ahora lo dejamos en 0
    const abs = 0;

    if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
    if (!fechaMax || fecha > fechaMax) fechaMax = fecha;

    metricas.push({
      documento: String(documento),
      nombre,
      loginNormalizado: String(documento).trim(),
      lob,
      supervisor,
      fecha,
      semana,
      interacciones: manejo,
      tmo,
      pph: Math.round(pph * 10) / 10,
      occ: Math.round(occ * 100) / 100,
      adh: Math.round(adh * 100) / 100,
      utl: Math.round(utl * 100) / 100,
      abs,
      excesoBreak,
      excesoBano,
      excesoCapa,
      horasFact: Math.round(horasFact * 100) / 100,
      horasUtl: Math.round(horasUtl * 100) / 100,
      interactuando,
      inactivo,
      asistencia,
      llegada,
      ausente,
      tipoFacturable,
    });
  }

  return {
    fechaProcesamiento: new Date().toISOString(),
    archivoNombre: archivo.name,
    totalRegistros: metricas.length,
    fechaInicio: fechaMin,
    fechaFin: fechaMax,
    metricas,
  };
}

// ============================================================
// v3.4.0 — Parser de Horas Robot (Horas robot.xlsx · hoja "Horas Genesys")
// ============================================================

/** Convierte una fecha Excel (Date o string) a YYYY-MM-DD */
function fechaExcelAFecha(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  // Ya viene YYYY-MM-DD
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
  // YYYY/MM/DD
  const m2 = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  // Intentar Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s;
}

/** Convierte un datetime Excel (Date o string) a ISO string (o null) */
function datetimeExcelAISO(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

/** Convierte un valor timedelta/HH:MM:SS a segundos */
function tiempoExcelASegundos(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  // Date (probablemente 1899-12-30 + timedelta)
  if (v instanceof Date) {
    // El timedelta se representa como fecha base 1899-12-30 + segundos.
    // Calculamos los segundos transcurridos desde medianoche.
    const h = v.getHours();
    const m = v.getMinutes();
    const s = v.getSeconds();
    // Si la fecha es 1899-12-30 (base de Excel para timedeltas), los
    // segundos son simplemente h*3600+m*60+s.
    if (v.getFullYear() < 1900) {
      return h * 3600 + m * 60 + s;
    }
    // Si es una fecha real, también tomamos h:m:s
    return h * 3600 + m * 60 + s;
  }
  if (typeof v === 'number') {
    // Número fraccionario de días
    const abs = Math.abs(v);
    const dias = Math.floor(abs);
    const frac = abs - dias;
    const seg = Math.round(frac * 24 * 3600);
    // Si hay días enteros, sumamos (es probablemente un timedelta largo)
    return dias * 24 * 3600 + seg;
  }
  const s = String(v).trim();
  if (!s || s === '*' || s === '-') return 0;
  const partes = s.split(':');
  if (partes.length === 3) {
    return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
  }
  if (partes.length === 2) {
    return parseInt(partes[0]) * 60 + parseInt(partes[1]);
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

export async function parsearHorasRobot(archivo: File): Promise<DatosHorasRobot> {
  const wb = await leerWorkbook(archivo);

  // Buscar hoja "Horas Genesys" (puede tener variantes)
  let hoja: XLSX.WorkSheet | null = null;
  for (const nombreHoja of wb.SheetNames) {
    const norm = normalizarTexto(nombreHoja);
    if (norm.includes('horas genesys') || norm.includes('genesys')) {
      hoja = wb.Sheets[nombreHoja];
      break;
    }
  }
  if (!hoja) {
    // Fallback: intentar con la hoja que tenga DOCUMENTO como columna
    for (const nombreHoja of wb.SheetNames) {
      const ws = wb.Sheets[nombreHoja];
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
        raw: false,
        blankrows: false,
      });
      if (filas.length > 0) {
        const row = filaNormalizada(filas[0]);
        if (valor(row, 'documento')) {
          hoja = ws;
          break;
        }
      }
    }
  }
  if (!hoja) {
    // Último recurso: primera hoja
    hoja = wb.Sheets[wb.SheetNames[0]];
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: '',
    raw: false,
    blankrows: false,
  });

  const registros: RegistroHorasRobot[] = [];
  let fechaMin = '';
  let fechaMax = '';

  for (const fila of filas) {
    const row = filaNormalizada(fila);

    const documentoRaw = valor(row, 'documento', 'cc', 'cedula', 'identificacion');
    const documento = String(documentoRaw || '').trim();
    if (!documento) continue;

    const nombre = valor(row, 'nombre del agente', 'nombre', 'nombre del agente ');
    const usuarioCic = valor(row, 'usuario cic');
    const fecha = fechaExcelAFecha(row['fecha'] ?? row['date']);
    if (!fecha) continue;

    const lob = valor(row, 'lob', 'lob ');
    const supervisor = valor(row, 'supervisor');
    const tipoCalculo = valor(row, 'tipo de calculo', 'tipo calculo');

    const programTime = tiempoExcelASegundos(
      row['program time'] ?? row['program.'] ?? row['program'] ?? row['program_time']
    );
    const horasAPagar = tiempoExcelASegundos(
      row['horas a pagar'] ?? row['horasapagar'] ?? row['horas a pagar valido']
    );
    const horasFact = tiempoExcelASegundos(
      row['horas fact'] ?? row['horasfact']
    );
    const entradaReal = datetimeExcelAISO(row['entrada real'] ?? row['entrada_real']);
    const salidaReal = datetimeExcelAISO(row['salida real'] ?? row['salida_real']);
    const tiempoConexion = tiempoExcelASegundos(
      row['t conexion total'] ?? row['tiempoconexiontotal'] ?? row['tiempo conexion total']
    );

    const faltante = Math.max(0, programTime - horasAPagar);
    const exceso = Math.max(0, horasAPagar - programTime);

    if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
    if (!fechaMax || fecha > fechaMax) fechaMax = fecha;

    registros.push({
      documento,
      nombre: nombre.trim(),
      usuarioCic,
      fecha,
      lob,
      supervisor,
      tipoCalculo,
      programTime,
      horasAPagar,
      horasFact,
      entradaReal,
      salidaReal,
      tiempoConexion,
      faltante,
      exceso,
    });
  }

  // Ordenar por fecha desc, luego nombre asc
  registros.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.nombre.localeCompare(b.nombre);
  });

  return {
    fechaProcesamiento: new Date().toISOString(),
    archivoNombre: archivo.name,
    totalRegistros: registros.length,
    fechaInicio: fechaMin,
    fechaFin: fechaMax,
    registros,
  };
}

// ============================================================
// v3.4.0 — Parser de Bitácora de Deslogueos Autorizados
// (Bitacora Deslogueos Autorizados · hoja "Deslogueos Autorizados")
// ============================================================

/** Convierte un valor de hora (Date/string/number) a "HH:MM" */
function horaExcelAHHMM(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) {
    const h = v.getHours();
    const m = v.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (!s) return '';
  // Ya es HH:MM o HH:MM:SS
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  // Número fraccionario (día Excel)
  const n = Number(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    const totalSec = Math.round(n * 24 * 3600);
    const h = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  return s;
}

export async function parsearBitacora(archivo: File): Promise<DatosBitacora> {
  const wb = await leerWorkbook(archivo);

  // Buscar hoja "Deslogueos Autorizados"
  let hoja: XLSX.WorkSheet | null = null;
  for (const nombreHoja of wb.SheetNames) {
    const norm = normalizarTexto(nombreHoja);
    if (norm.includes('deslogueos autorizados') || norm.includes('deslogueo')) {
      hoja = wb.Sheets[nombreHoja];
      break;
    }
  }
  if (!hoja) {
    // Fallback: buscar hoja con columna CC
    for (const nombreHoja of wb.SheetNames) {
      const ws = wb.Sheets[nombreHoja];
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
        raw: false,
        blankrows: false,
      });
      if (filas.length > 0) {
        const row = filaNormalizada(filas[0]);
        if (valor(row, 'cc', 'documento', 'cedula')) {
          hoja = ws;
          break;
        }
      }
    }
  }
  if (!hoja) {
    hoja = wb.Sheets[wb.SheetNames[0]];
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: '',
    raw: false,
    blankrows: false,
  });

  const deslogueos: DeslogueoAutorizado[] = [];

  for (const fila of filas) {
    const row = filaNormalizada(fila);

    const documentoRaw = valor(row, 'cc', 'documento', 'cedula');
    const documento = String(documentoRaw || '').trim();
    if (!documento) continue;

    const fecha = fechaExcelAFecha(row['fecha'] ?? row['date']);
    if (!fecha) continue;

    const dia = Number(valor(row, 'dia', 'día')) || 0;
    const mes = Number(valor(row, 'mes')) || 0;
    const skill = valor(row, 'skill');
    const nombre = valor(row, 'nombre', 'nombre del agente');
    const supervisor = valor(row, 'supervisor');

    const horaIngreso = horaExcelAHHMM(row['hora de ingreso'] ?? row['hora ingreso']);
    const horaDeslogueo = horaExcelAHHMM(row['hora de deslogueo'] ?? row['hora deslogueo']);
    const horaSalida = horaExcelAHHMM(row['hora salida'] ?? row['hora salida2']);
    const diferencia = horaExcelAHHMM(row['diferencia'] ?? row['diferencia ']);
    const ahorro = horaExcelAHHMM(row['ahorro'] ?? row['ahorro ']);
    const novedad = valor(row, 'novedad') || null;
    const tipoContrato = valor(row, 'tipo de contrato', 'tipo contrato');

    deslogueos.push({
      fecha,
      dia,
      mes,
      skill,
      documento,
      nombre,
      supervisor,
      horaIngreso,
      horaDeslogueo,
      horaSalida,
      diferencia,
      ahorro,
      novedad,
      tipoContrato,
    });
  }

  // Ordenar por fecha desc, luego nombre asc
  deslogueos.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return a.nombre.localeCompare(b.nombre);
  });

  return {
    fechaProcesamiento: new Date().toISOString(),
    archivoNombre: archivo.name,
    totalRegistros: deslogueos.length,
    deslogueos,
  };
}
