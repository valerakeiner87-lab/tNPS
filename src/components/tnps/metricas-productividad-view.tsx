'use client';

/**
 * v3.3.0 Fase 2 — MetricasProductividadView
 * ------------------------------------------
 * Métricas de productividad y asistencia del asesor, por día:
 *  - KPIs: TMO, PPH, Interacciones (totales y promedio)
 *  - Asistencia: % Ausentismo, Llegadas Tarde, A tiempo
 *  - Selector de día
 *  - Tabla por día con: TMO, PPH, Interacciones, Asistencia, Llegada, Ausente
 */
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Hash,
  Inbox,
  Timer,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { normalizarDocumento, documentosIguales } from '@/lib/utils';

function fmtTiempo(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

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

function normalizarLlegada(llegada: string): string {
  if (!llegada) return '';
  const l = llegada.toLowerCase();
  if (l.includes('tarde')) return 'tarde';
  if (l.includes('antes')) return 'antes';
  if (l.includes('tiempo')) return 'atiempo';
  if (l.includes('descanso')) return 'descanso';
  return l;
}

export function MetricasProductividadView() {
  const datosAdherencia = useStore((s) => s.datosAdherencia);
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const docAsesor = normalizarDocumento(perfilAsesor?.documento || perfil?.documento || '');

  const misMetricas = useMemo(() => {
    if (!datosAdherencia?.metricas?.length || !docAsesor) return [] as MetricaAdherencia[];
    return datosAdherencia.metricas
      .filter((m) => documentosIguales(m.documento, docAsesor))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [datosAdherencia, docAsesor]);

  const fechasDisponibles = useMemo(
    () => Array.from(new Set(misMetricas.map((m) => m.fecha).filter(Boolean))).sort((a, b) => (a < b ? 1 : -1)),
    [misMetricas]
  );

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('todas');
  const fechaActiva = fechaSeleccionada === 'todas' ? null : fechaSeleccionada;

  const metricasVisibles = useMemo(() => {
    if (!fechaActiva) return misMetricas;
    return misMetricas.filter((m) => m.fecha === fechaActiva);
  }, [misMetricas, fechaActiva]);

  const kpis = useMemo(() => {
    const n = metricasVisibles.length || 1;
    const sum = metricasVisibles.reduce(
      (acc, m) => {
        acc.interacciones += m.interacciones || 0;
        acc.tmo += m.tmo || 0;
        acc.pph += m.pph || 0;
        if (m.ausente) acc.ausentes += 1;
        if (normalizarLlegada(m.llegada) === 'tarde') acc.tardes += 1;
        if (normalizarLlegada(m.llegada) === 'atiempo') acc.atiempo += 1;
        return acc;
      },
      { interacciones: 0, tmo: 0, pph: 0, ausentes: 0, tardes: 0, atiempo: 0 }
    );
    return {
      totalInteracciones: sum.interacciones,
      promTMO: sum.tmo / n,
      promPPH: sum.pph / n,
      ausentes: sum.ausentes,
      tardes: sum.tardes,
      atiempo: sum.atiempo,
      diasTotales: metricasVisibles.length,
      pctAusentismo: metricasVisibles.length
        ? (sum.ausentes / metricasVisibles.length) * 100
        : 0,
    };
  }, [metricasVisibles]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  if (!datosAdherencia || datosAdherencia.totalRegistros === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No hay datos de productividad</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tu supervisor cargue el archivo de Adherencia, aquí verás tus métricas de
              productividad y asistencia.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (misMetricas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No se encontraron tus registros</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              No hay métricas asociadas a tu cédula ({docAsesor || 'sin documento'}).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary animar-aparecer animar-brillo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Productividad y asistencia
          </CardTitle>
          <CardDescription>
            Resumen de tus métricas de productividad (TMO, PPH, interacciones) y asistencia
            (% ausentismo, llegadas tarde y a tiempo).
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs productividad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> Interacciones totales
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{kpis.totalInteracciones}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" /> TMO promedio
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtTiempo(kpis.promTMO)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> PPH promedio
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{kpis.promPPH.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Días con datos
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{kpis.diasTotales}</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs asistencia */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" /> % Ausentismo
            </div>
            <p
              className={`text-2xl font-bold tabular-nums mt-1 ${
                kpis.pctAusentismo > 10 ? 'text-detractor' : 'text-foreground'
              }`}
            >
              {kpis.pctAusentismo.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">{kpis.ausentes} días ausente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Llegadas tarde
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1 text-pasivo">{kpis.tardes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> A tiempo
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1 text-promotor">{kpis.atiempo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Total días
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{kpis.diasTotales}</p>
          </CardContent>
        </Card>
      </div>

      {/* Selector de día */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtrar por día</CardTitle>
          <CardDescription>
            Selecciona un día específico o mantén "Todas" para ver el detalle completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={fechaSeleccionada} onValueChange={setFechaSeleccionada}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Todas las fechas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las fechas</SelectItem>
              {fechasDisponibles.map((f) => (
                <SelectItem key={f} value={f}>
                  {fmtFecha(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabla por día */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por día ({metricasVisibles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Interacciones</TableHead>
                    <TableHead className="text-right">TMO</TableHead>
                    <TableHead className="text-right">PPH</TableHead>
                    <TableHead>Asistencia</TableHead>
                    <TableHead>Llegada</TableHead>
                    <TableHead className="text-center">Ausente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricasVisibles.map((m) => (
                    <TableRow key={`${m.documento}-${m.fecha}`}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtFecha(m.fecha)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.interacciones}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtTiempo(m.tmo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{(m.pph || 0).toFixed(1)}</TableCell>
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
                        <Badge
                          variant="outline"
                          className={
                            normalizarLlegada(m.llegada) === 'tarde'
                              ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                              : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                          }
                        >
                          {m.llegada || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {m.ausente ? (
                          <XCircle className="h-4 w-4 text-detractor mx-auto" aria-label="Ausente" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-promotor mx-auto" aria-label="Presente" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
