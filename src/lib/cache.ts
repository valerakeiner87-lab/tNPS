// ============================================================
// tNPS Digital Claro Guatemala — Caché local (Dexie / IndexedDB)
// Archivo: src/lib/cache.ts
// Estrategia Cache-First + Delta Sync para reducir lecturas de
// Firestore (crítico en el plan gratuito de Firebase).
//
// v4: ahora también cachea TODO el módulo ATC (wallets,
// transacciones, premios, canjes, apelaciones, notificaciones,
// config) + el perfil del asesor autenticado, de modo que al
// recargar (F5) NO se relee la base de datos salvo datos nuevos.
// v5: normalización de documentos ATC legacy (wallets/apelaciones/
// notificaciones/canjes escritos por versiones anteriores). El bump
// de versión limpia el caché local corrupto y fuerza una re-sync.
// ============================================================
import Dexie, { type Table } from 'dexie';
import type { AsesorHC, DatosTMO, Encuesta } from './types';
import type {
  ApelacionATC,
  CanjeATC,
  ConfigATC,
  NotificacionATC,
  PremioATC,
  TransaccionATC,
  WalletATC,
} from './atc-types';

/** Versión del schema. Si cambia, el caché se invalida automáticamente. */
const CACHE_VERSION = 8;

class TNPSDatabase extends Dexie {
  encuestas!: Table<Encuesta, string>;
  asesoresHC!: Table<AsesorHC, string>;
  tmo!: Table<DatosTMO & { id: string }, string>;
  atcWallets!: Table<WalletATC, string>;
  atcTransacciones!: Table<TransaccionATC, string>;
  atcPremios!: Table<PremioATC, string>;
  atcCanjes!: Table<CanjeATC, string>;
  atcApelaciones!: Table<ApelacionATC, string>;
  atcNotificaciones!: Table<NotificacionATC, string>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('tnps-cache');
    this.version(CACHE_VERSION).stores({
      encuestas: 'id, savedAtTs, loginNormalizado, grupo, linea, fechaDia',
      asesoresHC: 'documento, savedAtTs, loginNormalizado, supervisor',
      tmo: 'id, savedAtTs',
      atcWallets: 'loginNormalizado, actualizado',
      atcTransacciones: 'id, loginNormalizado, fecha, creado, encuestaId',
      atcPremios: 'id, actualizado',
      atcCanjes: 'id, loginNormalizado, solicitado, actualizado',
      atcApelaciones: 'id, loginNormalizado, creado, actualizado',
      atcNotificaciones: 'id, paraLogin, paraAdmin, creado',
      kv: 'key',
    });
  }
}

let db: TNPSDatabase | null = null;

function getDB(): TNPSDatabase | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  if (!db) db = new TNPSDatabase();
  return db;
}

/** Verifica si IndexedDB está disponible en el navegador */
export function isCacheAvailable(): boolean {
  return getDB() !== null;
}

// Single-flight: la verificación de versión se ejecuta UNA sola vez
// por carga de página y todas las llamadas esperan la MISMA promesa.
// Sin esto, la primera verificación (BD nueva → borra todo) puede
// correr EN CARRERA con el guardado del perfil del asesor durante
// el primer login y borrarlo justo después de escribirlo.
let verificacionUnica: Promise<void> | null = null;

async function verificarVersionUnaVez(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    const registro = await database.kv.get('schema_version');
    const versionGuardada = (registro?.value as number) ?? 0;
    if (versionGuardada !== CACHE_VERSION) {
      await Promise.all([
        database.encuestas.clear(),
        database.asesoresHC.clear(),
        database.tmo.clear(),
        database.atcWallets.clear(),
        database.atcTransacciones.clear(),
        database.atcPremios.clear(),
        database.atcCanjes.clear(),
        database.atcApelaciones.clear(),
        database.atcNotificaciones.clear(),
        database.kv.clear(),
      ]);
      await database.kv.put({ key: 'schema_version', value: CACHE_VERSION });
    }
  } catch {
    // Silencioso: si falla, la app funciona igual contra Firestore
  }
}

/** Invalida el caché si cambió la versión del schema (una sola vez
 *  por sesión; las llamadas posteriores esperan la misma promesa). */
export function cacheVerificarVersion(): Promise<void> {
  if (!verificacionUnica) {
    verificacionUnica = verificarVersionUnaVez();
  }
  return verificacionUnica;
}

// ------------------------------------------------------------
// Metadata timestamp
// ------------------------------------------------------------

export async function cacheLeerMetadataTimestamp(): Promise<number> {
  const database = getDB();
  if (!database) return 0;
  try {
    const r = await database.kv.get('metadata_ts');
    return (r?.value as number) ?? 0;
  } catch {
    return 0;
  }
}

export async function cacheGuardarMetadataTimestamp(ts: number): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'metadata_ts', value: ts });
  } catch {
    /* noop */
  }
}

/** Flag: este navegador ya hizo la descarga completa inicial */
export async function cacheLeerFullSyncFlag(): Promise<boolean> {
  const database = getDB();
  if (!database) return false;
  try {
    const r = await database.kv.get('full_sync_done');
    return (r?.value as boolean) ?? false;
  } catch {
    return false;
  }
}

export async function cacheGuardarFullSyncFlag(valor: boolean): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'full_sync_done', value: valor });
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// Perfil del asesor autenticado (persistente entre recargas)
// ------------------------------------------------------------

export async function cacheLeerPerfilAsesor(): Promise<AsesorHC | null> {
  const database = getDB();
  if (!database) return null;
  try {
    const r = await database.kv.get('perfil_asesor');
    return (r?.value as AsesorHC) ?? null;
  } catch {
    return null;
  }
}

export async function cacheGuardarPerfilAsesor(asesor: AsesorHC | null): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    if (asesor) await database.kv.put({ key: 'perfil_asesor', value: asesor });
    else await database.kv.delete('perfil_asesor');
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// Encuestas
// ------------------------------------------------------------

export async function cacheLeerEncuestas(): Promise<Encuesta[]> {
  const database = getDB();
  if (!database) return [];
  try {
    return await database.encuestas.toArray();
  } catch {
    return [];
  }
}

export async function cacheGuardarEncuestas(encuestas: Encuesta[]): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.encuestas.clear();
    if (encuestas.length > 0) {
      await database.encuestas.bulkPut(encuestas);
    }
  } catch {
    /* noop */
  }
}

/** Merge incremental: agrega o actualiza solo las encuestas recibidas */
export async function cacheMergeEncuestas(encuestas: Encuesta[]): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    if (encuestas.length > 0) {
      await database.encuestas.bulkPut(encuestas);
    }
  } catch {
    /* noop */
  }
}

export async function cacheBorrarEncuestas(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.encuestas.clear();
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// Asesores HC
// ------------------------------------------------------------

export async function cacheLeerAsesoresHC(): Promise<AsesorHC[]> {
  const database = getDB();
  if (!database) return [];
  try {
    return await database.asesoresHC.toArray();
  } catch {
    return [];
  }
}

export async function cacheGuardarAsesoresHC(asesores: AsesorHC[]): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.asesoresHC.clear();
    if (asesores.length > 0) {
      await database.asesoresHC.bulkPut(asesores);
    }
  } catch {
    /* noop */
  }
}

export async function cacheMergeAsesoresHC(asesores: AsesorHC[]): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    if (asesores.length > 0) {
      await database.asesoresHC.bulkPut(asesores);
    }
  } catch {
    /* noop */
  }
}

export async function cacheBorrarAsesoresHC(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.asesoresHC.clear();
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// TMO
// ------------------------------------------------------------

export async function cacheLeerTMO(): Promise<DatosTMO | null> {
  const database = getDB();
  if (!database) return null;
  try {
    const doc = await database.tmo.get('current');
    if (!doc) return null;
    const { id: _id, ...datos } = doc;
    return datos as DatosTMO;
  } catch {
    return null;
  }
}

export async function cacheGuardarTMO(datos: DatosTMO): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.tmo.clear();
    await database.tmo.put({ ...datos, id: 'current' });
  } catch {
    /* noop */
  }
}

export async function cacheBorrarTMO(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.tmo.clear();
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// Timestamps de delta sync (datos principales)
// ------------------------------------------------------------

export async function cacheLeerEncuestasSyncTs(): Promise<number> {
  const database = getDB();
  if (!database) return 0;
  try {
    const r = await database.kv.get('encuestas_sync_ts');
    return (r?.value as number) ?? 0;
  } catch {
    return 0;
  }
}

export async function cacheGuardarEncuestasSyncTs(ts: number): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'encuestas_sync_ts', value: ts });
  } catch {
    /* noop */
  }
}

export async function cacheLeerAsesoresHCSyncTs(): Promise<number> {
  const database = getDB();
  if (!database) return 0;
  try {
    const r = await database.kv.get('asesores_hc_sync_ts');
    return (r?.value as number) ?? 0;
  } catch {
    return 0;
  }
}

export async function cacheGuardarAsesoresHCSyncTs(ts: number): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'asesores_hc_sync_ts', value: ts });
  } catch {
    /* noop */
  }
}

// ============================================================
// MÓDULO ATC — caché completo en el navegador
// ============================================================

export interface SnapshotATC {
  wallets: WalletATC[];
  transacciones: TransaccionATC[];
  premios: PremioATC[];
  canjes: CanjeATC[];
  apelaciones: ApelacionATC[];
  notificaciones: NotificacionATC[];
  config: ConfigATC | null;
}

const SNAPSHOT_VACIO: SnapshotATC = {
  wallets: [],
  transacciones: [],
  premios: [],
  canjes: [],
  apelaciones: [],
  notificaciones: [],
  config: null,
};

/** Lee todo el módulo ATC del caché local (0 lecturas de red) */
export async function cacheLeerATC(): Promise<SnapshotATC> {
  const database = getDB();
  if (!database) return { ...SNAPSHOT_VACIO };
  try {
    const [wallets, transacciones, premios, canjes, apelaciones, notificaciones, configKv] =
      await Promise.all([
        database.atcWallets.toArray(),
        database.atcTransacciones.toArray(),
        database.atcPremios.toArray(),
        database.atcCanjes.toArray(),
        database.atcApelaciones.toArray(),
        database.atcNotificaciones.toArray(),
        database.kv.get('atc_config'),
      ]);
    return {
      wallets,
      transacciones,
      premios,
      canjes,
      apelaciones,
      notificaciones,
      config: (configKv?.value as ConfigATC) ?? null,
    };
  } catch {
    return { ...SNAPSHOT_VACIO };
  }
}

export async function cacheMergeATCWallets(wallets: WalletATC[]): Promise<void> {
  const database = getDB();
  if (!database || wallets.length === 0) return;
  try {
    await database.atcWallets.bulkPut(wallets);
  } catch {
    /* noop */
  }
}

/** Lee solo las wallets ATC del caché (para el motor sin red) */
export async function cacheLeerATCWallets(): Promise<WalletATC[]> {
  const database = getDB();
  if (!database) return [];
  try {
    return await database.atcWallets.toArray();
  } catch {
    return [];
  }
}

export async function cacheMergeATCTransacciones(transacciones: TransaccionATC[]): Promise<void> {
  const database = getDB();
  if (!database || transacciones.length === 0) return;
  try {
    await database.atcTransacciones.bulkPut(transacciones);
  } catch {
    /* noop */
  }
}

export async function cacheMergeATCPremios(premios: PremioATC[]): Promise<void> {
  const database = getDB();
  if (!database || premios.length === 0) return;
  try {
    await database.atcPremios.bulkPut(premios);
  } catch {
    /* noop */
  }
}

export async function cacheMergeATCCanjes(canjes: CanjeATC[]): Promise<void> {
  const database = getDB();
  if (!database || canjes.length === 0) return;
  try {
    await database.atcCanjes.bulkPut(canjes);
  } catch {
    /* noop */
  }
}

export async function cacheMergeATCApelaciones(apelaciones: ApelacionATC[]): Promise<void> {
  const database = getDB();
  if (!database || apelaciones.length === 0) return;
  try {
    await database.atcApelaciones.bulkPut(apelaciones);
  } catch {
    /* noop */
  }
}

export async function cacheMergeATCNotificaciones(notificaciones: NotificacionATC[]): Promise<void> {
  const database = getDB();
  if (!database || notificaciones.length === 0) return;
  try {
    await database.atcNotificaciones.bulkPut(notificaciones);
  } catch {
    /* noop */
  }
}

export async function cacheGuardarATCConfig(config: ConfigATC): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'atc_config', value: config });
  } catch {
    /* noop */
  }
}

/** IDs de encuestas que ya generaron transacciones ATC (deduplicación sin red) */
export async function cacheLeerIdsProcesadasATC(): Promise<Set<string>> {
  const database = getDB();
  if (!database) return new Set();
  try {
    const ts = await database.atcTransacciones.toArray();
    return new Set(ts.map((t) => t.encuestaId).filter((x): x is string => Boolean(x)));
  } catch {
    return new Set();
  }
}

// ------------------------------------------------------------
// Beacon de sincronización ATC (1 lectura verifica todo el módulo)
// ------------------------------------------------------------

export async function cacheLeerBeaconATC(): Promise<string> {
  const database = getDB();
  if (!database) return '';
  try {
    const r = await database.kv.get('atc_beacon');
    return (r?.value as string) ?? '';
  } catch {
    return '';
  }
}

export async function cacheGuardarBeaconATC(valor: string): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'atc_beacon', value: valor });
  } catch {
    /* noop */
  }
}

/** Flag: este navegador ya sincronizó el módulo ATC completo */
export async function cacheLeerATCSyncFlag(): Promise<boolean> {
  const database = getDB();
  if (!database) return false;
  try {
    const r = await database.kv.get('atc_synced');
    return (r?.value as boolean) ?? false;
  } catch {
    return false;
  }
}

export async function cacheGuardarATCSyncFlag(valor: boolean): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await database.kv.put({ key: 'atc_synced', value: valor });
  } catch {
    /* noop */
  }
}

/**
 * Cursores de delta sync por colección ATC (ISO UTC).
 * Se guarda 1s de solapamiento para tolerancia de reloj/escrituras
 * concurrentes; el merge por clave lo hace idempotente.
 */
export type ColeccionATC = 'wallets' | 'transacciones' | 'premios' | 'canjes' | 'apelaciones' | 'notificaciones';

export async function cacheLeerCursorATC(coleccion: ColeccionATC): Promise<string> {
  const database = getDB();
  if (!database) return '';
  try {
    const r = await database.kv.get(`atc_cursor_${coleccion}`);
    return (r?.value as string) ?? '';
  } catch {
    return '';
  }
}

export async function cacheGuardarCursorATC(coleccion: ColeccionATC, iso: string): Promise<void> {
  const database = getDB();
  if (!database || !iso) return;
  try {
    await database.kv.put({ key: `atc_cursor_${coleccion}`, value: iso });
  } catch {
    /* noop */
  }
}

/** Avanza el cursor solo si el valor recibido es mayor */
export async function cacheAvanzarCursorATC(coleccion: ColeccionATC, iso: string): Promise<void> {
  const actual = await cacheLeerCursorATC(coleccion);
  if (!iso || iso > actual) await cacheGuardarCursorATC(coleccion, iso);
}

/** Limpia solo el módulo ATC del caché (manteniendo encuestas/HC/TMO) */
export async function cacheBorrarATC(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await Promise.all([
      database.atcWallets.clear(),
      database.atcTransacciones.clear(),
      database.atcPremios.clear(),
      database.atcCanjes.clear(),
      database.atcApelaciones.clear(),
      database.atcNotificaciones.clear(),
    ]);
    const claves = [
      'atc_beacon',
      'atc_synced',
      'atc_cursor_wallets',
      'atc_cursor_transacciones',
      'atc_cursor_premios',
      'atc_cursor_canjes',
      'atc_cursor_apelaciones',
      'atc_cursor_notificaciones',
      'atc_config',
    ];
    await database.kv.bulkDelete(claves);
  } catch {
    /* noop */
  }
}

// ------------------------------------------------------------
// Contador de lecturas Firebase ahorradas
// ------------------------------------------------------------

export async function cacheIncrementarReadsAhorradas(cantidad: number): Promise<number> {
  const database = getDB();
  if (!database || cantidad <= 0) return 0;
  try {
    const r = await database.kv.get('reads_ahorradas');
    const actual = (r?.value as number) ?? 0;
    const nueva = actual + cantidad;
    await database.kv.put({ key: 'reads_ahorradas', value: nueva });
    return nueva;
  } catch {
    return 0;
  }
}

export async function cacheLeerReadsAhorradas(): Promise<number> {
  const database = getDB();
  if (!database) return 0;
  try {
    const r = await database.kv.get('reads_ahorradas');
    return (r?.value as number) ?? 0;
  } catch {
    return 0;
  }
}

/** Estadísticas del caché para el panel de administración */
export async function cacheEstadisticas(): Promise<{
  disponible: boolean;
  encuestas: number;
  asesoresHC: number;
  tmo: boolean;
  atcWallets: number;
  atcTransacciones: number;
  atcPremios: number;
  atcCanjes: number;
  atcApelaciones: number;
  atcNotificaciones: number;
  readsAhorradas: number;
}> {
  const database = getDB();
  if (!database) {
    return {
      disponible: false,
      encuestas: 0,
      asesoresHC: 0,
      tmo: false,
      atcWallets: 0,
      atcTransacciones: 0,
      atcPremios: 0,
      atcCanjes: 0,
      atcApelaciones: 0,
      atcNotificaciones: 0,
      readsAhorradas: 0,
    };
  }
  try {
    const [encuestas, asesoresHC, tmo, wallets, transacciones, premios, canjes, apelaciones, notificaciones, readsAhorradas] =
      await Promise.all([
        database.encuestas.count(),
        database.asesoresHC.count(),
        database.tmo.count(),
        database.atcWallets.count(),
        database.atcTransacciones.count(),
        database.atcPremios.count(),
        database.atcCanjes.count(),
        database.atcApelaciones.count(),
        database.atcNotificaciones.count(),
        cacheLeerReadsAhorradas(),
      ]);
    return {
      disponible: true,
      encuestas,
      asesoresHC,
      tmo: tmo > 0,
      atcWallets: wallets,
      atcTransacciones: transacciones,
      atcPremios: premios,
      atcCanjes: canjes,
      atcApelaciones: apelaciones,
      atcNotificaciones: notificaciones,
      readsAhorradas,
    };
  } catch {
    return {
      disponible: false,
      encuestas: 0,
      asesoresHC: 0,
      tmo: false,
      atcWallets: 0,
      atcTransacciones: 0,
      atcPremios: 0,
      atcCanjes: 0,
      atcApelaciones: 0,
      atcNotificaciones: 0,
      readsAhorradas: 0,
    };
  }
}

/** Limpia todo el caché local */
export async function cacheLimpiarTodo(): Promise<void> {
  const database = getDB();
  if (!database) return;
  try {
    await Promise.all([
      database.encuestas.clear(),
      database.asesoresHC.clear(),
      database.tmo.clear(),
      database.atcWallets.clear(),
      database.atcTransacciones.clear(),
      database.atcPremios.clear(),
      database.atcCanjes.clear(),
      database.atcApelaciones.clear(),
      database.atcNotificaciones.clear(),
      database.kv.clear(),
    ]);
  } catch {
    /* noop */
  }
}
