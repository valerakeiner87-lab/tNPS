'use client';

/**
 * v3.4.3 — NominaConsolidadoView
 * --------------------------------
 * Consolidado de nómina del asesor:
 *  - Cruce con archivo de Horas Robot (Program_Time, Horas a pagar)
 *  - Fallback a datosAdherencia.horasFact si no hay Horas Robot cargado
 *  - Valor monetario en Pesos Colombianos (COP)
 *  - Novedades aprobadas ajustan el tiempo del día
 *  - Filtrado por cédula normalizada
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';
import type { RegistroHorasRobot, MetricaAdherencia } from '@/lib/types';
import { leerNovedades } from '@/lib/firestore-data';
import type { Novedad } from '@/lib/neon-data';
import { normalizarDocumento, documentosIguales } from '@/lib/utils';

// Tarifa por hora en Pesos Colombianos (COP). Valor de referencia configurable.
const TARIFA_POR_HORA_COP = 6500; // COP/hora (~USD 1.5)
const MONEDA = 'COP';

function fmtHoras(horas: number): string {
  if (!horas || horas <= 0) return '0h';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Formato estricto de Pesos Colombianos (COP): $ 1.250.000 COP */
function fmtCOP(valor: number): string {
  const v = Math.round(valor || 0);
  const partes = v.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `$ ${partes} ${MONEDA}`;
}

function fmtFecha(fecha: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return fecha;
  }
}

function EstadoNovedadBadge({ estado }: { estado: string }) {
  const e = (estado || '').toLowerCase();
  if (e === 'aprobada' || e === 'aprobado') {
    return (
      <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Aprobada
      </Badge>
    );
  }
  if (e === 'rechazada' || e === 'rechazado') {
    return (
      <Badge variant="outline" className="border-red-400/60 text-red-700 dark:text-red-300">
        <XCircle className="h-3 w-3 mr-1" /> Rechazada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3 mr-1" /> Pendiente
    </Badge>
  );
}

interface DiaNomina {
  fecha: string;
  horasProgramadas: number; // segundos
  horasRobot: number; // segundos (Horas a pagar)
  horasFact: number; // segundos (Horas fact)
  faltante: number; // segundos
  ajusteHoras: number; // horas (novedades aprobadas)
  horasEfectivas: number; // horas (robot + ajuste)
  valorDia: number; // COP
}

export function NominaConsolidadoView() {
  const datosHorasRobot = useStore((s) => s.datosHorasRobot);
  const datosAdherencia = useStore((s) => s.datosAdherencia);
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const docAsesor = normalizarDocumento(perfilAsesor?.documento || perfil?.documento || '');
  const nombreAsesor = perfilAsesor?.nombre ?? perfil?.nombre ?? '';

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargandoNovedades, setCargandoNovedades] = useState<boolean>(false);

  useEffect(() => {
    if (!docAsesor) return;
    setCargandoNovedades(true);
    leerNovedades(docAsesor)
      .then((res) => setNovedades(res || []))
      .catch(() => setNovedades([]))
      .finally(() => setCargandoNovedades(false));
  }, [docAsesor]);

  // Días trabajados — prioriza Horas Robot, fallback a Adherencia
  const diasTrabajados = useMemo<DiaNomina[]>(() => {
    if (!docAsesor) return [];

    // 1) Intentar Horas Robot
    if (datosHorasRobot?.registros?.length) {
      const agrupado = new Map<string, RegistroHorasRobot>();
      for (const r of datosHorasRobot.registros) {
        if (!documentosIguales(r.documento, docAsesor)) continue;
        if (!r.fecha) continue;
        const actual = agrupado.get(r.fecha);
        if (!actual) {
          agrupado.set(r.fecha, r);
        } else {
          // Sumar si hay duplicados
          actual.programTime += r.programTime;
          actual.horasAPagar += r.horasAPagar;
          actual.horasFact += r.horasFact;
          actual.faltante = Math.max(0, actual.programTime - actual.horasAPagar);
        }
      }
      return Array.from(agrupado.values())
        .map((r) => ({
          fecha: r.fecha,
          horasProgramadas: r.programTime,
          horasRobot: r.horasAPagar,
          horasFact: r.horasFact,
          faltante: r.faltante,
          // ajusteHoras se calcula abajo con novedades
          ajusteHoras: 0,
          horasEfectivas: 0,
          valorDia: 0,
        }))
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    }

    // 2) Fallback: Adherencia (horasFact = horas robot)
    if (datosAdherencia?.metricas?.length) {
      const agrupado = new Map<string, MetricaAdherencia>();
      for (const m of datosAdherencia.metricas) {
        if (!documentosIguales(m.documento, docAsesor)) continue;
        if (!m.fecha) continue;
        const actual = agrupado.get(m.fecha);
        if (!actual) {
          agrupado.set(m.fecha, m);
        } else {
          actual.horasFact = (actual.horasFact || 0) + (m.horasFact || 0);
          actual.horasUtl = (actual.horasUtl || 0) + (m.horasUtl || 0);
          actual.interacciones = (actual.interacciones || 0) + (m.interacciones || 0);
        }
      }
      return Array.from(agrupado.values())
        .map((m) => {
          const asistencia = (m.asistencia || '').toLowerCase();
          const horasProgramadasSeg = asistencia.includes('descanso') ? 0 : 8 * 3600;
          const horasRobotSeg = Math.round((m.horasFact || 0) * 3600);
          return {
            fecha: m.fecha,
            horasProgramadas: horasProgramadasSeg,
            horasRobot: horasRobotSeg,
            horasFact: horasRobotSeg,
            faltante: Math.max(0, horasProgramadasSeg - horasRobotSeg),
            ajusteHoras: 0,
            horasEfectivas: 0,
            valorDia: 0,
          };
        })
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    }

    return [];
  }, [datosHorasRobot, datosAdherencia, docAsesor]);

  // Mapa de tiempo ajustado aprobado por fecha (en segundos → horas)
  const tiempoAjustadoPorDia = useMemo(() => {
    const mapa = new Map<string, number>(); // fecha → horas ajustadas
    for (const n of novedades) {
      const estado = (n.estado || '').toLowerCase();
      if (estado !== 'aprobada' && estado !== 'aprobado' && estado !== 'ajustado') continue;
      const horasAjuste = (n.duracion || 0) / 3600;
      const actual = mapa.get(n.fecha) ?? 0;
      mapa.set(n.fecha, actual + horasAjuste);
    }
    return mapa;
  }, [novedades]);

  // Calcular horas efectivas y valor del día
  const diasConCalculo = useMemo(() => {
    return diasTrabajados.map((d) => {
      const ajuste = tiempoAjustadoPorDia.get(d.fecha) ?? 0;
      const horasRobotH = d.horasRobot / 3600;
      const horasEfectivas = horasRobotH + ajuste;
      const valorDia = horasEfectivas * TARIFA_POR_HORA_COP;
      return { ...d, ajusteHoras: ajuste, horasEfectivas, valorDia };
    });
  }, [diasTrabajados, tiempoAjustadoPorDia]);

  const consolidado = useMemo(() => {
    let totalHorasRobot = 0;
    let totalProgramadas = 0;
    let totalAjustado = 0;
    let valorAcumulado = 0;
    for (const d of diasConCalculo) {
      totalHorasRobot += d.horasRobot / 3600;
      totalProgramadas += d.horasProgramadas / 3600;
      totalAjustado += d.ajusteHoras;
      valorAcumulado += d.valorDia;
    }
    return {
      totalHorasRobot,
      totalProgramadas,
      totalAjustado,
      totalHorasEfectivas: totalHorasRobot + totalAjustado,
      valorAcumulado,
    };
  }, [diasConCalculo]);

  // Conteo por estado
  const novedadesPorEstado = useMemo(() => {
    const pendientes = novedades.filter((n) => (n.estado || '').toLowerCase() === 'pendiente').length;
    const aprobadas = novedades.filter(
      (n) => ['aprobada', 'aprobado', 'ajustado'].includes((n.estado || '').toLowerCase())
    ).length;
    const rechazadas = novedades.filter(
      (n) => ['rechazada', 'rechazado'].includes((n.estado || '').toLowerCase())
    ).length;
    return { pendientes, aprobadas, rechazadas, total: novedades.length };
  }, [novedades]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Wallet className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  if (diasTrabajados.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No hay datos de nómina</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tu supervisor cargue el archivo de <strong>Horas Robot</strong> (o Adherencia),
              aquí verás el consolidado de tus horas laboradas y valor monetario en COP.
              <br />
              Cédula activa: <code className="bg-muted px-1 rounded">{docAsesor || '(sin documento)'}</code>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Nómina consolidado
          </CardTitle>
          <CardDescription>
            Consolidado de horas laboradas cruzado por tu cédula. Tarifa de referencia:{' '}
            <strong>{fmtCOP(TARIFA_POR_HORA_COP)}/hora</strong>. Valores en Pesos Colombianos (COP).
            <br />
            Fuente de datos: {datosHorasRobot?.totalRegistros ? 'Horas Robot' : 'Adherencia (fallback)'}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horas robot
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {fmtHoras(consolidado.totalHorasRobot)}
            </p>
            <p className="text-xs text-muted-foreground">{diasConCalculo.length} días</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horas programadas
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {fmtHoras(consolidado.totalProgramadas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tiempo ajustado
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1 text-promotor">
              {fmtHoras(consolidado.totalAjustado)}
            </p>
            <p className="text-xs text-muted-foreground">Novedades aprobadas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-promotor">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Valor acumulado
            </div>
            <p className="text-xl font-bold tabular-nums mt-1 text-promotor">
              {fmtCOP(consolidado.valorAcumulado)}
            </p>
            <p className="text-xs text-muted-foreground">{fmtHoras(consolidado.totalHorasEfectivas)} efectivas</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por día */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desglose por día</CardTitle>
          <CardDescription>
            Horas robot por día + tiempo ajustado por novedades aprobadas + valor del día en COP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-[55vh] overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Prog.</TableHead>
                    <TableHead className="text-right">Robot</TableHead>
                    <TableHead className="text-right">Ajuste</TableHead>
                    <TableHead className="text-right">Efectivas</TableHead>
                    <TableHead className="text-right">Valor del día</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diasConCalculo.map((d) => (
                    <TableRow key={d.fecha}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtFecha(d.fecha)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtHoras(d.horasProgramadas / 3600)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtHoras(d.horasRobot / 3600)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-promotor">
                        {d.ajusteHoras > 0 ? `+${fmtHoras(d.ajusteHoras)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">
                        {fmtHoras(d.horasEfectivas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold text-promotor">
                        {fmtCOP(d.valorDia)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {diasConCalculo.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtHoras(consolidado.totalProgramadas)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtHoras(consolidado.totalHorasRobot)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-promotor">{fmtHoras(consolidado.totalAjustado)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmtHoras(consolidado.totalHorasEfectivas)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-promotor">{fmtCOP(consolidado.valorAcumulado)}</TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Novedades */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" /> Novedades reportadas
              </CardTitle>
              <CardDescription>
                Tus novedades con su estado de aprobación. Las aprobadas ajustan el tiempo del día.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
                Pendientes: {novedadesPorEstado.pendientes}
              </Badge>
              <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                Aprobadas: {novedadesPorEstado.aprobadas}
              </Badge>
              <Badge variant="outline" className="border-red-400/60 text-red-700 dark:text-red-300">
                Rechazadas: {novedadesPorEstado.rechazadas}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cargandoNovedades ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando novedades…
            </div>
          ) : novedades.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No has reportado novedades todavía.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-96 overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novedades.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtFecha(n.fecha)}</TableCell>
                        <TableCell className="text-xs">{n.tipo}</TableCell>
                        <TableCell className="text-xs font-mono">{n.ticket || '—'}</TableCell>
                        <TableCell>
                          <EstadoNovedadBadge estado={n.estado} />
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

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p>
            <strong>Asesor:</strong> {nombreAsesor} · <strong>Cédula:</strong> {docAsesor || '—'}
          </p>
          <p className="mt-1">
            El valor monetario es de referencia (tarifa {fmtCOP(TARIFA_POR_HORA_COP)}/hora).
            El valor final será validado por tu supervisor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
