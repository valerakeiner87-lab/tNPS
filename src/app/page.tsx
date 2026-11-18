'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertOctagon, Bell, BarChart3, Clock, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { LoginPanel } from '@/components/tnps/login-panel';
import { InicioPanel } from '@/components/tnps/inicio-panel';
import { UploadPanel } from '@/components/tnps/upload-panel';
import { DashboardGlobal } from '@/components/tnps/dashboard-global';
import { DashboardLinea } from '@/components/tnps/dashboard-linea';
import { AsesoresView } from '@/components/tnps/asesores-view';
import { AlertasView } from '@/components/tnps/alertas-view';
import { PatronesView } from '@/components/tnps/patrones-view';
import { TipificacionesView } from '@/components/tnps/tipificaciones-view';
import { PodioGlobal } from '@/components/tnps/podio-global';
import { PodioTV } from '@/components/tnps/podio-tv';
import { MiBilleteraView } from '@/components/tnps/mi-billetera-view';
import { BilleterasAdminView } from '@/components/tnps/billeteras-admin-view';
import { GestionUsuariosView } from '@/components/tnps/gestion-usuarios-view';
import { PerfilView } from '@/components/tnps/perfil-view';
import { AdminView } from '@/components/tnps/admin-view';
import { PanelSupervisor } from '@/components/tnps/panel-supervisor';
import { FiltroFechas } from '@/components/tnps/filtro-fechas';
import { FiltroGrupo } from '@/components/tnps/filtro-grupo';
import { ThemeToggle } from '@/components/tnps/theme-toggle';
import { CambiarPasswordDialog } from '@/components/tnps/cambiar-password-dialog';
// v3.0.9
import { NovedadesDialog } from '@/components/tnps/novedades-dialog';
import { ConfigurarPreguntasDialog } from '@/components/tnps/configurar-preguntas-dialog';
import { tienePreguntasSeguridadAction } from '@/app/actions/security-actions';
import {
  SidebarNavigation,
  getTabsVisibles,
} from '@/components/tnps/sidebar-navigation';
import { TMOConfigView } from '@/components/tnps/tmo-config-view';
import { TMOView } from '@/components/tnps/tmo-view';
import { ConfigReinicioView } from '@/components/tnps/config-reinicio-view';
import { ConfigJuegosView } from '@/components/tnps/config-juegos-view';
import { AnalisisImpactoView } from '@/components/tnps/analisis-impacto-view';
import { JuegosView } from '@/components/tnps/juegos-view';
import { FormulariosAdminView } from '@/components/tnps/formularios-admin-view';
// v3.0.5
import { DashboardEjecutivo } from '@/components/tnps/dashboard-ejecutivo';
import { ReportesView } from '@/components/tnps/reportes-view';
import { AuditView } from '@/components/tnps/audit-view';
import { TorneosView } from '@/components/tnps/torneos-view';
import { MetricasAdherenciaView } from '@/components/tnps/metricas-adherencia-view';
// v3.3.0 Fase 2 — nuevos módulos de navegación
import { TnpsResumenView } from '@/components/tnps/tnps-resumen-view';
import { TnpsEncuestasView } from '@/components/tnps/tnps-encuestas-view';
import { TnpsCalculadoraView } from '@/components/tnps/tnps-calculadora-view';
import { MetricasAdherenciaDetalleView } from '@/components/tnps/metricas-adherencia-detalle-view';
import { MetricasProductividadView } from '@/components/tnps/metricas-productividad-view';
import { NominaConsolidadoView } from '@/components/tnps/nomina-consolidado-view';
import { NominaValidacionView } from '@/components/tnps/nomina-validacion-view';
import { NovedadesReporteView } from '@/components/tnps/novedades-reporte-view';
import { WfmSugerenciaView } from '@/components/tnps/wfm-sugerencia-view';
import { AdminValidacionView } from '@/components/tnps/admin-validacion-view';
import { AdminNovedadesView } from '@/components/tnps/admin-novedades-view';
import { AdminWfmView } from '@/components/tnps/admin-wfm-view';
// v3.4.3 — Secciones contenedoras con subpestañas internas
import { TnpsSection } from '@/components/tnps/tnps-section';
import { AdherenciaSection } from '@/components/tnps/adherencia-section';
import { NominaSection } from '@/components/tnps/nomina-section';

export default function Page() {
  const autenticado = useStore((s) => s.autenticado);
  const inicializandoAuth = useStore((s) => s.inicializandoAuth);
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const tabActual = useStore((s) => s.tabActual);
  const setTab = useStore((s) => s.setTab);
  const logout = useStore((s) => s.logout);
  const iniciarListeners = useStore((s) => s.iniciarListeners);

  const notificaciones = useATCStore((s) => s.notificaciones);
  const marcarTodasLeidas = useATCStore((s) => s.marcarTodasLeidas);
  const marcarLeida = useATCStore((s) => s.marcarLeida);

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  // CRÍTICO: prevenir hydration mismatch.
  const [mounted, setMounted] = useState(false);
  // v3.0.8: última actualización de encuestas
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>('');
  const [mostrarBannerReload, setMostrarBannerReload] = useState(false);
  // v3.0.9: control de flujos post-login (novedades → password → preguntas)
  const [novedadesCerradas, setNovedadesCerradas] = useState(false);
  const [mostrarPreguntasDialog, setMostrarPreguntasDialog] = useState(false);
  const preguntasVerificadasRef = useRef(false);

  useEffect(() => {
    const unsubscribe = iniciarListeners();
    Promise.resolve().then(() => setMounted(true));

    // v3.0.9: Verificar versión del servidor (detectar deploys nuevos)
    // El navegador puede tener caché vieja de JS chunks con hashes antiguos.
    // Si la versión cambió, forzamos un hard reload para descargar los nuevos chunks.
    fetch('/api/version')
      .then((r) => r.json())
      .then((data) => {
        const serverVersion = data.version;
        const cachedVersion = localStorage.getItem('atc-build-version');
        if (cachedVersion && cachedVersion !== serverVersion) {
          console.log('Nueva versión detectada, recargando...');
          localStorage.setItem('atc-build-version', serverVersion);
          window.location.reload();
          return;
        }
        if (!cachedVersion) {
          localStorage.setItem('atc-build-version', serverVersion);
        }
      })
      .catch(() => undefined);

    // v3.0.8: Auto-reload cuando se detecta "Failed to find Server Action"
    // Esto ocurre cuando el navegador tiene caché vieja de un deploy anterior.
    // La solución es recargar la página automáticamente.
    const handlerError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (msg.includes('Failed to find Server Action') || msg.includes('was not found on the server')) {
        console.warn('Server Action mismatch detectado — recargando página...');
        // Solo recargar una vez (evitar bucle)
        const yaRecargado = sessionStorage.getItem('atc-auto-reloaded');
        if (!yaRecargado) {
          sessionStorage.setItem('atc-auto-reloaded', '1');
          window.location.reload();
        } else {
          // Si ya se recargó una vez y sigue fallando, mostrar banner
          setMostrarBannerReload(true);
          sessionStorage.removeItem('atc-auto-reloaded');
        }
      }
    };
    window.addEventListener('error', handlerError);

    // También capturar errores de unhandledrejection (las server actions fallan como promises)
    const handlerRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || '');
      if (msg.includes('Failed to find Server Action') || msg.includes('was not found on the server')) {
        console.warn('Server Action mismatch (promise) — recargando página...');
        const yaRecargado = sessionStorage.getItem('atc-auto-reloaded');
        if (!yaRecargado) {
          sessionStorage.setItem('atc-auto-reloaded', '1');
          window.location.reload();
        } else {
          setMostrarBannerReload(true);
          sessionStorage.removeItem('atc-auto-reloaded');
        }
      }
    };
    window.addEventListener('unhandledrejection', handlerRejection);

    // Limpiar el flag después de 30 segundos (si no hubo error, permitir futuros reloads)
    const timer = setTimeout(() => {
      sessionStorage.removeItem('atc-auto-reloaded');
    }, 30000);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('error', handlerError);
      window.removeEventListener('unhandledrejection', handlerRejection);
      clearTimeout(timer);
    };
  }, [iniciarListeners]);

  // v3.0.8: Cargar fecha de última actualización de encuestas
  const cargarUltimaActualizacion = useCallback(async () => {
    try {
      const { getMetadata } = await import('@/app/actions/neon-actions');
      const meta = await getMetadata();
      if (meta?.fechaCargaTs) {
        const d = new Date(Number(meta.fechaCargaTs));
        setUltimaActualizacion(
          d.toLocaleString('es-GT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } else if (meta?.fechaCarga) {
        try {
          const d = new Date(meta.fechaCarga);
          setUltimaActualizacion(
            d.toLocaleString('es-GT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        } catch {
          setUltimaActualizacion(meta.fechaCarga);
        }
      }
    } catch {
      // Silencioso — no es crítico
    }
  }, []);

  useEffect(() => {
    if (autenticado) {
      cargarUltimaActualizacion();
      // Actualizar cada 5 minutos
      const interval = setInterval(cargarUltimaActualizacion, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autenticado, cargarUltimaActualizacion]);

  // v3.0.9: Después de cerrar la ventana de novedades, si el usuario NO necesita
  // cambiar contraseña, verificar si le faltan preguntas de seguridad.
  // Si le faltan, mostrar el diálogo standalone de configuración de preguntas.
  useEffect(() => {
    if (!novedadesCerradas) return;
    if (perfil?.debeCambiarPassword) return; // CambiarPasswordDialog lo maneja
    if (preguntasVerificadasRef.current) return;
    preguntasVerificadasRef.current = true;
    tienePreguntasSeguridadAction()
      .then((tiene) => {
        if (!tiene) {
          setMostrarPreguntasDialog(true);
        }
      })
      .catch(() => undefined);
  }, [novedadesCerradas, perfil?.debeCambiarPassword]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 header-claro text-white">
        <Loader2 className="h-10 w-10 animate-spin text-white/90" aria-hidden />
        <p className="text-lg font-semibold">ATC · Claro Guatemala</p>
      </div>
    );
  }

  if (inicializandoAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 header-claro text-white">
        <Loader2 className="h-10 w-10 animate-spin text-white/90" aria-hidden />
        <p className="text-lg font-semibold">ATC Digital · Claro Guatemala</p>
        <p className="text-sm text-white/70">Iniciando sesión…</p>
      </div>
    );
  }

  // Login
  if (!autenticado) {
    return <LoginPanel />;
  }

  const rol = perfil?.rol ?? 'asesor';
  const tabsVisibles = getTabsVisibles(rol);
  const tabDef = tabsVisibles.find((t) => t.id === tabActual);
  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const nombreUsuario =
    rol === 'asesor'
      ? perfilAsesor?.nombre ?? perfil?.nombre ?? perfil?.loginNormalizado ?? 'Asesor'
      : perfil?.nombre ?? perfil?.email ?? 'Usuario';

  const nombreRol = rol === 'admin' ? 'Administrador' : rol === 'supervisor' ? 'Supervisor' : 'Asesor';

  return (
    <div className="min-h-screen flex">
      {/* v3.0.8: Banner de recarga si las Server Actions fallan después de auto-reload */}
      {mostrarBannerReload && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-3 shadow-lg">
          <span>⚠️ La app se actualizó. Recarga la página para usar la última versión.</span>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={() => {
              sessionStorage.removeItem('atc-auto-reloaded');
              window.location.reload();
            }}
          >
            <RefreshCw className="h-3 w-3" /> Recargar ahora
          </Button>
        </div>
      )}

      {/* ============ SIDEBAR ============ */}
      <SidebarNavigation
        rol={rol}
        tabActual={tabActual}
        setTab={setTab}
        nombreUsuario={nombreUsuario}
        nombreRol={nombreRol}
        onSalir={() => setConfirmandoSalida(true)}
        noLeidas={noLeidas}
      />

      {/* ============ CONTENIDO PRINCIPAL ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ============ HEADER ============ */}
        <header className="header-claro text-white sticky top-0 z-40 shadow-lg">
          <div className="px-3 sm:px-6 py-3 flex items-center gap-3">
            {/* Logo compacto (el sidebar ya tiene el grande) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 leading-none">
                  Claro Guatemala
                </p>
                <h1 className="text-lg font-bold leading-tight truncate">
                  ATC Digital
                  <span className="hidden sm:inline text-white/60 font-normal text-sm ml-2">
                    · {tabDef?.etiqueta ?? ''}
                  </span>
                </h1>
              </div>
            </div>

            {/* Acciones del header */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {/* v3.0.8: Fecha de última actualización de encuestas — visible para todos */}
              {ultimaActualizacion && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-white/70 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/10">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">
                    <span className="text-white/50">Actualizado:</span>{' '}
                    <span className="font-medium text-white/90">{ultimaActualizacion}</span>
                  </span>
                </div>
              )}

              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium truncate max-w-44">{nombreUsuario}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                  {nombreRol}
                </span>
              </div>

              {/* Campana de notificaciones */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Notificaciones (${noLeidas} sin leer)`}
                    className="relative border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Bell className="h-4 w-4" />
                    {noLeidas > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center animar-latido">
                        {noLeidas > 99 ? '99+' : noLeidas}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    {noLeidas > 0 && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => marcarTodasLeidas()}
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>
                  <ScrollArea className="h-72">
                    {notificaciones.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Sin notificaciones por ahora.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {notificaciones.slice(0, 30).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => !n.leida && marcarLeida(n.id)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors',
                              !n.leida && 'bg-primary/5'
                            )}
                          >
                            <p className="font-medium flex items-center gap-1.5">
                              {!n.leida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden />}
                              {n.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensaje}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(n.creado).toLocaleString('es-GT')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <ThemeToggle />
            </div>
          </div>

        </header>

        {/* v3.0.8: Timestamp de última actualización visible en móvil */}
        {ultimaActualizacion && (
          <div className="md:hidden bg-muted/50 border-b px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Última actualización de encuestas: <strong className="text-foreground">{ultimaActualizacion}</strong></span>
          </div>
        )}

        {/* ============ CONTENIDO ============ */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 space-y-4">
          {/* Barra de filtros */}
          {tabDef?.muestraFiltros && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 sticky top-[88px] z-30 shadow-sm">
              <FiltroFechas />
              <div className="hidden sm:block w-px h-6 bg-border" />
              <FiltroGrupo />
            </div>
          )}

          {/* Contenido según pestaña */}
          {tabActual === 'inicio' && <InicioPanel />}
          {tabActual === 'metricas' && <MetricasAdherenciaView />}
          {tabActual === 'supervision' && <PanelSupervisor />}
          {tabActual === 'carga' && <UploadPanel />}
          {tabActual === 'global' && <DashboardGlobal />}
          {tabActual === 'linea' && <DashboardLinea />}
          {tabActual === 'asesores' && <AsesoresView />}
          {tabActual === 'tmo' && <TMOView />}
          {tabActual === 'alertas' && <AlertasView />}
          {tabActual === 'patrones' && <PatronesView />}
          {tabActual === 'tipificaciones' && <TipificacionesView />}
          {tabActual === 'podio-global' && <PodioGlobal />}
          {tabActual === 'podio-tv' && <PodioTV />}
          {tabActual === 'perfil' && <PerfilView />}
          {tabActual === 'mi-billetera' && <MiBilleteraView />}
          {tabActual === 'billeteras' && <BilleterasAdminView />}
          {tabActual === 'usuarios' && <GestionUsuariosView />}
          {tabActual === 'config-tmo' && <TMOConfigView />}
          {tabActual === 'config-atc' && <AdminView initialTab="config" />}
          {tabActual === 'config-reinicio' && <ConfigReinicioView />}
          {tabActual === 'config-juegos' && <ConfigJuegosView />}
          {tabActual === 'analisis-impacto' && <AnalisisImpactoView />}
          {tabActual === 'formularios' && <FormulariosAdminView />}
          {tabActual === 'admin' && <AdminView />}
          {tabActual === 'juegos' && <JuegosView />}
          {/* v3.0.5 */}
          {tabActual === 'dashboard-ejecutivo' && <DashboardEjecutivo />}
          {tabActual === 'reportes' && <ReportesView />}
          {tabActual === 'audit' && <AuditView />}
          {tabActual === 'torneos' && <TorneosView />}
          {/* v3.3.0 Fase 2 — nuevos módulos de navegación */}
          {/* v3.4.3 — Secciones contenedoras con subpestañas internas */}
          {tabActual === 'tnps' && <TnpsSection />}
          {tabActual === 'adherencia' && <AdherenciaSection />}
          {tabActual === 'nomina' && <NominaSection />}
          {/* Subpestañas internas (routing directo para atajos) */}
          {tabActual === 'tnps-resumen' && <TnpsResumenView />}
          {tabActual === 'tnps-encuestas' && <TnpsEncuestasView />}
          {tabActual === 'tnps-calculadora' && <TnpsCalculadoraView />}
          {tabActual === 'metricas-adherencia-detalle' && <MetricasAdherenciaDetalleView />}
          {tabActual === 'metricas-productividad' && <MetricasProductividadView />}
          {tabActual === 'nomina-consolidado' && <NominaConsolidadoView />}
          {tabActual === 'nomina-validacion' && <NominaValidacionView />}
          {tabActual === 'novedades-reporte' && <NovedadesReporteView />}
          {tabActual === 'wfm-sugerencia' && <WfmSugerenciaView />}
          {tabActual === 'admin-validacion' && <AdminValidacionView />}
          {tabActual === 'admin-novedades' && <AdminNovedadesView />}
          {tabActual === 'admin-wfm' && <AdminWfmView />}
        </main>

        {/* ============ FOOTER ============ */}
        <footer className="mt-auto header-claro text-white/70 text-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
            <p>ATC Digital · Contact Center Claro Guatemala</p>
            <p className="flex items-center gap-2">
              <span>ATC Digital · Claro Guatemala</span>
            </p>
          </div>
        </footer>
      </div>

      {/* v3.0.9: Ventana de novedades (aparece primero, una sola vez por usuario) */}
      <NovedadesDialog onCerrado={() => setNovedadesCerradas(true)} />

      {/* Diálogo forzado de cambio de contraseña
          (solo después de cerrar novedades, para mantener el orden) */}
      {novedadesCerradas && <CambiarPasswordDialog />}

      {/* v3.0.9: Diálogo standalone de preguntas de seguridad
          (aparece cuando no debe cambiar password pero le faltan preguntas) */}
      {novedadesCerradas && mostrarPreguntasDialog && (
        <ConfigurarPreguntasDialog onGuardado={() => setMostrarPreguntasDialog(false)} />
      )}

      {/* ============ CONFIRMACIÓN DE SALIDA ============ */}
      {confirmandoSalida && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar cierre de sesión"
          onClick={() => setConfirmandoSalida(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-2xl animar-aparecer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
              <LogOut className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">¿Cerrar sesión?</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Se limpiarán los datos de la sesión en este navegador. Tu progreso ATC queda guardado en
              la nube.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setConfirmandoSalida(false)}>
                Quedarme
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={async () => {
                  setConfirmandoSalida(false);
                  await logout();
                }}
              >
                <LogOut className="h-4 w-4" /> Sí, salir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
