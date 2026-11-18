'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';

export function CalculadoraTNPS() {
  const kpisActuales = useStore((s) => s.kpisFiltrados);

  const [promotores, setPromotores] = useState(60);
  const [pasivos, setPasivos] = useState(20);
  const [detractores, setDetractores] = useState(20);

  const total = promotores + pasivos + detractores;
  const tNPS = useMemo(
    () => (total > 0 ? ((promotores - detractores) / total) * 100 : 0),
    [promotores, detractores, total]
  );

  const clasificacion =
    tNPS >= 75 ? { texto: 'Excelencia mundial', color: 'text-promotor' }
    : tNPS >= 50 ? { texto: 'Muy bueno', color: 'text-promotor' }
    : tNPS >= 0 ? { texto: 'Mejorable', color: 'text-pasivo' }
    : tNPS >= -30 ? { texto: 'Requiere atención', color: 'text-detractor' }
    : { texto: 'Crítico', color: 'text-detractor' };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-claro-red" /> Calculadora tNPS
          </CardTitle>
          <CardDescription>
            Simula escenarios moviendo los porcentajes de cada grupo. Fórmula:
            <code className="bg-muted px-1.5 py-0.5 rounded ml-1 text-xs">
              tNPS = ((Promotores − Detractores) / Total) × 100
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controles */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Promotores</span>
                <span className="tabular-nums font-bold text-promotor">{promotores}%</span>
              </div>
              <Slider
                value={[promotores]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => {
                  const resto = 100 - v;
                  const totalPasDet = pasivos + detractores || 1;
                  setPromotores(v);
                  setPasivos(Math.round((pasivos / totalPasDet) * resto));
                  setDetractores(100 - v - Math.round((pasivos / totalPasDet) * resto));
                }}
                aria-label="Porcentaje de promotores"
              />
              <p className="text-xs text-muted-foreground">Scores 9–10 · clientes entusiastas</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Pasivos</span>
                <span className="tabular-nums font-bold text-pasivo">{pasivos}%</span>
              </div>
              <Slider
                value={[pasivos]}
                min={0}
                max={100 - promotores}
                step={1}
                onValueChange={([v]) => {
                  setPasivos(v);
                  setDetractores(100 - promotores - v);
                }}
                aria-label="Porcentaje de pasivos"
              />
              <p className="text-xs text-muted-foreground">Scores 7–8 · satisfechos pero no entusiastas</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Detractores</span>
                <span className="tabular-nums font-bold text-detractor">{detractores}%</span>
              </div>
              <Slider
                value={[detractores]}
                min={0}
                max={100 - promotores}
                step={1}
                onValueChange={([v]) => {
                  setDetractores(v);
                  setPasivos(100 - promotores - v);
                }}
                aria-label="Porcentaje de detractores"
              />
              <p className="text-xs text-muted-foreground">Scores 0–6 · clientes insatisfechos</p>
            </div>
          </div>

          {/* Resultado */}
          <div className="rounded-2xl header-claro text-white p-6 text-center relative overflow-hidden">
            <p className="text-white/70 text-sm">tNPS simulado</p>
            <p className="text-5xl font-extrabold tabular-nums mt-1">
              {tNPS >= 0 ? '+' : ''}
              {tNPS.toFixed(1)}
            </p>
            <p className={`mt-2 font-semibold ${clasificacion.color === 'text-promotor' ? 'text-emerald-300' : clasificacion.color === 'text-pasivo' ? 'text-amber-300' : 'text-red-300'}`}>
              {clasificacion.texto}
            </p>
            <p className="text-xs text-white/60 mt-2">
              Con {total > 0 ? '100' : '0'}% distribuido: {promotores} prom. · {pasivos} pas. · {detractores} detr.
            </p>
          </div>

          {/* Comparar con el real */}
          {kpisActuales.total > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <p className="text-muted-foreground">
                Tu tNPS real actual:{' '}
                <span className="font-bold text-foreground">
                  {kpisActuales.tNPS >= 0 ? '+' : ''}
                  {kpisActuales.tNPS.toFixed(1)}
                </span>{' '}
                (P {kpisActuales.pctPromotores.toFixed(0)}% · Pa {kpisActuales.pctPasivos.toFixed(0)}% · D{' '}
                {kpisActuales.pctDetractores.toFixed(0)}%)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPromotores(Math.round(kpisActuales.pctPromotores));
                  setPasivos(Math.round(kpisActuales.pctPasivos));
                  setDetractores(Math.round(kpisActuales.pctDetractores));
                }}
              >
                Cargar escenario actual
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referencia */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">¿Cómo se interpreta?</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="rounded-lg border border-detractor/40 bg-detractor/5 p-2">
            <p className="font-bold text-detractor">−100 a −31</p>
            <p className="text-muted-foreground mt-1">Crítico</p>
          </div>
          <div className="rounded-lg border border-detractor/30 bg-detractor/5 p-2">
            <p className="font-bold text-detractor">−30 a −1</p>
            <p className="text-muted-foreground mt-1">Bajo</p>
          </div>
          <div className="rounded-lg border border-pasivo/40 bg-pasivo/5 p-2">
            <p className="font-bold text-pasivo">0 a 49</p>
            <p className="text-muted-foreground mt-1">Mejorable</p>
          </div>
          <div className="rounded-lg border border-promotor/40 bg-promotor/5 p-2">
            <p className="font-bold text-promotor">50 a 74</p>
            <p className="text-muted-foreground mt-1">Muy bueno</p>
          </div>
          <div className="rounded-lg border border-promotor/50 bg-promotor/10 p-2">
            <p className="font-bold text-promotor">75 a 100</p>
            <p className="text-muted-foreground mt-1">Excelencia</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
