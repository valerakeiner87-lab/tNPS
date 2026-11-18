'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calculator as CalcIcon,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileBarChart,
  Flame,
  Gamepad2,
  Gauge,
  Gift,
  History,
  Home,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Medal,
  Menu,
  PieChart,
  Radio,
  RotateCcw,
  ScrollText,
  Settings,
  Settings2,
  Tags,
  Timer,
  TrendingUp,
  Trophy,
  Tv,
  Upload,
  User as UserIcon,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useStore, type TabId } from '@/lib/store';
import type { RolUsuario } from '@/lib/types';

export interface DefinicionTab {
  id: TabId;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  roles: Array<RolUsuario>;
  muestraFiltros?: boolean;
}

const TODOS_ROLES: Array<RolUsuario> = ['asesor', 'supervisor', 'admin'];
const ROLES_ESCRITURA: Array<RolUsuario> = ['supervisor', 'admin'];

/**
 * Definición completa de pestañas. El orden importa — se respeta al
 * renderizar el sidebar.
 *
 * v3.4.3 — Reestructuración del panel del asesor:
 *   Solo 4 secciones principales: Inicio, TNPS, Adherencia, Nómina.
 *   TNPS, Adherencia y Nómina son contenedores con subpestañas internas
 *   que se renderizan dentro de la vista (no en el sidebar).
 *
 * Para admin/supervisor se conservan las pestañas existentes.
 */
export const TABS: DefinicionTab[] = [
  // --- Comunes ---
  { id: 'inicio', etiqueta: 'Inicio', icono: Home, roles: TODOS_ROLES },

  // ============================================================
  // ASESOR — v3.4.3 solo 4 secciones principales
  // ============================================================
  { id: 'tnps', etiqueta: 'TNPS', icono: BarChart3, roles: ['asesor'] },
  { id: 'adherencia', etiqueta: 'Adherencia', icono: Activity, roles: ['asesor'] },
  { id: 'nomina', etiqueta: 'Nómina', icono: Wallet, roles: ['asesor'] },
  // Subpestañas internas (no se muestran en el sidebar pero el routing las soporta)
  { id: 'mi-billetera', etiqueta: 'Mi Billetera', icono: Wallet, roles: ['asesor'] },
  { id: 'juegos', etiqueta: 'Juegos', icono: Gamepad2, roles: ['asesor'] },
  { id: 'perfil', etiqueta: 'Perfil', icono: UserIcon, roles: ['asesor'] },
  { id: 'novedades-reporte', etiqueta: 'Reportar Novedad', icono: AlertTriangle, roles: ['asesor'] },
  { id: 'wfm-sugerencia', etiqueta: 'Sugerencia de Turno', icono: CalendarClock, roles: ['asesor'] },

  // ============================================================
  // ADMIN / SUPERVISOR — conservar pestañas existentes + nuevos módulos
  // ============================================================
  // v3.2.0 — Métricas de Adherencia (vista legacy para admin/supervisor)
  { id: 'metricas', etiqueta: 'Métricas Adherencia', icono: Activity, roles: ROLES_ESCRITURA },
  { id: 'supervision', etiqueta: 'Supervisión', icono: LayoutDashboard, roles: ROLES_ESCRITURA },
  { id: 'carga', etiqueta: 'Carga', icono: Upload, roles: ROLES_ESCRITURA },
  { id: 'global', etiqueta: 'Dashboard Global', icono: Gauge, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'linea', etiqueta: 'Por Línea', icono: LineChart, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'asesores', etiqueta: 'Asesores', icono: Users, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'tmo', etiqueta: 'TMO', icono: Timer, roles: ROLES_ESCRITURA },
  { id: 'alertas', etiqueta: 'Alertas', icono: AlertOctagon, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'patrones', etiqueta: 'Patrones', icono: Radio, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'tipificaciones', etiqueta: 'Tipificaciones', icono: Tags, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'analisis-impacto', etiqueta: 'Análisis de Impacto', icono: BarChart3, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'podio-global', etiqueta: 'Podio', icono: Trophy, roles: ROLES_ESCRITURA },
  { id: 'podio-tv', etiqueta: 'Podio TV', icono: Tv, roles: ROLES_ESCRITURA },
  { id: 'billeteras', etiqueta: 'Billeteras ATC', icono: Gift, roles: ROLES_ESCRITURA },
  { id: 'formularios', etiqueta: 'Formularios', icono: BookOpen, roles: ROLES_ESCRITURA },
  { id: 'usuarios', etiqueta: 'Usuarios', icono: UserCog, roles: ROLES_ESCRITURA },
  { id: 'config-tmo', etiqueta: 'Configuración TMO', icono: Settings, roles: ROLES_ESCRITURA },
  { id: 'config-atc', etiqueta: 'Configuración ATC', icono: Settings2, roles: ROLES_ESCRITURA },
  { id: 'config-reinicio', etiqueta: 'Config. Reinicio', icono: RotateCcw, roles: ROLES_ESCRITURA },
  { id: 'config-juegos', etiqueta: 'Config. Juegos', icono: Gamepad2, roles: ROLES_ESCRITURA },
  { id: 'admin', etiqueta: 'Admin', icono: ScrollText, roles: ROLES_ESCRITURA },
  // --- v3.0.5 Admin/Supervisor ---
  { id: 'dashboard-ejecutivo', etiqueta: 'Dashboard Ejecutivo', icono: PieChart, roles: ROLES_ESCRITURA, muestraFiltros: true },
  { id: 'reportes', etiqueta: 'Reportes', icono: FileBarChart, roles: ROLES_ESCRITURA },
  { id: 'audit', etiqueta: 'Auditoría', icono: History, roles: ROLES_ESCRITURA },
  { id: 'torneos', etiqueta: 'Torneos', icono: Medal, roles: ROLES_ESCRITURA },
  // --- v3.3.0 Fase 2: nuevos módulos admin ---
  { id: 'admin-validacion', etiqueta: 'Validación de Tiempos', icono: ClipboardCheck, roles: ROLES_ESCRITURA },
  { id: 'admin-novedades', etiqueta: 'Novedades Ingresadas', icono: ClipboardList, roles: ROLES_ESCRITURA },
  { id: 'admin-wfm', etiqueta: 'Gestión WFM', icono: CalendarClock, roles: ROLES_ESCRITURA },
];

export function getTabsVisibles(rol: RolUsuario): DefinicionTab[] {
  return TABS.filter((t) => t.roles.includes(rol));
}

interface SidebarItemProps {
  tab: DefinicionTab;
  activo: boolean;
  colapsado: boolean;
  onClick: () => void;
}

function SidebarItem({ tab, activo, colapsado, onClick }: SidebarItemProps) {
  const Icono = tab.icono;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      aria-label={tab.etiqueta}
      title={colapsado ? tab.etiqueta : undefined}
      className={cn(
        'group relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activo
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
        colapsado && 'justify-center px-0'
      )}
    >
      {activo && !colapsado && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-primary-foreground"
          aria-hidden
        />
      )}
      <Icono
        className={cn(
          'h-5 w-5 shrink-0 transition-transform',
          activo ? 'scale-110' : 'group-hover:scale-105'
        )}
      />
      {!colapsado && <span className="truncate">{tab.etiqueta}</span>}
    </button>
  );
}

interface SidebarNavigationProps {
  rol: RolUsuario;
  tabActual: TabId;
  setTab: (t: TabId) => void;
  nombreUsuario: string;
  nombreRol: string;
  onSalir: () => void;
  noLeidas: number;
}

export function SidebarNavigation({
  rol,
  tabActual,
  setTab,
  nombreUsuario,
  nombreRol,
  onSalir,
  noLeidas,
}: SidebarNavigationProps) {
  // Estado de colapso persistido en localStorage
  const [colapsado, setColapsado] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem('atc-sidebar-colapsado');
      if (guardado === '1') setColapsado(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('atc-sidebar-colapsado', colapsado ? '1' : '0');
    } catch {}
  }, [colapsado]);

  const tabsVisibles = getTabsVisibles(rol);

  // Perfil: asesor → perfil, admin/supervisor → usuarios
  const tabPerfil: TabId = rol === 'asesor' ? 'perfil' : 'usuarios';

  const inicial = (nombreUsuario?.trim()?.[0] || 'U').toUpperCase();

  const contenido = (
    <div className="flex flex-col h-full">
      {/* Encabezado: logo + toggle (desktop) */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-3 border-b border-border/60',
          colapsado && 'justify-center px-0'
        )}
      >
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
          <BarChart3 className="h-5 w-5 text-primary-foreground" aria-hidden />
        </div>
        {!colapsado && (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none">
              Claro Guatemala
            </p>
            <p className="text-sm font-bold leading-tight truncate">ATC Digital</p>
          </div>
        )}
        {!colapsado && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden lg:inline-flex"
            onClick={() => setColapsado(true)}
            aria-label="Colapsar menú"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Botón expandir (cuando colapsado, solo desktop) */}
      {colapsado && (
        <div className="hidden lg:flex justify-center py-2 border-b border-border/60">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setColapsado(false)}
            aria-label="Expandir menú"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Circle de perfil */}
      <div className={cn('p-3 border-b border-border/60', colapsado && 'px-2')}>
        <button
          type="button"
          onClick={() => {
            setTab(tabPerfil);
            setMovilAbierto(false);
          }}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent',
            colapsado && 'justify-center'
          )}
          title={colapsado ? nombreUsuario : undefined}
          aria-label="Abrir perfil"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold flex items-center justify-center shrink-0 ring-2 ring-background shadow-sm">
            {inicial}
          </div>
          {!colapsado && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{nombreUsuario}</p>
              <p className="text-[11px] text-muted-foreground capitalize truncate">{nombreRol}</p>
            </div>
          )}
        </button>
      </div>

      {/* Lista de tabs */}
      <nav
        aria-label="Navegación principal"
        className={cn(
          'flex-1 overflow-y-auto scroll-fino py-3',
          colapsado ? 'px-2 space-y-1' : 'px-3 space-y-0.5'
        )}
      >
        {tabsVisibles.map((t) => (
          <SidebarItem
            key={t.id}
            tab={t}
            activo={tabActual === t.id}
            colapsado={colapsado}
            onClick={() => {
              setTab(t.id);
              setMovilAbierto(false);
            }}
          />
        ))}
      </nav>

      {/* Footer: salir */}
      <div className={cn('p-3 border-t border-border/60', colapsado && 'px-2')}>
        <button
          type="button"
          onClick={onSalir}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-destructive/10 hover:text-destructive transition-colors',
            colapsado && 'justify-center px-0'
          )}
          title={colapsado ? 'Salir' : undefined}
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!colapsado && <span>Salir</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ===== Desktop sidebar fija ===== */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-border bg-card transition-[width] duration-300 ease-in-out sticky top-0 h-screen z-30',
          colapsado ? 'w-[68px]' : 'w-60'
        )}
      >
        {contenido}
      </aside>

      {/* ===== Mobile: trigger + Sheet ===== */}
      <div className="lg:hidden">
        <Sheet open={movilAbierto} onOpenChange={setMovilAbierto}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Abrir menú"
              className="relative"
            >
              <Menu className="h-5 w-5" />
              {noLeidas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navegación principal</SheetTitle>
            {contenido}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** Botón para abrir el sidebar móvil (lo usa el header cuando aún no está abierto) */
export function SidebarMobileBellBadge({ noLeidas }: { noLeidas: number }) {
  // Placeholder por si se necesita una variante sin Sheet (no se usa por ahora)
  return noLeidas > 0 ? (
    <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
      {noLeidas > 99 ? '99+' : noLeidas}
    </span>
  ) : null;
}

// Re-export íconos usados en el header (mantener imports para tree-shaking)
export { Bell, TrendingUp, X };
