'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Coffee,
  Gauge,
  Hash,
  Inbox,
  Phone,
  Timer,
  TrendingUp,
  Users,
  Utensils,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useStore } from '@/lib/store';
import type { MetricaAdherencia } from '@/lib/types';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Formatea segundos a "H:MM:SS" */
function fmtTiempo(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Formatea un número con 2 decimales */
function fmtNum(n: number, decimales = 2): string {
  return Number(n || 0).toFixed(decimales);
}

/** Formatea una fecha YYYY-MM-DD a un formato más legible */
function fmtFecha(fecha: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return fecha;
  }
}

// ------------------------------------------------------------
// KPI Card individual
// ------------------------------------------------------------
function KpiCard({
  titulo,
  valor,
  sufijo,
  Icono,
  color,
  descripcion,
}: {
  titulo: string;
  valor: string | number;
  sufijo?: string;
  Icono: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  descripcion?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{titulo}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {valor}
              {sufijo && <span className="text-sm text-muted-foreground ml-1">{sufijo}</span>}
            </p>
            {descripcion && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{descripcion}</p>
            )}
          </div>
          <span
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}1A` }}
            aria-hidden
          >
            <Icono className="h-5 w-5" style={{ color }} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Progress con label
// ------------------------------------------------------------
function BarraProgreso({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, valor || 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{titulo}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {fmtNum(pct, 1)}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
          aria-hidden
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Badge de exceso
// ------------------------------------------------------------
function ExcesoBadge({
  titulo,
  segundos,
  Icono,
}: {
  titulo: string;
  segundos: number;
  Icono: React.ComponentType<{ className?: string }>;
}) {
  const tiene = (segundos || 0) > 0;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        tiene
          ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20'
          : 'border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/15'
      }`}
    >
      <Icono
        className={`h-4 w-4 shrink-0 ${tiene ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
      />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{titulo}</p>
        <p
          className={`text-sm font-semibold tabular-nums ${
            tiene ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {tiene ? fmtTiempo(segundos) : 'Sin exceso'}
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Vista principal
// ------------------------------------------------------------
export function MetricasAdherenciaView() {
  const datosAdherencia = useStore((s) => s.datosAdherencia);
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  // Fechas disponibles (todas las fechas en los datos)
  const fechasDisponibles = useMemo(() => {
    if (!datosAdherencia?.metricas?.length) return [] as string[];
    const set = new Set<string>();
    for (const m of datosAdherencia.metricas) {
      if (m.fecha) set.add(m.fecha);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [datosAdherencia]);

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');

  // Determinar fecha activa
  const fechaActiva = fechaSeleccionada || fechasDisponibles[0] || '';

  // Filtrar métricas según rol + fecha
  // v3.3.0: matching por documento (no por loginNormalizado) — el parser
  // ahora usa el documento/cédula como loginNormalizado para coincidir con
  // AsesorHC.documento y User.documento.
  const metricasFiltradas = useMemo(() => {
    if (!datosAdherencia?.metricas?.length) return [] as MetricaAdherencia[];
    const esAsesor = perfil?.rol === 'asesor';
    const docAsesor = perfilAsesor?.documento || perfil?.documento || '';
    return datosAdherencia.metricas.filter((m) => {
      if (m.fecha !== fechaActiva) return false;
      if (esAsesor && docAsesor && m.documento !== docAsesor) return false;
      return true;
    });
  }, [datosAdherencia, fechaActiva, perfil?.rol, perfil?.documento, perfilAsesor?.documento]);

  // KPIs agregados
  const kpis = useMemo(() => {
    if (metricasFiltradas.length === 0) {
      return {
        totalInteracciones: 0,
        promTMO: 0,
        promPPH: 0,
        promOCC: 0,
        promADH: 0,
        promUTL: 0,
        abs: 0,
        totalExcesoBreak: 0,
        totalExcesoBano: 0,
        totalExcesoCapa: 0,
        ausentes: 0,
        tardes: 0,
        totalAsesores: 0,
      };
    }
    const n = metricasFiltradas.length;
    const sum = metricasFiltradas.reduce(
      (acc, m) => {
        acc.interacciones += m.interacciones || 0;
        acc.tmo += m.tmo || 0;
        acc.pph += m.pph || 0;
        acc.occ += m.occ || 0;
        acc.adh += m.adh || 0;
        acc.utl += m.utl || 0;
        acc.excesoBreak += m.excesoBreak || 0;
        acc.excesoBano += m.excesoBano || 0;
        acc.excesoCapa += m.excesoCapa || 0;
        if (m.ausente) acc.ausentes += 1;
        if (normalizarTextoLlegada(m.llegada) === 'tarde') acc.tardes += 1;
        return acc;
      },
      {
        interacciones: 0,
        tmo: 0,
        pph: 0,
        occ: 0,
        adh: 0,
        utl: 0,
        excesoBreak: 0,
        excesoBano: 0,
        excesoCapa: 0,
        ausentes: 0,
        tardes: 0,
      }
    );
    return {
      totalInteracciones: sum.interacciones,
      promTMO: sum.tmo / n,
      promPPH: sum.pph / n,
      promOCC: sum.occ / n,
      promADH: sum.adh / n,
      promUTL: sum.utl / n,
      abs: 0, // %ABS se calcula a nivel agregado
      totalExcesoBreak: sum.excesoBreak,
      totalExcesoBano: sum.excesoBano,
      totalExcesoCapa: sum.excesoCapa,
      ausentes: sum.ausentes,
      tardes: sum.tardes,
      totalAsesores: n,
    };
  }, [metricasFiltradas]);

  // Estado vacío
  if (!datosAdherencia || datosAdherencia.totalRegistros === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No hay datos de Adherencia</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {perfil?.puedeEscribir
                ? 'Carga un archivo Excel de Adherencia desde la pestaña "Carga" para ver las métricas aquí.'
                : 'Cuando tu supervisor cargue el archivo de Adherencia, aquí verás las métricas.'}
            </p>
          </div>
          {perfil?.puedeEscribir && (
            <Button onClick={() => useStore.getState().setTab('carga')} className="gap-2">
              Ir a cargar archivos
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Color para TMO (verde si < 600s, amarillo < 900, rojo >= 900)
  const colorTMO =
    kpis.promTMO < 600 ? '#10b981' : kpis.promTMO < 900 ? '#f59e0b' : '#ef4444';

  const esAsesor = perfil?.rol === 'asesor';

  return (
    <div className="space-y-6">
      {/* ---------------- HEADER ---------------- */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Métricas de Adherencia
              </CardTitle>
              <CardDescription>
                {datosAdherencia.totalRegistros.toLocaleString('es-GT')} registros ·
                {datosAdherencia.fechaInicio && ` desde ${fmtFecha(datosAdherencia.fechaInicio)}`}
                {datosAdherencia.fechaFin && ` hasta ${fmtFecha(datosAdherencia.fechaFin)}`}
                {esAsesor && (perfilAsesor?.documento || perfil?.documento) && ' · Filtrado por tu usuario'}
              </CardDescription>
            </div>
            {/* Filtro de día */}
            <div className="flex items-center gap-2">
              <label htmlFor="filtro-fecha-adherencia" className="text-xs text-muted-foreground">
                Día:
              </label>
              <Select
                value={fechaActiva}
                onValueChange={(v) => setFechaSeleccionada(v)}
              >
                <SelectTrigger id="filtro-fecha-adherencia" className="w-[200px]">
                  <SelectValue placeholder="Seleccionar día" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {fechasDisponibles.map((f) => (
                    <SelectItem key={f} value={f}>
                      {fmtFecha(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ---------------- KPIs AGREGADOS ---------------- */}
      {fechaActiva && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard
              titulo="Asesores del día"
              valor={kpis.totalAsesores}
              Icono={Users}
              color="#8b5cf6"
              descripcion="Con registro en PROGRAMACION"
            />
            <KpiCard
              titulo="Total Interacciones"
              valor={kpis.totalInteracciones.toLocaleString('es-GT')}
              Icono={Hash}
              color="#3b82f6"
              descripcion="Manejo total"
            />
            <KpiCard
              titulo="TMO Promedio"
              valor={fmtTiempo(kpis.promTMO)}
              Icono={Timer}
              color={colorTMO}
              descripcion="Tiempo medio operativo"
            />
            <KpiCard
              titulo="PPH Promedio"
              valor={fmtNum(kpis.promPPH, 1)}
              Icono={TrendingUp}
              color="#10b981"
              descripcion="Partes por hora"
            />
          </div>

          {/* Barras de progreso % */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Porcentajes de Eficiencia
              </CardTitle>
              <CardDescription>
                Promedios del día · {fmtFecha(fechaActiva)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <BarraProgreso titulo="Ocupación (OCC)" valor={kpis.promOCC} color="#3b82f6" />
              <BarraProgreso titulo="Adherencia (ADH)" valor={kpis.promADH} color="#8b5cf6" />
              <BarraProgreso titulo="Utilización (UTL)" valor={kpis.promUTL} color="#10b981" />
            </CardContent>
          </Card>

          {/* Excesos + Asistencia */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Excesos Totales del Día
                </CardTitle>
                <CardDescription>Sumatoria de tiempos de exceso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ExcesoBadge titulo="Exceso Break" segundos={kpis.totalExcesoBreak} Icono={Coffee} />
                <ExcesoBadge titulo="Exceso Baño" segundos={kpis.totalExcesoBano} Icono={Utensils} />
                <ExcesoBadge titulo="Exceso Capa" segundos={kpis.totalExcesoCapa} Icono={Phone} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Asistencia y Puntualidad
                </CardTitle>
                <CardDescription>Conteo de incidencias del día</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-card p-4 text-center">
                  <div className="mx-auto h-9 w-9 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-2">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{kpis.ausentes}</p>
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                </div>
                <div className="rounded-lg border bg-card p-4 text-center">
                  <div className="mx-auto h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{kpis.tardes}</p>
                  <p className="text-xs text-muted-foreground">Llegadas tarde</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ---------------- TABLA POR ASESOR ---------------- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                {esAsesor ? 'Mis métricas del día' : 'Métricas por asesor'}
              </CardTitle>
              <CardDescription>
                {metricasFiltradas.length} registro(s) · {fmtFecha(fechaActiva)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricasFiltradas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay registros para este día{esAsesor ? ' con tu usuario' : ''}.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-96 overflow-y-auto scroll-fino">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          {!esAsesor && <TableHead>Asesor</TableHead>}
                          {!esAsesor && <TableHead className="hidden md:table-cell">LOB</TableHead>}
                          <TableHead className="text-right">Inter.</TableHead>
                          <TableHead className="text-right">TMO</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">PPH</TableHead>
                          <TableHead className="text-right">%OCC</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">%ADH</TableHead>
                          <TableHead className="text-right hidden md:table-cell">%UTL</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Break</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Baño</TableHead>
                          <TableHead className="hidden md:table-cell">Asist.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metricasFiltradas.map((m, i) => (
                          <TableRow key={`${m.documento}-${m.fecha}-${i}`}>
                            {!esAsesor && (
                              <TableCell className="font-medium">
                                <div className="min-w-0">
                                  <p className="truncate max-w-[180px]">{m.nombre || m.documento}</p>
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                    {m.documento}
                                  </p>
                                </div>
                              </TableCell>
                            )}
                            {!esAsesor && (
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                {m.lob || '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-right tabular-nums">{m.interacciones}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtTiempo(m.tmo)}</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">
                              {fmtNum(m.pph, 1)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{fmtNum(m.occ)}%</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">
                              {fmtNum(m.adh)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums hidden md:table-cell">
                              {fmtNum(m.utl)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs hidden lg:table-cell">
                              {m.excesoBreak > 0 ? fmtTiempo(m.excesoBreak) : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs hidden lg:table-cell">
                              {m.excesoBano > 0 ? fmtTiempo(m.excesoBano) : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge
                                variant="outline"
                                className={
                                  m.ausente
                                    ? 'border-red-400/60 text-red-700 dark:text-red-300'
                                    : normalizarTextoLlegada(m.llegada) === 'tarde'
                                      ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                                      : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                                }
                              >
                                {m.ausente
                                  ? 'Ausente'
                                  : m.llegada || m.asistencia || '—'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

function normalizarTextoLlegada(s: string): string {
  if (!s) return '';
  return String(s).trim().toLowerCase();
}
