'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useStore } from '@/lib/store';
import type { Linea } from '@/lib/types';
import { KPICard } from './kpi-card';
import { TrendChart } from './trend-chart';
import { PuntosDolor } from './puntos-dolor';

export function DashboardGlobal() {
  const kpis = useStore((s) => s.kpisFiltrados);
  const kpisPorLinea = useStore((s) => s.kpisPorLinea);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const setFiltroLinea = useStore((s) => s.setFiltroLinea);
  const setTab = useStore((s) => s.setTab);

  const datosDistribucion = useMemo(
    () => [
      { name: 'Promotores', value: kpis.promotores, color: '#16A34A' },
      { name: 'Pasivos', value: kpis.pasivos, color: '#F59E0B' },
      { name: 'Detractores', value: kpis.detractores, color: '#DC2626' },
    ],
    [kpis]
  );

  if (kpis.total === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No hay encuestas con los filtros actuales</p>
          <p className="text-sm text-muted-foreground">
            Ajusta los filtros de fecha o carga nuevos archivos desde la pestaña Carga.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animar-fade-in">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          titulo="tNPS Global"
          valor={`${kpis.tNPS >= 0 ? '+' : ''}${kpis.tNPS.toFixed(1)}`}
          subtitulo={`${kpis.total.toLocaleString('es-GT')} encuestas`}
          color={kpis.tNPS >= 50 ? 'promotor' : kpis.tNPS >= 0 ? 'pasivo' : 'detractor'}
        />
        <KPICard
          titulo="Promotores"
          valor={kpis.promotores.toLocaleString('es-GT')}
          subtitulo={`${kpis.pctPromotores.toFixed(1)}% del total`}
          color="promotor"
        />
        <KPICard
          titulo="Pasivos"
          valor={kpis.pasivos.toLocaleString('es-GT')}
          subtitulo={`${kpis.pctPasivos.toFixed(1)}% del total`}
          color="pasivo"
        />
        <KPICard
          titulo="Detractores"
          valor={kpis.detractores.toLocaleString('es-GT')}
          subtitulo={`${kpis.pctDetractores.toFixed(1)}% del total`}
          color="detractor"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Tendencia */}
        <Card className="lg:col-span-2 animar-escalar-fade">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución del tNPS</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart encuestas={encuestasFiltradas} altura={300} />
          </CardContent>
        </Card>

        {/* Distribución */}
        <Card className="animar-escalar-fade">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución por grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={datosDistribucion}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  label={(entry) => `${(entry as { value: number }).value}`}
                >
                  {datosDistribucion.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-muted-foreground">
              Score promedio: <strong>{kpis.scorePromedio.toFixed(2)}</strong> / 10
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por línea */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Desglose por línea de negocio</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {(['Móvil', 'Fijo Soporte', 'Fijo Información'] as Linea[]).map((linea) => {
            const k = kpisPorLinea[linea];
            return (
              <Card
                key={linea}
                className="cursor-pointer hover:border-claro-red/50 hover:shadow-md transition-all animar-escalar-fade"
                onClick={() => {
                  setFiltroLinea(linea);
                  setTab('linea');
                }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{linea}</p>
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        k.tNPS >= 50 ? 'text-promotor' : k.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'
                      }`}
                    >
                      {k.tNPS >= 0 ? '+' : ''}
                      {k.tNPS.toFixed(1)}
                    </p>
                  </div>
                  <Progress value={Math.max(0, k.pctPromotores)} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-promotor font-medium">P {k.promotores.toLocaleString('es-GT')}</span>
                    <span className="text-pasivo font-medium">Pa {k.pasivos.toLocaleString('es-GT')}</span>
                    <span className="text-detractor font-medium">D {k.detractores.toLocaleString('es-GT')}</span>
                    <span>Total {k.total.toLocaleString('es-GT')}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right">Clic para ver detalle</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Puntos de dolor */}
      <PuntosDolor />
    </div>
  );
}
