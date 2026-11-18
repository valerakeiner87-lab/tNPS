// ============================================================
// tNPS Digital Claro Guatemala — Store principal (Zustand)
// Archivo: src/lib/store.ts
// Autenticación nativa con Neon + JWT (sin Firebase), carga de
// archivos, filtros y logout.
// ============================================================
import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  AnalisisAlerta,
  AsesorConsolidado,
  AsesorHC,
  DatosTMO,
  DatosAdherencia,
  DatosHorasRobot,
  DatosBitacora,
  Encuesta,
  FiltroFecha,
  GrupoTNPS,
  KPIS,
  Linea,
  MetadataCarga,
  PerfilUsuario,
} from './types';
import { LINEAS } from './types';
import {
  calcularKPIs,
  calcularKPIsPorLinea,
  consolidarAsesores,
  filtrarPorFecha,
} from './metrics';
import {
  borrarAsesoresHC as fbBorrarAsesoresHC,
  borrarEncuestas as fbBorrarEncuestas,
  borrarTMO as fbBorrarTMO,
  borrarTodaLaBase,
  buscarAsesorHC,
  deduplicarEncuestas,
  eliminarEncuestasDuplicadas as fbEliminarDuplicados,
  guardarAnalisisAlertas,
  guardarAsesoresHCDiferencial,
  guardarEncuestasDiferencial,
  guardarMetadata,
  guardarTMO as fbGuardarTMO,
  leerAnalisisAlertas,
  leerAsesoresHC,
  leerAsesoresHCDesde,
  leerEncuestas,
  leerEncuestasDesde,
  leerMetadata,
  leerTMO,
  migrarLogins as fbMigrarLogins,
} from './firestore-data';
import { parsearHC, parsearQualtrics, parsearTMO, validarEstructuraQualtrics } from './excel-parser';
import type { ResultadoValidacionEstructura } from './excel-parser';
import { normalizarLogin } from './queue-mapping';
import { detectarAgresividad } from './keyword-detector';
import type { Area } from './types';
import { normalizarDocumento } from './utils';
import {
  cacheBorrarEncuestas,
  cacheBorrarAsesoresHC,
  cacheBorrarTMO,
  cacheEstadisticas,
  cacheGuardarAsesoresHC,
  cacheGuardarAsesoresHCSyncTs,
  cacheGuardarEncuestas,
  cacheGuardarEncuestasSyncTs,
  cacheGuardarFullSyncFlag,
  cacheGuardarMetadataTimestamp,
  cacheGuardarPerfilAsesor,
  cacheGuardarTMO,
  cacheIncrementarReadsAhorradas,
  cacheLeerAsesoresHC,
  cacheLeerAsesoresHCSyncTs,
  cacheLeerEncuestas,
  cacheLeerEncuestasSyncTs,
  cacheLeerFullSyncFlag,
  cacheLeerMetadataTimestamp,
  cacheLeerPerfilAsesor,
  cacheLeerTMO,
  cacheMergeAsesoresHC,
  cacheMergeEncuestas,
  cacheVerificarVersion,
} from './cache';
import { useATCStore } from './atc-store';
import type { AuthSession, Rol } from './session';

// API calls (en vez de Server Actions que causaban stack overflow)
async function apiLogin(username: string, password: string, area: 'digital'): Promise<{ ok: boolean; error?: string; session?: AuthSession }> {
  const resp = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, area }),
  });
  return resp.json();
}

async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

async function apiGetSession(): Promise<AuthSession | null> {
  try {
    const resp = await fetch('/api/auth/me', { cache: 'no-store' });
    const data = await resp.json();
    return data.session;
  } catch {
    return null;
  }
}

export type TabId =
  | 'inicio'
  | 'carga'
  | 'global'
  | 'linea'
  | 'asesores'
  | 'alertas'
  | 'patrones'
  | 'tipificaciones'
  | 'mis-encuestas'
  | 'mis-metricas'
  | 'podio-global'
  | 'podio-lob'
  | 'podio-tv'
  | 'calculadora'
  | 'perfil'
  | 'mi-billetera'
  | 'billeteras'
  | 'usuarios'
  | 'admin'
  | 'supervision'
  | 'tmo'
  | 'config-tmo'
  | 'config-atc'
  // v3.0.4
  | 'juegos'
  | 'aprendizaje'
  | 'analisis-impacto'
  | 'formularios'
  | 'config-reinicio'
  // v3.0.5
  | 'dashboard-ejecutivo'
  | 'reportes'
  | 'audit'
  | 'torneos'
  | 'streaks'
  // v3.0.7
  | 'config-juegos'
  // v3.2.0
  | 'metricas'
  // v3.3.0 — Fase 2: nuevos módulos de navegación del asesor y admin
  | 'tnps-resumen'
  | 'tnps-encuestas'
  | 'tnps-calculadora'
  | 'metricas-adherencia-detalle'
  | 'metricas-productividad'
  | 'nomina-consolidado'
  | 'nomina-validacion'
  | 'novedades-reporte'
  | 'wfm-sugerencia'
  | 'admin-validacion'
  | 'admin-novedades'
  | 'admin-wfm'
  // v3.4.3: secciones contenedoras con subpestañas internas
  | 'tnps'
  | 'adherencia'
  | 'nomina';

interface EstadoPrincipal {
  // --- Autenticación (Neon + JWT, sin Firebase) ---
  sesion: AuthSession | null;
  perfil: PerfilUsuario | null;
  perfilAsesor: AsesorHC | null;
  autenticado: boolean;
  inicializandoAuth: boolean;

  // --- Datos crudos ---
  encuestas: Encuesta[];
  asesoresHC: AsesorHC[];
  datosTMO: DatosTMO | null;
  datosAdherencia: DatosAdherencia | null;
  datosHorasRobot: DatosHorasRobot | null;
  datosBitacora: DatosBitacora | null;
  metadata: MetadataCarga | null;

  // --- Datos filtrados / procesados ---
  encuestasFiltradas: Encuesta[];
  asesoresConsolidados: AsesorConsolidado[];
  // Ranking del área (TODOS los asesores del área, sin filtrar por login
  // del asesor logueado — para que el podio lo muestre entre sus pares)
  asesoresRanking: AsesorConsolidado[];
  kpisFiltrados: KPIS;
  kpisPorLinea: Record<Linea, KPIS>;

  // --- Filtros ---
  filtroFecha: FiltroFecha;
  filtroGrupo: GrupoTNPS | 'todos';
  filtroLinea: Linea | 'todas';
  tabActual: TabId;

  // --- Estado de carga ---
  cargandoDatos: boolean;
  procesandoCarga: boolean;
  analizandoAlertas: boolean;

  // --- Alerta de cambio de estructura Qualtrics ---
  alertaEstructuraQualtrics: ResultadoValidacionEstructura | null;
  verDetalleEstructura: boolean;
  setVerDetalleEstructura: (v: boolean) => void;
  descartarAlertaEstructura: () => void;

  // --- Init ---
  iniciarListeners: () => () => void;
  setSesionNeon: (sesion: AuthSession) => void;
  /** Limpia la bandera `debeCambiarPassword` del perfil en memoria
   *  después de que el usuario cambia su contraseña exitosamente. */
  limpiarDebeCambiarPassword: () => void;

  // --- Autenticación ---
  logout: () => Promise<void>;
  setAreaActiva: (area: Area) => void;
  areaActiva: Area;

  // --- Datos ---
  cargarDesdeFirestore: (silencioso?: boolean, forzar?: boolean) => Promise<void>;
  forzarSincronizacion: () => Promise<void>;
  procesar: (archivoHC: File, archivoQualtrics: File) => Promise<void>;
  cargarSoloHC: (archivoHC: File) => Promise<void>;
  cargarSoloQualtrics: (archivoQualtrics: File) => Promise<void>;
  cargarArchivoTMO: (archivoTMO: File) => Promise<void>;
  cargarArchivoAdherencia: (archivo: File) => Promise<void>;
  cargarArchivoHorasRobot: (archivo: File) => Promise<void>;
  cargarArchivoBitacora: (archivo: File) => Promise<void>;
  /**
   * v3.4.2: Procesa TODOS los archivos seleccionados en una sola pasada.
   * Recibe un objeto con los 6 archivos (HC, Qualtrics, TMO, Adherencia,
   * Horas Robot, Bitácora). Los que no estén presentes se omiten.
   * Devuelve un resumen con éxitos, errores y total de archivos procesados.
   */
  procesarTodosArchivos: (archivos: {
    hc?: File | null;
    qualtrics?: File | null;
    tmo?: File | null;
    adherencia?: File | null;
    horasRobot?: File | null;
    bitacora?: File | null;
  }) => Promise<{
    procesados: string[];
    errores: string[];
  }>;
  analizarAlertas: () => Promise<void>;
  borrarDatos: (tipo: 'encuestas' | 'hc' | 'tmo' | 'adherencia' | 'horas-robot' | 'bitacora' | 'todo', clave?: string) => Promise<void>;
  migrarLogins: () => Promise<void>;
  eliminarDuplicados: () => Promise<void>;

  // --- Filtros y navegación ---
  setFiltroFecha: (filtro: FiltroFecha) => void;
  setFiltroGrupo: (grupo: GrupoTNPS | 'todos') => void;
  setFiltroLinea: (linea: Linea | 'todas') => void;
  setTab: (tab: TabId) => void;
  recalcularDatosFiltrados: () => void;
}

function perfilVacio(): Pick<EstadoPrincipal, 'kpisFiltrados' | 'kpisPorLinea'> {
  return { kpisFiltrados: calcularKPIs([]), kpisPorLinea: calcularKPIsPorLinea([]) };
}

/** Resetea por completo el estado de datos/sesión (usado por logout y por el listener) */
function estadoLimpio() {
  return {
    sesion: null,
    perfil: null,
    perfilAsesor: null,
    autenticado: false,
    inicializandoAuth: false,
    areaActiva: 'digital' as Area,
    encuestas: [],
    asesoresHC: [],
    datosTMO: null,
    datosAdherencia: null,
    metadata: null,
    encuestasFiltradas: [],
    asesoresConsolidados: [],
    filtroFecha: { tipo: 'todo' } as FiltroFecha,
    filtroGrupo: 'todos' as GrupoTNPS | 'todos',
    filtroLinea: 'todas' as Linea | 'todas',
    tabActual: 'inicio' as TabId,
    alertaEstructuraQualtrics: null,
    verDetalleEstructura: false,
    ...perfilVacio(),
  };
}

export const useStore = create<EstadoPrincipal>((set, get) => ({
  sesion: null,
  perfil: null,
  perfilAsesor: null,
  autenticado: false,
  inicializandoAuth: true,
  areaActiva: 'digital',

  encuestas: [],
  asesoresHC: [],
  datosTMO: null,
  datosAdherencia: null,
  datosHorasRobot: null,
  datosBitacora: null,
  metadata: null,

  encuestasFiltradas: [],
  asesoresConsolidados: [],
  asesoresRanking: [],
  ...perfilVacio(),

  filtroFecha: { tipo: 'todo' },
  filtroGrupo: 'todos',
  filtroLinea: 'todas',
  tabActual: 'inicio',

  cargandoDatos: false,
  procesandoCarga: false,
  analizandoAlertas: false,

  alertaEstructuraQualtrics: null,
  verDetalleEstructura: false,

  // ------------------------------------------------------------
  // Inicialización: verifica si hay sesión JWT activa al cargar la app
  // ------------------------------------------------------------
  iniciarListeners: () => {
    // Verificar sesión existente (cookie httpOnly) al montar la app
    (async () => {
      try {
        const sesion = await apiGetSession();
        if (sesion) {
          get().setSesionNeon(sesion);
        } else {
          set({ ...estadoLimpio(), inicializandoAuth: false });
        }
      } catch {
        set({ ...estadoLimpio(), inicializandoAuth: false });
      }
    })();
    return () => undefined;
  },

  // ------------------------------------------------------------
  // Setter para cuando el login-panel ejecuta la Server Action
  // directamente y recibe la sesión ya creada.
  // ------------------------------------------------------------
  setSesionNeon: (sesion) => {
    const rol: 'asesor' | 'supervisor' | 'admin' =
      sesion.role === 'ADMIN' ? 'admin' : sesion.role === 'SUPERVISOR' ? 'supervisor' : 'asesor';
    console.log('[Auth] Sesión establecida:', { username: sesion.username, role: sesion.role, rol, area: sesion.area });
    const perfil: PerfilUsuario = {
      uid: sesion.userId,
      email: null,
      rol,
      loginNormalizado: sesion.username,
      nombre: sesion.name,
      // v3.4.3: Propagar documento desde la sesión para que TODAS las
      // vistas (inclusive las que leen perfil.documento en vez de
      // perfilAsesor.documento) tengan el valor correcto.
      documento: sesion.documento || '',
      puedeEscribir: rol !== 'asesor',
      esAdmin: rol === 'admin',
      area: sesion.area,
      // Si el usuario debe cambiar contraseña (primer login o reset),
      // lo propagamos al perfil para que la UI muestre el diálogo.
      debeCambiarPassword: sesion.debeCambiarPassword ?? false,
    };
    // Para los asesores, construir un perfilAsesor sintético a partir
    // de la sesión. Esto es necesario porque recalcularDatosFiltrados
    // filtra por `perfilAsesor.loginNormalizado` y si es null, el
    // asesor vería TODAS las encuestas en vez de solo las suyas.
    // v3.4.3: La sesión ahora incluye documento, lob y supervisor
    // cargados desde AsesorHC al hacer login — se propagan de inmediato
    // para evitar el error "(sin documento)" en las vistas.
    const perfilAsesorSintetico: AsesorHC | null = rol === 'asesor' ? {
      documento: sesion.documento || '',
      nombre: sesion.name || sesion.username,
      usuarioCic: sesion.username,
      usuarioGen: '',
      loginAib: '',
      cargo: '',
      lob: sesion.lob || '',
      linea: undefined,
      supervisor: sesion.supervisor || '',
      jefeOperacion: '',
      fechaIngreso: '',
      ciudad: '',
      sede: '',
      genero: '',
      tipoContrato: '',
      modalidad: '',
      contratacion: '',
      email: '',
      telefono: '',
      origen: 'ACTIVOS',
      loginNormalizado: sesion.username,
    } : null;

    set({
      sesion,
      perfil,
      perfilAsesor: perfilAsesorSintetico,
      autenticado: true,
      inicializandoAuth: false,
      areaActiva: 'digital',
    });
    // Inicializar ATC y cargar datos en background
    const atc = useATCStore.getState();
    atc.inicializar(sesion.username, rol !== 'asesor').catch(() => undefined);
    get().cargarDesdeFirestore(true).catch(() => undefined);
  },

  limpiarDebeCambiarPassword: () => {
    set((state) => ({
      perfil: state.perfil ? { ...state.perfil, debeCambiarPassword: false } : state.perfil,
      sesion: state.sesion ? { ...state.sesion, debeCambiarPassword: false } : state.sesion,
    }));
  },

  setAreaActiva: (area) => {
    // v3.3.0: Solo existe 'digital' como área. La función se conserva
    // para no romper la interfaz, pero siempre asigna 'digital'.
    set({ areaActiva: 'digital' });
    set((state) => ({
      perfil: state.perfil ? { ...state.perfil, area: 'digital' } : state.perfil,
    }));
    get().recalcularDatosFiltrados();
  },

  // ------------------------------------------------------------
  // Cerrar sesión (elimina la cookie JWT via Server Action)
  // ------------------------------------------------------------
  logout: async () => {
    try {
      await apiLogout();
    } catch {
      // Incluso si falla la red, la sesión local se limpia
    } finally {
      set({ ...estadoLimpio(), inicializandoAuth: false });
      useATCStore.getState().cerrarSesionATC();
      toast.info('Sesión cerrada. ¡Hasta pronto!');
    }
  },

  // ------------------------------------------------------------
  // Carga de datos desde Firestore (Cache-First + Delta Sync)
  // ------------------------------------------------------------
  cargarDesdeFirestore: async (silencioso = false, forzar = false) => {
    if (!silencioso) set({ cargandoDatos: true });
    try {
      // v3.0.1: CARGA OPTIMIZADA — los asesores solo cargan SUS encuestas,
      // los supervisores solo las de su área. Antes se cargaban TODAS las
      // encuestas para todos los usuarios (5000), lo que con 50 usuarios
      // concurrentes causaba rate limit 429 en HuggingFace.
      const { perfil, perfilAsesor } = get();
      const esAsesor = perfil?.rol === 'asesor';
      const esSupervisor = perfil?.rol === 'supervisor' || perfil?.rol === 'admin';
      const areaActiva = perfil?.area;

      let encuestas: Encuesta[] = [];
      if (esAsesor && perfilAsesor?.loginNormalizado) {
        // Asesor: solo sus encuestas
        const { leerEncuestasAsesor } = await import('./firestore-data');
        encuestas = await leerEncuestasAsesor(perfilAsesor.loginNormalizado).catch(() => [] as Encuesta[]);
      } else if (esSupervisor && areaActiva) {
        // Supervisor: solo encuestas de su área
        const { leerEncuestasArea } = await import('./firestore-data');
        encuestas = await leerEncuestasArea(areaActiva).catch(() => [] as Encuesta[]);
      } else {
        // Fallback: todas (limitado a 5000)
        encuestas = await leerEncuestas().catch(() => [] as Encuesta[]);
      }

      // v3.0.2: asesores solo cargan SU propio HC, no toda la lista
      let asesoresHC: AsesorHC[] = [];
      if (esAsesor && perfilAsesor?.loginNormalizado) {
        // Asesor: solo su registro HC
        const { leerAsesorHCNeon } = await import('./neon-data');
        const miHC = await leerAsesorHCNeon(perfilAsesor.loginNormalizado).catch(() => null);
        asesoresHC = miHC ? [miHC] : [];
        // Si encontramos el HC real, usarlo en vez del sintético
        if (miHC) {
          set({ perfilAsesor: miHC });
        }
      } else {
        // Supervisor/Admin: cargar lista de HC (limitada a 1000)
        asesoresHC = await leerAsesoresHC().catch(() => [] as AsesorHC[]);
      }

      const [tmo, analisis, metadata] = await Promise.all([
        leerTMO().catch(() => null),
        leerAnalisisAlertas().catch(() => [] as AnalisisAlerta[]),
        leerMetadata().catch(() => null),
      ]);

      // Load adherencia
      try {
        const { leerAdherencia } = await import('./firestore-data');
        const datosAdh = await leerAdherencia();
        if (datosAdh) set({ datosAdherencia: datosAdh });
      } catch {}

      // v3.4.2: Load Horas Robot y Bitácora desde la BD
      try {
        const { leerHorasRobot } = await import('./firestore-data');
        const datosHR = await leerHorasRobot();
        if (datosHR) set({ datosHorasRobot: datosHR });
      } catch {}
      try {
        const { leerBitacora } = await import('./firestore-data');
        const datosBit = await leerBitacora();
        if (datosBit) set({ datosBitacora: datosBit });
      } catch {}

      // v3.4.5: Si el asesor logueado no tiene documento en la sesión
      // (caso donde AsesorHC no se encontró al hacer login), intentar
      // recuperarlo desde Horas Robot (USUARIO CIC → DOCUMENTO) o desde
      // Adherencia (por nombre). Esto resuelve el bug "algunos asesores
      // no ven sus métricas de adherencia".
      const { perfil: perfilActual, perfilAsesor: perfilAsesorActual } = get();
      if (
        perfilActual?.rol === 'asesor' &&
        perfilAsesorActual &&
        !normalizarDocumento(perfilAsesorActual.documento)
      ) {
        const username = (perfilAsesorActual.loginNormalizado || perfilActual.loginNormalizado || '').toLowerCase().trim();
        const nombreAsesor = (perfilAsesorActual.nombre || perfilActual.nombre || '').toUpperCase().trim();
        let documentoEncontrado = '';

        // 1) Buscar en Horas Robot por USUARIO CIC
        const datosHR = get().datosHorasRobot;
        if (datosHR?.registros?.length && username) {
          const match = datosHR.registros.find(
            (r) => (r.usuarioCic || '').toLowerCase().trim() === username
          );
          if (match) documentoEncontrado = normalizarDocumento(match.documento);
        }

        // 2) Fallback: Adherencia por nombre exacto
        if (!documentoEncontrado && nombreAsesor) {
          const datosAdh = get().datosAdherencia;
          if (datosAdh?.metricas?.length) {
            const match = datosAdh.metricas.find(
              (m) => (m.nombre || '').toUpperCase().trim() === nombreAsesor
            );
            if (match) documentoEncontrado = normalizarDocumento(match.documento);
          }
        }

        // 3) Fallback: Horas Robot por nombre exacto
        if (!documentoEncontrado && nombreAsesor) {
          const datosHRfb = get().datosHorasRobot;
          if (datosHRfb?.registros?.length) {
            const match = datosHRfb.registros.find(
              (r) => (r.nombre || '').toUpperCase().trim() === nombreAsesor
            );
            if (match) documentoEncontrado = normalizarDocumento(match.documento);
          }
        }

        if (documentoEncontrado) {
          console.info(`[Auth] Documento recuperado via fallback: ${documentoEncontrado}`);
          set({
            perfil: perfilActual ? { ...perfilActual, documento: documentoEncontrado } : perfilActual,
            perfilAsesor: perfilAsesorActual
              ? { ...perfilAsesorActual, documento: documentoEncontrado }
              : perfilAsesorActual,
          });
        } else {
          console.warn(`[Auth] No se pudo recuperar documento para ${username || nombreAsesor}`);
        }
      }

      // Aplicar análisis de alertas a las encuestas
      const mapaAlertas = new Map(analisis.map((a) => [a.encuestaId, a]));
      const encuestasConAlertas = deduplicarEncuestas(
        encuestas.map((e) => {
          const a = mapaAlertas.get(e.id);
          return a
            ? { ...e, alertaAgresiva: a.agresivo, alertaRazon: a.razon, alertaSeveridad: a.severidad }
            : e;
        })
      );

      set({
        encuestas: encuestasConAlertas,
        asesoresHC,
        datosTMO: tmo,
        metadata,
      });

      // Guardar en caché local para uso offline
      if (encuestasConAlertas.length > 0) {
        await cacheGuardarEncuestas(encuestasConAlertas).catch(() => undefined);
      }
      if (asesoresHC.length > 0) {
        await cacheGuardarAsesoresHC(asesoresHC).catch(() => undefined);
      }
      if (tmo) await cacheGuardarTMO(tmo).catch(() => undefined);
      if (metadata) {
        await cacheGuardarMetadataTimestamp(metadata.fechaCargaTs).catch(() => undefined);
      }
      await cacheGuardarFullSyncFlag(true).catch(() => undefined);

      get().recalcularDatosFiltrados();
      if (forzar) {
        toast.success('Datos sincronizados correctamente.');
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      // Fallback: intentar leer del caché local si la BD falló
      try {
        const [encuestasCache, hcCache, tmoCache] = await Promise.all([
          cacheLeerEncuestas(),
          cacheLeerAsesoresHC(),
          cacheLeerTMO(),
        ]);
        set({
          encuestas: deduplicarEncuestas(encuestasCache),
          asesoresHC: hcCache,
          datosTMO: tmoCache,
        });
        get().recalcularDatosFiltrados();
        if (!silencioso) toast.warning('Usando datos en caché local. Verifica tu conexión.');
      } catch {
        if (!silencioso) toast.error('Error al cargar los datos. Intenta de nuevo.');
      }
      get().recalcularDatosFiltrados();
    } finally {
      set({ cargandoDatos: false });
    }
  },

  // ------------------------------------------------------------
  // Sincronización manual completa (botón "Forzar sincronización")
  // ------------------------------------------------------------
  forzarSincronizacion: async () => {
    // Limpiar cursores/flags para forzar la descarga completa
    await cacheGuardarFullSyncFlag(false).catch(() => undefined);
    await cacheGuardarMetadataTimestamp(0).catch(() => undefined);
    await get().cargarDesdeFirestore(false, true);
  },

  // ------------------------------------------------------------
  // Carga de archivos (pipeline completo)
  // ------------------------------------------------------------
  procesar: async (archivoHC, archivoQualtrics) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      toast.info('Procesando archivos en tu navegador…');

      // 🆕 Validar estructura Qualtrics ANTES de procesar.
      // Si faltan columnas obligatorias, abortar con mensaje claro.
      // Si hay columnas nuevas, alertar pero continuar.
      const validacion = await validarEstructuraQualtrics(archivoQualtrics).catch((e) => {
        console.error('Error validando estructura:', e);
        return null;
      });
      if (validacion) {
        if (!validacion.ok) {
          set({ alertaEstructuraQualtrics: validacion, verDetalleEstructura: true });
          throw new Error(
            `Estructura de Qualtrics no válida: ${validacion.mensaje}`
          );
        }
        if (validacion.estructuraCambiada) {
          // Mostrar alerta pero continuar el procesamiento.
          set({ alertaEstructuraQualtrics: validacion });
          toast.warning('Qualtrics cambió la estructura del archivo. Revisa el detalle en la alerta.', {
            duration: 8000,
            action: {
              label: 'Ver detalle',
              onClick: () => set({ verDetalleEstructura: true }),
            },
          });
        } else {
          // Estructura OK: limpiar alerta anterior si la había.
          set({ alertaEstructuraQualtrics: null });
        }
      }

      const [asesoresHC, encuestas] = await Promise.all([parsearHC(archivoHC), parsearQualtrics(archivoQualtrics)]);

      if (asesoresHC.length === 0) throw new Error('El archivo HC no contiene asesores válidos.');
      if (encuestas.length === 0) throw new Error('El archivo Qualtrics no contiene encuestas válidas.');

      // Escritura diferencial: solo lo nuevo se escribe en Firestore
      const statsHC = await guardarAsesoresHCDiferencial(asesoresHC, get().asesoresHC);
      const statsEnc = await guardarEncuestasDiferencial(encuestas, get().encuestas);

      // v3.0.3: Crear usuarios automáticamente desde el HC
      try {
        const { crearUsuariosDesdeHC } = await import('@/app/actions/neon-actions');
        const resultUsers = await crearUsuariosDesdeHC(asesoresHC);
        if (resultUsers.creados > 0) {
          toast.success(`${resultUsers.creados} usuarios creados automáticamente (password = cédula).`);
        }
      } catch (err) {
        console.warn('No se pudieron crear usuarios desde HC:', err);
      }

      // 🆕 MERGE: el estado y el caché conservan lo ya cargado
      // (subir un archivo nuevo no borra los datos anteriores)
      // DEDUPLICACIÓN: tras el merge, se eliminan duplicados por idTransaccion
      // (por si quedan docs viejos con ID `enc_<n>` conviviendo con `enc_<uuid>`).
      const mapaEnc = new Map(get().encuestas.map((e) => [e.id, e]));
      for (const e of encuestas) mapaEnc.set(e.id, e);
      const mapaHC = new Map(get().asesoresHC.map((a) => [a.documento || a.usuarioCic, a]));
      for (const a of asesoresHC) mapaHC.set(a.documento || a.usuarioCic, a);
      const encuestasFinales = deduplicarEncuestas(Array.from(mapaEnc.values()));
      const asesoresFinales = Array.from(mapaHC.values());

      // Metadata
      const meta: MetadataCarga = {
        fechaCarga: new Date().toISOString(),
        fechaCargaTs: Date.now(),
        totalEncuestas: encuestasFinales.length,
        totalAsesoresHC: asesoresFinales.length,
        archivoHCNombre: archivoHC.name,
        archivoQualtricsNombre: archivoQualtrics.name,
        cargadoPor: perfil.email ?? '—',
        cargadoPorUid: perfil.uid,
        escrituraDiferencial: `HC: ${statsHC.nuevas} nuevos / ${statsHC.actualizadas ?? 0} actualizados / ${statsHC.omitidas} omitidos · Encuestas: ${statsEnc.nuevas} nuevas / ${statsEnc.actualizadas ?? 0} actualizadas / ${statsEnc.omitidas} omitidas`,
      };
      await guardarMetadata(meta);

      // Actualizar caché (merge incremental) y estado
      await Promise.all([
        cacheMergeEncuestas(encuestas),
        cacheMergeAsesoresHC(asesoresHC),
        cacheGuardarEncuestasSyncTs(Date.now()),
        cacheGuardarAsesoresHCSyncTs(Date.now()),
        cacheGuardarMetadataTimestamp(meta.fechaCargaTs),
        cacheGuardarFullSyncFlag(true),
      ]);
      set({ encuestas: encuestasFinales, asesoresHC: asesoresFinales, metadata: meta });

      // Recalcular métricas
      get().recalcularDatosFiltrados();

      // Procesar ATC en background (no bloquea la UI)
      useATCStore.getState().procesarNuevasEncuestas(encuestas).catch(console.error);

      toast.success(`Carga completada: ${statsEnc.nuevas} encuestas nuevas (${statsEnc.actualizadas ?? 0} actualizadas) y ${statsHC.nuevas} asesores nuevos (${statsHC.actualizadas ?? 0} actualizados).`);
      set({ tabActual: 'global' });
    } catch (error) {
      toast.error((error as Error).message || 'Error al procesar los archivos.');
      throw error;
    } finally {
      set({ procesandoCarga: false });
    }
  },

  cargarSoloHC: async (archivoHC) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      const asesoresHC = await parsearHC(archivoHC);
      if (asesoresHC.length === 0) throw new Error('El archivo HC no contiene asesores válidos.');

      const stats = await guardarAsesoresHCDiferencial(asesoresHC, get().asesoresHC);

      // v3.0.3: Crear usuarios automáticamente desde el HC
      // Cada asesor del HC se crea como usuario con rol ASESOR,
      // password = su documento (cédula), y debeCambiarPassword = true
      try {
        const { crearUsuariosDesdeHC } = await import('@/app/actions/neon-actions');
        const resultUsers = await crearUsuariosDesdeHC(asesoresHC);
        if (resultUsers.creados > 0) {
          toast.success(`${resultUsers.creados} usuarios creados automáticamente (password = cédula).`);
        }
      } catch (err) {
        console.warn('No se pudieron crear usuarios desde HC:', err);
      }

      // 🆕 MERGE: conservar los asesores ya cargados
      const mapaHC = new Map(get().asesoresHC.map((a) => [a.documento || a.usuarioCic, a]));
      for (const a of asesoresHC) mapaHC.set(a.documento || a.usuarioCic, a);
      const asesoresFinales = Array.from(mapaHC.values());

      await cacheMergeAsesoresHC(asesoresHC);
      await cacheGuardarAsesoresHCSyncTs(Date.now());

      set({ asesoresHC: asesoresFinales });
      get().recalcularDatosFiltrados();
      toast.success(`HC cargado: ${stats.nuevas} nuevos, ${stats.actualizadas ?? 0} actualizados, ${stats.omitidas} sin cambios.`);
    } catch (error) {
      toast.error((error as Error).message || 'Error al cargar el HC.');
    } finally {
      set({ procesandoCarga: false });
    }
  },

  cargarSoloQualtrics: async (archivoQualtrics) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      // 🆕 Validar estructura antes de procesar
      const validacion = await validarEstructuraQualtrics(archivoQualtrics).catch((e) => {
        console.error('Error validando estructura:', e);
        return null;
      });
      if (validacion) {
        if (!validacion.ok) {
          set({ alertaEstructuraQualtrics: validacion, verDetalleEstructura: true });
          throw new Error(`Estructura de Qualtrics no válida: ${validacion.mensaje}`);
        }
        if (validacion.estructuraCambiada) {
          set({ alertaEstructuraQualtrics: validacion });
          toast.warning('Qualtrics cambió la estructura del archivo. Revisa el detalle en la alerta.', {
            duration: 8000,
            action: {
              label: 'Ver detalle',
              onClick: () => set({ verDetalleEstructura: true }),
            },
          });
        } else {
          set({ alertaEstructuraQualtrics: null });
        }
      }

      const encuestas = await parsearQualtrics(archivoQualtrics);
      if (encuestas.length === 0) throw new Error('El archivo Qualtrics no contiene encuestas válidas.');

      const stats = await guardarEncuestasDiferencial(encuestas, get().encuestas);

      // 🆕 MERGE: conservar las encuestas ya cargadas + deduplicar por idTransaccion
      const mapaEnc = new Map(get().encuestas.map((e) => [e.id, e]));
      for (const e of encuestas) mapaEnc.set(e.id, e);
      const encuestasFinales = deduplicarEncuestas(Array.from(mapaEnc.values()));

      const meta: MetadataCarga = {
        fechaCarga: new Date().toISOString(),
        fechaCargaTs: Date.now(),
        totalEncuestas: encuestasFinales.length,
        totalAsesoresHC: get().asesoresHC.length,
        archivoHCNombre: get().metadata?.archivoHCNombre ?? '—',
        archivoQualtricsNombre: archivoQualtrics.name,
        cargadoPor: perfil.email ?? '—',
        cargadoPorUid: perfil.uid,
        escrituraDiferencial: `Encuestas: ${stats.nuevas} nuevas / ${stats.actualizadas ?? 0} actualizadas / ${stats.omitidas} omitidas`,
      };
      await guardarMetadata(meta);

      await Promise.all([
        cacheMergeEncuestas(encuestas),
        cacheGuardarEncuestasSyncTs(Date.now()),
        cacheGuardarMetadataTimestamp(meta.fechaCargaTs),
        cacheGuardarFullSyncFlag(true),
      ]);
      set({ encuestas: encuestasFinales, metadata: meta });
      get().recalcularDatosFiltrados();

      useATCStore.getState().procesarNuevasEncuestas(encuestas).catch(console.error);
      toast.success(`Qualtrics cargado: ${stats.nuevas} nuevas, ${stats.actualizadas ?? 0} actualizadas, ${stats.omitidas} sin cambios.`);
    } catch (error) {
      toast.error((error as Error).message || 'Error al cargar Qualtrics.');
    } finally {
      set({ procesandoCarga: false });
    }
  },

  cargarArchivoTMO: async (archivoTMO) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      // v3.0: usar parsearTMODaily que devuelve registros diarios por asesor
      // + snapshot agregado para compatibilidad
      const { parsearTMODaily } = await import('./excel-parser');
      const { snapshot: datos, registros } = await parsearTMODaily(archivoTMO, get().asesoresHC);
      if (datos.totalAsesores === 0) throw new Error('No se encontraron datos TMO en el archivo.');

      // Guardar snapshot (compatibilidad)
      await fbGuardarTMO(datos);
      await cacheGuardarTMO(datos);

      // v3.0: guardar registros diarios en la BD (para trend lines)
      // IMPORTANTE: el TMO actualiza TODAS las áreas (digital + telefonico)
      // porque el archivo TMO no separa por área — es un solo archivo para todo.
      // El campo `area` se deriva del LOB en el parser, pero si está vacío
      // (LOB no específico), los registros quedan con area='' y se muestran
      // en ambas áreas.
      try {
        const { guardarTMODaily } = await import('@/app/actions/neon-actions');
        const result = await guardarTMODaily(registros);
        toast.success(
          `TMO cargado: ${datos.totalAsesores} asesores, promedio ${datos.promedioGeneral}s. ` +
          `${result.guardados} registros diarios guardados.` +
          (result.errores > 0 ? ` (${result.errores} errores)` : '')
        );
      } catch (err) {
        console.warn('No se pudieron guardar registros TMO diarios:', err);
        toast.success(`TMO cargado: ${datos.totalAsesores} asesores, promedio ${datos.promedioGeneral}s.`);
      }

      set({ datosTMO: datos });
    } catch (error) {
      toast.error((error as Error).message || 'Error al cargar el TMO.');
    } finally {
      set({ procesandoCarga: false });
    }
  },

  // ------------------------------------------------------------
  // v3.2.0 — Carga de archivo de Adherencia
  // ------------------------------------------------------------
  cargarArchivoAdherencia: async (archivo) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      const { parsearAdherencia } = await import('./excel-parser');
      const datos = await parsearAdherencia(archivo);
      const { guardarAdherencia } = await import('./firestore-data');
      await guardarAdherencia(datos);
      set({ datosAdherencia: datos, procesandoCarga: false });
      toast.success(`Adherencia cargada: ${datos.totalRegistros} registros`);
    } catch (e: any) {
      set({ procesandoCarga: false });
      toast.error(`Error al cargar Adherencia: ${e.message?.substring(0, 100)}`);
    }
  },

  // ------------------------------------------------------------
  // v3.4.0 — Carga de archivo de Horas Robot (Horas robot.xlsx)
  // ------------------------------------------------------------
  cargarArchivoHorasRobot: async (archivo) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      const { parsearHorasRobot } = await import('./excel-parser');
      const datos = await parsearHorasRobot(archivo);
      // v3.4.2: Persistir en BD
      const { guardarHorasRobot } = await import('./firestore-data');
      await guardarHorasRobot(datos);
      set({ datosHorasRobot: datos, procesandoCarga: false });
      toast.success(`Horas Robot cargadas: ${datos.totalRegistros} registros`);
    } catch (e: any) {
      set({ procesandoCarga: false });
      toast.error(`Error al cargar Horas Robot: ${e.message?.substring(0, 100)}`);
    }
  },

  // ------------------------------------------------------------
  // v3.4.0 — Carga de archivo de Bitácora (Deslogueos Autorizados)
  // ------------------------------------------------------------
  cargarArchivoBitacora: async (archivo) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      const { parsearBitacora } = await import('./excel-parser');
      const datos = await parsearBitacora(archivo);
      // v3.4.2: Persistir en BD
      const { guardarBitacora } = await import('./firestore-data');
      await guardarBitacora(datos);
      set({ datosBitacora: datos, procesandoCarga: false });
      toast.success(`Bitácora cargada: ${datos.totalRegistros} deslogueos`);
    } catch (e: any) {
      set({ procesandoCarga: false });
      toast.error(`Error al cargar Bitácora: ${e.message?.substring(0, 100)}`);
    }
  },

  // ------------------------------------------------------------
  // v3.4.2 — Procesar TODOS los archivos en una sola pasada
  // ------------------------------------------------------------
  procesarTodosArchivos: async (archivos) => {
    const { perfil } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para cargar archivos.');
      return { procesados: [], errores: [] };
    }
    const procesados: string[] = [];
    const errores: string[] = [];

    set({ procesandoCarga: true });

    // 1. HC + Qualtrics (carga principal)
    if (archivos.hc && archivos.qualtrics) {
      try {
        await get().procesar(archivos.hc, archivos.qualtrics);
        procesados.push('HC + Qualtrics');
      } catch (e: any) {
        errores.push(`HC + Qualtrics: ${e.message?.substring(0, 60)}`);
      }
    } else {
      if (archivos.hc) {
        try {
          await get().cargarSoloHC(archivos.hc);
          procesados.push('HC');
        } catch (e: any) {
          errores.push(`HC: ${e.message?.substring(0, 60)}`);
        }
      }
      if (archivos.qualtrics) {
        try {
          await get().cargarSoloQualtrics(archivos.qualtrics);
          procesados.push('Qualtrics Digital');
        } catch (e: any) {
          errores.push(`Qualtrics: ${e.message?.substring(0, 60)}`);
        }
      }
    }

    // 2. TMO
    if (archivos.tmo) {
      try {
        await get().cargarArchivoTMO(archivos.tmo);
        procesados.push('TMO');
      } catch (e: any) {
        errores.push(`TMO: ${e.message?.substring(0, 60)}`);
      }
    }

    // 3. Adherencia
    if (archivos.adherencia) {
      try {
        await get().cargarArchivoAdherencia(archivos.adherencia);
        procesados.push('Adherencia');
      } catch (e: any) {
        errores.push(`Adherencia: ${e.message?.substring(0, 60)}`);
      }
    }

    // 4. Horas Robot
    if (archivos.horasRobot) {
      try {
        await get().cargarArchivoHorasRobot(archivos.horasRobot);
        procesados.push('Horas Robot');
      } catch (e: any) {
        errores.push(`Horas Robot: ${e.message?.substring(0, 60)}`);
      }
    }

    // 5. Bitácora
    if (archivos.bitacora) {
      try {
        await get().cargarArchivoBitacora(archivos.bitacora);
        procesados.push('Bitácora');
      } catch (e: any) {
        errores.push(`Bitácora: ${e.message?.substring(0, 60)}`);
      }
    }

    set({ procesandoCarga: false });

    if (procesados.length === 0) {
      toast.info('No se seleccionó ningún archivo.');
    } else if (errores.length === 0) {
      toast.success(`${procesados.length} archivo(s) procesados: ${procesados.join(', ')}.`);
    } else {
      toast.warning(
        `${procesados.length} procesados, ${errores.length} con error. Revisa el panel para ver el detalle.`
      );
    }

    return { procesados, errores };
  },

  // ------------------------------------------------------------
  // Análisis de alertas (detección de agresividad por keywords)
  // ------------------------------------------------------------
  analizarAlertas: async () => {
    const { perfil, encuestas } = get();
    if (!perfil?.puedeEscribir) {
      toast.error('No tienes permisos para ejecutar el análisis.');
      return;
    }
    if (encuestas.length === 0) {
      toast.error('No hay encuestas para analizar.');
      return;
    }
    set({ analizandoAlertas: true });
    try {
      const analisis: AnalisisAlerta[] = [];
      const encuestasActualizadas = encuestas.map((e) => {
        const resultado = detectarAgresividad(e.razon, e.comentarioSolucion, e.comentarioAdicional);
        analisis.push({
          encuestaId: e.id,
          agresivo: resultado.agresivo,
          razon: resultado.razon,
          severidad: resultado.severidad,
        });
        return {
          ...e,
          alertaAgresiva: resultado.agresivo,
          alertaRazon: resultado.razon,
          alertaSeveridad: resultado.severidad,
        };
      });

      // 🆕 ESCRITURA DIFERENCIAL: solo se escriben en Firestore los
      // análisis que cambiaron respecto a lo ya guardado; lo que ya
      // está en la BD con el mismo resultado se omite.
      const cambiadas = analisis.filter((a) => {
        const enc = encuestas.find((e) => e.id === a.encuestaId);
        if (!enc) return true;
        return (
          enc.alertaAgresiva !== a.agresivo ||
          enc.alertaRazon !== a.razon ||
          enc.alertaSeveridad !== a.severidad
        );
      });
      await guardarAnalisisAlertas(cambiadas);

      await cacheMergeEncuestas(encuestasActualizadas);
      set({ encuestas: encuestasActualizadas });
      get().recalcularDatosFiltrados();

      const totalAlertas = analisis.filter((a) => a.agresivo).length;
      toast.success(
        totalAlertas > 0
          ? `Análisis completado: ${totalAlertas} encuestas con comentarios agresivos (${cambiadas.length} escrituras, resto omitido).`
          : 'Análisis completado: no se detectaron comentarios agresivos.'
      );
    } catch {
      toast.error('Error al ejecutar el análisis de alertas.');
    } finally {
      set({ analizandoAlertas: false });
    }
  },

  // ------------------------------------------------------------
  // Borrado de datos (zona de peligro)
  // ------------------------------------------------------------
  borrarDatos: async (tipo, clave) => {
    const { perfil } = get();
    if (!perfil?.esAdmin) {
      toast.error('Solo un administrador puede borrar datos.');
      return;
    }
    try {
      // v3.2.1: Usar la server action que valida la clave administrativa
      const { borrarDatos: actionBorrarDatos } = await import('@/app/actions/neon-actions');
      await actionBorrarDatos(tipo, clave || '');

      // Limpiar caché local
      if (tipo === 'encuestas' || tipo === 'todo') await cacheBorrarEncuestas();
      if (tipo === 'hc' || tipo === 'todo') await cacheBorrarAsesoresHC();
      if (tipo === 'tmo' || tipo === 'todo') await cacheBorrarTMO();
      // El borrado total también resetea el módulo ATC local para que
      // la próxima sincronización reparta desde cero.
      if (tipo === 'todo') {
        const { cacheBorrarATC } = await import('./cache');
        await cacheBorrarATC();
        await useATCStore.getState().sincronizar(true).catch(() => undefined);
      }

      set({
        encuestas: tipo === 'encuestas' || tipo === 'todo' ? [] : get().encuestas,
        asesoresHC: tipo === 'hc' || tipo === 'todo' ? [] : get().asesoresHC,
        datosTMO: tipo === 'tmo' || tipo === 'todo' ? null : get().datosTMO,
        datosAdherencia: tipo === 'adherencia' || tipo === 'todo' ? null : get().datosAdherencia,
        datosHorasRobot: tipo === 'horas-robot' || tipo === 'todo' ? null : get().datosHorasRobot,
        datosBitacora: tipo === 'bitacora' || tipo === 'todo' ? null : get().datosBitacora,
        metadata: tipo === 'todo' ? null : get().metadata,
      });
      get().recalcularDatosFiltrados();
      toast.success('Datos eliminados correctamente.');
      if (clave) console.info('Borrado autorizado con clave.');
    } catch {
      toast.error('Error al borrar los datos.');
    }
  },

  // ------------------------------------------------------------
  // Migración de logins (re-normalización de datos existentes)
  // ------------------------------------------------------------
  migrarLogins: async () => {
    const { perfil } = get();
    if (!perfil?.esAdmin) {
      toast.error('Solo un administrador puede ejecutar la migración.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      toast.info('Iniciando migración de logins…');
      const resultado = await fbMigrarLogins(normalizarLogin, (recibidas, total) => {
        if (recibidas % 400 === 0 || recibidas === total) {
          console.info(`Migración: ${recibidas}/${total} docs procesados`);
        }
      });

      // Recargar datos desde Firestore para reflejar los cambios
      await get().cargarDesdeFirestore(false, true);
      toast.success(
        `Migración completada: ${resultado.encuestasMigradas} encuestas y ${resultado.hcMigrados} asesores HC actualizados.`
      );
    } catch (error) {
      console.error('Error en migración:', error);
      toast.error('Error al ejecutar la migración de logins.');
    } finally {
      set({ procesandoCarga: false });
    }
  },

  // ------------------------------------------------------------
  // Eliminación de duplicados en Firestore
  // ------------------------------------------------------------
  eliminarDuplicados: async () => {
    const { perfil } = get();
    if (!perfil?.esAdmin) {
      toast.error('Solo un administrador puede ejecutar la limpieza.');
      return;
    }
    set({ procesandoCarga: true });
    try {
      toast.info('Buscando y eliminando encuestas duplicadas…');
      const resultado = await fbEliminarDuplicados((proc, total) => {
        if (proc % 400 === 0 || proc === total) {
          console.info(`Eliminación: ${proc}/${total} duplicados borrados`);
        }
      });

      // Forzar recarga completa desde Firestore (sin delta)
      await get().cargarDesdeFirestore(false, true);
      toast.success(
        `Limpieza completada: ${resultado.duplicadosBorrados} duplicados eliminados de ${resultado.totalDocs} docs. Quedan ${resultado.idTransaccionUnicos} encuestas únicas.`
      );
    } catch (error) {
      console.error('Error eliminando duplicados:', error);
      toast.error('Error al eliminar duplicados.');
    } finally {
      set({ procesandoCarga: false });
    }
  },

  // ------------------------------------------------------------
  // Filtros y recálculo
  // ------------------------------------------------------------
  setFiltroFecha: (filtro) => {
    set({ filtroFecha: filtro });
    get().recalcularDatosFiltrados();
  },

  setFiltroGrupo: (grupo) => {
    set({ filtroGrupo: grupo });
    get().recalcularDatosFiltrados();
  },

  setFiltroLinea: (linea) => {
    set({ filtroLinea: linea });
    get().recalcularDatosFiltrados();
  },

  setTab: (tab) => set({ tabActual: tab }),

  setVerDetalleEstructura: (v) => set({ verDetalleEstructura: v }),
  descartarAlertaEstructura: () => set({ alertaEstructuraQualtrics: null, verDetalleEstructura: false }),

  recalcularDatosFiltrados: () => {
    const { encuestas, asesoresHC, filtroFecha, filtroGrupo, filtroLinea, perfil, perfilAsesor } = get();

    // DEDUPLICACIÓN: por si el estado aún tiene duplicados (legacy),
    // los eliminamos antes de filtrar para que KPIs y ranking sean correctos.
    const encuestasDedup = deduplicarEncuestas(encuestas);

    // v3.3.0: Solo existe el área Digital — no se filtra por área.
    let base = encuestasDedup;

    // Base: los asesores solo ven sus propias encuestas.
    // SAFETY NET: si las encuestas en Firestore tienen un loginNormalizado
    // antiguo (no normalizado con la función actual), también comparamos
    // normalizando `e.usuario` al vuelo. Esto evita que un asesor se quede
    // sin sus encuestas si la migración de logins aún no se ha ejecutado.
    if (perfil?.rol === 'asesor' && perfilAsesor?.loginNormalizado) {
      const login = perfilAsesor.loginNormalizado;
      base = base.filter((e) => {
        if (e.loginNormalizado === login) return true;
        // Fallback: renormalizar el `usuario` original de la encuesta
        const altLogin = normalizarLogin(e.usuario || '');
        return altLogin === login;
      });
    }

    // Filtro por fecha
    let filtradas = filtrarPorFecha(base, filtroFecha);
    // Filtro por línea
    if (filtroLinea !== 'todas') {
      filtradas = filtradas.filter((e) => e.linea === filtroLinea);
    }
    // Filtro por grupo
    if (filtroGrupo !== 'todos') {
      filtradas = filtradas.filter((e) => e.grupo === filtroGrupo);
    }

    // Para los KPIs globales no se aplica el filtro de grupo (los 3 grupos cuentan)
    const paraKPIs = filtroGrupo === 'todos' ? filtradas : filtrarPorFecha(base, filtroFecha).filter((e) => (filtroLinea === 'todas' ? true : e.linea === filtroLinea));

    // RANKING DEL ÁREA: TODOS los asesores (sin filtrar por login del
    // asesor logueado). Esto permite que el podio muestre al asesor
    // comparado con sus pares. v3.3.0: solo área Digital.
    const encuestasAreaCompleta = filtrarPorFecha(encuestasDedup, filtroFecha);
    const paraRanking = filtroGrupo === 'todos'
      ? encuestasAreaCompleta
      : encuestasAreaCompleta.filter((e) => (filtroLinea === 'todas' ? true : e.linea === filtroLinea));
    const asesoresRanking = consolidarAsesores(paraRanking, asesoresHC);

    set({
      encuestasFiltradas: filtradas,
      kpisFiltrados: calcularKPIs(paraKPIs),
      kpisPorLinea: calcularKPIsPorLinea(paraKPIs),
      asesoresConsolidados: consolidarAsesores(paraKPIs, asesoresHC),
      asesoresRanking,
    });
  },
}));

/** Estadísticas del caché (para el panel de administración) */
export async function obtenerEstadisticasCache() {
  return cacheEstadisticas();
}

/** Líneas disponibles con datos */
export function lineasDisponibles(kpisPorLinea: Record<Linea, KPIS>): Linea[] {
  return LINEAS.filter((l) => kpisPorLinea[l].total > 0);
}

// En desarrollo: exponer stores para depuración/verificación (como Redux DevTools).
// En el build de producción (NODE_ENV=production) esto no existe.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const w = window as unknown as Record<string, unknown>;
  w.__TNPS_STORE__ = useStore;
  w.__TNPS_ATC__ = useATCStore;
}
