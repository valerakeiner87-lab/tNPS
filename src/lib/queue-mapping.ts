// ============================================================
// tNPS Digital Claro Guatemala — Mapeo de colas/LOBs → líneas
// Archivo: src/lib/queue-mapping.ts
// ============================================================
import type { Linea } from './types';

/**
 * Normaliza texto para comparación: minúsculas, sin tildes,
 * sin espacios múltiples.
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza el login del asesor para que el mismo agente se reconozca
 * igual venga del HC, de Qualtrics o de Genesys:
 * - Quita prefijos de dominio tipo "CLAROGT\\usuario" (backslash)
 * - Quita prefijos tipo "CLAROGT_usuario" (guion bajo, export Qualtrics 2024+)
 * - Quita sufijos de correo (@...)
 * - Quita espacios y pasa a minúsculas
 *
 * Ejemplos:
 *   "CLAROGT\\GLENDAJ.DUARTE"   → "glendaj.duarte"
 *   "CLAROGT_GLENDAJ.DUARTE"    → "glendaj.duarte"
 *   "glendaj.duarte@claro.com"  → "glendaj.duarte"
 *   "  Gduarte "                → "gduarte"
 */
export function normalizarLogin(usuario: string): string {
  if (!usuario) return '';
  let login = usuario.toString().trim().toLowerCase();
  // 1. Quitar dominio tipo "clarogt\usuario" o "dominio\usuario"
  const idxBackslash = login.indexOf('\\');
  if (idxBackslash >= 0) login = login.slice(idxBackslash + 1);
  // 2. Quitar prefijo "clarogt_" (export Qualtrics nuevo formato)
  //    Solo si aparece al inicio; respeta logins legítimos con guion bajo.
  const PREFIJOS_DOMINIO = ['clarogt_', 'clarogt.', 'claro_gt_', 'claro_'];
  for (const p of PREFIJOS_DOMINIO) {
    if (login.startsWith(p)) {
      login = login.slice(p.length);
      break;
    }
  }
  // 3. Quitar correo
  const idxArroba = login.indexOf('@');
  if (idxArroba >= 0) login = login.slice(0, idxArroba);
  return login.trim();
}

/**
 * Determina la línea de negocio (Linea) a partir de la COLA de Genesys
 * o SERVICIO_INICIAL (Telefónico).
 * Ejemplos:
 *  - GT_WA_Hogar_Soporte      → Fijo Soporte
 *  - GT_WA_Fijo_Informacion   → Fijo Información
 *  - GT_WA_Movil_Soporte      → Móvil
 *  - Soporte Técnico          → Fijo Soporte
 *  - Información General      → Fijo Información
 */
export function lineaDeCola(cola: string): Linea {
  const c = normalizarTexto(cola);
  if (!c) return 'Fijo Soporte';

  const esMovil = /movil|mov\b|celular|prepago|pospago|telefonia/.test(c);
  const esInformacion = /informacion|info\b|ventas|comercial|facturacion|factura|pago[s]?\b/.test(c);
  const esSoporte = /soporte|tecnica|tecnico|hogar|falla|averia|reclamo|servicio tec/.test(c);

  if (esMovil) return 'Móvil';
  // Si la cola menciona "información" Y no menciona "soporte", es Fijo Información
  if (esInformacion && !esSoporte) return 'Fijo Información';
  // Si menciona "soporte", es Fijo Soporte
  if (esSoporte) return 'Fijo Soporte';
  // Default: Fijo Soporte (la mayoría de colas no informativas son soporte)
  return 'Fijo Soporte';
}

/**
 * Determina la línea de negocio a partir del LOB del HC.
 * Ejemplos:
 *  - WHATSAPP FIJO SOPORTE     → Fijo Soporte
 *  - WHATSAPP FIJO INFORMACION → Fijo Información
 *  - WHATSAPP MOVIL            → Móvil
 *  - TELEFONIA MOVIL           → Móvil
 */
export function lineaDeLob(lob: string): Linea | null {
  const l = normalizarTexto(lob);
  if (!l) return null;

  const esMovil = /movil|mov\b|celular|prepago|pospago|telefonia/.test(l);
  const esInformacion = /informacion|info\b|ventas|comercial|facturacion|factura|pago[s]?\b/.test(l);
  const esSoporte = /soporte|tecnica|tecnico|hogar|fallo|averia|reclamo/.test(l);

  if (esMovil) return 'Móvil';
  if (esInformacion && !esSoporte) return 'Fijo Información';
  if (esSoporte) return 'Fijo Soporte';
  return null;
}

/**
 * Determina la línea a partir del campo UNIDAD (Fijo/Móvil).
 * IMPORTANTE: la unidad solo distingue Fijo vs Móvil. Para distinguir
 * Soporte vs Información, se necesita la cola o el servicio. Por eso
 * esta función solo devuelve 'Móvil' o 'Fijo Soporte' (default de Fijo).
 * El caller debe combinarla con lineaDeCola/lineaDeLob para el detalle.
 */
export function lineaDeUnidad(unidad: string): Linea | null {
  const u = normalizarTexto(unidad);
  if (!u) return null;
  if (/movil|mov\b/.test(u)) return 'Móvil';
  if (/fijo|hogar|fibra/.test(u)) return 'Fijo Soporte';
  return null;
}

/**
 * Determina la línea combinando UNIDAD + COLA/SERVICIO.
 * Prioridad:
 *  1. Si la cola/servicio indica explícitamente "información" → Fijo Información
 *  2. Si la unidad o cola indica "móvil" → Móvil
 *  3. Si la cola/servicio indica "soporte" → Fijo Soporte
 *  4. Fallback a lineaDeUnidad(unidad) ?? lineaDeCola(cola)
 *
 * Nota: "información" tiene prioridad sobre "hogar" porque en Digital
 * la cola GT_WA_Hogar_información es de información (no de soporte).
 */
export function lineaDeUnidadYCola(unidad: string, colaOservicio: string): Linea {
  const c = normalizarTexto(colaOservicio);
  const esInformacionExplicita = /informacion|info\b|ventas|comercial|facturacion|factura|pago[s]?\b/.test(c);
  const esSoporte = /soporte|tecnica|tecnico|falla|averia|reclamo/.test(c);
  const esMovilCola = /movil|mov\b|celular|prepago|pospago|telefonia/.test(c);
  const esMovilUnidad = /movil|mov\b/.test(normalizarTexto(unidad));

  // 1. Información explícita tiene prioridad máxima (sobre hogar, sobre soporte)
  if (esInformacionExplicita) return 'Fijo Información';
  // 2. Móvil
  if (esMovilCola || esMovilUnidad) return 'Móvil';
  // 3. Soporte (sin mención de información)
  if (esSoporte) return 'Fijo Soporte';
  // 4. Fallback por unidad
  const porUnidad = lineaDeUnidad(unidad);
  if (porUnidad) return porUnidad;
  return lineaDeCola(colaOservicio);
}

