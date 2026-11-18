'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Clock, LineChart as LineIcon, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { calcularKPIs, calcularKPIsPorFranja, calcularKPIsPorLinea, calcularKPIsPorTipificacion } from '@/lib/metrics';
import { FRANJAS, LINEAS, type Linea } from '@/lib/types';

const FRANJA_EMOJI: Record<string, string> = {
  madrugada: '🌙',
  mañana: '🌅',
  mediodia: '☀️',
  tarde: '🌇',
  noche: '🌆',
};

const LINEA_EMOJI: Record<Linea, string> = {
  'Móvil': '📱',
  'Fijo Soporte': '🎧',
  'Fijo Información': 'ℹ️',
};

/**
 * Análisis de impacto por franja horaria, tipificación (Nivel 1) y línea.
 * Calcula los KPIs client-side a partir de las encuestas ya cargadas en el store.
 */
export function AnalisisImpactoView() {
  const encuestas = useStore((s) => s.encuestasFiltradas);

  // === 1. Impacto por franja horaria ===
  const porFranja = useMemo(() => calcularKPIsPorFranja(encuestas), [encuestas]);
  const datosFranja = useMemo(
    () =>
      porFranja
        .filter((f) => f.kpis.total > 0)
        .map((f) => ({
          nombre: `${FRANJA_EMOJI[f.franja] ?? ''} ${f.label}`,
          tNPS: Math.round(f.kpis.tNPS),
          total: f.kpis.total,
        })),
    [porFranja]
  );

  // === 2. Tipificación (Nivel 1) — top 10 ===
  const tipificaciones = useMemo(
    () => calcularKPIsPorTipificacion(encuestas, 'nivel1').filter((t) => t.kpis.total >= 1),
    [encuestas]
  );
  const top10Tipificaciones = useMemo(
    () => tipificaciones.slice(0, 10),
    [tipificaciones]
  );

  // === 3. Impacto por línea ===
  const porLinea = useMemo(() => calcularKPIsPorLinea(encuestas), [encuestas]);
  const datosLinea = useMemo(
    () =>
      LINEAS.filter((l) => porLinea[l]?.total > 0).map((l) => ({
        nombre: `${LINEA_EMOJI[l] ?? ''} ${l}`,
        linea: l,
        tNPS: Math.round(porLinea[l].tNPS),
        total: porLinea[l].total,
      })),
    [porLinea]
  );

  const kpisGlobal = useMemo(() => calcularKPIs(encuestas), [encuestas]);

  if (encuestas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Sin encuestas para analizar</p>
          <p className="text-sm text-muted-foreground">
            Carga datos o ajusta los filtros de fecha para ver el análisis de impacto.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <BarChart3 className="h-3 w-3" /> {encuestas.length} encuestas en el filtro
          </Badge>
          <Badge variant="outline" className="gap-1">
            tNPS global:{' '}
            <span
              className={
                kpisGlobal.tNPS >= 50
                  ? 'text-promotor font-bold'
                  : kpisGlobal.tNPS >= 0
                    ? 'text-pasivo font-bold'
                    : 'text-detractor font-bold'
              }
            >
              {kpisGlobal.tNPS >= 0 ? '+' : ''}
              {kpisGlobal.tNPS.toFixed(0)}
            </span>
          </Badge>
          <p className="text-xs text-muted-foreground">
            Los gráficos se actualizan con el filtro de fechas del header.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* === Impacto por franja horaria === */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Impacto por franja horaria
            </CardTitle>
            <CardDescription>tNPS por bloque horario del día</CardDescription>
          </CardHeader>
          <CardContent>
            {datosFranja.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sin datos de franja horaria.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, datosFranja.length * 48)}>
                <BarChart data={datosFranja} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    domain={[-100, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={130}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, _n, item) => [
                      `tNPS ${value}`,
                      `${item.payload.nombre} · ${item.payload.total} encuestas`,
                    ]}
                  />
                  <Bar dataKey="tNPS" radius={[0, 4, 4, 0]}>
                    {datosFranja.map((d) => (
                      <Cell
                        key={d.nombre}
                        fill={d.tNPS >= 50 ? '#16A34A' : d.tNPS >= 0 ? '#F59E0B' : '#DC2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* === Impacto por línea === */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" /> Impacto por línea
            </CardTitle>
            <CardDescription>tNPS por línea de negocio (Móvil, Fijo Soporte, Fijo Información)</CardDescription>
          </CardHeader>
          <CardContent>
            {datosLinea.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sin datos por línea.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, datosLinea.length * 48)}>
                <BarChart data={datosLinea} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    domain={[-100, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={140}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, _n, item) => [
                      `tNPS ${value}`,
                      `${item.payload.linea} · ${item.payload.total} encuestas`,
                    ]}
                  />
                  <Bar dataKey="tNPS" radius={[0, 4, 4, 0]}>
                    {datosLinea.map((d) => (
                      <Cell
                        key={d.nombre}
                        fill={d.tNPS >= 50 ? '#16A34A' : d.tNPS >= 0 ? '#F59E0B' : '#DC2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Tabla de tipificaciones (Nivel 1) top 10 === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" /> Tipificación de impacto (Nivel 1)
          </CardTitle>
          <CardDescription>
            Top 10 tipificaciones con mayor volumen de encuestas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {top10Tipificaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin tipificaciones de Nivel 1 disponibles.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Tipificación (Nivel 1)</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Prom.</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Pas.</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Detr.</TableHead>
                    <TableHead className="text-right">tNPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top10Tipificaciones.map((t, i) => (
                    <TableRow key={t.valor}>
                      <TableCell className="text-center font-semibold text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={t.valor}>
                        {t.valor || '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{t.kpis.total}</TableCell>
                      <TableCell className="text-center tabular-nums text-promotor hidden sm:table-cell">
                        {t.kpis.promotores}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-pasivo hidden sm:table-cell">
                        {t.kpis.pasivos}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-detractor hidden sm:table-cell">
                        {t.kpis.detractores}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          t.kpis.tNPS >= 50
                            ? 'text-promotor'
                            : t.kpis.tNPS >= 0
                              ? 'text-pasivo'
                              : 'text-detractor'
                        }`}
                      >
                        {t.kpis.tNPS >= 0 ? '+' : ''}
                        {t.kpis.tNPS.toFixed(0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
