// ============================================================
// tNPS Digital Claro Guatemala — Store ATC (Zustand)
// Archivo: src/lib/atc-store.ts
// Estado global del sistema de incentivos ATC.
//
// OPTIMIZACIÓN DE LECTURAS (plan gratuito Firebase):
// - `inicializar` pinta la UI desde el CACHÉ LOCAL (IndexedDB)
//   al instante, con 0 lecturas de red.
// - `sincronizar` verifica con 1 lectura (beacon) si cambió algo;
//   si no cambió, no lee nada más. Si cambió, lee SOLO lo nuevo
//   (delta por cursores ISO) y lo fusiona al caché.
// - El refresco liviano se dispara al volver a la pestaña
//   (visibilitychange) y cada 3 minutos — sin onSnapshot costoso.
// - Se eliminaron las transferencias P2P entre usuarios.
// ============================================================
import { create } from 'zustand';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type {
  ApelacionATC,
  CanjeATC,
  ConfigATC,
  NotificacionATC,
  PremioATC,
  TransaccionATC,
  WalletATC,
} from './atc-types';
import { CONFIG_ATC_DEFAULT, semanaISOActual } from './atc-types';
import { deltaApelacion, procesarEncuestasATC } from './atc-engine';
import { clasificarDetractor } from './keyword-detector';
import {
  actualizarStockPremio,
  agregarAdmin as fbAgregarAdmin,
  borrarPremio as fbBorrarPremio,
  crearApelacion as fbCrearApelacion,
  crearCanje as fbCrearCanje,
  crearNotificacion,
  esErrorPermisos,
  guardarConfig as fbGuardarConfig,
  guardarPremio as fbGuardarPremio,
  guardarTransacciones,
  guardarWallet,
  guardarWalletsDiferencial,
  leerApelaciones,
  leerApelacionesDe,
  leerApelacionesDesde,
  leerBeaconATC,
  leerCanjes,
  leerCanjesDe,
  leerCanjesDesde,
  leerConfig,
  leerNotificaciones,
  leerNotificacionesDe,
  leerNotificacionesDesde,
  leerPremios,
  leerPremiosDesde,
  leerTransacciones,
  leerTransaccionesDesde,
  leerWallet,
  leerWallets,
  leerWalletsDesde,
  marcarNotificacionLeida as fbMarcarLeida,
  marcarTodasLeidas as fbMarcarTodas,
  quitarAdmin as fbQuitarAdmin,
  reiniciarWallets as fbReiniciarWallets,
  resolverApelacion as fbResolverApelacion,
  resolverCanje as fbResolverCanje,
} from './atc-firestore';
import {
  cacheAvanzarCursorATC,
  cacheGuardarATCConfig,
  cacheGuardarATCSyncFlag,
  cacheGuardarBeaconATC,
  cacheIncrementarReadsAhorradas,
  cacheLeerATC,
  cacheLeerATCSyncFlag,
  cacheLeerATCWallets,
  cacheLeerBeaconATC,
  cacheLeerCursorATC,
  cacheLeerIdsProcesadasATC,
  cacheMergeATCApelaciones,
  cacheMergeATCCanjes,
  cacheMergeATCNotificaciones,
  cacheMergeATCPremios,
  cacheMergeATCTransacciones,
  cacheMergeATCWallets,
} from './cache';
import type { Encuesta } from './types';

interface EstadoATC {
  config: ConfigATC;
  wallets: WalletATC[]; // Todas (vista admin)
  miWallet: WalletATC | null; // Wallet del asesor autenticado
  premios: PremioATC[];
  canjes: CanjeATC[];
  apelaciones: ApelacionATC[];
  transacciones: TransaccionATC[]; // Ledger completo (vista admin)
  notificaciones: NotificacionATC[];
  cargando: boolean;
  procesando: boolean;
  sincronizando: boolean;
  ultimoSyncTs: number | null;
  loginActual: string | null;
  esAdminActual: boolean;
  /** Login cuyos datos ya se sincronizaron en ESTA sesión (evita
   *  saltarse la sync cuando el beacon aún vale '' y el caché no
   *  tiene los datos de este asesor) */
  loginSincronizado: string | null;
  /** true si Firestore denegó permisos (reglas desactualizadas) */
  avisoReglas: boolean;

  // Inicialización y sincronización
  inicializar: (login: string | null, esAdmin: boolean) => Promise<void>;
  sincronizar: (forzar?: boolean) => Promise<void>;
  /** v3.0.2: Sincronización por capas para 250 usuarios */
  sincronizarNotificaciones: () => Promise<void>;
  sincronizarWallets: () => Promise<void>;
  sincronizarCompleto: () => Promise<void>;
  cerrarSesionATC: () => void;

  // Motor
  procesarNuevasEncuestas: (encuestas: Encuesta[]) => Promise<void>;

  // Canjes
  solicitarCanje: (premio: PremioATC) => Promise<void>;
  resolverCanje: (canje: CanjeATC, estado: 'aprobado' | 'rechazado', comentario?: string) => Promise<void>;

  // Apelaciones
  crearApelacion: (encuesta: Encuesta, motivo: string) => Promise<void>;
  resolverApelacion: (apelacion: ApelacionATC, aprobada: boolean, respuesta: string) => Promise<void>;

  // Configuración y premios (admin)
  actualizarConfig: (parcial: Partial<ConfigATC>) => Promise<void>;
  guardarPremio: (premio: PremioATC) => Promise<void>;
  eliminarPremio: (id: string) => Promise<void>;
  reiniciarWallets: (saldoInicial?: number) => Promise<void>;
  ajustarSaldo: (login: string, monto: number, motivo: string) => Promise<void>;
  gestionarAdmin: (uid: string, agregar: boolean) => Promise<void>;

  // Notificaciones
  marcarLeida: (id: string) => Promise<void>;
  marcarTodasLeidas: () => Promise<void>;

  // Refresco de wallet
  refrescarMiWallet: () => Promise<void>;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Orden + filtro de notificaciones según rol */
function filtrarNotificaciones(
  notificaciones: NotificacionATC[],
  esAdmin: boolean,
  login: string | null
): NotificacionATC[] {
  return notificaciones
    .filter((n) => {
      if (esAdmin) return n.paraAdmin === true || (login ? n.paraLogin === login : false);
      if (login) return n.paraLogin === login;
      return false;
    })
    .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
}

/** Deriva el estado visible del módulo ATC desde el caché local */
function aplicarSnapshot(
  wallets: WalletATC[],
  premios: PremioATC[],
  canjes: CanjeATC[],
  apelaciones: ApelacionATC[],
  notificaciones: NotificacionATC[],
  login: string | null,
  esAdmin: boolean,
  transacciones: TransaccionATC[] = []
): Partial<EstadoATC> {
  return {
    wallets: esAdmin ? [...wallets].sort((a, b) => b.saldo - a.saldo) : [],
    miWallet: login ? wallets.find((w) => w.loginNormalizado === login) ?? null : null,
    premios,
    canjes: (esAdmin ? canjes : canjes.filter((c) => c.loginNormalizado === login)).sort((a, b) =>
      (b.solicitado || '').localeCompare(a.solicitado || '')
    ),
    apelaciones: (esAdmin ? apelaciones : apelaciones.filter((a) => a.loginNormalizado === login)).sort((a, b) =>
      (b.creado || '').localeCompare(a.creado || '')
    ),
    transacciones: (esAdmin
      ? transacciones
      : transacciones.filter((t) => t.loginNormalizado === login)
    ).sort((a, b) =>
      (b.creado || b.fecha || '').localeCompare(a.creado || a.fecha || '')
    ),
    notificaciones: filtrarNotificaciones(notificaciones, esAdmin, login),
  };
}

/** Máximo ISO de una lista según el campo indicado */
function maxISO(items: Record<string, unknown>[], campo: string): string {
  let max = '';
  for (const item of items) {
    const v = String(item[campo] ?? '');
    if (v && v > max) max = v;
  }
  return max;
}

/** Retrocede 1s un ISO para tolerar escrituras concurrentes (merge idempotente) */
function retrocederISO(iso: string, ms = 1000): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t - ms).toISOString();
}

/** Wallet desde el caché; si no está, la lee de Firestore (1 doc) */
async function walletLocalORemota(login: string): Promise<WalletATC | null> {
  try {
    const locales = await cacheLeerATCWallets();
    const local = locales.find((w) => w.loginNormalizado === login);
    if (local) return local;
  } catch {
    /* noop */
  }
  try {
    return await leerWallet(login);
  } catch {
    return null;
  }
}

/**
 * Manejo de errores de Firestore con mensajes claros para el
 * usuario (permisos / cuota / genérico) + activa el aviso de
 * reglas cuando corresponde.
 */
function manejarErrorATC(error: unknown, contexto: string): void {
  console.error(contexto, error);
  if (esErrorPermisos(error)) {
    useATCStore.setState({ avisoReglas: true });
    toast.error(
      `${contexto} Permiso denegado. Contacta al administrador del sistema.`,
      { duration: 10000 }
    );
  } else if (`${(error as { code?: string })?.code ?? ''}`.includes('resource-exhausted')) {
    toast.error(`${contexto} Límite de operaciones alcanzado; se reintentará más tarde.`);
  } else {
    toast.error(contexto);
  }
}

// ------------------------------------------------------------
// Sincronización periódica escalable para 250 usuarios (v3.0.2)
// ------------------------------------------------------------
// ESTRATEGIA: 3 capas de frecuencia + jitter aleatorio
//
// Capa 1 (frecuente): Notificaciones — cada 5min, 1 Server Action
//   250 usuarios × 1 action / 5min = 50 actions/min = 0.83/seg ✓
//
// Capa 2 (media): Wallets + Canjes — cada 10min, 2 Server Actions
//   250 usuarios × 2 actions / 10min = 50 actions/min = 0.83/seg ✓
//
// Capa 3 (rara): Premios + Apelaciones + Config — cada 30min, 3 Server Actions
//   250 usuarios × 3 actions / 30min = 25 actions/min = 0.42/seg ✓
//
// TOTAL: ~125 actions/min = 2.1/seg con 250 usuarios concurrentes
// HuggingFace Space free soporta ~5-10 req/seg, así que hay margen.
//
// JITTER: cada usuario empieza su intervalo con un offset aleatorio de 0-60s
// para evitar que los 250 usuarios disparen todos al mismo segundo.

const INTERVALO_NOTIFS_MS = 5 * 60 * 1000; // 5 min
const INTERVALO_WALLETS_MS = 10 * 60 * 1000; // 10 min
const INTERVALO_COMPLETO_MS = 30 * 60 * 1000; // 30 min

let timerNotifs: JitterTimer | null = null;
let timerWallets: JitterTimer | null = null;
let timerCompleto: JitterTimer | null = null;
let handlerVisibilidad: (() => void) | null = null;

let ultimaSyncNotifsTs = 0;
let ultimaSyncWalletsTs = 0;
let ultimaSyncCompletoTs = 0;
const THROTTLE_NOTIFS_MS = 3 * 60 * 1000; // 3 min
const THROTTLE_WALLETS_MS = 5 * 60 * 1000; // 5 min
const THROTTLE_COMPLETO_MS = 15 * 60 * 1000; // 15 min

/** Jitter aleatorio de 0-60s para distribuir la carga entre 250 usuarios */
function jitterSegundos(): number {
  return Math.floor(Math.random() * 60) * 1000;
}

/** Espera el jitter antes de iniciar el intervalo, para distribuir la carga.
 * Retorna un objeto con un método `stop()` para limpiar ambos timers. */
interface JitterTimer {
  stop: () => void;
}
function iniciarConJitter(jitterMs: number, callback: () => void, intervaloMs: number): JitterTimer {
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  const jitterTimer = setTimeout(() => {
    callback();
    intervalTimer = setInterval(callback, intervaloMs);
  }, jitterMs);
  return {
    stop: () => {
      clearTimeout(jitterTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    },
  };
}

function iniciarSincronizacionPeriodica() {
  detenerSincronizacionPeriodica();
  if (typeof window === 'undefined') return;

  const jitter1 = jitterSegundos();
  const jitter2 = jitterSegundos();
  const jitter3 = jitterSegundos();

  // Capa 1: Notificaciones (cada 5min)
  timerNotifs = iniciarConJitter(jitter1, () => {
    if (document.visibilityState !== 'visible') return;
    const ahora = Date.now();
    if (ahora - ultimaSyncNotifsTs < THROTTLE_NOTIFS_MS) return;
    ultimaSyncNotifsTs = ahora;
    useATCStore.getState().sincronizarNotificaciones().catch(() => undefined);
  }, INTERVALO_NOTIFS_MS);

  // Capa 2: Wallets + Canjes (cada 10min)
  timerWallets = iniciarConJitter(jitter2, () => {
    if (document.visibilityState !== 'visible') return;
    const ahora = Date.now();
    if (ahora - ultimaSyncWalletsTs < THROTTLE_WALLETS_MS) return;
    ultimaSyncWalletsTs = ahora;
    useATCStore.getState().sincronizarWallets().catch(() => undefined);
  }, INTERVALO_WALLETS_MS);

  // Capa 3: Premios + Apelaciones + Config (cada 30min)
  timerCompleto = iniciarConJitter(jitter3, () => {
    if (document.visibilityState !== 'visible') return;
    const ahora = Date.now();
    if (ahora - ultimaSyncCompletoTs < THROTTLE_COMPLETO_MS) return;
    ultimaSyncCompletoTs = ahora;
    useATCStore.getState().sincronizarCompleto().catch(() => undefined);
  }, INTERVALO_COMPLETO_MS);

  // Handler de visibilidad: solo sync notifs al volver a la pestaña (ligero)
  handlerVisibilidad = () => {
    if (document.visibilityState === 'visible') {
      const ahora = Date.now();
      if (ahora - ultimaSyncNotifsTs > THROTTLE_NOTIFS_MS) {
        ultimaSyncNotifsTs = ahora;
        useATCStore.getState().sincronizarNotificaciones().catch(() => undefined);
      }
    }
  };
  document.addEventListener('visibilitychange', handlerVisibilidad);
}

function detenerSincronizacionPeriodica() {
  if (timerNotifs) { timerNotifs.stop(); timerNotifs = null; }
  if (timerWallets) { timerWallets.stop(); timerWallets = null; }
  if (timerCompleto) { timerCompleto.stop(); timerCompleto = null; }
  if (handlerVisibilidad) {
    document.removeEventListener('visibilitychange', handlerVisibilidad);
    handlerVisibilidad = null;
  }
}

// ------------------------------------------------------------
// Polling de notificaciones (cada 5 min) — LIGERO, 1 Server Action
// ------------------------------------------------------------
let notifInterval: ReturnType<typeof setInterval> | null = null;

function iniciarPollingNotificaciones() {
  detenerPollingNotificaciones();
  if (typeof window === 'undefined') return;
  // v3.0.2: el polling ahora usa sincronizarNotificaciones() que es la
  // capa 1. No necesitamos un intervalo separado — la sincronización
  // periódica ya lo hace. Esta función queda como no-op para compat.
}

function detenerPollingNotificaciones() {
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }
}

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

export const useATCStore = create<EstadoATC>((set, get) => ({
  config: { ...CONFIG_ATC_DEFAULT },
  wallets: [],
  miWallet: null,
  premios: [],
  canjes: [],
  apelaciones: [],
  transacciones: [],
  notificaciones: [],
  cargando: false,
  procesando: false,
  sincronizando: false,
  ultimoSyncTs: null,
  loginActual: null,
  esAdminActual: false,
  loginSincronizado: null,
  avisoReglas: false,

  inicializar: async (login, esAdmin) => {
    set({ cargando: true, loginActual: login, esAdminActual: esAdmin });
    try {
      // 1) CACHE-FIRST: la UI se pinta al instante con los datos
      //    locales del navegador (0 lecturas de Firestore).
      const snap = await cacheLeerATC();
      set(aplicarSnapshot(snap.wallets, snap.premios, snap.canjes, snap.apelaciones, snap.notificaciones, login, esAdmin, snap.transacciones));
      if (snap.config) set({ config: snap.config });

      // 2) Sincronización: 1 lectura (beacon) decide si hay datos
      //    nuevos; si los hay, delta sync (solo lo nuevo).
      await get().sincronizar();

      // 3) Refresco liviano en background (visibilidad + 3 min)
      iniciarSincronizacionPeriodica();
      // 4) Polling de notificaciones: cada 30s revisa si hay nuevas
      //    notificaciones sin leer para el usuario actual y las muestra
      //    como toasts. Las notificaciones ya llegan filtradas por área
      //    (paraLogin / paraAdmin) desde el servidor.
      iniciarPollingNotificaciones();
    } catch (error) {
      console.error('Error inicializando ATC:', error);
      toast.error('No se pudo cargar el sistema ATC. Intenta de nuevo más tarde.');
    } finally {
      set({ cargando: false });
    }
  },

  sincronizar: async (forzar = false) => {
    const { sincronizando } = get();
    if (sincronizando) return;
    set({ sincronizando: true });
    try {
      const { loginActual, esAdminActual } = get();

      // === CARGA SIMPLE: siempre leer de la BD vía Server Actions ===
      // Sin delta sync, sin beacons, sin cursores. Prisma es rápido.
      const config = await leerConfig().catch(() => ({ ...CONFIG_ATC_DEFAULT }));
      set({ config });
      await cacheGuardarATCConfig(config).catch(() => undefined);

      if (esAdminActual) {
        // SUPERVISOR / ADMIN — leer TODAS las colecciones
        const [wallets, transacciones, premios, canjes, apelaciones, notificaciones] = await Promise.all([
          leerWallets().catch(() => [] as WalletATC[]),
          leerTransacciones().catch(() => [] as TransaccionATC[]),
          leerPremios().catch(() => [] as PremioATC[]),
          leerCanjes().catch(() => [] as CanjeATC[]),
          leerApelaciones().catch(() => [] as ApelacionATC[]),
          leerNotificaciones(true, undefined).catch(() => [] as NotificacionATC[]),
        ]);

        set(aplicarSnapshot(wallets, premios, canjes, apelaciones, notificaciones, loginActual, true, transacciones));

        // Guardar en caché
        await cacheMergeATCWallets(wallets).catch(() => undefined);
        await cacheMergeATCTransacciones(transacciones).catch(() => undefined);
        await cacheMergeATCPremios(premios).catch(() => undefined);
        await cacheMergeATCCanjes(canjes).catch(() => undefined);
        await cacheMergeATCApelaciones(apelaciones).catch(() => undefined);
        await cacheMergeATCNotificaciones(notificaciones).catch(() => undefined);
      } else if (loginActual) {
        // ASESOR — leer ÚNICAMENTE sus propios datos + catálogo de premios
        const [walletRemota, canjesMios, apelacionesMias, notificacionesMias, premios, transaccionesMias] = await Promise.all([
          leerWallet(loginActual).catch(() => null),
          leerCanjesDe(loginActual).catch(() => [] as CanjeATC[]),
          leerApelacionesDe(loginActual).catch(() => [] as ApelacionATC[]),
          leerNotificacionesDe(loginActual).catch(() => [] as NotificacionATC[]),
          leerPremios().catch(() => [] as PremioATC[]),
          leerTransacciones(loginActual).catch(() => [] as TransaccionATC[]),
        ]);

        const wallets = walletRemota ? [walletRemota] : [];
        set(aplicarSnapshot(wallets, premios, canjesMios, apelacionesMias, notificacionesMias, loginActual, false, transaccionesMias));

        // Guardar en caché
        if (walletRemota) await cacheMergeATCWallets([walletRemota]).catch(() => undefined);
        if (transaccionesMias.length > 0) await cacheMergeATCTransacciones(transaccionesMias).catch(() => undefined);
        if (premios.length > 0) await cacheMergeATCPremios(premios).catch(() => undefined);
        if (canjesMios.length > 0) await cacheMergeATCCanjes(canjesMios).catch(() => undefined);
        if (apelacionesMias.length > 0) await cacheMergeATCApelaciones(apelacionesMias).catch(() => undefined);
        if (notificacionesMias.length > 0) await cacheMergeATCNotificaciones(notificacionesMias).catch(() => undefined);
      }

      await cacheGuardarATCSyncFlag(true).catch(() => undefined);
      if (!esAdminActual && loginActual) {
        set({ loginSincronizado: loginActual });
      }
      set({ ultimoSyncTs: Date.now() });
    } catch (error) {
      console.error('Error sincronizando ATC:', error);
      // Fallback: leer del caché local
      try {
        const snap = await cacheLeerATC();
        const { loginActual, esAdminActual } = get();
        set(aplicarSnapshot(snap.wallets, snap.premios, snap.canjes, snap.apelaciones, snap.notificaciones, loginActual, esAdminActual, snap.transacciones));
        if (snap.config) set({ config: snap.config });
      } catch (e2) {
        console.error('Error leyendo caché ATC:', e2);
      }
    } finally {
      set({ sincronizando: false });
    }
  },

  // v3.0.2: Sincronización por capas para 250 usuarios
  // Capa 1: Solo notificaciones (1 Server Action) — cada 5min
  sincronizarNotificaciones: async () => {
    const { loginActual, esAdminActual, notificaciones, marcarLeida } = get();
    if (!loginActual) return;
    try {
      const notifsNuevas = esAdminActual
        ? await leerNotificaciones(true, undefined).catch(() => [] as NotificacionATC[])
        : await leerNotificacionesDe(loginActual).catch(() => [] as NotificacionATC[]);
      // Detectar no leídas nuevas
      const idsConocidos = new Set(notificaciones.map(n => n.id));
      const nuevasNoLeidas = notifsNuevas.filter(n => !n.leida && !idsConocidos.has(n.id));
      // Mostrar toast por las primeras 3 no leídas y marcarlas como leídas
      for (const n of nuevasNoLeidas.slice(0, 3)) {
        toast.info(n.titulo, { description: n.mensaje });
        await marcarLeida(n.id).catch(() => undefined);
      }
      // Actualizar estado con las notificaciones nuevas
      if (notifsNuevas.length > 0) {
        const setUnido = new Map<string, NotificacionATC>();
        for (const n of notificaciones) setUnido.set(n.id, n);
        for (const n of notifsNuevas) setUnido.set(n.id, n);
        set({ notificaciones: Array.from(setUnido.values()) });
        await cacheMergeATCNotificaciones(notifsNuevas).catch(() => undefined);
      }
    } catch (err) {
      console.warn('sincronizarNotificaciones falló:', err);
    }
  },

  // Capa 2: Wallets + Canjes + Transacciones (2-3 Server Actions) — cada 10min
  sincronizarWallets: async () => {
    const { loginActual, esAdminActual } = get();
    if (!loginActual) return;
    try {
      if (esAdminActual) {
        const [wallets, transacciones, canjes] = await Promise.all([
          leerWallets().catch(() => [] as WalletATC[]),
          leerTransacciones().catch(() => [] as TransaccionATC[]),
          leerCanjes().catch(() => [] as CanjeATC[]),
        ]);
        set({ wallets: [...wallets].sort((a, b) => b.saldo - a.saldo), transacciones, canjes });
        await cacheMergeATCWallets(wallets).catch(() => undefined);
        await cacheMergeATCTransacciones(transacciones).catch(() => undefined);
        await cacheMergeATCCanjes(canjes).catch(() => undefined);
      } else {
        const [walletRemota, canjesMios, transaccionesMias] = await Promise.all([
          leerWallet(loginActual).catch(() => null),
          leerCanjesDe(loginActual).catch(() => [] as CanjeATC[]),
          leerTransacciones(loginActual).catch(() => [] as TransaccionATC[]),
        ]);
        if (walletRemota) {
          set({ miWallet: walletRemota, wallets: [walletRemota] });
          await cacheMergeATCWallets([walletRemota]).catch(() => undefined);
        }
        set({ canjes: canjesMios, transacciones: transaccionesMias });
        if (transaccionesMias.length > 0) await cacheMergeATCTransacciones(transaccionesMias).catch(() => undefined);
        if (canjesMios.length > 0) await cacheMergeATCCanjes(canjesMios).catch(() => undefined);
      }
    } catch (err) {
      console.warn('sincronizarWallets falló:', err);
    }
  },

  // Capa 3: Premios + Apelaciones + Config (3 Server Actions) — cada 30min
  sincronizarCompleto: async () => {
    const { loginActual, esAdminActual } = get();
    if (!loginActual) return;
    try {
      const config = await leerConfig().catch(() => ({ ...CONFIG_ATC_DEFAULT }));
      set({ config });
      await cacheGuardarATCConfig(config).catch(() => undefined);

      if (esAdminActual) {
        const [premios, apelaciones] = await Promise.all([
          leerPremios().catch(() => [] as PremioATC[]),
          leerApelaciones().catch(() => [] as ApelacionATC[]),
        ]);
        set({ premios, apelaciones });
        await cacheMergeATCPremios(premios).catch(() => undefined);
        await cacheMergeATCApelaciones(apelaciones).catch(() => undefined);
      } else {
        const [premios, apelacionesMias] = await Promise.all([
          leerPremios().catch(() => [] as PremioATC[]),
          leerApelacionesDe(loginActual).catch(() => [] as ApelacionATC[]),
        ]);
        set({ premios, apelaciones: apelacionesMias });
        await cacheMergeATCPremios(premios).catch(() => undefined);
        if (apelacionesMias.length > 0) await cacheMergeATCApelaciones(apelacionesMias).catch(() => undefined);
      }
      set({ ultimoSyncTs: Date.now() });
    } catch (err) {
      console.warn('sincronizarCompleto falló:', err);
    }
  },

  cerrarSesionATC: () => {
    detenerSincronizacionPeriodica();
    detenerPollingNotificaciones();
    set({
      config: { ...CONFIG_ATC_DEFAULT },
      wallets: [],
      miWallet: null,
      premios: [],
      canjes: [],
      apelaciones: [],
      notificaciones: [],
      cargando: false,
      procesando: false,
      sincronizando: false,
      ultimoSyncTs: null,
      loginActual: null,
      esAdminActual: false,
      loginSincronizado: null,
      avisoReglas: false,
    });
  },

  procesarNuevasEncuestas: async (encuestas) => {
    const { config, wallets, miWallet, loginActual, esAdminActual } = get();
    if (!config.sistemaATCActivo || encuestas.length === 0) return;

    set({ procesando: true });
    try {
      // 0. Sincronizar antes (1 lectura beacon) para tener las
      //    transacciones de OTROS navegadores y no duplicar puntos.
      await get().sincronizar().catch(() => undefined);

      // 1. IDs ya procesadas:
      //    a) Desde la BD (fuente de verdad — sobrevive reinicios/caché limpio)
      //    b) Desde el CACHÉ local (más rápido, cubre lo que la BD aún no tiene)
      const idsProcesados = await cacheLeerIdsProcesadasATC();
      try {
        const { getEncuestasProcesadasATC } = await import('@/app/actions/neon-actions');
        const idsBD = await getEncuestasProcesadasATC();
        for (const id of idsBD) idsProcesados.add(id);
      } catch (err) {
        console.warn('No se pudieron leer IDs procesados desde la BD, usando solo caché local:', err);
      }

      // 2. Índice de wallets: caché (todas) + estado (más fresco)
      const walletsCache = await cacheLeerATCWallets();
      const walletsActuales: Record<string, WalletATC> = {};
      for (const w of walletsCache) walletsActuales[w.loginNormalizado] = w;
      for (const w of wallets) walletsActuales[w.loginNormalizado] = w;
      if (miWallet && !walletsActuales[miWallet.loginNormalizado]) {
        walletsActuales[miWallet.loginNormalizado] = miWallet;
      }
      // Snapshot previo para la escritura diferencial
      const anteriores: Record<string, WalletATC> = JSON.parse(JSON.stringify(walletsActuales));

      // 3. Motor ATC
      const resultado = procesarEncuestasATC(encuestas, walletsActuales, idsProcesados, config);

      if (resultado.transacciones.length === 0) {
        set({ procesando: false });
        return;
      }

      // 4. ESCRITURA DIFERENCIAL: solo wallets nuevas/modificadas;
      //    las que ya están en la BD con el mismo contenido se omiten.
      const statsW = await guardarWalletsDiferencial(resultado.wallets, anteriores);
      // Ledger best-effort: con las reglas desplegadas actuales la
      // escritura puede estar denegada; los puntos ya quedaron en
      // las wallets y el caché local mantiene los IDs procesados.
      await guardarTransacciones(resultado.transacciones).catch((e) => {
        console.warn('Ledger de transacciones no guardado (permisos):', e);
        toast.warning('Puntos aplicados, pero el ledger no se pudo guardar (reglas sin desplegar).');
      });

      // 5. Notificar a los admins (1 write)
      const r = resultado.resumen;
      await crearNotificacion({
        id: uuidv4(),
        tipo: 'carga_completada',
        titulo: 'Procesamiento ATC completado',
        mensaje: `${r.promotores + r.promotoresRacha} promotores, ${r.pasivos} pasivos y ${r.detractoresAsesor + r.detractoresServicio + r.detractoresIndeterminados} detractores procesados. ${r.totalPuntosDistribuidos >= 0 ? '+' : ''}${r.totalPuntosDistribuidos} ATC distribuidos en ${resultado.wallets.length} wallets.`,
        paraAdmin: true,
        leida: false,
        creado: new Date().toISOString(),
      });

      // 6. Actualizar caché local + estado SIN releer la base de datos
      await Promise.all([
        cacheMergeATCWallets(resultado.wallets),
        cacheMergeATCTransacciones(resultado.transacciones),
      ]);
      const mapaWallets = new Map(walletsCache.map((w) => [w.loginNormalizado, w]));
      for (const w of get().wallets) mapaWallets.set(w.loginNormalizado, w);
      for (const w of resultado.wallets) mapaWallets.set(w.loginNormalizado, w);
      const walletsFinales = Array.from(mapaWallets.values());

      set({
        wallets: esAdminActual
          ? [...walletsFinales].sort((a, b) => b.saldo - a.saldo)
          : get().wallets,
        miWallet: loginActual
          ? walletsFinales.find((w) => w.loginNormalizado === loginActual) ?? get().miWallet
          : get().miWallet,
      });

      toast.success(
        `ATC: ${resultado.transacciones.length} transacciones (${r.totalPuntosDistribuidos >= 0 ? '+' : ''}${r.totalPuntosDistribuidos} puntos) · ${statsW?.omitidas ?? 0} wallets sin cambios omitidas`
      );

      // 🏆 Verificar logros para todos los asesores afectados (best-effort)
      import('@/app/actions/logros-helpers').then(({ verificarLogrosAction }) => {
        verificarLogrosAction(resultado.wallets).catch(() => undefined);
      }).catch(() => undefined);
    } catch (error) {
      console.error('Error procesando ATC:', error);
      toast.error('Error al procesar puntos ATC.');
    } finally {
      set({ procesando: false });
    }
  },

  solicitarCanje: async (premio) => {
    const { miWallet } = get();
    if (!miWallet) {
      toast.error('No tienes una billetera ATC activa.');
      return;
    }
    if (miWallet.saldo < premio.costoATC) {
      toast.error(`Saldo insuficiente. Necesitas ${premio.costoATC} ATC y tienes ${miWallet.saldo}.`);
      return;
    }
    if (premio.stock === 0) {
      toast.error('Este premio está agotado.');
      return;
    }

    // v3.0: Validar requisito de TMO máximo si el premio lo define
    if (premio.tmoMaximoRequerido && premio.tmoMaximoRequerido > 0) {
      try {
        const { getTMOPromedioAsesor } = await import('@/app/actions/neon-actions');
        const res = await getTMOPromedioAsesor(miWallet.loginNormalizado, 7);
        const tmoAsesor = (res as any)?.tmo;
        if (typeof tmoAsesor === 'number' && tmoAsesor > premio.tmoMaximoRequerido) {
          toast.error(
            `No puedes canjear este premio porque tu TMO promedio (${tmoAsesor}s) es mayor al requerido (${premio.tmoMaximoRequerido}s).`
          );
          return;
        }
      } catch (e) {
        console.warn('No se pudo verificar TMO del asesor para canje:', e);
      }
    }

    // v3.0.4: Validar límite de reclamos por asesor
    const maxReclamos = (premio as any).maxReclamosPorAsesor ?? 0;
    if (maxReclamos > 0) {
      try {
        const { getCanjes } = await import('@/app/actions/neon-actions');
        const canjesPrevios = await getCanjes(miWallet.loginNormalizado);
        const canjesDeEstePremio = canjesPrevios.filter((c: any) => c.premioId === premio.id);
        if (canjesDeEstePremio.length >= maxReclamos) {
          toast.error(
            `Ya reclamaste este premio ${canjesDeEstePremio.length} veces. El límite es ${maxReclamos}.`
          );
          return;
        }
      } catch (e) {
        console.warn('No se pudo verificar límite de reclamos:', e);
      }
    }

    const canje: CanjeATC = {
      id: uuidv4(),
      loginNormalizado: miWallet.loginNormalizado,
      nombreAsesor: miWallet.nombre,
      premioId: premio.id,
      premioNombre: premio.nombre,
      premioEmoji: premio.emoji,
      costoATC: premio.costoATC,
      estado: premio.autoAprobacion ? 'aprobado' : 'pendiente',
      solicitado: new Date().toISOString(),
      resuelto: premio.autoAprobacion ? new Date().toISOString() : undefined,
      resueltoPor: premio.autoAprobacion ? 'auto' : undefined,
    } as any;
    // v3.0.4: incluir duración si el premio la define
    if ((premio as any).duracionTipo) {
      (canje as any).duracionTipo = (premio as any).duracionTipo;
      (canje as any).duracionValor = (premio as any).duracionValor;
    }

    // 1. Registrar el canje ANTES de descontar el saldo: si la
    //    escritura falla (permisos/cuota), no se pierde nada.
    try {
      await fbCrearCanje(canje);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo registrar el canje.');
      return;
    }

    // 2. Descontar saldo inmediatamente
    const walletActualizada: WalletATC = {
      ...miWallet,
      saldo: miWallet.saldo - premio.costoATC,
      stats: { ...miWallet.stats, totalGastado: miWallet.stats.totalGastado + premio.costoATC },
      actualizado: new Date().toISOString(),
    };
    try {
      await guardarWallet(walletActualizada);
    } catch (e) {
      manejarErrorATC(e, 'El canje quedó registrado pero no se pudo descontar el saldo.');
    }
    set({ miWallet: walletActualizada, canjes: [canje, ...get().canjes] });

    // 3. Caché local al día (sin releer la BD)
    await Promise.all([
      cacheMergeATCCanjes([canje]),
      cacheMergeATCWallets([walletActualizada]),
    ]);

    if (premio.autoAprobacion && premio.stock > 0) {
      // Stock best-effort: con reglas sin desplegar, el asesor no
      // puede escribir atc_premios; el canje ya quedó registrado.
      await actualizarStockPremio(premio.id, premio.stock - 1).catch(() => undefined);
      const premioActualizado = { ...premio, stock: premio.stock - 1, actualizado: new Date().toISOString() };
      set({ premios: get().premios.map((p) => (p.id === premio.id ? premioActualizado : p)) });
      await cacheMergeATCPremios([premioActualizado]);
      toast.success(`Canje automático aprobado. Disfruta tu ${premio.nombre}.`);
    } else {
      toast.success('Canje solicitado. Queda pendiente de aprobación del supervisor.');
    }

    // 🏆 Logro: primer canje
    try {
      const { otorgarLogroPorLoginAction } = await import('@/app/actions/logros-helpers');
      await otorgarLogroPorLoginAction(miWallet.loginNormalizado, 'primer_canje').catch(() => undefined);
    } catch {
      // best-effort
    }

    // 4. Notificar al admin (best-effort)
    await crearNotificacion({
      id: uuidv4(),
      tipo: 'canje_nuevo',
      titulo: 'Nueva solicitud de canje',
      mensaje: `${miWallet.nombre} solicitó "${premio.nombre}" por ${premio.costoATC} ATC.`,
      paraAdmin: true,
      leida: false,
      creado: new Date().toISOString(),
    }).catch(() => undefined);
  },

  resolverCanje: async (canje, estado, comentario) => {
    // 1. Marcar el canje (si falla → abortar con aviso claro)
    try {
      await fbResolverCanje(canje.id, estado, 'supervisor', comentario);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo resolver el canje.');
      return;
    }

    const canjeResuelto: CanjeATC = {
      ...canje,
      estado,
      resuelto: new Date().toISOString(),
      comentario: comentario ?? '',
      actualizado: new Date().toISOString(),
    };

    if (estado === 'rechazado') {
      // Devolver los ATC al asesor (cache-first, sin releer la BD)
      const wallet = await walletLocalORemota(canje.loginNormalizado);
      if (wallet) {
        const walletActualizada: WalletATC = {
          ...wallet,
          saldo: wallet.saldo + canje.costoATC,
          stats: { ...wallet.stats, totalGastado: Math.max(0, wallet.stats.totalGastado - canje.costoATC) },
          actualizado: new Date().toISOString(),
        };
        await guardarWallet(walletActualizada).catch((e) =>
          manejarErrorATC(e, 'El canje quedó rechazado pero no se pudieron devolver los ATC; usa el ajuste manual.')
        );
        await cacheMergeATCWallets([walletActualizada]);
        if (get().miWallet?.loginNormalizado === canje.loginNormalizado) {
          set({ miWallet: walletActualizada });
        }
        set({ wallets: get().wallets.map((w) => (w.loginNormalizado === wallet.loginNormalizado ? walletActualizada : w)) });
      }
    } else if (estado === 'aprobado') {
      // Reducir stock del premio (best-effort: requiere reglas/admin)
      const premio = get().premios.find((p) => p.id === canje.premioId);
      if (premio && premio.stock > 0) {
        await actualizarStockPremio(premio.id, premio.stock - 1).catch(() => undefined);
        const premioActualizado = { ...premio, stock: premio.stock - 1, actualizado: new Date().toISOString() };
        set({ premios: get().premios.map((p) => (p.id === premio.id ? premioActualizado : p)) });
        await cacheMergeATCPremios([premioActualizado]);
      }
    }

    set({ canjes: get().canjes.map((c) => (c.id === canje.id ? canjeResuelto : c)) });
    await cacheMergeATCCanjes([canjeResuelto]);

    // Notificar al asesor (best-effort)
    await crearNotificacion({
      id: uuidv4(),
      tipo: 'canje_resuelto',
      titulo: estado === 'aprobado' ? 'Canje aprobado' : 'Canje rechazado',
      mensaje:
        estado === 'aprobado'
          ? `Tu canje de "${canje.premioNombre}" fue aprobado. ¡Felicidades!`
          : `Tu canje de "${canje.premioNombre}" fue rechazado. Se devolvieron ${canje.costoATC} ATC a tu billetera. ${comentario ?? ''}`,
      paraLogin: canje.loginNormalizado,
      leida: false,
      creado: new Date().toISOString(),
    }).catch(() => undefined);

    toast.success(estado === 'aprobado' ? 'Canje aprobado.' : 'Canje rechazado (ATC devueltos).');
  },

  crearApelacion: async (encuesta, motivo) => {
    const { loginActual, config } = get();
    const motivoLimpio = motivo.trim();

    // --- Validaciones ---
    if (!loginActual) {
      toast.error('Tu sesión no está inicializada; recarga la página e inténtalo de nuevo.');
      return;
    }
    if (motivoLimpio.length < 10) {
      toast.error('Escribe un motivo de al menos 10 caracteres para que el supervisor pueda evaluar tu caso.');
      return;
    }
    if (get().apelaciones.some((a) => a.encuestaId === encuesta.id)) {
      toast.info('Ya enviaste una apelación para esta encuesta.');
      return;
    }

    // --- Wallet: si el asesor aún no tiene (caso extremo), se crea
    //     con el saldo inicial vigente para no bloquear la apelación ---
    let wallet = get().miWallet;
    if (!wallet) {
      wallet = {
        loginNormalizado: loginActual,
        nombre: encuesta.usuario || loginActual,
        saldo: config.saldoInicial,
        semanaActual: semanaISOActual(),
        stats: {
          totalPromotores: 0,
          totalPasivos: 0,
          totalDetractores: 0,
          totalGanado: 0,
          totalGastado: 0,
          mejorRacha: 0,
        },
        rachaActual: 0,
        metricasSemanales: [],
        actualizado: new Date().toISOString(),
      };
      await guardarWallet(wallet).catch(() => undefined);
      await cacheMergeATCWallets([wallet]);
      set({ miWallet: wallet });
    }

    // --- Capturar la clasificación ORIGINAL y los datos de la
    //     encuesta para que el supervisor la revise en el mismo
    //     diálogo (sin salir de la vista de apelaciones) ---
    const clasificacion = clasificarDetractor(
      encuesta.razon,
      encuesta.comentarioSolucion,
      encuesta.comentarioAdicional
    );
    const ahora = new Date().toISOString();
    const apelacion: ApelacionATC = {
      id: uuidv4(),
      loginNormalizado: wallet.loginNormalizado,
      nombreAsesor: wallet.nombre,
      encuestaId: encuesta.id,
      motivo: motivoLimpio,
      clasificacionOriginal: clasificacion,
      encuestaScore: encuesta.tnps,
      encuestaRazon: (encuesta.razon || '').slice(0, 200),
      encuestaComentario: (encuesta.comentarioSolucion || '').slice(0, 300),
      encuestaFecha: encuesta.fechaDia,
      estado: 'pendiente',
      creado: ahora,
      actualizado: ahora,
    };

    // --- Persistir (si falla → aviso claro, sin estado corrupto) ---
    try {
      await fbCrearApelacion(apelacion);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo enviar la apelación.');
      return;
    }

    // --- Estado local + caché (sin releer la BD) ---
    set({ apelaciones: [apelacion, ...get().apelaciones] });
    await cacheMergeATCApelaciones([apelacion]);

    // --- Notificar al supervisor (best-effort) ---
    await crearNotificacion({
      id: uuidv4(),
      tipo: 'apelacion_nueva',
      titulo: 'Nueva apelación de detractor',
      mensaje: `${wallet.nombre} apeló un detractor (score ${encuesta.tnps}). Revisa la pestaña de apelaciones.`,
      paraAdmin: true,
      leida: false,
      creado: ahora,
    }).catch(() => undefined);

    toast.success('Apelación enviada. El supervisor la revisará pronto.');
  },

  resolverApelacion: async (apelacion, aprobada, respuesta) => {
    const { config } = get();
    // Delta REAL de puntos: descuenta lo que ya se aplicó con la
    // clasificación original (evita cobrar dos veces el mismo
    // detractor y calcula reembolsos cuando corresponde).
    const puntos = deltaApelacion(apelacion.clasificacionOriginal, aprobada, config);
    const ahora = new Date().toISOString();

    // 1. Marcar la apelación como resuelta (si falla → abortar)
    try {
      await fbResolverApelacion(apelacion.id, aprobada ? 'aprobada' : 'rechazada', 'supervisor', respuesta);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo resolver la apelación.');
      return;
    }

    // 2. Aplicar el ajuste de puntos a la wallet (lo visible)
    const wallet = await walletLocalORemota(apelacion.loginNormalizado);
    if (wallet && puntos !== 0) {
      const walletActualizada: WalletATC = {
        ...wallet,
        saldo: wallet.saldo + puntos,
        actualizado: ahora,
      };
      await guardarWallet(walletActualizada).catch((e) =>
        manejarErrorATC(e, 'La apelación quedó resuelta, pero no se pudo ajustar el saldo; usa el ajuste manual.')
      );
      await cacheMergeATCWallets([walletActualizada]);
      if (get().miWallet?.loginNormalizado === wallet.loginNormalizado) {
        set({ miWallet: walletActualizada });
      }
      set({ wallets: get().wallets.map((w) => (w.loginNormalizado === wallet.loginNormalizado ? walletActualizada : w)) });

      // 3. Ledger auditable (best-effort: con reglas sin desplegar
      //    la colección atc_transacciones puede estar denegada;
      //    el ajuste de la wallet ya quedó aplicado).
      const transaccion: TransaccionATC = {
        id: uuidv4(),
        loginNormalizado: apelacion.loginNormalizado,
        tipo: aprobada ? 'APELACION_GANADA' : 'APELACION_PERDIDA',
        monto: puntos,
        descripcion: `Apelación ${aprobada ? 'aprobada' : 'rechazada'} de detractor (${apelacion.clasificacionOriginal}) — encuesta ${apelacion.encuestaId}`,
        encuestaId: apelacion.encuestaId,
        semanaISO: semanaISOActual(),
        fecha: ahora,
        procesadoPor: 'supervisor',
      };
      await guardarTransacciones([transaccion]).catch(() => undefined);
      await cacheMergeATCTransacciones([transaccion]).catch(() => undefined);
    }

    // 4. Estado local + caché de la apelación resuelta
    const apelacionResuelta: ApelacionATC = {
      ...apelacion,
      estado: aprobada ? 'aprobada' : 'rechazada',
      respuesta,
      resuelto: ahora,
      actualizado: ahora,
      puntosAplicados: puntos,
    };
    set({ apelaciones: get().apelaciones.map((a) => (a.id === apelacion.id ? apelacionResuelta : a)) });
    await cacheMergeATCApelaciones([apelacionResuelta]);

    // 🏆 Logro: apelación ganada (detractor recuperado)
    if (aprobada) {
      try {
        const { otorgarLogroPorLoginAction } = await import('@/app/actions/logros-helpers');
        await otorgarLogroPorLoginAction(apelacion.loginNormalizado, 'detractor_recuperado').catch(() => undefined);
      } catch {
        // best-effort
      }
    }

    // 5. Notificar al asesor (best-effort)
    const sufijoPuntos =
      puntos > 0 ? ` Se acreditaron ${puntos} ATC.` : puntos < 0 ? ` Se descontaron ${Math.abs(puntos)} ATC.` : '';
    await crearNotificacion({
      id: uuidv4(),
      tipo: 'apelacion_resuelta',
      titulo: aprobada ? 'Apelación aprobada' : 'Apelación rechazada',
      mensaje: `${aprobada ? 'Tu apelación fue aprobada' : 'Tu apelación fue rechazada'}.${sufijoPuntos} ${respuesta}`.trim(),
      paraLogin: apelacion.loginNormalizado,
      leida: false,
      creado: ahora,
    }).catch(() => undefined);

    toast.success(
      aprobada
        ? `Apelación aprobada${puntos !== 0 ? ` (${puntos > 0 ? '+' : ''}${puntos} ATC)` : ''}.`
        : `Apelación rechazada${puntos !== 0 ? ` (${puntos} ATC)` : ''}.`
    );
  },

  actualizarConfig: async (parcial) => {
    const nuevaConfig = { ...get().config, ...parcial };
    try {
      await fbGuardarConfig(nuevaConfig);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo guardar la configuración ATC.');
      return;
    }
    await cacheGuardarATCConfig(nuevaConfig);
    set({ config: nuevaConfig });
    toast.success('Configuración ATC actualizada.');
  },

  guardarPremio: async (premio) => {
    try {
      await fbGuardarPremio(premio);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo guardar el premio.');
      return;
    }
    const existe = get().premios.some((p) => p.id === premio.id);
    set({
      premios: existe
        ? get().premios.map((p) => (p.id === premio.id ? premio : p))
        : [...get().premios, premio],
    });
    await cacheMergeATCPremios([premio]);
    toast.success('Premio guardado en el catálogo.');
  },

  eliminarPremio: async (id) => {
    try {
      await fbBorrarPremio(id);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo eliminar el premio.');
      return;
    }
    set({ premios: get().premios.filter((p) => p.id !== id) });
    toast.success('Premio eliminado del catálogo.');
  },

  reiniciarWallets: async (saldoInicial) => {
    const { config } = get();
    const saldo = saldoInicial ?? config.saldoInicial;
    // fbReiniciarWallets devuelve las wallets ya reiniciadas
    // (evita una relectura completa de la colección).
    let wallets: WalletATC[];
    try {
      wallets = await fbReiniciarWallets(saldo);
    } catch (e) {
      manejarErrorATC(e, 'No se pudieron reiniciar las wallets.');
      return;
    }
    await cacheMergeATCWallets(wallets);
    set({ wallets: [...wallets].sort((a, b) => b.saldo - a.saldo) });
    if (get().miWallet) {
      const mia = wallets.find((w) => w.loginNormalizado === get().miWallet?.loginNormalizado) ?? null;
      set({ miWallet: mia });
    }
    await crearNotificacion({
      id: uuidv4(),
      tipo: 'wallet_reset',
      titulo: 'Wallets reiniciadas',
      mensaje: `Se reiniciaron ${wallets.length} wallets al saldo inicial de ${saldo} ATC.`,
      paraAdmin: true,
      leida: false,
      creado: new Date().toISOString(),
    });
    toast.success(`${wallets.length} wallets reiniciadas a ${saldo} ATC.`);
  },

  ajustarSaldo: async (login, monto, motivo) => {
    const wallet = await walletLocalORemota(login);
    if (!wallet) {
      toast.error('No se encontró la wallet de ese asesor.');
      return;
    }
    const saldoAnterior = wallet.saldo;
    const walletActualizada: WalletATC = {
      ...wallet,
      saldo: wallet.saldo + monto,
      actualizado: new Date().toISOString(),
    };
    try {
      await guardarWallet(walletActualizada);
    } catch (e) {
      manejarErrorATC(e, 'No se pudo aplicar el ajuste.');
      return;
    }
    await cacheMergeATCWallets([walletActualizada]);

    // v3.1.0: registrar quien hizo el ajuste (username del admin logueado)
    // Usar import dinámico para evitar dependencia circular
    let adminUsername = 'admin';
    try {
      const { useStore } = await import('./store');
      adminUsername = useStore.getState().perfil?.loginNormalizado || useStore.getState().perfil?.nombre || 'admin';
    } catch {}
    const transaccion: TransaccionATC = {
      id: uuidv4(),
      loginNormalizado: login,
      tipo: 'AJUSTE_ADMIN',
      monto,
      descripcion: `${motivo || 'Ajuste manual'} — por: ${adminUsername}`,
      semanaISO: semanaISOActual(),
      fecha: new Date().toISOString(),
      procesadoPor: adminUsername,
    } as any;
    // v3.1.0: incluir saldo anterior y nuevo
    (transaccion as any).saldoAnterior = saldoAnterior;
    (transaccion as any).saldoNuevo = saldoAnterior + monto;
    // Ledger best-effort (el ajuste de la wallet ya quedó aplicado)
    await guardarTransacciones([transaccion]).catch(() => undefined);
    await cacheMergeATCTransacciones([transaccion]);

    // v3.1.0: registrar en audit log
    try {
      const { auditAction } = await import('@/app/actions/audit-actions');
      await auditAction({
        accion: 'update',
        tabla: 'atc_wallets',
        registroId: login,
        descripcion: `Ajuste de ${monto >= 0 ? '+' : ''}${monto} ATC a ${login}. Saldo: ${saldoAnterior} → ${saldoAnterior + monto}. Motivo: ${motivo || 'sin motivo'}`,
      });
    } catch {}

    set({ wallets: get().wallets.map((w) => (w.loginNormalizado === login ? walletActualizada : w)) });
    if (get().miWallet?.loginNormalizado === login) set({ miWallet: walletActualizada });

    toast.success(`Ajuste aplicado: ${monto >= 0 ? '+' : ''}${monto} ATC a ${login}. Saldo: ${saldoAnterior} → ${saldoAnterior + monto}`);
  },

  gestionarAdmin: async (uid, agregar) => {
    try {
      if (agregar) {
        await fbAgregarAdmin(uid);
        toast.success('Admin agregado.');
      } else {
        await fbQuitarAdmin(uid);
        toast.success('Admin removido.');
      }
    } catch (e) {
      manejarErrorATC(e, 'No se pudo gestionar el admin.');
    }
  },

  marcarLeida: async (id) => {
    await fbMarcarLeida(id).catch(() => undefined);
    const notificaciones = get().notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n));
    set({ notificaciones });
    await cacheMergeATCNotificaciones(notificaciones.filter((n) => n.id === id));
  },

  marcarTodasLeidas: async () => {
    const noLeidas = get().notificaciones.filter((n) => !n.leida);
    if (noLeidas.length === 0) return;
    await fbMarcarTodas(noLeidas).catch(() => undefined);
    const actualizadas = get().notificaciones.map((n) => ({ ...n, leida: true }));
    set({ notificaciones: actualizadas });
    await cacheMergeATCNotificaciones(noLeidas.map((n) => ({ ...n, leida: true })));
  },

  refrescarMiWallet: () => get().sincronizar(true),
}));

