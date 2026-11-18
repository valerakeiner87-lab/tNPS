'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts';
import { Clock, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { calcularKPIsPorFranja, detectarPatronesFranja } from '@/lib/metrics';
import { KPICard } from './kpi-card';

export function PatronesView() {
  const encuestas = useStore((s) => s.encuestasFiltradas);

  const kpisFranja = useMemo(() => calcularKPIsPorFranja(encuestas), [encuestas]);
  const insights = useMemo(() => detectarPatronesFranja(encuestas), [encuestas]);

  const datosGrafico = useMemo(
    () => kpisFranja.map((f) => ({ franja: f.label, tNPS: f.kpis.tNPS, total: f.kpis.total })),
    [kpisFranja]
  );

  const mejorFranja = useMemo(() => {
    const conDatos = kpisFranja.filter((f) => f.kpis.total > 0);
    if (conDatos.length === 0) return null;
    return conDatos.reduce((a, b) => (a.kpis.tNPS > b.kpis.tNPS ? a : b));
  }, [kpisFranja]);

  const peorFranja = useMemo(() => {
    const conDatos = kpisFranja.filter((f) => f.kpis.total > 0);
    if (conDatos.length === 0) return null;
    return conDatos.reduce((a, b) => (a.kpis.tNPS < b.kpis.tNPS ? a : b));
  }, [kpisFranja]);

  if (encuestas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Sin encuestas para analizar patrones</p>
          <p className="text-sm text-muted-foreground">Carga datos o ajusta los filtros de fecha.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          titulo="Mejor franja"
          valor={mejorFranja ? `${mejorFranja.kpis.tNPS.toFixed(1)}` : '—'}
          subtitulo={mejorFranja?.label ?? 'Sin datos'}
         
          color="promotor"
        />
        <KPICard
          titulo="Franja a reforzar"
          valor={peorFranja ? `${peorFranja.kpis.tNPS.toFixed(1)}` : '—'}
          subtitulo={peorFranja?.label ?? 'Sin datos'}
         
          color="detractor"
        />
        <KPICard titulo="Encuestas analizadas" valor={encuestas.length.toLocaleString('es-GT')} />
        <KPICard titulo="Insights generados" valor={insights.length} color="pasivo" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Gráfica tNPS por franja */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">tNPS por franja horaria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosGrafico} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="franja" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <ReTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _n, item) => [
                    `tNPS ${value}`,
                    `${item.payload.franja} · ${item.payload.total} encuestas`,
                  ]}
                />
                <Bar dataKey="tNPS" radius={[6, 6, 0, 0]}>
                  {datosGrafico.map((d) => (
                    <Cell key={d.franja} fill={d.tNPS >= 50 ? '#16A34A' : d.tNPS >= 0 ? '#F59E0B' : '#DC2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detalle por franja */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalle por franja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpisFranja.map((f) => (
              <div
                key={f.franja}
                className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium min-w-32">{f.label}</span>
                {f.kpis.total === 0 ? (
                  <span className="text-xs text-muted-foreground">Sin encuestas</span>
                ) : (
                  <>
                    <span
                      className={`font-bold tabular-nums ${
                        f.kpis.tNPS >= 50 ? 'text-promotor' : f.kpis.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'
                      }`}
                    >
                      {f.kpis.tNPS >= 0 ? '+' : ''}
                      {f.kpis.tNPS.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {f.kpis.total} encuestas · {f.kpis.promotores} prom. · {f.kpis.pasivos} pas. · {f.kpis.detractores} detr.
                    </span>
                  </>
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Madrugada 00–06 · Mañana 06–12 · Mediodía 12–15 · Tarde 15–19 · Noche 19–24
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-pasivo" /> Patrones detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm space-y-1 ${
                  insight.severidad === 'critico'
                    ? 'border-detractor/40 bg-detractor/5'
                    : insight.severidad === 'advertencia'
                      ? 'border-pasivo/40 bg-pasivo/5'
                      : 'border-promotor/40 bg-promotor/5'
                }`}
              >
                <p className="font-medium">{insight.titulo}</p>
                <p className="text-xs text-muted-foreground">{insight.descripcion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
