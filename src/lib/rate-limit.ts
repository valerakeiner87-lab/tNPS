// ============================================================
// v3.0.5 — Rate Limiting para Server Actions
// ============================================================
// Implementación simple en memoria (no requiere Redis).
// Para 250 usuarios en un solo proceso Node.js es suficiente.
// Cada action key tiene un bucket con timestamps de los últimos intentos.

interface RateLimitBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitBucket>();

interface RateLimitConfig {
  /** Máximo número de intentos en la ventana */
  max: number;
  /** Ventana de tiempo en milisegundos */
  windowMs: number;
  /** Mensaje de error personalizado */
  message?: string;
}

/** Configuraciones de rate limit por tipo de acción */
const CONFIGS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowMs: 60 * 1000, message: 'Demasiados intentos de login. Espera 1 minuto.' },
  upload: { max: 3, windowMs: 60 * 1000, message: 'Demasiadas cargas de archivos. Espera 1 minuto.' },
  canje: { max: 5, windowMs: 60 * 60 * 1000, message: 'Demasiados canjes solicitados. Espera 1 hora.' },
  formulario: { max: 10, windowMs: 60 * 1000, message: 'Demasiados envíos de formulario. Espera 1 minuto.' },
  juego: { max: 20, windowMs: 60 * 1000, message: 'Demasiadas partidas guardadas. Espera 1 minuto.' },
  default: { max: 30, windowMs: 60 * 1000, message: 'Demasiadas solicitudes. Espera 1 minuto.' },
};

/**
 * Verifica si una acción está dentro del rate limit.
 * @param action Tipo de acción (login, upload, canje, etc.)
 * @param key Identificador único (IP + username, o IP sola)
 * @returns { allowed: boolean, retryAfter?: number, message?: string }
 */
export function checkRateLimit(
  action: string,
  key: string
): { allowed: boolean; retryAfter?: number; message?: string } {
  const config = CONFIGS[action] || CONFIGS.default;
  const bucketKey = `${action}:${key}`;
  const now = Date.now();

  // Limpiar timestamps viejos
  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(bucketKey, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter(ts => now - ts < config.windowMs);

  // Verificar si excede el límite
  if (bucket.timestamps.length >= config.max) {
    const oldest = bucket.timestamps[0];
    const retryAfter = Math.ceil((config.windowMs - (now - oldest)) / 1000);
    return {
      allowed: false,
      retryAfter,
      message: config.message || 'Rate limit excedido.',
    };
  }

  // Registrar el intento
  bucket.timestamps.push(now);
  return { allowed: true };
}

/**
 * Obtiene la IP del cliente desde los headers de Next.js
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Limpia los buckets expirados (para evitar memory leaks).
 * Llamar periódicamente.
 */
export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    // Si no hay timestamps o todos son viejos, eliminar el bucket
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < 5 * 60 * 1000); // 5 min max
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

// Limpiar cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitBuckets, 5 * 60 * 1000);
}
