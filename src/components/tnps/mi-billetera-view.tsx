'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Flame,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { generarReglasATC, CONFIG_ATC_DEFAULT } from '@/lib/atc-types';
import type { PremioATC, TipoTransaccion, TransaccionATC } from '@/lib/atc-types';
import { leerPremiosAction } from '@/app/actions/premios-actions';
import {
  calcularRachasDisponiblesAction,
  canjearPorRachaAction,
} from '@/app/actions/racha-actions';
import { exportarTransaccionesAExcel } from '@/lib/excel-export';

// Traducción + color de los tipos de transacción (igual que en Centralización ATC)
const TIPOS_TRADUCION: Record<TipoTransaccion, string> = {
  SALDO_INICIAL: 'Saldo inicial',
  PROMOTOR: 'Promotor',
  PROMOTOR_RACHA: 'Promotor (racha)',
  PASIVO: 'Pasivo',
  DETRACTOR_ASESOR: 'Detractor',
  DETRACTOR_SERVICIO: 'Detractor',
  DETRACTOR_INDETERMINADO: 'Detractor',
  AJUSTE_ADMIN: 'Ajuste admin',
  CANJE: 'Canje',
  CANJE_RACHA: 'Canje por racha',
  APELACION_GANADA: 'Apelación ganada',
  APELACION_PERDIDA: 'Apelación perdida',
  JUEGO: 'Juego',
  FORMULARIO: 'Formulario',
  LOGRO: 'Logro',
  STREAK_BONUS: 'Bonus racha',
};

const COLOR_TIPO: Record<TipoTransaccion, string> = {
  SALDO_INICIAL: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  PROMOTOR: 'bg-promotor/15 text-promotor',
  PROMOTOR_RACHA: 'bg-promotor/20 text-promotor',
  PASIVO: 'bg-pasivo/15 text-pasivo',
  DETRACTOR_ASESOR: 'bg-detractor/15 text-detractor',
  DETRACTOR_SERVICIO: 'bg-detractor/15 text-detractor',
  DETRACTOR_INDETERMINADO: 'bg-muted text-muted-foreground',
  AJUSTE_ADMIN: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  CANJE: 'bg-claro-blue/15 text-claro-blue',
  CANJE_RACHA: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  APELACION_GANADA: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  APELACION_PERDIDA: 'bg-detractor/15 text-detractor',
  JUEGO: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  FORMULARIO: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  LOGRO: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  STREAK_BONUS: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
};

/** Etiqueta legible para el tipo de duración del premio */
function labelDuracionTipo(tipo?: string | null): string {
  switch (tipo) {
    case 'hora':
      return 'hora(s)';
    case 'dia':
      return 'día(s)';
    case 'semana':
      return 'semana(s)';
    case 'mes':
      return 'mes(es)';
    default:
      return '';
  }
}

export function MiBilleteraView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const atc = useATCStore();
  const { miWallet, premios, canjes, transacciones, config } = atc;

  const [premioSeleccionado, setPremioSeleccionado] = useState<PremioATC | null>(null);
  const [canjeando, setCanjeando] = useState(false);
  const [canjeandoRacha, setCanjeandoRacha] = useState(false);
  const [rachasDisponibles, setRachasDisponibles] = useState<number>(0);
  const [rachasCargadas, setRachasCargadas] = useState(false);

  const loginAsesor = perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '';

  // Cargar premios desde Neon (filtrados por área) al montar
  useEffect(() => {
    leerPremiosAction()
      .then((premiosCargados) => {
        useATCStore.setState({ premios: premiosCargados });
      })
      .catch(() => undefined);
  }, []);

  // v3.0.7: Calcular rachas disponibles al montar
  useEffect(() => {
    if (!loginAsesor || rachasCargadas) return;
    let mounted = true;
    calcularRachasDisponiblesAction(loginAsesor)
      .then((res) => {
        if (!mounted) return;
        setRachasDisponibles(res.rachasDisponibles);
        setRachasCargadas(true);
        if (res.rachasDisponibles > 0) {
          toast.success(
            `¡Tienes ${res.rachasDisponibles} racha${res.rachasDisponibles === 1 ? '' : 's'} disponible${res.rachasDisponibles === 1 ? '' : 's'}! Canjea un premio por racha 🔥`
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setRachasDisponibles(0);
          setRachasCargadas(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [loginAsesor, rachasCargadas]);

  // KPIs de movimientos (ingresos vs egresos)
  const { totalIngresos, totalEgresos } = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    for (const t of transacciones) {
      if (t.monto > 0) ingresos += t.monto;
      else if (t.monto < 0) egresos += Math.abs(t.monto);
    }
    return { totalIngresos: ingresos, totalEgresos: egresos };
  }, [transacciones]);

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Wallet className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu login de red y documento para ver tu billetera ATC.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canjesPendientes = canjes.filter((c) => c.estado === 'pendiente').length;

  async function canjearPorRacha(premio: PremioATC) {
    setCanjeandoRacha(true);
    try {
      const res = await canjearPorRachaAction(premio.id);
      if (res.ok) {
        toast.success(`🔥 ¡Canje por racha exitoso! Disfruta tu: ${premio.nombre}`);
        setRachasDisponibles((n) => Math.max(0, n - 1));
        await atc.refrescarMiWallet();
        await atc.sincronizar(true).catch(() => undefined);
      } else {
        toast.error(res.error || 'No se pudo canjear por racha.');
      }
    } finally {
      setCanjeandoRacha(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* v3.0.7: Banner de rachas disponibles */}
      {rachasDisponibles > 0 && (
        <Card className="border-orange-400/40 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 animar-aparecer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                🔥 Tienes {rachasDisponibles} racha{rachasDisponibles === 1 ? '' : 's'} disponible{rachasDisponibles === 1 ? '' : 's'} para canjear premios
              </p>
              <p className="text-xs text-orange-700/80 dark:text-orange-300/80">
                Busca premios con el badge <span className="font-semibold">🔥 Canjeable por racha</span> y reclámalos sin gastar ATC.
              </p>
            </div>
            <Badge className="bg-orange-500 hover:bg-orange-500 text-white gap-1 shrink-0">
              <Flame className="h-3 w-3" /> {rachasDisponibles}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* === Header con saldo destacado === */}
      <Card className="header-claro text-white border-0 overflow-hidden">
        <CardContent className="p-6 relative">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Wallet className="h-8 w-8" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs uppercase tracking-wide">Mi saldo ATC</p>
              <p className="text-4xl sm:text-5xl font-bold tabular-nums">{miWallet?.saldo ?? 0}</p>
              <p className="text-white/70 text-xs">disponible para canjear</p>
            </div>
            <div className="ml-auto flex flex-col items-stretch gap-2">
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => atc.refrescarMiWallet()}
              >
                <RefreshCw className="h-4 w-4" /> Actualizar
              </Button>
            </div>
          </div>

          {/* Mini-resumen: promotores, racha, canjeado */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-white/70 text-xs">Promotores</p>
              <p className="font-bold text-xl tabular-nums">
                {miWallet?.stats.totalPromotores ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-white/70 text-xs">Racha</p>
              <p className="font-bold text-xl tabular-nums">{miWallet?.rachaActual ?? 0}</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <p className="text-white/70 text-xs">Ganado / Gastado</p>
              <p className="font-bold text-sm tabular-nums">
                +{miWallet?.stats.totalGanado ?? 0} / -{miWallet?.stats.totalGastado ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="premios">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="premios" className="flex-1 sm:flex-none">
            Premios
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="flex-1 sm:flex-none">
            Movimientos
            {transacciones.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] tabular-nums">
                {transacciones.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="canjes" className="flex-1 sm:flex-none">
            Mis canjes
            {canjesPendientes > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px]">{canjesPendientes}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reglas" className="flex-1 sm:flex-none">
            Reglas
          </TabsTrigger>
        </TabsList>

        {/* === Premios === */}
        <TabsContent value="premios" className="space-y-3">
          {premios.filter((p) => p.activo).length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                El catálogo de premios está vacío. Pídele a tu supervisor que publique premios.
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {premios
                .filter((p) => p.activo)
                .map((premio) => {
                  const suficiente = (miWallet?.saldo ?? 0) >= premio.costoATC;
                  // v3.0.9: Botón de racha con contador — habilitado solo si
                  // rachasDisponibles >= promotoresRequeridosRacha
                  const promotoresReqRacha = premio.promotoresRequeridosRacha ?? 3;
                  const cumpleRacha = rachasDisponibles >= promotoresReqRacha;
                  const rachaFaltan = Math.max(0, promotoresReqRacha - rachasDisponibles);
                  // Si tipoCanje === 'racha', NO se puede canjear con ATC
                  const ocultarCanjeATC = premio.canjePorRacha && premio.tipoCanje === 'racha';
                  return (
                    <Card key={premio.id} className="flex flex-col hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex-1 flex flex-col gap-2">
                        {/* Emoji prominente */}
                        <div className="h-20 w-full rounded-lg bg-muted flex items-center justify-center relative">
                          <span className="text-5xl" aria-hidden>{premio.emoji || '🎁'}</span>
                          {premio.canjePorRacha && (
                            <Badge className="absolute top-1.5 right-1.5 bg-orange-500 hover:bg-orange-500 text-white gap-0.5 text-[10px]">
                              <Flame className="h-2.5 w-2.5" /> Racha
                            </Badge>
                          )}
                        </div>
                        <p className="font-semibold leading-tight">{premio.nombre}</p>
                        {premio.descripcion && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{premio.descripcion}</p>
                        )}
                        {/* Badges de restricciones */}
                        <div className="flex flex-wrap items-center gap-1">
                          {premio.tmoMaximoRequerido && premio.tmoMaximoRequerido > 0 ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-500/40 text-[10px] gap-0.5">
                              🔒 TMO ≤ {premio.tmoMaximoRequerido}s
                            </Badge>
                          ) : null}
                          {premio.lineaRequerida ? (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              📞 {premio.lineaRequerida}
                            </Badge>
                          ) : null}
                          {premio.duracionTipo && premio.duracionValor && premio.duracionValor > 0 ? (
                            <Badge variant="outline" className="text-blue-700 border-blue-500/40 text-[10px] gap-0.5">
                              ⏱️ {premio.duracionValor} {labelDuracionTipo(premio.duracionTipo)}
                            </Badge>
                          ) : null}
                          {typeof premio.maxReclamosPorAsesor === 'number' && premio.maxReclamosPorAsesor > 0 ? (
                            <Badge variant="outline" className="text-purple-700 border-purple-500/40 text-[10px] gap-0.5">
                              🔢 máx {premio.maxReclamosPorAsesor}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <Badge variant="secondary" className="font-bold">
                            {premio.canjePorRacha && premio.tipoCanje === 'racha'
                              ? 'Solo por racha 🔥'
                              : `${premio.costoATC} ATC`}
                          </Badge>
                          {premio.stock === 0 ? (
                            <Badge variant="destructive">Agotado</Badge>
                          ) : premio.stock > 0 ? (
                            <span className="text-xs text-muted-foreground">{premio.stock} disp.</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin límite</span>
                          )}
                        </div>
                        {/* Botones de canje */}
                        <div className="flex gap-1.5">
                          {!ocultarCanjeATC && (
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={!suficiente || premio.stock === 0}
                              onClick={() => setPremioSeleccionado(premio)}
                            >
                              {suficiente
                                ? 'Canjear con ATC'
                                : `Faltan ${premio.costoATC - (miWallet?.saldo ?? 0)}`}
                            </Button>
                          )}
                          {premio.canjePorRacha &&
                            (premio.tipoCanje === 'racha' || premio.tipoCanje === 'ambas') && (
                              <Button
                                size="sm"
                                variant={ocultarCanjeATC ? 'default' : 'outline'}
                                className={
                                  ocultarCanjeATC
                                    ? 'flex-1 gap-1'
                                    : 'gap-1'
                                }
                                disabled={!cumpleRacha || canjeandoRacha || premio.stock === 0}
                                onClick={() => canjearPorRacha(premio)}
                                title={
                                  cumpleRacha
                                    ? 'Canjear usando una racha de promotores'
                                    : `Te faltan ${rachaFaltan} para completar la racha`
                                }
                              >
                                <Flame className="h-3.5 w-3.5" />
                                {cumpleRacha
                                  ? 'Comprar con racha ✅'
                                  : `Comprar con racha (${rachaFaltan} faltan)`}
                              </Button>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* === Movimientos (ledger del asesor) === */}
        <TabsContent value="movimientos" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Resumen ingresos / egresos + exportar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-promotor/30 bg-promotor/5 px-3 py-2 flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-promotor" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase">Ingresos</p>
                    <p className="font-bold text-promotor tabular-nums">+{totalIngresos}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-detractor/30 bg-detractor/5 px-3 py-2 flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-detractor" />
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase">Egresos</p>
                    <p className="font-bold text-detractor tabular-nums">-{totalEgresos}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto gap-2"
                  disabled={transacciones.length === 0}
                  onClick={() => exportarTransaccionesAExcel(transacciones)}
                >
                  <Download className="h-3.5 w-3.5" /> Exportar Excel
                </Button>
              </div>

              {/* Lista de movimientos */}
              {transacciones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aún no tienes movimientos de ATC. ¡Sigue recibiendo encuestas para empezar a sumar!
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto scroll-fino">
                  {transacciones.map((t) => (
                    <MovimientoFila key={t.id} t={t} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Mis canjes === */}
        <TabsContent value="canjes" className="space-y-2">
          {canjes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Todavía no has canjeado premios. ¡A seguir sumando promotores!
              </CardContent>
            </Card>
          ) : (
            canjes.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {c.premioEmoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.premioNombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.solicitado).toLocaleString('es-GT')} · {c.costoATC} ATC
                      {c.comentario && ` · ${c.comentario}`}
                    </p>
                  </div>
                  <Badge
                    className={
                      c.estado === 'aprobado'
                        ? 'bg-promotor text-white'
                        : c.estado === 'rechazado'
                          ? 'bg-detractor text-white'
                          : 'bg-pasivo text-white'
                    }
                  >
                    {c.estado === 'aprobado'
                      ? 'Aprobado'
                      : c.estado === 'rechazado'
                        ? 'Rechazado'
                        : 'Pendiente'}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* === Reglas ATC === */}
        <TabsContent value="reglas" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">Cómo ganas ATC</p>
              {generarReglasATC(CONFIG_ATC_DEFAULT).map((r) => (
                <div
                  key={r.evento}
                  className="flex items-center justify-between text-sm border-b last:border-0 py-1.5"
                >
                  <div>
                    <p className="font-medium">{r.evento}</p>
                    <p className="text-xs text-muted-foreground">{r.detalle}</p>
                  </div>
                  <Badge
                    variant={
                      r.puntos.startsWith('+')
                        ? 'default'
                        : r.puntos.startsWith('-')
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {r.puntos}
                  </Badge>
                </div>
              ))}
              {config.caducidadDias && config.caducidadDias > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">⏰ Caducidad de ATC</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Los ATC no canjeados caducan a los <strong>{config.caducidadDias} días</strong> de
                    ser ganados. ¡Úsalos antes de que expiren!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo: confirmar canje */}
      <Dialog open={!!premioSeleccionado} onOpenChange={(a) => !a && setPremioSeleccionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Canjear: {premioSeleccionado?.nombre}</DialogTitle>
            <DialogDescription>
              Se descontarán {premioSeleccionado?.costoATC} ATC de tu saldo. Tu saldo actual:{' '}
              {miWallet?.saldo ?? 0} ATC.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPremioSeleccionado(null)}>
              Cancelar
            </Button>
            <Button
              disabled={canjeando}
              onClick={async () => {
                if (!premioSeleccionado) return;
                setCanjeando(true);
                try {
                  await atc.solicitarCanje(premioSeleccionado);
                  setPremioSeleccionado(null);
                } finally {
                  setCanjeando(false);
                }
              }}
            >
              {canjeando ? 'Procesando…' : 'Confirmar canje'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Fila de movimiento (transacción ATC)
// ============================================================
function MovimientoFila({ t }: { t: TransaccionATC }) {
  const fecha = t.creado || t.fecha;
  const esIngreso = t.monto >= 0;
  const labelTipo = TIPOS_TRADUCION[t.tipo] ?? t.tipo;
  const colorTipo = COLOR_TIPO[t.tipo] ?? 'bg-muted text-muted-foreground';

  return (
    <div className="flex items-center gap-3 rounded-lg border p-2.5">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          esIngreso ? 'bg-promotor/15 text-promotor' : 'bg-detractor/15 text-detractor'
        }`}
        aria-hidden
      >
        {esIngreso ? (
          <ArrowUpCircle className="h-5 w-5" />
        ) : (
          <ArrowDownCircle className="h-5 w-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={colorTipo} variant="outline">
            {labelTipo}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fecha ? new Date(fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
          </span>
        </div>
        {t.descripcion && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.descripcion}</p>
        )}
      </div>

      <div
        className={`font-bold tabular-nums text-right shrink-0 ${
          esIngreso ? 'text-promotor' : 'text-detractor'
        }`}
      >
        {esIngreso ? '+' : ''}
        {t.monto}
      </div>
    </div>
  );
}
