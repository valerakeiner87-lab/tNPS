'use client';

import { useMemo } from 'react';
import { AlertTriangle, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { calcularKPIsPorTipificacion, identificarTipificacionesCriticas } from '@/lib/metrics';

/**
 * Análisis de puntos de dolor: las razones y tipificaciones que más
 * golpean al tNPS, con emojis y severity visual.
 */
export function PuntosDolor() {
  const encuestas = useStore((s) => s.encuestasFiltradas);

  const analisis = useMemo(() => {
    const detractores = encuestas.filter((e) => e.grupo === 'Detractor');

    // Razones más frecuentes en detractores
    const razones = new Map<string, number>();
    for (const d of detractores) {
      const razon = (d.razon || 'Sin razón especificada').trim().slice(0, 80);
      razones.set(razon, (razones.get(razon) ?? 0) + 1);
    }
    const topRazones = Array.from(razones.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Niveles 1 con más detractores
    const porNivel1 = calcularKPIsPorTipificacion(encuestas, 'nivel1')
      .filter((t) => t.kpis.detractores > 0)
      .sort((a, b) => b.kpis.detractores - a.kpis.detractores)
      .slice(0, 5);

    // Productos con peor tNPS
    const porProducto = new Map<string, { total: number; detractores: number }>();
    for (const e of encuestas) {
      const p = (e.productoFamilia || 'Sin producto').trim();
      const acum = porProducto.get(p) ?? { total: 0, detractores: 0 };
      acum.total++;
      if (e.grupo === 'Detractor') acum.detractores++;
      porProducto.set(p, acum);
    }
    const peoresProductos = Array.from(porProducto.entries())
      .filter(([, v]) => v.total >= 5)
      .map(([nombre, v]) => ({ nombre, pct: (v.detractores / v.total) * 100, total: v.total }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    const insights = identificarTipificacionesCriticas(encuestas);

    return { topRazones, porNivel1, peoresProductos, insights, totalDetractores: detractores.length };
  }, [encuestas]);

  if (encuestas.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        Puntos de dolor <Badge variant="secondary">{analisis.totalDetractores} detractores analizados</Badge>
      </h2>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Razones más frecuentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-detractor" /> Razones más reportadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analisis.topRazones.length === 0 && (
              <p className="text-sm text-muted-foreground">¡Sin detractores con los filtros actuales!</p>
            )}
            {analisis.topRazones.map(([razon, n], i) => (
              <div key={razon + i} className="flex items-start gap-2 text-sm">
                
                <p className="flex-1 min-w-0 truncate" title={razon}>
                  {razon}
                </p>
                <Badge variant="destructive" className="shrink-0">{n}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tipificaciones críticas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-pasivo" /> Tipificaciones (Nivel 1) con más detractores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analisis.porNivel1.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos de tipificación.</p>
            )}
            {analisis.porNivel1.map((t) => (
              <div key={t.valor} className="flex items-center gap-2 text-sm">
                                <p className="flex-1 min-w-0 truncate" title={t.valor}>{t.valor}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t.kpis.pctDetractores.toFixed(0)}% de {t.kpis.total}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Productos afectados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 rotate-180 text-claro-red" /> Productos con más reclamos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analisis.peoresProductos.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin suficientes datos por producto.</p>
            )}
            {analisis.peoresProductos.map((p) => (
              <div key={p.nombre} className="flex items-center gap-2 text-sm">
                                <p className="flex-1 min-w-0 truncate" title={p.nombre}>{p.nombre}</p>
                <Badge variant="outline" className="shrink-0">{p.pct.toFixed(0)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Insights automáticos */}
      {analisis.insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-pasivo" /> Insights automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {analisis.insights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm space-y-1 ${
                  insight.severidad === 'critico'
                    ? 'border-detractor/40 bg-detractor/5'
                    : insight.severidad === 'advertencia'
                      ? 'border-pasivo/40 bg-pasivo/5'
                      : insight.severidad === 'positivo'
                        ? 'border-promotor/40 bg-promotor/5'
                        : 'border-border'
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
