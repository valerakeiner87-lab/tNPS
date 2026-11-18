'use client';

/**
 * v3.3.0 Fase 2 — TnpsCalculadoraView
 * -----------------------------------
 * Calculadora basada en conteos (no porcentajes).
 *
 * Dado el inventario actual del asesor (Total=N, Promotores=P, Detractores=D),
 * calcula cuántos promotores consecutivos nuevos (sin agregar detractores)
 * necesita para alcanzar una meta de tNPS objetivo X.
 *
 * Fórmula:
 *   tNPS = ((P + x) - D) / (N + x) * 100 = X
 *   x = (X*N - 100*P + 100*D) / (100 - X)
 *
 * Reglas:
 *   - Si X >= 100 → "Meta inválida"
 *   - Si x <= 0   → "Ya superaste la meta con tu tNPS actual"
 *   - x se redondea hacia arriba (Math.ceil) porque necesitas el promotor completo
 */
import { useMemo, useState } from 'react';
import { Calculator, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/lib/store';

interface ResultadoCalc {
  ok: boolean;
  mensaje: string;
  promotoresNecesarios?: number;
  tnpsResultado?: number;
  detalle?: string;
}

function calcular(
  total: number,
  promotores: number,
  detractores: number,
  meta: number
): ResultadoCalc {
  if (Number.isNaN(meta) || meta === undefined || meta === null) {
    return { ok: false, mensaje: 'Ingresa una meta válida.' };
  }
  if (meta >= 100) {
    return { ok: false, mensaje: 'Meta inválida: el tNPS no puede ser 100 o mayor.' };
  }
  if (meta <= -100) {
    return { ok: false, mensaje: 'Meta inválida: el tNPS no puede ser -100 o menor.' };
  }
  if (total <= 0) {
    return {
      ok: false,
      mensaje: 'Aún no tienes encuestas. Necesitas al menos una para calcular.',
    };
  }

  // x = (X*N - 100*P + 100*D) / (100 - X)
  const numerador = meta * total - 100 * promotores + 100 * detractores;
  const denominador = 100 - meta;
  const x = numerador / denominador;

  if (x <= 0) {
    return {
      ok: true,
      mensaje: 'Ya superaste la meta con tu tNPS actual. ¡Felicidades!',
      promotoresNecesarios: 0,
      tnpsResultado: ((promotores - detractores) / total) * 100,
      detalle: `Tu tNPS actual ya es ${(((promotores - detractores) / total) * 100).toFixed(1)}, mayor o igual que la meta ${meta}.`,
    };
  }

  const xCeil = Math.ceil(x);
  // Recalcular el tNPS real con el x redondeado hacia arriba
  const tnpsResultado = ((promotores + xCeil - detractores) / (total + xCeil)) * 100;
  return {
    ok: true,
    mensaje: `Necesitas ganar ${xCeil} promotor${xCeil === 1 ? '' : 'es'} consecutivo${xCeil === 1 ? '' : 's'} nuevo${xCeil === 1 ? '' : 's'} (sin detractores) para alcanzar un tNPS de ${meta}.`,
    promotoresNecesarios: xCeil,
    tnpsResultado,
    detalle: `Con ${xCeil} promotores nuevos tendrás ${(promotores + xCeil)} promotores, ${detractores} detractores y ${(total + xCeil)} encuestas → tNPS = ${tnpsResultado.toFixed(1)}.`,
  };
}

export function TnpsCalculadoraView() {
  const kpis = useStore((s) => s.kpisFiltrados);

  const total = kpis.total;
  const promotores = kpis.promotores;
  const detractores = kpis.detractores;
  const pasivos = kpis.pasivos;
  const tnpsActual = kpis.tNPS;

  const [metaInput, setMetaInput] = useState<string>('75');
  const meta = parseFloat(metaInput);

  const resultado = useMemo(
    () => calcular(total, promotores, detractores, meta),
    [total, promotores, detractores, meta]
  );

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Calculadora de promotores
          </CardTitle>
          <CardDescription>
            Calcula cuántos promotores consecutivos nuevos necesitas para alcanzar tu meta de
            tNPS. La fórmula asume que no se agregan nuevos detractores ni pasivos.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Base actual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total encuestas</p>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Promotores actuales</p>
            <p className="text-2xl font-bold tabular-nums text-promotor">{promotores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Detractores actuales</p>
            <p className="text-2xl font-bold tabular-nums text-detractor">{detractores}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">tNPS actual</p>
            <p className="text-2xl font-bold tabular-nums">
              {tnpsActual >= 0 ? '+' : ''}
              {tnpsActual.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entrada de meta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Define tu meta</CardTitle>
          <CardDescription>
            Ingresa el tNPS objetivo (entre -99 y 99). La calculadora resolverá cuántos
            promotores consecutivos nuevos necesitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="meta-tnps">Meta de tNPS objetivo</Label>
            <Input
              id="meta-tnps"
              type="number"
              inputMode="decimal"
              min={-99}
              max={99}
              step="1"
              value={metaInput}
              onChange={(e) => setMetaInput(e.target.value)}
              placeholder="75"
            />
            <p className="text-xs text-muted-foreground">
              Sugerencia: 75 = Excelencia mundial · 50 = Muy bueno · 0 = Mejorable.
            </p>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2">
            {[75, 50, 25, 0, -10].map((v) => (
              <Button
                key={v}
                size="sm"
                variant={metaInput === String(v) ? 'default' : 'outline'}
                onClick={() => setMetaInput(String(v))}
              >
                Meta {v >= 0 ? '+' : ''}{v}
              </Button>
            ))}
          </div>

          {/* Fórmula */}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Fórmula usada:</p>
            <p className="font-mono">
              tNPS = ((P + x) − D) / (N + x) × 100 = meta
            </p>
            <p className="font-mono mt-1">
              x = (meta·N − 100·P + 100·D) / (100 − meta)
            </p>
            <p className="mt-2">
              Donde: <strong>N</strong> = total encuestas · <strong>P</strong> = promotores
              actuales · <strong>D</strong> = detractores actuales · <strong>x</strong> =
              promotores consecutivos nuevos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      <Card
        className={
          resultado.ok
            ? resultado.promotoresNecesarios && resultado.promotoresNecesarios > 0
              ? 'border-l-4 border-l-primary'
              : 'border-l-4 border-l-promotor'
            : 'border-l-4 border-l-destructive'
        }
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {resultado.ok ? (
              resultado.promotoresNecesarios && resultado.promotoresNecesarios > 0 ? (
                <Info className="h-4 w-4 text-primary" />
              ) : (
                <Info className="h-4 w-4 text-promotor" />
              )
            ) : (
              <TriangleAlert className="h-4 w-4 text-destructive" />
            )}
            Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {total === 0 ? (
            <div className="rounded-lg bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Aún no tienes encuestas cargadas. Cuando recibas tu primera respuesta, podrás usar
              esta calculadora.
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
                {resultado.promotoresNecesarios !== undefined &&
                resultado.promotoresNecesarios > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Promotores consecutivos nuevos requeridos
                    </p>
                    <p className="text-5xl font-extrabold tabular-nums text-primary mt-1">
                      {resultado.promotoresNecesarios}
                    </p>
                    <p className="text-sm mt-2 text-foreground">
                      Necesitas ganar{' '}
                      <strong>{resultado.promotoresNecesarios}</strong> promoto{' '}
                      {resultado.promotoresNecesarios === 1 ? 'consecutivo nuevo' : 'consecutivos nuevos'}{' '}
                      (sin detractores) para alcanzar un tNPS de{' '}
                      <strong>{meta}</strong>.
                    </p>
                  </>
                ) : resultado.ok ? (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Estado
                    </p>
                    <p className="text-2xl font-bold text-promotor mt-1">
                      Ya superaste la meta
                    </p>
                    <p className="text-sm mt-2 text-foreground">
                      {resultado.mensaje}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-destructive mt-1">
                      Meta inválida
                    </p>
                    <p className="text-sm mt-2 text-foreground">
                      {resultado.mensaje}
                    </p>
                  </>
                )}
              </div>

              {resultado.detalle && (
                <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Detalle del cálculo:</p>
                  <p>{resultado.detalle}</p>
                  {resultado.tnpsResultado !== undefined && (
                    <p className="mt-1">
                      tNPS proyectado tras los nuevos promotores:{' '}
                      <strong className="text-foreground tabular-nums">
                        {resultado.tnpsResultado >= 0 ? '+' : ''}
                        {resultado.tnpsResultado.toFixed(1)}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total final</p>
                  <p className="font-bold tabular-nums">
                    {total + (resultado.promotoresNecesarios ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Promotores finales</p>
                  <p className="font-bold tabular-nums text-promotor">
                    {promotores + (resultado.promotoresNecesarios ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pasivos finales</p>
                  <p className="font-bold tabular-nums text-pasivo">{pasivos}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Detractores finales</p>
                  <p className="font-bold tabular-nums text-detractor">{detractores}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
