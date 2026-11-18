'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Loader2, MessageSquareText, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getEncuestaDetalle } from '@/app/actions/neon-actions';
import type { Encuesta } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EncuestaDetalleDialogProps {
  encuestaId: string | null;
  /** Área del usuario actual (define qué índices mostrar).
   *  v3.3.0: solo Digital; el parámetro se conserva por compatibilidad de API. */
  area?: 'digital';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Componente de fila de índice (1-5) con estrellas */
function IndiceFila({ nombre, valor }: { nombre: string; valor: number | null | undefined }) {
  const v = typeof valor === 'number' ? Math.round(valor) : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{nombre}</p>
        <p className="text-lg font-bold tabular-nums">{v ?? '—'}</p>
      </div>
      <div className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              v !== null && i <= v
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground/40'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function EncuestaDetalleDialog({
  encuestaId,
  open,
  onOpenChange,
}: EncuestaDetalleDialogProps) {
  const [encuesta, setEncuesta] = useState<Encuesta | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!open || !encuestaId) {
      setEncuesta(null);
      return;
    }
    let cancel = false;
    setCargando(true);
    getEncuestaDetalle(encuestaId)
      .then((data) => {
        if (!cancel) setEncuesta(data as Encuesta | null);
      })
      .catch(() => {
        if (!cancel) setEncuesta(null);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, encuestaId]);

  // Índice promedio
  // v3.3.0: Solo área Digital — se muestran TIEMPO/CONOCIMIENTO/SOLUCION.
  const indices = encuesta
    ? [
        { nombre: 'TIEMPO', valor: encuesta.indiceTiempo },
        { nombre: 'CONOCIMIENTO', valor: encuesta.indiceConocimiento },
        { nombre: 'SOLUCION', valor: encuesta.indiceSolucion },
      ]
    : [];

  const indicePromedio = encuesta?.indicePromedio
    ? Math.round(encuesta.indicePromedio * 100) / 100
    : (() => {
        const vals = indices.map((i) => i.valor).filter((v): v is number => typeof v === 'number');
        if (vals.length === 0) return null;
        return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
      })();

  const tipificaciones = encuesta
    ? [
        encuesta.nivel1,
        encuesta.nivel2,
        encuesta.nivel3,
        encuesta.nivel4,
        encuesta.nivel5,
      ].filter((t) => t && t.trim().length > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-fino">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Detalle de encuesta
          </DialogTitle>
          <DialogDescription>
            Información completa de la interacción y la calificación del cliente.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !encuesta ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No se encontró la encuesta solicitada.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Encabezado: ID + grupo + score */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      ID Transacción
                    </p>
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded block break-all">
                      {encuesta.idTransaccion || encuesta.id}
                    </code>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Score tNPS
                    </p>
                    <p
                      className={cn(
                        'text-3xl font-bold tabular-nums',
                        encuesta.grupo === 'Promotor'
                          ? 'text-promotor'
                          : encuesta.grupo === 'Pasivo'
                            ? 'text-pasivo'
                            : 'text-detractor'
                      )}
                    >
                      {encuesta.tnps}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      encuesta.grupo === 'Promotor'
                        ? 'bg-promotor text-white'
                        : encuesta.grupo === 'Pasivo'
                          ? 'bg-pasivo text-white'
                          : 'bg-detractor text-white'
                    }
                  >
                    {encuesta.grupo}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {encuesta.fechaDia} · {encuesta.horaExacta}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Índice promedio destacado */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Índice promedio
                  </p>
                  <p className="text-3xl font-bold tabular-nums">
                    {indicePromedio ?? '—'}
                    <span className="text-base text-muted-foreground"> / 5</span>
                  </p>
                </div>
                <div className="flex items-center gap-0.5" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-6 w-6',
                        indicePromedio !== null && i <= Math.round(indicePromedio)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted-foreground/40'
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Los 3 índices */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {indices.map((i) => (
                <IndiceFila key={i.nombre} nombre={i.nombre} valor={i.valor} />
              ))}
            </div>

            {/* Razón + comentarios */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {encuesta.razon && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Razón
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{encuesta.razon}</p>
                  </div>
                )}
                {encuesta.comentarioSolucion && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Comentario de solución
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {encuesta.comentarioSolucion}
                    </p>
                  </div>
                )}
                {encuesta.comentarioAdicional && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Comentario adicional
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {encuesta.comentarioAdicional}
                    </p>
                  </div>
                )}
                {!encuesta.razon &&
                  !encuesta.comentarioSolucion &&
                  !encuesta.comentarioAdicional && (
                    <p className="text-sm text-muted-foreground italic">
                      El cliente no dejó comentarios adicionales.
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Tipificaciones (Nivel 1-5) */}
            {tipificaciones.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Tipificaciones
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tipificaciones.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        N{i + 1}: {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Datos operativos */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Datos de la interacción
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <DatoRotulo etiqueta="Canal" valor={encuesta.canal} />
                  <DatoRotulo etiqueta="Medio contacto" valor={encuesta.medioContacto} />
                  <DatoRotulo etiqueta="Unidad" valor={encuesta.unidad} />
                  <DatoRotulo etiqueta="Cola" valor={encuesta.cola} />
                  <DatoRotulo etiqueta="Línea" valor={encuesta.linea} />
                  <DatoRotulo etiqueta="Franja" valor={encuesta.franjaHoraria} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DatoRotulo({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{etiqueta}</p>
      <p className="text-sm font-medium break-words">{valor || '—'}</p>
    </div>
  );
}
