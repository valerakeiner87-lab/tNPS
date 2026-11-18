'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { BarChart3, Clock, MessageSquareText, Tags } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { calcularKPIs, calcularKPIsPorFranja, calcularKPIsPorTipificacion, calcularTendencia } from '@/lib/metrics';
import { FRANJAS, LINEAS, type FranjaHoraria, type Linea } from '@/lib/types';
import { TrendChart } from './trend-chart';
import { getMetadata } from '@/app/actions/neon-actions';

/**
 * Vista de métricas personales del asesor.
 * Muestra:
 * - KPIs personales (tNPS, promotores, pasivos, detractores)
 * - tNPS por línea (puntaje global de cada línea)
 * - tNPS por franja horaria (en qué franja le va mejor)
 * - tNPS por tipificación (nivel 1, 2, 3)
 * - Tendencia temporal
 * - Análisis de comentarios (palabras más frecuentes en razones)
 */
export function MisMetricasView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const areaActiva = useStore((s) => s.areaActiva);

  // Última actualización (metadata)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>('');

  useEffect(() => {
    getMetadata()
      .then((meta) => {
        if (meta?.fechaCargaTs) {
          try {
            const d = new Date(Number(meta.fechaCargaTs));
            setUltimaActualizacion(
              d.toLocaleString('es-GT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            );
          } catch {}
        } else if (meta?.fechaCarga) {
          setUltimaActualizacion(meta.fechaCarga);
        }
      })
      .catch(() => undefined);
  }, []);

  // Las encuestasFiltradas ya contienen SOLO las del asesor cuando su rol es 'asesor'
  // (recalcularDatosFiltrados filtra por loginNormalizado).
  const encuestas = encuestasFiltradas;

  const kpis = useMemo(() => calcularKPIs(encuestas), [encuestas]);

  // KPIs por línea (puntaje global de cada línea, calculado sobre las
  // encuestas DEL ASESOR en cada línea)
  const kpisPorLinea = useMemo(() => {
    const resultado: { linea: Linea; tNPS: number; total: number; promotores: number; detractores: number }[] = [];
    for (const linea of LINEAS) {
      const encs = encuestas.filter((e) => e.linea === linea);
      if (encs.length === 0) continue;
      const k = calcularKPIs(encs);
      resultado.push({
        linea,
        tNPS: k.tNPS,
        total: k.total,
        promotores: k.promotores,
        detractores: k.detractores,
      });
    }
    return resultado;
  }, [encuestas]);

  // KPIs por franja horaria
  const kpisPorFranja = useMemo(() => calcularKPIsPorFranja(encuestas), [encuestas]);

  // tNPS por tipificación (nivel 1)
  const tipifNivel1 = useMemo(() => calcularKPIsPorTipificacion(encuestas, 'nivel1').slice(0, 8), [encuestas]);

  // Tendencia
  const tendencia = useMemo(() => calcularTendencia(encuestas, 'dia'), [encuestas]);

  // Análisis de comentarios: palabras más frecuentes en razones
  const palabrasFrecuentes = useMemo(() => {
    const stopwords = new Set([
      'el', 'la', 'los', 'las', 'de', 'del', 'que', 'que', 'y', 'a', 'en', 'un', 'una',
      'por', 'con', 'su', 'se', 'lo', 'le', 'me', 'mi', 'si', 'no', 'es', 'al', 'como',
      'mas', 'pero', 'sus', 'fue', 'ya', 'muy', 'sin', 'cuando', 'para', 'esto', 'eso',
      'the', 'and', 'for', 'with', 'was', 'had', 'have', 'you', 'are', 'but', 'not',
    ]);
    const conteo = new Map<string, number>();
    for (const e of encuestas) {
      const texto = `${e.razon} ${e.comentarioSolucion} ${e.comentarioAdicional}`.toLowerCase();
      const palabras = texto.match(/[a-záéíóúñ]{4,}/g) || [];
      for (const p of palabras) {
        if (stopwords.has(p)) continue;
        conteo.set(p, (conteo.get(p) || 0) + 1);
      }
    }
    return Array.from(conteo.entries())
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [encuestas]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-2">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  if (encuestas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Aún no tienes encuestas en el área {areaActiva === 'digital' ? 'Digital' : 'Telefónico'}</p>
          <p className="text-sm text-muted-foreground">Tus métricas aparecerán aquí cuando recibas tu primera encuesta.</p>
        </CardContent>
      </Card>
    );
  }

  // Datos para gráfico de franja horaria
  const datosFranja = kpisPorFranja
    .filter((f) => f.kpis.total > 0)
    .map((f) => ({
      franja: f.label,
      tNPS: f.kpis.tNPS,
      total: f.kpis.total,
    }));

  // Datos para gráfico de tipificaciones
  const datosTipif = tipifNivel1.map((t) => ({
    nombre: t.valor.length > 18 ? `${t.valor.slice(0, 17)}…` : t.valor,
    tNPS: t.kpis.tNPS,
    total: t.kpis.total,
  }));

  // Mejor franja horaria
  const mejorFranja = datosFranja.length > 0
    ? datosFranja.reduce((a, b) => (a.tNPS > b.tNPS ? a : b))
    : null;

  return (
    <div className="space-y-4">
      {ultimaActualizacion && (
        <div className="text-xs text-muted-foreground text-right">
          Última actualización: <strong className="tabular-nums">{ultimaActualizacion}</strong>
        </div>
      )}

      {/* Header */}
      <Card className="header-claro text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wide">Mis métricas</p>
              <p className="text-xl font-bold">{perfilAsesor?.nombre || perfil?.nombre || 'Asesor'}</p>
            </div>
            <div className="ml-auto flex gap-2 flex-wrap">
              <Badge className="bg-white/15 text-white">{areaActiva === 'digital' ? 'Digital' : 'Telefónico'}</Badge>
              <Badge className="bg-white/15 text-white">{encuestas.length} encuestas</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs personales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-claro-red">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground uppercase">Mi tNPS</p>
            <p className={`text-2xl font-bold ${kpis.tNPS >= 50 ? 'text-promotor' : kpis.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'}`}>
              {kpis.tNPS >= 0 ? '+' : ''}{kpis.tNPS.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Promotores</p>
            <p className="text-2xl font-bold text-promotor">{kpis.promotores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pasivos</p>
            <p className="text-2xl font-bold text-pasivo">{kpis.pasivos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Detractores</p>
            <p className="text-2xl font-bold text-detractor">{kpis.detractores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Score prom.</p>
            <p className="text-2xl font-bold">{kpis.scorePromedio.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mejor franja horaria (insight) */}
      {mejorFranja && (
        <Card className="border-promotor/40 bg-promotor/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-promotor shrink-0" />
            <div>
              <p className="text-sm font-semibold text-promotor">Tu mejor franja horaria: {mejorFranja.franja}</p>
              <p className="text-xs text-muted-foreground">
                tNPS {mejorFranja.tNPS >= 0 ? '+' : ''}{mejorFranja.tNPS.toFixed(1)} con {mejorFranja.total} encuestas.
                Identifica qué haces distinto en este horario y replícalo en los demás.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Puntaje global por línea */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-claro-red" /> Puntaje por línea
          </CardTitle>
          <CardDescription>tNPS de tus encuestas en cada línea de negocio</CardDescription>
        </CardHeader>
        <CardContent>
          {kpisPorLinea.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin datos por línea.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              {kpisPorLinea.map((l) => (
                <div key={l.linea} className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">{l.linea}</p>
                  <p className={`text-2xl font-bold ${l.tNPS >= 50 ? 'text-promotor' : l.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'}`}>
                    {l.tNPS >= 0 ? '+' : ''}{l.tNPS.toFixed(1)}
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{l.total} enc.</span>
                    <span className="text-promotor">{l.promotores}P</span>
                    <span className="text-detractor">{l.detractores}D</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Gráfico de franja horaria */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> tNPS por franja horaria
            </CardTitle>
            <CardDescription>¿En qué horario te va mejor?</CardDescription>
          </CardHeader>
          <CardContent>
            {datosFranja.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sin datos suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={datosFranja} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="franja" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <ReTooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, _n, item) => [`tNPS ${value}`, `${item.payload.franja} · ${item.payload.total} encuestas`]}
                  />
                  <Bar dataKey="tNPS" radius={[4, 4, 0, 0]}>
                    {datosFranja.map((d) => (
                      <Cell key={d.franja} fill={d.tNPS >= 0 ? '#16A34A' : '#DC2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de tipificaciones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tags className="h-4 w-4" /> tNPS por tipificación (Nivel 1)
            </CardTitle>
            <CardDescription>¿Con qué tipo de consultas te va mejor?</CardDescription>
          </CardHeader>
          <CardContent>
            {datosTipif.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sin tipificaciones registradas.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={datosTipif} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <ReTooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, _n, item) => [`tNPS ${value}`, `${item.payload.nombre} · ${item.payload.total} encuestas`]}
                  />
                  <Bar dataKey="tNPS" radius={[0, 4, 4, 0]}>
                    {datosTipif.map((d) => (
                      <Cell key={d.nombre} fill={d.tNPS >= 0 ? '#16A34A' : '#DC2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendencia temporal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mi tendencia</CardTitle>
          <CardDescription>Evolución de tu tNPS día a día</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart encuestas={encuestas} altura={250} mostrarSelector={true} />
        </CardContent>
      </Card>

      {/* Análisis de comentarios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" /> Análisis de comentarios
          </CardTitle>
          <CardDescription>Palabras más frecuentes en las razones y comentarios de tus encuestas</CardDescription>
        </CardHeader>
        <CardContent>
          {palabrasFrecuentes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aún no hay suficientes comentarios para analizar. Vuelve cuando tengas más encuestas.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {palabrasFrecuentes.map(([palabra, count]) => (
                <span
                  key={palabra}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                  style={{
                    fontSize: `${Math.min(0.8 + count * 0.1, 1.4)}rem`,
                    fontWeight: count > 5 ? 700 : 500,
                  }}
                >
                  {palabra}
                  <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
