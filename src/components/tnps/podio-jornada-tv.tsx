'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Linea } from '@/lib/types';
import { LINEAS } from '@/lib/types';
import { useStore } from '@/lib/store';

/**
 * Podio estilo pantalla de TV: tipografía grande, rotación automática
 * entre líneas y paleta oscura para pantallas del piso de operaciones.
 */
export function PodioJornadaTV() {
  const asesores = useStore((s) => s.asesoresConsolidados);
  const [rotar, setRotar] = useState(true);
  const [lineaIdx, setLineaIdx] = useState(0);

  const lineaActual = LINEAS[lineaIdx];

  // Rotación automática cada 8 segundos entre las vistas: Global + 3 líneas
  useEffect(() => {
    if (!rotar) return;
    const t = setInterval(() => setLineaIdx((i) => (i + 1) % (LINEAS.length + 1)), 8000);
    return () => clearInterval(t);
  }, [rotar]);

  const esGlobal = lineaIdx === LINEAS.length;

  const ranking = useMemo(() => {
    let lista = asesores.filter((a) => a.kpis.total >= 3);
    if (!esGlobal) lista = lista.filter((a) => a.linea === LINEAS[lineaIdx]);
    return lista.sort((a, b) => b.kpis.tNPS - a.kpis.tNPS || b.kpis.total - a.kpis.total).slice(0, 5);
  }, [asesores, esGlobal, lineaIdx]);

  const titulares = [
    ...LINEAS.map((l) => `LÍNEA ${l.toUpperCase()}`),
    'TOP GLOBAL',
  ];
  const titulo = titulares[lineaIdx];

  const medallas = ['1°', '2°', '3°', '4°', '5°'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Optimizado para pantallas de TV del piso · Rotación cada 8s</p>
        <div className="flex items-center gap-2">
          <Switch id="rotar-tv" checked={rotar} onCheckedChange={setRotar} />
          <Label htmlFor="rotar-tv" className="text-xs">Rotación automática</Label>
        </div>
      </div>

      <Card className="overflow-hidden border-0">
        {/* Pantalla TV */}
        <div className="header-claro text-white p-6 sm:p-10 min-h-[480px] relative overflow-hidden">
          <div className="relative text-center mb-6">
            <p className="text-white/60 text-xs tracking-[0.3em] uppercase">ATC Digital · Claro Guatemala</p>
            <motion.h2
              key={titulo}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl sm:text-4xl font-bold mt-1"
            >
              {titulo}
            </motion.h2>
          </div>

          {ranking.length === 0 ? (
            <p className="text-center text-white/70 py-20 text-lg">
              Aún no hay datos para mostrar en pantalla
            </p>
          ) : (
            <div className="relative space-y-3 max-w-3xl mx-auto">
              {ranking.map((a, i) => (
                <motion.div
                  key={a.loginNormalizado}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
                    i === 0
                      ? 'bg-gradient-to-r from-amber-400/90 to-amber-600/90 text-amber-950 shadow-2xl scale-105'
                      : 'bg-white/10 backdrop-blur border border-white/15'
                  }`}
                >
                  <span className="text-3xl sm:text-4xl" aria-hidden>{medallas[i]}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-lg sm:text-2xl font-bold truncate">{a.nombre}</p>
                    <p className="text-xs sm:text-sm opacity-80">
                      {a.linea} · {a.kpis.total} encuestas · {a.kpis.promotores} prom.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-4xl font-extrabold tabular-nums">
                      +{a.kpis.tNPS.toFixed(1)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider opacity-70">tNPS</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Selector de línea (dots) */}
          <div className="relative flex justify-center gap-2 mt-8">
            {[...LINEAS.map(() => ''), ''].map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setLineaIdx(i);
                  setRotar(false);
                }}
                aria-label={`Ver ${i < LINEAS.length ? LINEAS[i] : 'global'}`}
                className={`h-3 rounded-full transition-all ${
                  lineaIdx === i ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'
                }`}
              >
                <span className="sr-only">{`Ver ${i < LINEAS.length ? LINEAS[i] : 'global'}`}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sugerencia de uso</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            Coloca esta pestaña en las pantallas del piso de operaciones (modo oscuro recomendado).
            La rotación automática alterna entre las 3 líneas de negocio y el top global cada 8 segundos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
