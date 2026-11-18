// ============================================================
// v3.1.5 — Server-side in-memory cache to reduce Neon quota usage
// ============================================================
// Cada query a Neon consume compute hours. Con 7 BDs free tier,
// cada query cuenta. Este caché en memoria del servidor:
//
//  - Mantiene resultados de reads frecuentes por N segundos.
//  - Se invalida automáticamente cuando se hace un write.
//  - Es por-proceso (no compartido entre instancias), pero en
//    HF Spaces solo hay 1 instancia así que está bien.
//
// Uso típico:
//   const result = await cachedRead('encuestas:area:digital', 30, () =>
//     db.encuesta.findMany({ where: { area: 'digital' }, take: 5000 })
//   );
//   // Invalida cuando se guardan nuevas encuestas:
//   invalidatePattern('encuestas:');
//
// Las keys se versionan por área automáticamente.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Estadísticas para el panel
let hits = 0;
let misses = 0;
let sets = 0;
let invalidations = 0;

/**
 * Lee del caché si existe y no expiró. Si no, ejecuta fn(), guarda el resultado y lo devuelve.
 * ttl = tiempo de vida en segundos.
 */
export async function cachedRead<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    hits++;
    return entry.value;
  }
  misses++;
  const value = await fn();
  cache.set(key, { value, expiresAt: now + ttlSec * 1000, createdAt: now });
  sets++;
  // Limpieza perezosa: si el caché crece mucho, eliminar entradas expiradas
  if (cache.size > 200) {
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }
  return value;
}

/**
 * Invalida una key específica.
 */
export function invalidate(key: string): void {
  if (cache.delete(key)) {
    invalidations++;
  }
}

/**
 * Invalida todas las keys que empiezan con el prefijo dado.
 * Ejemplo: invalidatePattern('encuestas:') borra todas las keys de encuestas.
 */
export function invalidatePattern(prefix: string): void {
  let count = 0;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
      count++;
    }
  }
  if (count > 0) invalidations += count;
}

/**
 * Invalida todo el caché.
 */
export function invalidateAll(): void {
  const n = cache.size;
  cache.clear();
  invalidations += n;
}

/**
 * Estadísticas para el panel de supervisor.
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  hitRate: number;
} {
  const total = hits + misses;
  return {
    size: cache.size,
    hits,
    misses,
    sets,
    invalidations,
    hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
  };
}

/**
 * Lista todas las keys en el caché (para depuración).
 */
export function getCacheKeys(): string[] {
  return Array.from(cache.keys());
}
