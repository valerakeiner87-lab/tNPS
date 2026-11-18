'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { AsesorConsolidado } from '@/lib/types';
import { calcularTendenciaAcumulada } from '@/lib/metrics';
import { useATCStore } from '@/lib/atc-store';
import { TrendChart } from './trend-chart';

interface Props {
  asesor: AsesorConsolidado | null;
  abierto: boolean;
  onCerrar: () => void;
}

export function AgenteDetalle({ asesor, abierto, onCerrar }: Props) {
  const wallets = useATCStore((s) => s.wallets);

  const wallet = useMemo(
    () => wallets.find((w) => w.loginNormalizado === asesor?.loginNormalizado) ?? null,
    [wallets, asesor]
  );

  if (!asesor) return null;

  const k = asesor.kpis;
  const encuestasRecientes = [...asesor.encuestas]
    .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''))
    .slice(0, 30);

  return (
    <Dialog open={abierto && !!asesor} onOpenChange={(abiertoAhora) => !abiertoAhora && onCerrar()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            {asesor.nombre}
            <Badge variant={asesor.origenHC ? 'default' : 'secondary'} className="text-[10px]">
              {asesor.origenHC ? 'En HC' : 'Fuera de HC'}
            </Badge>
            {asesor.tieneAlertas && (
              <Badge variant="destructive" className="text-[10px] animar-latido">
                {asesor.alertas} alerta{asesor.alertas > 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {asesor.loginNormalizado} · {asesor.linea} · Supervisor: {asesor.supervisor}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">tNPS</p>
                <p className={`text-xl font-bold ${k.tNPS >= 50 ? 'text-promotor' : k.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'}`}>
                  {k.tNPS >= 0 ? '+' : ''}{k.tNPS.toFixed(1)}
                </p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">Encuestas</p>
                <p className="text-xl font-bold">{k.total}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">Prom.</p>
                <p className="text-xl font-bold text-promotor">{k.promotores}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">Pas.</p>
                <p className="text-xl font-bold text-pasivo">{k.pasivos}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">Detr.</p>
                <p className="text-xl font-bold text-detractor">{k.detractores}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-[11px] text-muted-foreground">Score</p>
                <p className="text-xl font-bold">{k.scorePromedio.toFixed(2)}</p>
              </div>
            </div>

            {/* Wallet ATC */}
            {wallet && (
              <div className="rounded-lg border border-pasivo/40 bg-pasivo/5 p-3 flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <p className="font-semibold">Billetera ATC: {wallet.saldo} ATC</p>
                  <p className="text-xs text-muted-foreground">
                    Racha actual: {wallet.rachaActual ?? 0} · Historial: {wallet.stats.totalPromotores} prom. ·{' '}
                    {wallet.stats.totalPasivos} pas. · {wallet.stats.totalDetractores} detr.
                  </p>
                </div>
              </div>
            )}

            {/* Tendencia acumulada */}
            <div>
              <h3 className="text-sm font-semibold mb-1">Tendencia acumulada del asesor</h3>
              <TrendChart
                encuestas={asesor.encuestas}
                titulo="Cierre de día (acumulado)"
                altura={200}
                mostrarSelector={false}
              />
            </div>

            {/* Datos del HC */}
            {asesor.origenHC && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Datos del Health Check</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <p><span className="text-muted-foreground">Documento:</span> {asesor.documento || '—'}</p>
                  <p><span className="text-muted-foreground">Cargo:</span> {asesor.cargo}</p>
                  <p><span className="text-muted-foreground">LOB:</span> {asesor.lob}</p>
                  <p><span className="text-muted-foreground">Sede:</span> {asesor.sede}</p>
                  <p><span className="text-muted-foreground">Ingreso:</span> {asesor.fechaIngreso}</p>
                  <p><span className="text-muted-foreground">Jefe op.:</span> {asesor.supervisor}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Encuestas recientes */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Encuestas recientes (últimas 30)</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto scroll-fino pr-1">
                {encuestasRecientes.map((e) => (
                  <details key={e.id} className="rounded-lg border px-3 py-2 text-sm group">
                    <summary className="flex items-center gap-2 cursor-pointer list-none">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${e.grupo === 'Promotor' ? 'bg-promotor' : e.grupo === 'Pasivo' ? 'bg-pasivo' : 'bg-detractor'}`} aria-hidden />
                      <span className="font-medium">{e.tnps}</span>
                      <span className="text-xs text-muted-foreground">{e.fechaDia} {e.horaExacta}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">{e.nivel1 || '—'}</span>
                      {e.alertaAgresiva && <Badge variant="destructive" className="text-[10px]">Alerta</Badge>}
                      <span className="text-xs text-muted-foreground group-open:hidden">▾</span>
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <p><strong>ID Transacción:</strong> <code className="bg-muted px-1 rounded text-[10px] break-all">{e.idTransaccion || '—'}</code></p>
                        <p><strong>ID Interacción:</strong> <code className="bg-muted px-1 rounded text-[10px] break-all">{e.idInteraccion || '—'}</code></p>
                      </div>
                      {e.razon && <p><strong>Razón:</strong> {e.razon}</p>}
                      {e.comentarioSolucion && <p><strong>Comentario solución:</strong> {e.comentarioSolucion}</p>}
                      {e.comentarioAdicional && <p><strong>Comentario adicional:</strong> {e.comentarioAdicional}</p>}
                      <p><strong>Cola:</strong> {e.cola || '—'} · <strong>Canal:</strong> {e.canal || '—'} · <strong>Área:</strong> {e.area || 'digital'}</p>
                      {e.alertaAgresiva && (
                        <p className="text-detractor">
                          Alerta ({e.alertaSeveridad}): {e.alertaRazon}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
