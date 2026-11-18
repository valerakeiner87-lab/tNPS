'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts';
import { Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { calcularKPIsPorTipificacion, identificarTipificacionesCriticas } from '@/lib/metrics';

type Nivel = 'nivel1' | 'nivel2' | 'nivel3' | 'nivel4' | 'nivel5';
type GrupoFiltro = 'todos' | 'Promotor' | 'Pasivo' | 'Detractor';

const NIVELES: { id: Nivel; etiqueta: string }[] = [
  { id: 'nivel1', etiqueta: 'Nivel 1' },
  { id: 'nivel2', etiqueta: 'Nivel 2' },
  { id: 'nivel3', etiqueta: 'Nivel 3' },
  { id: 'nivel4', etiqueta: 'Nivel 4' },
  { id: 'nivel5', etiqueta: 'Nivel 5' },
];

const GRUPO_COLOR_HEX: Record<GrupoFiltro, string> = {
  Promotor: '#16A34A', // verde
  Pasivo: '#F59E0B', // amarillo/amber
  Detractor: '#DC2626', // rojo
  todos: '#1A3F7A', // navy (multi)
};

export function TipificacionesView() {
  const [nivel, setNivel] = useState<Nivel>('nivel1');
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoFiltro>('todos');
  const encuestasOriginales = useStore((s) => s.encuestasFiltradas);

  // v3.0.7: filtrar por grupo (Promotor/Pasivo/Detractor) si está seleccionado
  const encuestas = useMemo(() => {
    if (grupoFiltro === 'todos') return encuestasOriginales;
    return encuestasOriginales.filter((e) => e.grupo === grupoFiltro);
  }, [encuestasOriginales, grupoFiltro]);

  const tipificaciones = useMemo(
    () => calcularKPIsPorTipificacion(encuestas, nivel).filter((t) => t.kpis.total >= 3),
    [encuestas, nivel]
  );

  const criticas = useMemo(() => identificarTipificacionesCriticas(encuestas), [encuestas]);

  const datosGrafico = useMemo(
    () =>
      tipificaciones.slice(0, 12).map((t) => ({
        nombre: t.valor.length > 16 ? `${t.valor.slice(0, 15)}…` : t.valor,
        tNPS: t.kpis.tNPS,
        total: t.kpis.total,
      })),
    [tipificaciones]
  );

  if (encuestasOriginales.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Tags className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Sin encuestas para analizar tipificaciones</p>
          <p className="text-sm text-muted-foreground">Carga datos o ajusta los filtros.</p>
        </CardContent>
      </Card>
    );
  }

  // Color de las barras: si hay un filtro de grupo seleccionado, todas las barras
  // usan el color de ese grupo; si es "todos", se usa la regla por tNPS.
  const colorBarra = (tnps: number) => {
    if (grupoFiltro !== 'todos') return GRUPO_COLOR_HEX[grupoFiltro];
    return tnps >= 50 ? '#16A34A' : tnps >= 0 ? '#F59E0B' : '#DC2626';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
          <TabsList>
            {NIVELES.map((n) => (
              <TabsTrigger key={n.id} value={n.id}>{n.etiqueta}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5" />
          {tipificaciones.length} tipificaciones distintas (mín. 3 encuestas)
        </p>
      </div>

      {/* v3.0.7: Filtro por grupo */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Filtrar por grupo:</span>
        <Tabs value={grupoFiltro} onValueChange={(v) => setGrupoFiltro(v as GrupoFiltro)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="Promotor" className="text-promotor data-[state=active]:text-promotor">
              Promotor
            </TabsTrigger>
            <TabsTrigger value="Pasivo" className="text-pasivo data-[state=active]:text-pasivo">
              Pasivo
            </TabsTrigger>
            <TabsTrigger value="Detractor" className="text-detractor data-[state=active]:text-detractor">
              Detractor
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {grupoFiltro !== 'todos' && (
          <Badge
            variant="outline"
            className="capitalize"
            style={{
              color: GRUPO_COLOR_HEX[grupoFiltro],
              borderColor: GRUPO_COLOR_HEX[grupoFiltro],
            }}
          >
            Mostrando solo: {grupoFiltro}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              tNPS por tipificación
              {grupoFiltro === 'Pasivo' && (
                <span className="ml-2 text-pasivo">(barras amarillas)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {datosGrafico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                Sin tipificaciones con suficientes datos en este nivel{grupoFiltro !== 'todos' ? ` para el grupo "${grupoFiltro}"` : ''}.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, datosGrafico.length * 34)}>
                <BarChart data={datosGrafico} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="nombre" width={125} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
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
                    {datosGrafico.map((d) => (
                      <Cell key={d.nombre} fill={colorBarra(d.tNPS)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tabla detallada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-y-auto scroll-fino">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2 font-medium">Tipificación</th>
                    <th className="py-2 px-2 text-center font-medium">Total</th>
                    <th className="py-2 px-2 text-center font-medium">Prom.</th>
                    <th className="py-2 px-2 text-center font-medium">Pas.</th>
                    <th className="py-2 px-2 text-center font-medium">Detr.</th>
                    <th className="py-2 pl-2 text-right font-medium">tNPS</th>
                  </tr>
                </thead>
                <tbody>
                  {tipificaciones.map((t) => (
                    <tr key={t.valor} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="py-2 pr-2 max-w-48 truncate" title={t.valor}>{t.valor}</td>
                      <td className="py-2 px-2 text-center tabular-nums">{t.kpis.total}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-promotor">{t.kpis.promotores}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-pasivo">{t.kpis.pasivos}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-detractor">{t.kpis.detractores}</td>
                      <td
                        className={`py-2 pl-2 text-right font-semibold tabular-nums ${
                          t.kpis.tNPS >= 50 ? 'text-promotor' : t.kpis.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'
                        }`}
                      >
                        {t.kpis.tNPS >= 0 ? '+' : ''}
                        {t.kpis.tNPS.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {criticas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tipificaciones que más golpean al tNPS</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {criticas.map((c, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm space-y-1 ${
                  c.severidad === 'critico'
                    ? 'border-detractor/40 bg-detractor/5'
                    : c.severidad === 'advertencia'
                      ? 'border-pasivo/40 bg-pasivo/5'
                      : 'border-promotor/40 bg-promotor/5'
                }`}
              >
                <p className="font-medium">{c.titulo}</p>
                <p className="text-xs text-muted-foreground">{c.descripcion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

