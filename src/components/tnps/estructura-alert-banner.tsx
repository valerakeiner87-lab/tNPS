'use client';

import { AlertTriangle, AlertOctagon, X, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';

/**
 * Banner de alerta que aparece cuando Qualtrics cambia la estructura
 * del archivo de exportación (columnas renombradas, agregadas o eliminadas).
 *
 * Se muestra en la parte superior de la página hasta que el usuario
 * lo descarta. Incluye un detalle expandible con la lista de columnas
 * faltantes, recomendadas y nuevas.
 */
export function EstructuraAlertBanner() {
  const alerta = useStore((s) => s.alertaEstructuraQualtrics);
  const descartar = useStore((s) => s.descartarAlertaEstructura);
  const [expandido, setExpandido] = useState(false);

  if (!alerta) return null;

  const esBloqueante = !alerta.ok; // faltan obligatorias
  const esAdvertencia = alerta.ok && alerta.estructuraCambiada; // hay columnas nuevas

  const Icono = esBloqueante ? AlertOctagon : esAdvertencia ? AlertTriangle : CheckCircle2;
  const color = esBloqueante
    ? 'bg-red-600/95 text-white'
    : esAdvertencia
      ? 'bg-amber-500/95 text-amber-950'
      : 'bg-emerald-600/95 text-white';

  return (
    <div className={`${color} text-xs sm:text-[13px] px-3 sm:px-6 py-2`}>
      <div className="mx-auto max-w-7xl flex items-center gap-2">
        <Icono className="h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1 font-medium">{alerta.mensaje}</p>
        <button
          type="button"
          aria-label={expandido ? 'Ocultar detalle' : 'Ver detalle'}
          className="shrink-0 h-6 px-2 rounded hover:bg-black/10 flex items-center gap-1 font-medium"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expandido ? 'Ocultar' : 'Detalle'}
        </button>
        <button
          type="button"
          aria-label="Cerrar alerta"
          className="shrink-0 h-6 w-6 rounded hover:bg-black/10 flex items-center justify-center"
          onClick={descartar}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {expandido && (
        <div className="mx-auto max-w-7xl mt-2 pb-1 space-y-2">
          {alerta.sugerencia && (
            <p className="opacity-90">
              <span className="font-semibold">Acción sugerida:</span> {alerta.sugerencia}
            </p>
          )}

          <div className="grid sm:grid-cols-3 gap-2">
            {alerta.faltantesObligatorias.length > 0 && (
              <Card className="bg-white/15 border-white/20 text-current">
                <CardContent className="p-2.5 space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide opacity-80">
                    Columnas obligatorias faltantes ({alerta.faltantesObligatorias.length})
                  </p>
                  <ul className="text-[11px] space-y-0.5 list-disc list-inside">
                    {alerta.faltantesObligatorias.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {alerta.faltantesRecomendadas.length > 0 && (
              <Card className="bg-white/15 border-white/20 text-current">
                <CardContent className="p-2.5 space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide opacity-80">
                    Columnas recomendadas faltantes ({alerta.faltantesRecomendadas.length})
                  </p>
                  <ul className="text-[11px] space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
                    {alerta.faltantesRecomendadas.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {alerta.columnasDesconocidas.length > 0 && (
              <Card className="bg-white/15 border-white/20 text-current">
                <CardContent className="p-2.5 space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide opacity-80">
                    Columnas nuevas detectadas ({alerta.columnasDesconocidas.length})
                  </p>
                  <ul className="text-[11px] space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
                    {alerta.columnasDesconocidas.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="opacity-90 text-[11px]">
            <span className="font-semibold">Total columnas detectadas:</span>{' '}
            {alerta.columnasDetectadas.length}
          </div>

          {!esBloqueante && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/15 border-white/30 text-current hover:bg-white/25"
                onClick={descartar}
              >
                Entendido, cerrar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
