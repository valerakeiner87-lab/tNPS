'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';
import type { Linea } from '@/lib/types';
import { LINEAS } from '@/lib/types';
import { calcularKPIsPorTipificacion } from '@/lib/metrics';
import { KPICard } from './kpi-card';
import { TrendChart } from './trend-chart';

export function DashboardLinea() {
  const [linea, setLinea] = useState<Linea>('Fijo Soporte');
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const setTab = useStore((s) => s.setTab);

  const encuestasLinea = useMemo(
    () => encuestasFiltradas.filter((e) => e.linea === linea),
    [encuestasFiltradas, linea]
  );

  const kpis = useMemo(() => {
    const total = encuestasLinea.length;
    if (total === 0) return null;
    const promotores = encuestasLinea.filter((e) => e.grupo === 'Promotor').length;
    const pasivos = encuestasLinea.filter((e) => e.grupo === 'Pasivo').length;
    const detractores = total - promotores - pasivos;
    const score = encuestasLinea.reduce((s, e) => s + e.tnps, 0) / total;
    return {
      total,
      promotores,
      pasivos,
      detractores,
      tNPS: ((promotores - detractores) / total) * 100,
      score,
      asesores: new Set(encuestasLinea.map((e) => e.loginNormalizado)).size,
    };
  }, [encuestasLinea]);

  const topNivel1 = useMemo(
    () => calcularKPIsPorTipificacion(encuestasLinea, 'nivel1').slice(0, 8),
    [encuestasLinea]
  );

  const datosGrafico = useMemo(
    () =>
      topNivel1.map((t) => ({
        nombre: t.valor.length > 18 ? `${t.valor.slice(0, 17)}…` : t.valor,
        tNPS: t.kpis.tNPS,
        total: t.kpis.total,
      })),
    [topNivel1]
  );

  return (
    <div className="space-y-4 animar-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={linea} onValueChange={(v) => setLinea(v as Linea)}>
          <TabsList>
            {LINEAS.map((l) => (
              <TabsTrigger key={l} value={l}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <button
          onClick={() => setTab('global')}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Volver al dashboard global
        </button>
      </div>

      {!kpis ? (
        <Card>
          <CardContent className="py-14 text-center space-y-2">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Sin encuestas para {linea}</p>
            <p className="text-sm text-muted-foreground">Ajusta los filtros o carga más datos.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPICard
              titulo="tNPS de la línea"
              valor={`${kpis.tNPS >= 0 ? '+' : ''}${kpis.tNPS.toFixed(1)}`}
              subtitulo={`${kpis.total.toLocaleString('es-GT')} encuestas`}
              color={kpis.tNPS >= 50 ? 'promotor' : kpis.tNPS >= 0 ? 'pasivo' : 'detractor'}
            />
            <KPICard titulo="Promotores" valor={kpis.promotores.toLocaleString('es-GT')} color="promotor" />
            <KPICard titulo="Pasivos" valor={kpis.pasivos.toLocaleString('es-GT')} color="pasivo" />
            <KPICard titulo="Detractores" valor={kpis.detractores.toLocaleString('es-GT')} color="detractor" />
            <KPICard
              titulo="Asesores activos"
              valor={kpis.asesores}
              subtitulo={`${kpis.score.toFixed(2)} promedio`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="animar-escalar-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tendencia · {linea}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart encuestas={encuestasLinea} altura={280} mostrarSelector={false} />
              </CardContent>
            </Card>

            <Card className="animar-escalar-fade">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">tNPS por tipificación (Nivel 1)</CardTitle>
              </CardHeader>
              <CardContent>
                {datosGrafico.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">Sin tipificaciones registradas.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={datosGrafico} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                      <ReTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number, _n, item) => [`tNPS ${value}`, `${item.payload.nombre} · ${item.payload.total} encuestas`]}
                      />
                      <Bar dataKey="tNPS" radius={[0, 4, 4, 0]}>
                        {datosGrafico.map((d) => (
                          <Cell key={d.nombre} fill={d.tNPS >= 50 ? '#16A34A' : d.tNPS >= 0 ? '#F59E0B' : '#DC2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
