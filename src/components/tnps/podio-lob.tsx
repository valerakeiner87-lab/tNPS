'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Medal, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AsesorConsolidado, Linea } from '@/lib/types';
import { LINEAS } from '@/lib/types';
import { useStore } from '@/lib/store';
import { AgenteDetalle } from './agente-detalle';

export function PodioLOB() {
  const [linea, setLinea] = useState<Linea>('Fijo Soporte');
  // Usar asesoresRanking (TODOS los asesores del área) para que el asesor
  // se compare con sus pares del mismo LOB
  const asesores = useStore((s) => s.asesoresRanking);
  const [seleccionado, setSeleccionado] = useState<AsesorConsolidado | null>(null);

  const ranking = useMemo(
    () =>
      [...asesores]
        .filter((a) => a.linea === linea && a.kpis.total >= 3)
        .sort((a, b) => b.kpis.tNPS - a.kpis.tNPS || b.kpis.total - a.kpis.total)
        .slice(0, 10),
    [asesores, linea]
  );

  return (
    <div className="space-y-4">
      <Tabs value={linea} onValueChange={(v) => setLinea(v as Linea)}>
        <TabsList className="w-full sm:w-auto">
          {LINEAS.map((l) => (
            <TabsTrigger key={l} value={l} className="gap-1.5 flex-1 sm:flex-none">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {ranking.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Sin podio para {linea}</p>
            <p className="text-sm text-muted-foreground">Se necesitan asesores con al menos 3 encuestas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {ranking.slice(0, 3).map((a, i) => (
            <motion.button
              key={a.loginNormalizado}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12 }}
              onClick={() => setSeleccionado(a)}
              className={`text-left rounded-xl border p-4 hover:shadow-md transition-shadow ${
                i === 0 ? 'border-pasivo/60 bg-gradient-to-b from-pasivo/10 to-transparent' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {`${i + 1}°`}
                </span>
                <span className="text-xl font-bold tabular-nums text-promotor">+{a.kpis.tNPS.toFixed(1)}</span>
              </div>
              <p className="mt-2 font-semibold truncate">{a.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {a.kpis.total} encuestas · {a.kpis.promotores} prom. · {a.kpis.detractores} detr.
              </p>
            </motion.button>
          ))}
        </div>
      )}

      {ranking.length > 3 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="h-4 w-4 text-pasivo" /> Ranking {linea} (top 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {ranking.map((a, i) => (
              <button
                key={a.loginNormalizado}
                onClick={() => setSeleccionado(a)}
                className="w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-accent/50 text-left"
              >
                <span className="w-7 text-center font-semibold">{i + 1}°</span>
                <p className="flex-1 truncate font-medium">{a.nombre}</p>
                <span className="text-xs text-muted-foreground hidden sm:block">{a.kpis.total} encuestas</span>
                <span className="font-bold tabular-nums text-promotor">+{a.kpis.tNPS.toFixed(1)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <AgenteDetalle asesor={seleccionado} abierto={!!seleccionado} onCerrar={() => setSeleccionado(null)} />
    </div>
  );
}
