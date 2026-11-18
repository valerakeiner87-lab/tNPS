'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Star, TrendingUp, Award, History } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AsesorAvatar } from '@/components/tnps/asesor-avatar';
import { getRendimientoAsesor, getCanjes, getTransacciones } from '@/app/actions/neon-actions';
import type { AsesorConsolidado } from '@/lib/types';
import type { CanjeATC, TransaccionATC } from '@/lib/atc-types';
import { cn } from '@/lib/utils';

function formatearFechaCorta(fechaIso: string): string {
  try {
    const d = new Date(fechaIso + 'T00:00:00');
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' });
  } catch {
    return fechaIso;
  }
}

function formatearTiempoCalificacion(segundos: number): string {
  if (!segundos || segundos <= 0) return '—';
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface Props {
  asesor: AsesorConsolidado | null;
  abierto: boolean;
  onCerrar: () => void;
}

/**
 * Perfil completo de un asesor visto por el supervisor / admin.
 * Muestra índice promedio, punto fuerte, logros, historial de canjes,
 * historial de ATC (transacciones), TMO promedio y tendencia tNPS.
 */
export function AsesorPerfilSupervisor({ asesor, abierto, onCerrar }: Props) {
  const [rendimiento, setRendimiento] = useState<any | null>(null);
  const [canjes, setCanjes] = useState<CanjeATC[]>([]);
  const [transacciones, setTransacciones] = useState<TransaccionATC[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!asesor || !abierto) return;
    let cancelado = false;
    (async () => {
      setCargando(true);
      setRendimiento(null);
      setCanjes([]);
      setTransacciones([]);
      try {
        // v3.3.0: Solo área Digital. La llamada a getRendimientoAsesor
        // recibe 'digital' siempre.
        const [rend, cjs, txs] = await Promise.all([
          getRendimientoAsesor(asesor.loginNormalizado, 'digital').catch(() => null),
          getCanjes(asesor.loginNormalizado).catch(() => [] as CanjeATC[]),
          getTransacciones(asesor.loginNormalizado).catch(() => [] as TransaccionATC[]),
        ]);
        if (cancelado) return;
        setRendimiento(rend);
        setCanjes(cjs);
        setTransacciones(txs);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [asesor, abierto]);

  if (!asesor) return null;

  // v3.3.0: Solo área Digital — siempre 'digital'.
  const indicePromedio = rendimiento?.indicePromedio ?? null;

  return (
    <Dialog open={abierto && !!asesor} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            <AsesorAvatar
              login={asesor.loginNormalizado}
              nombre={asesor.nombre}
              size="sm"
            />
            <span className="truncate max-w-xs">{asesor.nombre}</span>
            <Badge variant="secondary" className="text-[10px]">
              @{asesor.loginNormalizado}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {asesor.linea}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Perfil detallado del asesor · Supervisor: {asesor.supervisor || '—'} · LOB: {asesor.lob || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scroll-fino pr-2 space-y-4">
          {cargando && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!cargando && (
            <>
              {/* === Punto fuerte + índice promedio === */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                  <span className="text-4xl" aria-hidden>
                    {rendimiento?.puntoFuerteEmoji || '⭐'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Punto fuerte
                    </p>
                    <p className="font-bold text-lg leading-tight">
                      {rendimiento?.puntoFuerte || 'Sin datos suficientes'}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
                  <div className="flex items-center gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-5 w-5',
                          indicePromedio !== null && i <= Math.round(indicePromedio)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-muted text-muted-foreground/40'
                        )}
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Índice promedio
                    </p>
                    <p className="font-bold text-lg tabular-nums">
                      {indicePromedio ?? '—'}
                      <span className="text-sm font-normal text-muted-foreground"> / 5</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* === Índices individuales === */}
              {rendimiento && rendimiento.totalEncuestas > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Índices individuales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <IndiceBarra
                      nombre="TIEMPO"
                      valor={rendimiento.indiceTiempo}
                    />
                    <IndiceBarra nombre="CONOCIMIENTO" valor={rendimiento.indiceConocimiento} />
                    <IndiceBarra nombre="SOLUCION" valor={rendimiento.indiceSolucion} />
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">Tiempo de calificación</p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatearTiempoCalificacion(rendimiento.promedioTiempoCalificacion || 0)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground uppercase">TMO promedio del mes</p>
                        <p className="text-lg font-bold tabular-nums">
                          {rendimiento.tmoPromedio !== null ? `${rendimiento.tmoPromedio}s` : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* === Logros (placeholder — los logros se cargan vía el perfil del usuario; aquí solo mostramos info) === */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" /> Logros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Los logros detallados del asesor están disponibles en su perfil público. Aquí
                    verás un resumen cuando se integre el conteo desde el sistema ATC.
                  </p>
                </CardContent>
              </Card>

              {/* === tNPS tendencia + TMO tendencia === */}
              {rendimiento?.tnpsTendencia && rendimiento.tnpsTendencia.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> tNPS acumulado del mes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart
                        data={rendimiento.tnpsTendencia.map((t: any) => ({
                          fecha: formatearFechaCorta(t.fecha),
                          tNPS: t.tNPS,
                        }))}
                        margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <YAxis domain={[-100, 100]} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line type="monotone" dataKey="tNPS" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {rendimiento?.tmoTendencia && rendimiento.tmoTendencia.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> TMO diario del mes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart
                        data={rendimiento.tmoTendencia.map((t: any) => ({
                          fecha: formatearFechaCorta(t.fecha),
                          tmo: t.tmo,
                        }))}
                        margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [`${value}s`, 'TMO']}
                        />
                        <Line type="monotone" dataKey="tmo" stroke="#1A3F7A" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* === Historial de canjes === */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Historial de canjes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {canjes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Sin canjes registrados.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scroll-fino">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Premio</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Costo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {canjes.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(c.solicitado).toLocaleDateString('es-GT')}
                              </TableCell>
                              <TableCell className="text-sm">
                                <span className="mr-1">{c.premioEmoji}</span>
                                {c.premioNombre}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    c.estado === 'aprobado' && 'border-promotor/50 text-promotor',
                                    c.estado === 'rechazado' && 'border-detractor/50 text-detractor',
                                    c.estado === 'pendiente' && 'border-pasivo/50 text-pasivo'
                                  )}
                                >
                                  {c.estado}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {c.costoATC} ATC
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* === Historial de monedas (transacciones) === */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> Historial de ATC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transacciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Sin transacciones registradas.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scroll-fino">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transacciones.slice(0, 100).map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {t.fecha
                                  ? new Date(t.fecha).toLocaleDateString('es-GT')
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px]">
                                  {t.tipo}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right tabular-nums font-medium',
                                  t.monto > 0 && 'text-promotor',
                                  t.monto < 0 && 'text-detractor'
                                )}
                              >
                                {t.monto > 0 ? '+' : ''}
                                {t.monto}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground hidden sm:table-cell max-w-xs truncate">
                                {t.descripcion || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="pt-2 border-t flex justify-end">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === Sub-componente: barra de progreso de un índice (1-5) ===
function IndiceBarra({ nombre, valor }: { nombre: string; valor: number | null }) {
  const v = typeof valor === 'number' ? valor : 0;
  const pct = Math.min((v / 5) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{nombre}</span>
        <span className="tabular-nums text-muted-foreground">
          {valor !== null ? valor.toFixed(2) : '—'} / 5
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
