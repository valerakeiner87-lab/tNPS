'use client';

/**
 * v3.3.0 Fase 2 — MetricasAdherenciaDetalleView
 * ----------------------------------------------
 * Vista detallada de adherencia para el asesor, por día:
 *  - Fecha, turno (Program_Time), tiempo conectado (Horas UTL)
 *  - Tiempo en auxiliares (Inactivo), Exceso Break/Baño/Capa
 *  - % Adherencia
 *
 * Filtra por documento del asesor logueado.
 * Selector de día para acotar la tabla.
 */
import { useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Coffee,
  Gauge,
  Inbox,
  Timer,
  Utensils,
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

function fmtHoras(horas: number): string {
  if (!horas || horas <= 0) return '0h';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
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

export function MetricasAdherenciaDetalleView() {
  const datosAdherencia = useStore((s) => s.datosAdherencia);
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const docAsesor = normalizarDocumento(perfilAsesor?.documento || perfil?.documento || '');

  // Filtrar solo las métricas del asesor (cédula normalizada)
  const misMetricas = useMemo(() => {
    if (!datosAdherencia?.metricas?.length) return [] as MetricaAdherencia[];
    if (!docAsesor) return [] as MetricaAdherencia[];
    return datosAdherencia.metricas
      .filter((m) => documentosIguales(m.documento, docAsesor))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [datosAdherencia, docAsesor]);

  // Fechas disponibles
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

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
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
            <h2 className="text-xl font-semibold">No hay datos de Adherencia</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tu supervisor cargue el archivo de Adherencia, aquí verás tu detalle
              diario de tiempos y excesos.
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
              No hay métricas de adherencia asociadas a tu cédula ({docAsesor || 'sin documento'}).
              Contacta a tu supervisor si crees que es un error.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // KPIs agregados
  const totalInteracciones = metricasVisibles.reduce((acc, m) => acc + (m.interacciones || 0), 0);
  const promTMO = metricasVisibles.length
    ? metricasVisibles.reduce((acc, m) => acc + (m.tmo || 0), 0) / metricasVisibles.length
    : 0;
  const promAdh = metricasVisibles.length
    ? metricasVisibles.reduce((acc, m) => acc + (m.adh || 0), 0) / metricasVisibles.length
    : 0;
  const totalExceso =
    metricasVisibles.reduce(
      (acc, m) => acc + (m.excesoBreak || 0) + (m.excesoBano || 0) + (m.excesoCapa || 0),
      0
    );

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary animar-aparecer animar-brillo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Adherencia detallada
          </CardTitle>
          <CardDescription>
            Desglose por día de tu tiempo conectado, auxiliares y excesos. Datos desde{' '}
            {fmtFecha(datosAdherencia.fechaInicio)} hasta {fmtFecha(datosAdherencia.fechaFin)}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs agregados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> % Adherencia prom.
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{promAdh.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" /> TMO prom.
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtTiempo(promTMO)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Interacciones
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{totalInteracciones}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Excesos totales
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtTiempo(totalExceso)}</p>
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

      {/* Tabla — 11 columnas obligatorias */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por día ({metricasVisibles.length})</CardTitle>
          <CardDescription>
            Registros diarios extraídos del Excel de Adherencia, filtrados por tu cédula.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-[60vh] overflow-x-auto overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Interacciones</TableHead>
                    <TableHead className="text-right whitespace-nowrap">TMO</TableHead>
                    <TableHead className="text-right whitespace-nowrap">PPH</TableHead>
                    <TableHead className="text-right whitespace-nowrap">%OCC</TableHead>
                    <TableHead className="text-right whitespace-nowrap">%ADH</TableHead>
                    <TableHead className="text-right whitespace-nowrap">%UTL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">%ABS</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Exceso Break</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Exceso Baño</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Exceso Capa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricasVisibles.map((m) => (
                    <TableRow key={`${m.documento}-${m.fecha}`}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtFecha(m.fecha)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{m.interacciones || 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtTiempo(m.tmo)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{(m.pph || 0).toFixed(1)}</TableCell>
                      <TableCell className={`text-right tabular-nums text-xs ${(m.occ || 0) >= 85 ? 'text-promotor' : (m.occ || 0) >= 70 ? 'text-pasivo' : 'text-detractor'}`}>
                        {(m.occ || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-xs font-semibold ${(m.adh || 0) >= 85 ? 'text-promotor' : (m.adh || 0) >= 70 ? 'text-pasivo' : 'text-detractor'}`}>
                        {(m.adh || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-xs ${(m.utl || 0) >= 85 ? 'text-promotor' : (m.utl || 0) >= 70 ? 'text-pasivo' : 'text-detractor'}`}>
                        {(m.utl || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {(m.abs || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <ExcesoChip segundos={m.excesoBreak} Icono={Coffee} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ExcesoChip segundos={m.excesoBano} Icono={Utensils} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ExcesoChip segundos={m.excesoCapa} Icono={Clock} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {metricasVisibles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        No hay registros de adherencia para tu cédula ({docAsesor || 'sin documento'}).
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExcesoChip({
  segundos,
  Icono,
}: {
  segundos: number;
  Icono: React.ComponentType<{ className?: string }>;
}) {
  const tiene = (segundos || 0) > 0;
  return (
    <Badge
      variant="outline"
      className={
        tiene
          ? 'border-amber-400/60 text-amber-700 dark:text-amber-300'
          : 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
      }
    >
      <Icono className="h-3 w-3 mr-1" />
      {tiene ? fmtTiempo(segundos) : 'OK'}
    </Badge>
  );
}
