'use client';

/**
 * v3.3.0 Fase 2 — TnpsResumenView
 * --------------------------------
 * Vista de resumen tNPS para el asesor:
 *  - Score tNPS actual con clasificación (Excelencia, Muy bueno, Mejorable, etc.)
 *  - Breakdown Promotores / Pasivos / Detractores (conteo y porcentaje)
 *  - Tendencia simple (acumulada) con la mini-gráfica existente
 *  - Atajos a las vistas detalladas (encuestas, calculadora)
 *
 * Toda la data se obtiene del store (kpisFiltrados, encuestasFiltradas) que
 * ya está filtrada por el login del asesor logueado.
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Calculator as CalcIcon,
  Inbox,
  ListChecks,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useStore } from '@/lib/store';
import { TrendChart } from './trend-chart';
import { KPICard } from './kpi-card';

function escalaTNPS(tnps: number): { texto: string; color: 'promotor' | 'pasivo' | 'detractor' } {
  if (tnps >= 75) return { texto: 'Excelencia mundial', color: 'promotor' };
  if (tnps >= 50) return { texto: 'Muy bueno', color: 'promotor' };
  if (tnps >= 0) return { texto: 'Mejorable', color: 'pasivo' };
  if (tnps >= -30) return { texto: 'Requiere atención', color: 'detractor' };
  return { texto: 'Crítico', color: 'detractor' };
}

export function TnpsResumenView() {
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const perfil = useStore((s) => s.perfil);
  const kpis = useStore((s) => s.kpisFiltrados);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const setTab = useStore((s) => s.setTab);

  const escala = useMemo(() => escalaTNPS(kpis.tNPS), [kpis.tNPS]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu login de red para ver tu resumen tNPS.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (encuestasFiltradas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Aún no tienes encuestas</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tus clientes respondan la encuesta tNPS, aquí verás tu score, desglose y
              tendencia.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nombreCorto = perfilAsesor?.nombre?.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {/* HERO: score tNPS */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl animar-gradiente-claro animar-brillo text-white p-6 sm:p-8 relative overflow-hidden shadow-xl"
      >
        <div className="relative">
          <p className="text-white/75 text-sm">
            Hola{nombreCorto ? `, ${nombreCorto}` : ''} — este es tu tNPS actual
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Score tNPS</p>
              <p className="text-5xl sm:text-6xl font-extrabold tabular-nums leading-none">
                {kpis.tNPS >= 0 ? '+' : ''}
                {kpis.tNPS.toFixed(1)}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {escala.texto}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3">
              <p className="text-xs text-white/70">Total encuestas</p>
              <p className="text-2xl font-bold tabular-nums">{kpis.total.toLocaleString('es-GT')}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3">
              <p className="text-xs text-white/70">Score promedio</p>
              <p className="text-2xl font-bold tabular-nums">{kpis.scorePromedio.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* KPI cards: Promotores / Pasivos / Detractores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <KPICard
            titulo="Promotores"
            valor={kpis.promotores}
            subtitulo={`${kpis.pctPromotores.toFixed(1)}% del total`}
            color="promotor"
            icono={<TrendingUp className="h-5 w-5" />}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <KPICard
            titulo="Pasivos"
            valor={kpis.pasivos}
            subtitulo={`${kpis.pctPasivos.toFixed(1)}% del total`}
            color="pasivo"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <KPICard
            titulo="Detractores"
            valor={kpis.detractores}
            subtitulo={`${kpis.pctDetractores.toFixed(1)}% del total`}
            color="detractor"
          />
        </motion.div>
      </div>

      {/* Breakdown visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Distribución de respuestas
          </CardTitle>
          <CardDescription>
            Muestra cómo se reparten tus {kpis.total} encuestas entre los tres grupos tNPS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarraDistribucion
            titulo="Promotores (9-10)"
            valor={kpis.pctPromotores}
            color="var(--promotor, #10b981)"
            textoAdicional={`${kpis.promotores} encuestas`}
          />
          <BarraDistribucion
            titulo="Pasivos (7-8)"
            valor={kpis.pctPasivos}
            color="var(--pasivo, #f59e0b)"
            textoAdicional={`${kpis.pasivos} encuestas`}
          />
          <BarraDistribucion
            titulo="Detractores (0-6)"
            valor={kpis.pctDetractores}
            color="var(--detractor, #ef4444)"
            textoAdicional={`${kpis.detractores} encuestas`}
          />
        </CardContent>
      </Card>

      {/* Tendencia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Mi tendencia tNPS
          </CardTitle>
          <CardDescription>
            Evolución acumulada de tu score tNPS a lo largo del tiempo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            encuestas={encuestasFiltradas}
            titulo="Mi tNPS acumulado"
            altura={240}
            mostrarSelector={false}
          />
        </CardContent>
      </Card>

      {/* Atajos */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Accesos rápidos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setTab('tnps-encuestas')}
            className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ListChecks className="h-4 w-4 text-primary" />
            </span>
            <p className="mt-2 font-medium text-sm flex items-center gap-1">
              Ver mis encuestas
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </p>
            <p className="text-xs text-muted-foreground">Detalle de cada respuesta recibida.</p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setTab('tnps-calculadora')}
            className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalcIcon className="h-4 w-4 text-primary" />
            </span>
            <p className="mt-2 font-medium text-sm flex items-center gap-1">
              Calculadora de promotores
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </p>
            <p className="text-xs text-muted-foreground">¿Cuántos promotores necesitas para tu meta?</p>
          </motion.button>
        </div>
      </section>

      {/* Botón a vista detallada */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setTab('tnps-encuestas')} className="gap-2">
          Ver todas mis encuestas <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BarraDistribucion({
  titulo,
  valor,
  color,
  textoAdicional,
}: {
  titulo: string;
  valor: number;
  color: string;
  textoAdicional?: string;
}) {
  const pct = Math.max(0, Math.min(100, valor || 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{titulo}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {pct.toFixed(1)}%{textoAdicional ? <span className="text-muted-foreground ml-2 font-normal">· {textoAdicional}</span> : null}
        </span>
      </div>
      <Progress value={pct} className="h-2.5" />
    </div>
  );
}
