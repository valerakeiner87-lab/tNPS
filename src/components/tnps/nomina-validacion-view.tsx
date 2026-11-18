'use client';

/**
 * v3.4.3 — NominaValidacionView
 * --------------------------------
 * Validación diaria de nómina del asesor:
 *  - Cruce con Horas Robot (Program_Time, Horas a pagar)
 *  - Fallback a Adherencia si Horas Robot no está cargado
 *  - Tiempo ajustado por novedades aprobadas
 *  - Valor en Pesos Colombianos (COP)
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

const TARIFA_POR_HORA_COP = 8338; // COP/hora (SMMLV 2026, 210h/mes)
const MONEDA = 'COP';

function fmtHoras(horas: number): string {
  if (!horas || horas <= 0) return '0h';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtCOP(valor: number): string {
  const v = Math.round(valor || 0);
  return `$ ${v.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${MONEDA}`;
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

function fmtDuracion(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

interface FilaValidacion {
  fecha: string;
  horasProgramadas: number; // horas
  horasRobot: number; // horas
  tiempoFaltante: number; // horas
  tiempoAjustadoHoras: number;
  tiempoAjustadoSeg: number;
  novedadesDia: Novedad[];
  horasEfectivas: number;
  valorDia: number;
}

export function NominaValidacionView() {
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

  // Construir filas unificadas (prioriza Horas Robot, fallback Adherencia)
  const filas = useMemo<FilaValidacion[]>(() => {
    if (!docAsesor) return [];

    // Novedades aprobadas/ajustadas por fecha
    const novPorFecha = new Map<string, Novedad[]>();
    for (const n of novedades) {
      const estado = (n.estado || '').toLowerCase();
      if (estado !== 'aprobada' && estado !== 'aprobado' && estado !== 'ajustado') continue;
      const arr = novPorFecha.get(n.fecha) ?? [];
      arr.push(n);
      novPorFecha.set(n.fecha, arr);
    }

    const construirFila = (
      fecha: string,
      horasProgramadasSeg: number,
      horasRobotSeg: number
    ): FilaValidacion => {
      const horasProgramadas = horasProgramadasSeg / 3600;
      const horasRobot = horasRobotSeg / 3600;
      const tiempoFaltante = Math.max(0, horasProgramadas - horasRobot);
      const novedadesDia = novPorFecha.get(fecha) ?? [];
      const tiempoAjustadoSeg = novedadesDia.reduce((acc, n) => acc + (n.duracion || 0), 0);
      const tiempoAjustadoHoras = tiempoAjustadoSeg / 3600;
      const horasEfectivas = horasRobot + tiempoAjustadoHoras;
      const valorDia = horasEfectivas * TARIFA_POR_HORA_COP;
      return {
        fecha,
        horasProgramadas,
        horasRobot,
        tiempoFaltante,
        tiempoAjustadoHoras,
        tiempoAjustadoSeg,
        novedadesDia,
        horasEfectivas,
        valorDia,
      };
    };

    // 1) Horas Robot
    if (datosHorasRobot?.registros?.length) {
      const agrupado = new Map<string, { programTime: number; horasAPagar: number }>();
      for (const r of datosHorasRobot.registros) {
        if (!documentosIguales(r.documento, docAsesor)) continue;
        if (!r.fecha) continue;
        const actual = agrupado.get(r.fecha);
        if (!actual) {
          agrupado.set(r.fecha, { programTime: r.programTime, horasAPagar: r.horasAPagar });
        } else {
          actual.programTime += r.programTime;
          actual.horasAPagar += r.horasAPagar;
        }
      }
      return Array.from(agrupado.entries())
        .map(([fecha, v]) => construirFila(fecha, v.programTime, v.horasAPagar))
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    }

    // 2) Fallback: Adherencia
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
        }
      }
      return Array.from(agrupado.values())
        .map((m) => {
          const asistencia = (m.asistencia || '').toLowerCase();
          const horasProgramadasSeg = asistencia.includes('descanso') ? 0 : 8 * 3600;
          const horasRobotSeg = Math.round((m.horasFact || 0) * 3600);
          return construirFila(m.fecha, horasProgramadasSeg, horasRobotSeg);
        })
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    }

    return [];
  }, [datosHorasRobot, datosAdherencia, docAsesor, novedades]);

  const totales = useMemo(() => {
    return filas.reduce(
      (acc, f) => {
        acc.horasProgramadas += f.horasProgramadas;
        acc.horasRobot += f.horasRobot;
        acc.tiempoFaltante += f.tiempoFaltante;
        acc.tiempoAjustado += f.tiempoAjustadoHoras;
        acc.horasEfectivas += f.horasEfectivas;
        acc.valorTotal += f.valorDia;
        return acc;
      },
      {
        horasProgramadas: 0,
        horasRobot: 0,
        tiempoFaltante: 0,
        tiempoAjustado: 0,
        horasEfectivas: 0,
        valorTotal: 0,
      }
    );
  }, [filas]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  if (filas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No hay datos de nómina</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tu supervisor cargue el archivo de Horas Robot, aquí verás la validación
              diaria de tus tiempos.
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
      <Card className="border-l-4 border-l-primary animar-aparecer animar-brillo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Validación diaria
          </CardTitle>
          <CardDescription>
            Desglose por día de horas programadas, horas robot, tiempo faltante y tiempo ajustado
            por novedades aprobadas. Tarifa: <strong>{fmtCOP(TARIFA_POR_HORA_COP)}/hora</strong>.
            <br />
            Fuente: {datosHorasRobot?.totalRegistros ? 'Horas Robot' : 'Adherencia (fallback)'}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horas programadas
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtHoras(totales.horasProgramadas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Horas robot
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{fmtHoras(totales.horasRobot)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Tiempo faltante
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1 text-pasivo">
              {fmtHoras(totales.tiempoFaltante)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-promotor animar-aparecer animar-brillo" style={{ animationDelay: '0.15s' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Valor total
            </div>
            <p className="text-xl font-bold tabular-nums mt-1 text-promotor">
              {fmtCOP(totales.valorTotal)}
            </p>
            <p className="text-xs text-muted-foreground">{fmtHoras(totales.horasEfectivas)} efectivas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por día ({filas.length})</CardTitle>
          <CardDescription>
            Horas programadas vs. horas robot (reales). Novedades aprobadas aparecen como ajuste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoNovedades ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando novedades…
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Prog.</TableHead>
                      <TableHead className="text-right">Robot</TableHead>
                      <TableHead className="text-right">Faltante</TableHead>
                      <TableHead className="text-right">Ajuste</TableHead>
                      <TableHead className="text-right">Efectivas</TableHead>
                      <TableHead className="text-right">Valor día</TableHead>
                      <TableHead>Novedad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map((f) => (
                      <TableRow key={f.fecha}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtFecha(f.fecha)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtHoras(f.horasProgramadas)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtHoras(f.horasRobot)}</TableCell>
                        <TableCell className={`text-right tabular-nums text-xs ${f.tiempoFaltante > 0 ? 'text-pasivo' : 'text-promotor'}`}>
                          {f.tiempoFaltante > 0 ? fmtHoras(f.tiempoFaltante) : 'OK'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-promotor">
                          {f.tiempoAjustadoHoras > 0 ? `+${fmtHoras(f.tiempoAjustadoHoras)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-semibold">
                          {fmtHoras(f.horasEfectivas)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs font-semibold text-promotor">
                          {fmtCOP(f.valorDia)}
                        </TableCell>
                        <TableCell>
                          {f.novedadesDia.length > 0 ? (
                            <div className="space-y-1">
                              {f.novedadesDia.map((n) => (
                                <div key={n.id} className="text-[10px]">
                                  <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Aprobada
                                  </Badge>
                                  <span className="ml-1 text-muted-foreground">
                                    {n.tipo} · {fmtDuracion(n.duracion)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {filas.length > 0 && (
                    <tfoot>
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtHoras(totales.horasProgramadas)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtHoras(totales.horasRobot)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-pasivo">{fmtHoras(totales.tiempoFaltante)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-promotor">{fmtHoras(totales.tiempoAjustado)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmtHoras(totales.horasEfectivas)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-promotor">{fmtCOP(totales.valorTotal)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </tfoot>
                  )}
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
            Si tu tiempo faltante es positivo, significa que trabajaste menos horas de las
            programadas. Reporta una novedad si fue por falla técnica, capacitación o caso
            complejo para que tu supervisor ajuste tu tiempo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
