'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  Coffee,
  Gauge,
  Hash,
  Inbox,
  Info,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  Smartphone,
  Timer,
  TrendingUp,
  Trophy,
  User as UserIcon,
  Users,
  Utensils,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Encuesta, Linea, MetricaAdherencia, KPIS, DatosAdherencia } from '@/lib/types';
import { useStore } from '@/lib/store';
import { CumpleanosCard } from '@/components/tnps/cumpleanos-card';
import { AsesorAvatarGradient } from '@/components/tnps/asesor-avatar';
import { normalizarDocumento, documentosIguales } from '@/lib/utils';

// ------------------------------------------------------------
// Contador animado (count-up)
// ------------------------------------------------------------
function ContadorAnimado({ valor, duracion = 1200 }: { valor: number; duracion?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const estaVisible = useInView(ref, { once: true });
  const [valorMostrado, setValorMostrado] = useState(0);

  useEffect(() => {
    if (!estaVisible) return;
    let raf = 0;
    const inicio = performance.now();
    const animar = (ahora: number) => {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const eased = 1 - Math.pow(1 - progreso, 3);
      setValorMostrado(valor * eased);
      if (progreso < 1) raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(raf);
  }, [estaVisible, valor, duracion]);

  return <span ref={ref}>{valorMostrado.toFixed(1)}</span>;
}

// ------------------------------------------------------------
// Saludo según hora
// ------------------------------------------------------------
function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Color del grupo tNPS para el punto del feed */
function colorDeGrupo(encuesta: Encuesta): string {
  switch (encuesta.grupo) {
    case 'Promotor':
      return 'bg-promotor';
    case 'Pasivo':
      return 'bg-pasivo';
    default:
      return 'bg-detractor';
  }
}

// ------------------------------------------------------------
// Feed rotativo de movimientos de encuestas
// ------------------------------------------------------------
function FeedEncuestas({ encuestas }: { encuestas: Encuesta[] }) {
  const [indice, setIndice] = useState(0);
  const ultimas = useMemo(
    () =>
      [...encuestas]
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
        .slice(0, 24),
    [encuestas]
  );

  useEffect(() => {
    if (ultimas.length <= 5) return;
    const t = setInterval(() => setIndice((i) => i + 1), 2800);
    return () => clearInterval(t);
  }, [ultimas.length]);

  if (ultimas.length === 0) return null;

  const visibles = Array.from({ length: Math.min(6, ultimas.length) }, (_, i) => ultimas[(indice + i) % ultimas.length]);

  return (
    <div className="space-y-2">
      {visibles.map((e, i) => (
        <motion.div
          key={`${e.id}-${indice}-${i}`}
          initial={{ opacity: 0, x: -28, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: i * 0.09, duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-3 rounded-lg border bg-card/70 px-3 py-2 hover:bg-accent/50 transition-colors"
        >
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorDeGrupo(e)}`} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {e.usuario || e.loginNormalizado || 'Asesor'} · <span className="text-muted-foreground">{e.linea}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Score {e.tnps} · {e.fechaDia} {e.horaExacta && `· ${e.horaExacta}`}
              {e.nivel1 && ` · ${e.nivel1}`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              e.grupo === 'Promotor'
                ? 'bg-promotor/15 text-promotor'
                : e.grupo === 'Pasivo'
                  ? 'bg-pasivo/15 text-pasivo'
                  : 'bg-detractor/15 text-detractor'
            }`}
          >
            {e.grupo}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Ícono por línea de negocio
// ------------------------------------------------------------
const ICONO_LINEA: Record<Linea, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Móvil: Smartphone,
  'Fijo Soporte': Wrench,
  'Fijo Información': Info,
};

// ------------------------------------------------------------
// Tarjeta de red (línea de negocio)
// ------------------------------------------------------------
function TarjetaRed({
  linea,
  total,
  tNPS,
  pctPromotores,
}: {
  linea: Linea;
  total: number;
  tNPS: number;
  pctPromotores: number;
}) {
  const color =
    linea === 'Móvil' ? '#1A3F7A' : linea === 'Fijo Soporte' ? '#DA291C' : '#F59E0B';
  const Icono = ICONO_LINEA[linea] ?? Info;

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}1A` }}
              aria-hidden
            >
              <Icono className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="font-semibold leading-tight">Red {linea}</p>
              <p className="text-xs text-muted-foreground">{total.toLocaleString('es-GT')} encuestas</p>
            </div>
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color }}>
            {tNPS >= 0 ? '+' : ''}
            {tNPS.toFixed(1)}
          </p>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Promotores</span>
            <span>{pctPromotores.toFixed(1)}%</span>
          </div>
          <Progress value={pctPromotores} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Panel de inicio
// ------------------------------------------------------------
export function InicioPanel() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const kpisFiltrados = useStore((s) => s.kpisFiltrados);
  const kpisPorLinea = useStore((s) => s.kpisPorLinea);
  const todasEncuestas = useStore((s) => s.encuestas);
  const cargandoDatos = useStore((s) => s.cargandoDatos);
  const tabActual = useStore((s) => s.tabActual);
  const setTab = useStore((s) => s.setTab);
  const asesoresHC = useStore((s) => s.asesoresHC);
  const datosAdherencia = useStore((s) => s.datosAdherencia);

  const esAsesor = perfil?.rol === 'asesor';
  const nombre = esAsesor ? perfilAsesor?.nombre?.split(' ')[0] : perfil?.email?.split('@')[0] ?? '';

  // Para el asesor, TODO se basa en sus propias encuestas (encuestasFiltradas).
  // Para supervisor/admin, se usan las encuestas filtradas del área activa.
  // NUNCA usar `todasEncuestas` directamente en la UI.
  const encuestas = encuestasFiltradas;
  // sinDatos = no hay encuestas cargadas en absoluto (para mostrar el estado vacío de carga inicial)
  const sinDatos = todasEncuestas.length === 0;
  // sinMisEncuestas = el asesor no tiene encuestas propias (pero sí hay datos globales)
  const sinMisEncuestas = esAsesor && todasEncuestas.length > 0 && encuestas.length === 0;

  const atajos = useMemo(() => {
    if (esAsesor) {
      return [
        { tab: 'tnps-resumen' as const, titulo: 'Mi tNPS', desc: 'Tu resumen de encuestas', Icono: BarChart3 },
        { tab: 'metricas-adherencia-detalle' as const, titulo: 'Adherencia', desc: 'Tu detalle diario', Icono: Activity },
        { tab: 'nomina-consolidado' as const, titulo: 'Mi nómina', desc: 'Horas y valor acumulado', Icono: Wallet },
        { tab: 'novedades-reporte' as const, titulo: 'Reportar novedad', desc: 'Reporta un incidente', Icono: Inbox },
      ];
    }
    return [
      { tab: 'global' as const, titulo: 'Dashboard global', desc: 'KPIs generales', Icono: Gauge },
      { tab: 'asesores' as const, titulo: 'Asesores', desc: 'Ranking completo', Icono: Users },
      { tab: 'alertas' as const, titulo: 'Alertas', desc: 'Comentarios agresivos', Icono: BarChart3 },
      { tab: 'admin-validacion' as const, titulo: 'Validación de tiempos', desc: 'Ajusta tiempos diarios', Icono: Timer },
    ];
  }, [esAsesor]);

  if (cargandoDatos && sinDatos) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-claro-red" />
        <p className="text-sm">Sincronizando datos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden rounded-2xl header-claro text-white p-6 sm:p-8 animar-aparecer">
        <div className="relative">
          <p className="text-white/75 text-sm">
            {saludo()}{nombre ? `, ${nombre}` : ''}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold">
            Panel de inicio · <span className="texto-gradiente-claro">ATC Digital</span>
          </h1>
          <p className="mt-2 text-white/80 max-w-2xl text-sm sm:text-base">
            {esAsesor
              ? 'El movimiento de tus encuestas y el estado de tu red, en tiempo real.'
              : 'Resumen ejecutivo del contact center: encuestas, redes y accesos a los análisis.'}
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            <div className="rounded-xl bg-white/10 backdrop-blur p-3">
              <p className="text-xs text-white/70">tNPS {esAsesor ? 'mío' : 'global'}</p>
              <p className="text-2xl font-bold tabular-nums">
                <ContadorAnimado valor={kpisFiltrados.tNPS} />
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3">
              <p className="text-xs text-white/70">Promotoras</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-300">
                {kpisFiltrados.promotores.toLocaleString('es-GT')}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3">
              <p className="text-xs text-white/70">Pasivas</p>
              <p className="text-2xl font-bold tabular-nums text-amber-300">
                {kpisFiltrados.pasivos.toLocaleString('es-GT')}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3">
              <p className="text-xs text-white/70">Detractoras</p>
              <p className="text-2xl font-bold tabular-nums text-red-300">
                {kpisFiltrados.detractores.toLocaleString('es-GT')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- v3.3.0 Fase 2: PERFIL + KPIs + DÍAS TRABAJADOS ---------------- */}
      {esAsesor && (
        <section className="grid lg:grid-cols-3 gap-4">
          {/* Tarjeta de perfil */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" /> Mi perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <AsesorAvatarGradient
                  login={perfilAsesor?.loginNormalizado || ''}
                  nombre={perfilAsesor?.nombre || ''}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate">
                    {perfilAsesor?.nombre || perfil?.nombre || 'Asesor'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Cédula: {perfilAsesor?.documento || '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">LOB / Campaña</p>
                  <p className="font-medium truncate" title={perfilAsesor?.lob || '—'}>
                    {perfilAsesor?.lob || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Supervisor</p>
                  <p className="font-medium truncate" title={perfilAsesor?.supervisor || '—'}>
                    {perfilAsesor?.supervisor || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium truncate">
                    {perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cargo</p>
                  <p className="font-medium truncate">{perfilAsesor?.cargo || 'Asesor'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI cards (Adherencia / TMO / PPH / ABS / Llegadas tarde) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Mis KPIs operativos
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Calendario para día específico · botón "General" para acumulado del mes.
                    tNPS siempre se muestra consolidado.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <KpiAdherenciaGrid
                datosAdherencia={datosAdherencia}
                docAsesor={perfilAsesor?.documento || perfil?.documento}
                kpisTNPS={kpisFiltrados}
                onVerProductividad={() => setTab('adherencia')}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* v3.4.3 — Tarjeta Mi Adherencia (D-1 + Descanso) */}
      {esAsesor && (
        <MiAdherenciaCard
          datosAdherencia={datosAdherencia}
          docAsesor={perfilAsesor?.documento || perfil?.documento}
          onVerDetalle={() => setTab('adherencia')}
        />
      )}

      {/* Tabla de días trabajados (solo asesor) */}
      {esAsesor && (
        <DiasTrabajadosCard
          datosAdherencia={datosAdherencia}
          docAsesor={perfilAsesor?.documento}
          onVerDetalle={() => setTab('metricas-adherencia-detalle')}
        />
      )}

      {sinDatos ? (
        /* ---------------- ESTADO VACÍO ---------------- */
        <Card className="animar-aparecer">
          <CardContent className="py-14 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Aún no hay encuestas cargadas</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {perfil?.puedeEscribir
                  ? 'Carga los archivos de Qualtrics y del Health Check para comenzar.'
                  : 'Cuando tu supervisor cargue las encuestas, aquí verás tu panel.'}
              </p>
            </div>
            {perfil?.puedeEscribir && (
              <Button onClick={() => setTab('carga')} className="gap-2">
                Ir a cargar archivos <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ---------------- MOVIMIENTO DE ENCUESTAS + REDES + CUMPLEAÑOS ---------------- */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Movimiento de encuestas (feed en vivo) */}
            <Card className="animar-aparecer">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-promotor opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-promotor" />
                  </span>
                  Movimiento de encuestas
                  <span className="ml-auto text-xs font-normal text-muted-foreground">en vivo</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FeedEncuestas encuestas={encuestas} />
              </CardContent>
            </Card>

            {/* Redes (líneas de negocio) */}
            <Card className="animar-aparecer">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-claro-red" /> Redes del contact center
                  <span className="ml-auto text-xs font-normal text-muted-foreground">por línea</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['Móvil', 'Fijo Soporte', 'Fijo Información'] as Linea[]).map((linea) => {
                  const k = kpisPorLinea[linea];
                  return (
                    <TarjetaRed
                      key={linea}
                      linea={linea}
                      total={k.total}
                      tNPS={k.tNPS}
                      pctPromotores={k.pctPromotores}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* ---------------- ATAJOS ---------------- */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Accesos rápidos</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {atajos.map((a, i) => (
                <motion.button
                  key={a.tab}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                  onClick={() => setTab(a.tab)}
                  className={`text-left rounded-xl border bg-card p-4 hover:border-claro-red/50 hover:shadow-md transition-all group ${tabActual === a.tab ? 'border-claro-red/60' : ''}`}
                >
                  <IconoSlot Icono={a.Icono} />
                  <p className="mt-2 font-medium text-sm flex items-center gap-1">
                    {a.titulo}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </motion.button>
              ))}
            </div>
          </section>

          {/* ---------------- MINI RESUMEN ---------------- */}
          <Card className="animar-aparecer">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-claro-red" /> Resumen rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-claro-navy dark:text-claro-blue-2" />
                <div>
                  <p className="text-xs text-muted-foreground">Total encuestas</p>
                  <p className="font-bold text-lg tabular-nums">{kpisFiltrados.total.toLocaleString('es-GT')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-claro-navy dark:text-claro-blue-2" />
                <div>
                  <p className="text-xs text-muted-foreground">Asesores con encuestas</p>
                  <p className="font-bold text-lg tabular-nums">
                    {new Set(encuestas.map((e) => e.loginNormalizado)).size}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-pasivo" />
                <div>
                  <p className="text-xs text-muted-foreground">Score promedio</p>
                  <p className="font-bold text-lg tabular-nums">{kpisFiltrados.scorePromedio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ---------------- CUMPLEAÑOS DEL MES ---------------- */}
      {/* Se muestra siempre que haya cumpleañeros este mes, independientemente de si hay encuestas */}
      <CumpleanosCard
        asesoresHC={asesoresHC}
        miLogin={perfilAsesor?.loginNormalizado || perfil?.email || undefined}
      />

      {/* ---------------- v3.2.0: MÉTRICAS DE ADHERENCIA ---------------- */}
      <AdherenciaResumenCard
        datosAdherencia={datosAdherencia}
        docAsesor={perfilAsesor?.documento}
        esAsesor={esAsesor}
        onVerDetalle={() => setTab('metricas')}
      />

      {/* Footer de estado de sincronización */}
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <RefreshCw className="h-3 w-3" /> Datos servidos desde el caché local con sincronización
        inteligente · Contact Center Claro Guatemala
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// v3.2.0 — Resumen de Adherencia (card para el inicio)
// ------------------------------------------------------------
function fmtTiempoAdh(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function fmtFechaAdh(fecha: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
  } catch {
    return fecha;
  }
}

function AdherenciaResumenCard({
  datosAdherencia,
  docAsesor,
  esAsesor,
  onVerDetalle,
}: {
  datosAdherencia: { metricas: MetricaAdherencia[]; fechaFin: string } | null;
  docAsesor?: string;
  esAsesor: boolean;
  onVerDetalle: () => void;
}) {
  const metricaHoy = useMemo<MetricaAdherencia | null>(() => {
    if (!datosAdherencia?.metricas?.length) return null;
    // v3.3.0: Filtrar por documento (no por loginNormalizado).
    // v3.4.3: Usar comparación normalizada (sin espacios, puntos, ceros a la izquierda).
    let pool = datosAdherencia.metricas;
    if (esAsesor && docAsesor) {
      pool = pool.filter((m) => documentosIguales(m.documento, docAsesor));
    }
    if (pool.length === 0) return null;
    // Tomar la fecha más reciente disponible
    const fechasOrdenadas = Array.from(new Set(pool.map((m) => m.fecha)))
      .filter(Boolean)
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    if (fechasOrdenadas.length === 0) return null;
    const fechaReciente = fechasOrdenadas[0];
    // Si es asesor, debe tener un solo registro ese día
    return pool.find((m) => m.fecha === fechaReciente) ?? null;
  }, [datosAdherencia, docAsesor, esAsesor]);

  if (!metricaHoy) return null;

  const colorTMO =
    metricaHoy.tmo < 600 ? '#10b981' : metricaHoy.tmo < 900 ? '#f59e0b' : '#ef4444';

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Mi Adherencia · {fmtFechaAdh(metricaHoy.fecha)}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Métricas de tu último día con registro
              </p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={onVerDetalle}>
              Ver detalle <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mini KPIs: Interacciones, TMO, PPH */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="h-3.5 w-3.5" /> Interacciones
              </div>
              <p className="text-xl font-bold tabular-nums mt-1">{metricaHoy.interacciones}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> TMO
              </div>
              <p className="text-xl font-bold tabular-nums mt-1" style={{ color: colorTMO }}>
                {fmtTiempoAdh(metricaHoy.tmo)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> PPH
              </div>
              <p className="text-xl font-bold tabular-nums mt-1">
                {metricaHoy.pph.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Progress bars: %OCC, %ADH, %UTL */}
          <div className="space-y-3">
            <BarraPorcentajeAdh titulo="Ocupación (OCC)" valor={metricaHoy.occ} color="#3b82f6" Icono={Gauge} />
            <BarraPorcentajeAdh titulo="Adherencia (ADH)" valor={metricaHoy.adh} color="#8b5cf6" Icono={Activity} />
            <BarraPorcentajeAdh titulo="Utilización (UTL)" valor={metricaHoy.utl} color="#10b981" Icono={BarChart3} />
          </div>

          {/* Excesos como badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Excesos:</span>
            <Badge
              variant="outline"
              className={
                metricaHoy.excesoBreak > 0
                  ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
              }
            >
              <Coffee className="h-3 w-3 mr-1" />
              Break: {fmtTiempoAdh(metricaHoy.excesoBreak)}
            </Badge>
            <Badge
              variant="outline"
              className={
                metricaHoy.excesoBano > 0
                  ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
              }
            >
              <Utensils className="h-3 w-3 mr-1" />
              Baño: {fmtTiempoAdh(metricaHoy.excesoBano)}
            </Badge>
            <Badge
              variant="outline"
              className={
                metricaHoy.excesoCapa > 0
                  ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
              }
            >
              <Clock className="h-3 w-3 mr-1" />
              Capa: {fmtTiempoAdh(metricaHoy.excesoCapa)}
            </Badge>
          </div>

          {/* Ausentismo / tardanza */}
          <div className="flex flex-wrap items-center gap-2">
            {metricaHoy.ausente ? (
              <Badge variant="outline" className="border-red-400/60 text-red-700 dark:text-red-300">
                <XCircle className="h-3 w-3 mr-1" /> Ausente
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                Presente
              </Badge>
            )}
            {metricaHoy.llegada && (
              <Badge
                variant="outline"
                className={
                  metricaHoy.llegada.toLowerCase().includes('tarde')
                    ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                    : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                }
              >
                <Clock className="h-3 w-3 mr-1" /> {metricaHoy.llegada}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

function BarraPorcentajeAdh({
  titulo,
  valor,
  color,
  Icono,
}: {
  titulo: string;
  valor: number;
  color: string;
  Icono: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const pct = Math.max(0, Math.min(100, valor || 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icono className="h-3.5 w-3.5" style={{ color }} /> {titulo}
        </span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function IconoSlot({ Icono }: { Icono: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="h-8 w-8 rounded-lg bg-claro-red/10 flex items-center justify-center" aria-hidden>
      <Icono className="h-4 w-4 text-claro-red" />
    </span>
  );
}

// ============================================================
// v3.3.0 Fase 2 — Componentes nuevos para el Inicio del asesor
// ============================================================

/** Formatea segundos a "Xm" o "Xs" para tablas compactas */
function fmtTiempoCorto(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtHorasCorto(horas: number): string {
  if (!horas || horas <= 0) return '0h';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtFechaCorta(fecha: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
  } catch {
    return fecha;
  }
}

function obtenerUltimaMetricaAsesor(
  datosAdherencia: DatosAdherencia | null,
  docAsesor?: string
): MetricaAdherencia | null {
  if (!datosAdherencia?.metricas?.length) return null;
  let pool = datosAdherencia.metricas;
  if (docAsesor) {
    // v3.4.3: usar comparación normalizada para cruce por cédula
    pool = pool.filter((m) => documentosIguales(m.documento, docAsesor));
  }
  if (pool.length === 0) return null;
  const fechas = Array.from(new Set(pool.map((m) => m.fecha).filter(Boolean))).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0
  );
  if (fechas.length === 0) return null;
  return pool.find((m) => m.fecha === fechas[0]) ?? null;
}

/**
 * v3.4.3 — Obtiene la métrica del día inmediatamente anterior (D-1)
 * a la fecha actual. Si el asesor descansó ese día, devuelve la métrica
 * con `asistencia = 'Descanso'` para que la UI muestre el mensaje.
 */
function obtenerMetricaDiaAnterior(
  datosAdherencia: DatosAdherencia | null,
  docAsesor?: string
): MetricaAdherencia | null {
  if (!datosAdherencia?.metricas?.length) return null;
  let pool = datosAdherencia.metricas;
  if (docAsesor) {
    pool = pool.filter((m) => documentosIguales(m.documento, docAsesor));
  }
  if (pool.length === 0) return null;

  // Calcular fecha D-1 (ayer)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const fechaAyer = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

  // Buscar métrica de ayer
  const metricaAyer = pool.find((m) => m.fecha === fechaAyer);
  if (metricaAyer) return metricaAyer;

  // Si no hay de ayer, buscar la fecha más reciente <= ayer
  const fechasPasadas = Array.from(new Set(pool.map((m) => m.fecha).filter(Boolean)))
    .filter((f) => f <= fechaAyer)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  if (fechasPasadas.length === 0) {
    // Si no hay fechas pasadas, devolver la última disponible
    return obtenerUltimaMetricaAsesor(datosAdherencia, docAsesor);
  }
  return pool.find((m) => m.fecha === fechasPasadas[0]) ?? null;
}

function normalizarLlegadaInicio(llegada: string): string {
  if (!llegada) return '';
  const l = llegada.toLowerCase();
  if (l.includes('tarde')) return 'Tarde';
  if (l.includes('antes')) return 'Antes';
  if (l.includes('tiempo')) return 'A tiempo';
  if (l.includes('descanso')) return 'Descanso';
  return llegada;
}

/**
 * v3.4.3 — Grilla de KPIs operativos con calendario + botón "General".
 *
 * - Calendario (input type="date") permite seleccionar un día específico.
 * - Botón "General" acumula el mes en curso.
 * - EXCEPCIÓN: tNPS siempre muestra el valor consolidado (kpisTNPS),
 *   nunca se filtra por fecha.
 * - Las métricas operativas (Adh, TMO, PPH, ABS, Llegadas tarde, excesos)
 *   sí se filtran por la fecha seleccionada o se acumulan en modo General.
 */
function KpiAdherenciaGrid({
  datosAdherencia,
  docAsesor,
  kpisTNPS,
  onVerProductividad,
}: {
  datosAdherencia: DatosAdherencia | null;
  docAsesor?: string;
  kpisTNPS: KPIS;
  onVerProductividad: () => void;
}) {
  // Modo: 'general' (acumulado del mes) | 'dia' (fecha específica)
  const [modo, setModo] = useState<'general' | 'dia'>('general');
  // Fecha seleccionada en el calendario (YYYY-MM-DD)
  const [fechaSel, setFechaSel] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Pool filtrado por cédula
  const misMetricas = useMemo(() => {
    if (!datosAdherencia?.metricas?.length) return [] as MetricaAdherencia[];
    let pool = datosAdherencia.metricas;
    if (docAsesor) {
      pool = pool.filter((m) => documentosIguales(m.documento, docAsesor));
    }
    return pool;
  }, [datosAdherencia, docAsesor]);

  // Métrica activa según modo
  const metricaActiva = useMemo<MetricaAdherencia | null>(() => {
    if (misMetricas.length === 0) return null;
    if (modo === 'dia') {
      return misMetricas.find((m) => m.fecha === fechaSel) ?? null;
    }
    // Modo general: acumular mes en curso
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth() + 1;
    const prefijoMes = `${anio}-${String(mes).padStart(2, '0')}`;
    const delMes = misMetricas.filter((m) => m.fecha?.startsWith(prefijoMes));
    if (delMes.length === 0) return null;
    // Agregar: sumar interacciones, promediar TMO/PPH, sumar excesos
    const totalInter = delMes.reduce((a, m) => a + (m.interacciones || 0), 0);
    const promTMO = delMes.reduce((a, m) => a + (m.tmo || 0), 0) / delMes.length;
    const promPPH = delMes.reduce((a, m) => a + (m.pph || 0), 0) / delMes.length;
    const promAdh = delMes.reduce((a, m) => a + (m.adh || 0), 0) / delMes.length;
    const sumExcesoBreak = delMes.reduce((a, m) => a + (m.excesoBreak || 0), 0);
    const sumExcesoBano = delMes.reduce((a, m) => a + (m.excesoBano || 0), 0);
    const sumExcesoCapa = delMes.reduce((a, m) => a + (m.excesoCapa || 0), 0);
    const ausentes = delMes.filter((m) => m.ausente).length;
    const llegoTarde = delMes.filter((m) => normalizarLlegadaInicio(m.llegada) === 'Tarde').length;
    return {
      ...delMes[0],
      interacciones: totalInter,
      tmo: promTMO,
      pph: promPPH,
      adh: promAdh,
      excesoBreak: sumExcesoBreak,
      excesoBano: sumExcesoBano,
      excesoCapa: sumExcesoCapa,
      ausente: ausentes > 0,
      // Para modo general contamos llegadas tarde acumuladas
      llegada: llegoTarde > 0 ? 'Tarde' : 'A tiempo',
    } as MetricaAdherencia;
  }, [misMetricas, modo, fechaSel]);

  if (misMetricas.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        Aún no hay datos de adherencia para tu cédula
        {docAsesor ? ` (${normalizarDocumento(docAsesor)})` : ''}.
      </div>
    );
  }

  if (!metricaActiva) {
    return (
      <div className="space-y-3">
        <CalendarioGeneralControl modo={modo} setModo={setModo} fechaSel={fechaSel} setFechaSel={setFechaSel} />
        <div className="text-sm text-muted-foreground py-6 text-center">
          {modo === 'dia'
            ? 'No hay datos para la fecha seleccionada. Prueba con otra fecha o usa "General".'
            : 'No hay datos para el mes en curso.'}
        </div>
      </div>
    );
  }

  const colorTMO =
    metricaActiva.tmo < 600 ? '#10b981' : metricaActiva.tmo < 900 ? '#f59e0b' : '#ef4444';
  const llegoTardeNum = modo === 'dia'
    ? (normalizarLlegadaInicio(metricaActiva.llegada) === 'Tarde' ? 1 : 0)
    : misMetricas.filter((m) => m.fecha?.startsWith(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      ) && normalizarLlegadaInicio(m.llegada) === 'Tarde').length;

  return (
    <div className="space-y-4">
      {/* Control: calendario + botón General */}
      <CalendarioGeneralControl modo={modo} setModo={setModo} fechaSel={fechaSel} setFechaSel={setFechaSel} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* EXCEPCIÓN: tNPS siempre muestra el valor consolidado (kpisTNPS) */}
        <KpiPequeno
          titulo="tNPS (consolidado)"
          valor={`${kpisTNPS.tNPS >= 0 ? '+' : ''}${kpisTNPS.tNPS.toFixed(1)}`}
          subtitulo={`${kpisTNPS.total} enc.`}
          color={kpisTNPS.tNPS >= 50 ? '#10b981' : kpisTNPS.tNPS >= 0 ? '#f59e0b' : '#ef4444'}
        />
        <KpiPequeno
          titulo="% Adherencia"
          valor={`${(metricaActiva.adh || 0).toFixed(1)}%`}
          color={(metricaActiva.adh || 0) >= 85 ? '#10b981' : (metricaActiva.adh || 0) >= 70 ? '#f59e0b' : '#ef4444'}
        />
        <KpiPequeno
          titulo="TMO"
          valor={fmtTiempoCorto(metricaActiva.tmo)}
          color={colorTMO}
        />
        <KpiPequeno
          titulo="PPH"
          valor={(metricaActiva.pph || 0).toFixed(1)}
        />
        <KpiPequeno
          titulo="% Ausentismo"
          valor={metricaActiva.ausente ? '100%' : '0%'}
          color={metricaActiva.ausente ? '#ef4444' : '#10b981'}
        />
        <KpiPequeno
          titulo="Lleg. tarde"
          valor={String(llegoTardeNum)}
          color={llegoTardeNum > 0 ? '#f59e0b' : '#10b981'}
        />
      </div>

      {/* Excesos como badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Excesos:</span>
        <Badge
          variant="outline"
          className={
            metricaActiva.excesoBreak > 0
              ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
              : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
          }
        >
          <Coffee className="h-3 w-3 mr-1" />
          Break: {fmtTiempoCorto(metricaActiva.excesoBreak)}
        </Badge>
        <Badge
          variant="outline"
          className={
            metricaActiva.excesoBano > 0
              ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
              : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
          }
        >
          <Utensils className="h-3 w-3 mr-1" />
          Baño: {fmtTiempoCorto(metricaActiva.excesoBano)}
        </Badge>
        <Badge
          variant="outline"
          className={
            metricaActiva.excesoCapa > 0
              ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
              : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
          }
        >
          <Clock className="h-3 w-3 mr-1" />
          Capa: {fmtTiempoCorto(metricaActiva.excesoCapa)}
        </Badge>
        <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={onVerProductividad}>
          Ver productividad <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Control de calendario + botón General para Mis KPIs Operativos */
function CalendarioGeneralControl({
  modo,
  setModo,
  fechaSel,
  setFechaSel,
}: {
  modo: 'general' | 'dia';
  setModo: (m: 'general' | 'dia') => void;
  fechaSel: string;
  setFechaSel: (f: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={fechaSel}
        onChange={(e) => {
          setFechaSel(e.target.value);
          setModo('dia');
        }}
        className="w-auto text-xs"
        aria-label="Seleccionar fecha"
      />
      <Button
        type="button"
        size="sm"
        variant={modo === 'general' ? 'default' : 'outline'}
        onClick={() => setModo('general')}
        className="gap-1"
      >
        <Gauge className="h-3.5 w-3.5" />
        General
      </Button>
      <span className="text-xs text-muted-foreground ml-1">
        {modo === 'general'
          ? 'Mostrando acumulado del mes en curso (tNPS siempre consolidado)'
          : `Mostrando ${fmtFechaCorta(fechaSel)} (tNPS siempre consolidado)`}
      </span>
    </div>
  );
}

/**
 * v3.4.3 — Tarjeta "Mi Adherencia" con lógica D-1 (día anterior).
 * - Por defecto muestra las métricas del día inmediatamente anterior.
 * - Si el asesor descansó en esa fecha, muestra "Descanso programado"
 *   en lugar de los contadores numéricos.
 * - Botón "Ver detalle" redirige a la subpestaña Adherencia Detallada.
 */
function MiAdherenciaCard({
  datosAdherencia,
  docAsesor,
  onVerDetalle,
}: {
  datosAdherencia: DatosAdherencia | null;
  docAsesor?: string;
  onVerDetalle: () => void;
}) {
  const metricaAyer = useMemo(
    () => obtenerMetricaDiaAnterior(datosAdherencia, docAsesor),
    [datosAdherencia, docAsesor]
  );

  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const fechaAyer = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

  if (!datosAdherencia || datosAdherencia.totalRegistros === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Mi adherencia (ayer {fmtFechaCorta(fechaAyer)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aún no hay datos de adherencia cargados.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!metricaAyer) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Mi adherencia (ayer {fmtFechaCorta(fechaAyer)})
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1" onClick={onVerDetalle}>
              Ver detalle <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No se encontraron registros para tu cédula
            {docAsesor ? ` (${normalizarDocumento(docAsesor)})` : ''}.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Detectar descanso
  const esDescanso = (metricaAyer.asistencia || '').toLowerCase().includes('descanso');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Mi adherencia (ayer {fmtFechaCorta(metricaAyer.fecha)})
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1" onClick={onVerDetalle}>
            Ver detalle <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {esDescanso ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center" aria-hidden>
              <Coffee className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">Descanso programado</p>
            <p className="text-xs text-muted-foreground">
              No laboraste el {fmtFechaCorta(metricaAyer.fecha)}. Disfruta tu descanso.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiPequeno
              titulo="% Adherencia"
              valor={`${(metricaAyer.adh || 0).toFixed(1)}%`}
              color={(metricaAyer.adh || 0) >= 85 ? '#10b981' : (metricaAyer.adh || 0) >= 70 ? '#f59e0b' : '#ef4444'}
            />
            <KpiPequeno
              titulo="TMO"
              valor={fmtTiempoCorto(metricaAyer.tmo)}
              color={metricaAyer.tmo < 600 ? '#10b981' : metricaAyer.tmo < 900 ? '#f59e0b' : '#ef4444'}
            />
            <KpiPequeno
              titulo="PPH"
              valor={(metricaAyer.pph || 0).toFixed(1)}
            />
            <KpiPequeno
              titulo="Interacciones"
              valor={String(metricaAyer.interacciones || 0)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiPequeno({
  titulo,
  valor,
  subtitulo,
  color,
}: {
  titulo: string;
  valor: string;
  subtitulo?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-muted-foreground truncate">{titulo}</p>
      <p
        className="text-lg font-bold tabular-nums mt-0.5"
        style={color ? { color } : undefined}
      >
        {valor}
      </p>
      {subtitulo && <p className="text-[10px] text-muted-foreground">{subtitulo}</p>}
    </div>
  );
}

/** Tabla de días trabajados: Fecha, Turno, Entrada, Salida, Estado Asistencia, Cumplimiento */
function DiasTrabajadosCard({
  datosAdherencia,
  docAsesor,
  onVerDetalle,
}: {
  datosAdherencia: DatosAdherencia | null;
  docAsesor?: string;
  onVerDetalle: () => void;
}) {
  const dias = useMemo(() => {
    if (!datosAdherencia?.metricas?.length || !docAsesor) return [] as MetricaAdherencia[];
    return datosAdherencia.metricas
      .filter((m) => documentosIguales(m.documento, docAsesor))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      .slice(0, 14); // últimos 14 días
  }, [datosAdherencia, docAsesor]);

  if (dias.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Días trabajados
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tus últimos {dias.length} días con datos.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={onVerDetalle}>
            Ver detalle <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border overflow-hidden">
          <div className="max-h-72 overflow-y-auto scroll-fino">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead>Cumplimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dias.map((m) => {
                  const horasFact = m.horasFact || 0;
                  const horasEsperadas = m.asistencia?.toLowerCase().includes('descanso') ? 0 : 8;
                  const cumplimiento = horasEsperadas > 0
                    ? Math.min(100, (horasFact / horasEsperadas) * 100)
                    : 0;
                  return (
                    <TableRow key={`${m.documento}-${m.fecha}`}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtFechaCorta(m.fecha)}</TableCell>
                      <TableCell className="text-xs">{m.tipoFacturable || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {m.llegada ? normalizarLlegadaInicio(m.llegada) : '—'}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{fmtHorasCorto(horasFact)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.ausente
                              ? 'border-red-400/60 text-red-700 dark:text-red-300'
                              : m.asistencia?.toLowerCase().includes('descanso')
                                ? 'border-muted text-muted-foreground'
                                : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                          }
                        >
                          {m.asistencia || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[60px]">
                            <Progress value={cumplimiento} className="h-1.5" />
                          </div>
                          <span
                            className={`text-xs tabular-nums font-semibold ${
                              cumplimiento >= 90
                                ? 'text-promotor'
                                : cumplimiento >= 70
                                  ? 'text-pasivo'
                                  : 'text-detractor'
                            }`}
                          >
                            {cumplimiento.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

