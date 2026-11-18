'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { AsesorAvatar } from './asesor-avatar';
import { exportarWalletsAExcel, exportarCanjesAExcel, exportarTransaccionesAExcel } from '@/lib/excel-export';
import { semanaISOActual } from '@/lib/atc-types';
import { BDStatusPanel } from './bd-status-panel';

interface KPI {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: 'up' | 'down' | 'flat';
}

/**
 * Panel Supervisor — vista consolidada para supervisores y admins.
 * KPIs en tiempo real, top asesores, alertas, canjes pendientes,
 * movimientos recientes y exportación a Excel.
 */
export function PanelSupervisor() {
  const perfil = useStore((s) => s.perfil);
  const areaActiva = useStore((s) => s.areaActiva);
  const encuestas = useStore((s) => s.encuestasFiltradas);
  const asesoresConsolidados = useStore((s) => s.asesoresConsolidados);
  const atc = useATCStore();
  const { wallets, canjes, transacciones, config, sincronizando } = atc;

  const [tab, setTab] = useState('overview');

  useEffect(() => {
    atc.sincronizar(true).catch(() => undefined);
  }, [atc]);

  // KPIs principales
  const kpis: KPI[] = useMemo(() => {
    const totalEncuestas = encuestas.length;
    const promotores = encuestas.filter((e) => e.grupo === 'Promotor').length;
    const pasivos = encuestas.filter((e) => e.grupo === 'Pasivo').length;
    const detractores = encuestas.filter((e) => e.grupo === 'Detractor').length;
    const tNPS = totalEncuestas > 0
      ? ((promotores - detractores) / totalEncuestas) * 100
      : 0;
    const totalSaldoATC = wallets.reduce((s, w) => s + w.saldo, 0);
    const totalGanado = wallets.reduce((s, w) => s + (((w.stats as any)?.totalGanado) ?? 0), 0);
    const totalGastado = wallets.reduce((s, w) => s + (((w.stats as any)?.totalGastado) ?? 0), 0);
    const canjesPendientes = canjes.filter((c) => c.estado === 'pendiente').length;
    const promedioSaldo = wallets.length ? Math.round(totalSaldoATC / wallets.length) : 0;

    return [
      {
        label: 'tNPS Global',
        value: `${tNPS >= 0 ? '+' : ''}${tNPS.toFixed(1)}`,
        hint: `${totalEncuestas} encuestas`,
        icon: BarChart3,
        color: tNPS >= 50 ? 'text-promotor' : tNPS >= 0 ? 'text-pasivo' : 'text-detractor',
        trend: tNPS >= 0 ? 'up' : 'down',
      },
      {
        label: 'Asesores Activos',
        value: `${asesoresConsolidados.length}`,
        hint: `${wallets.length} con wallet ATC`,
        icon: Users,
        color: 'text-claro-blue',
      },
      {
        label: 'ATC en Circulación',
        value: `${totalSaldoATC.toLocaleString('es-GT')}`,
        hint: `Promedio: ${promedioSaldo} ATC/asesor`,
        icon: Wallet2,
        color: 'text-claro-red',
      },
      {
        label: 'Canjes Pendientes',
        value: `${canjesPendientes}`,
        hint: `${canjes.length} canjes totales`,
        icon: Award,
        color: canjesPendientes > 0 ? 'text-pasivo' : 'text-promotor',
        trend: canjesPendientes > 0 ? 'down' : 'flat',
      },
      {
        label: 'ATC Ganado (Histórico)',
        value: `${totalGanado.toLocaleString('es-GT')}`,
        hint: 'Promotores + rachas + ajustes',
        icon: TrendingUp,
        color: 'text-promotor',
      },
      {
        label: 'ATC Gastado (Histórico)',
        value: `${totalGastado.toLocaleString('es-GT')}`,
        hint: 'En premios canjeados',
        icon: TrendingDown,
        color: 'text-detractor',
      },
    ];
  }, [encuestas, asesoresConsolidados, wallets, canjes]);

  // Top asesores por saldo ATC
  const topAsesores = useMemo(() => {
    return [...wallets]
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 8);
  }, [wallets]);

  // Canjes pendientes recientes
  const canjesPendientes = useMemo(() => {
    return canjes.filter((c) => c.estado === 'pendiente').slice(0, 8);
  }, [canjes]);

  // Movimientos recientes (últimas 10 transacciones)
  const movimientosRecientes = useMemo(() => {
    return [...transacciones]
      .sort((a, b) => (b.creado || b.fecha || '').localeCompare(a.creado || a.fecha || ''))
      .slice(0, 10);
  }, [transacciones]);

  // Distribución promotores / pasivos / detractores
  const distribucion = useMemo(() => {
    const total = encuestas.length || 1;
    const promotores = encuestas.filter((e) => e.grupo === 'Promotor').length;
    const pasivos = encuestas.filter((e) => e.grupo === 'Pasivo').length;
    const detractores = encuestas.filter((e) => e.grupo === 'Detractor').length;
    return {
      promotores,
      pasivos,
      detractores,
      promotoresPct: Math.round((promotores / total) * 100),
      pasivosPct: Math.round((pasivos / total) * 100),
      detractoresPct: Math.round((detractores / total) * 100),
    };
  }, [encuestas]);

  if (!perfil?.esAdmin && perfil?.rol !== 'supervisor') {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium mt-2">Acceso exclusivo para supervisores y administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-claro-red">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-claro-red" />
                Panel de Supervisión · {areaActiva === 'digital' ? 'Digital' : 'Telefónico'}
              </CardTitle>
              <CardDescription>
                KPIs en tiempo real, top asesores, alertas y exportación · Semana {semanaISOActual()}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => atc.sincronizar(true)}
              disabled={sincronizando}
              className="gap-2"
            >
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="top">Top Asesores</TabsTrigger>
          <TabsTrigger value="canjes">
            Canjes
            {canjesPendientes.length > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-pasivo text-white">
                {canjesPendientes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="bases-datos">Bases de Datos</TabsTrigger>
        </TabsList>

        {/* ============================ TAB: RESUMEN ============================ */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                        <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
                        {kpi.hint && (
                          <p className="text-[11px] text-muted-foreground mt-1">{kpi.hint}</p>
                        )}
                      </div>
                      <Icon className={`h-8 w-8 ${kpi.color} opacity-70 shrink-0`} aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Distribución + Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Distribución de Encuestas</CardTitle>
                <CardDescription>Proporción promotores / pasivos / detractores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <DistribucionBar
                  label="Promotores"
                  value={distribucion.promotores}
                  pct={distribucion.promotoresPct}
                  color="bg-promotor"
                />
                <DistribucionBar
                  label="Pasivos"
                  value={distribucion.pasivos}
                  pct={distribucion.pasivosPct}
                  color="bg-pasivo"
                />
                <DistribucionBar
                  label="Detractores"
                  value={distribucion.detractores}
                  pct={distribucion.detractoresPct}
                  color="bg-detractor"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-pasivo" />
                  Alertas Activas
                </CardTitle>
                <CardDescription>Encuestas con potencial contenido agresivo</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const alertas = encuestas.filter((e) => e.alertaAgresiva).slice(0, 5);
                  if (alertas.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Sin alertas activas. Todo bajo control.
                      </p>
                    );
                  }
                  return (
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {alertas.map((a) => (
                          <div key={a.id} className="text-sm border-l-2 border-detractor pl-3">
                            <p className="font-medium">{a.usuario || a.loginNormalizado}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.razon}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(a.fechaInicio).toLocaleString('es-GT')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================ TAB: TOP ASESORES ============================ */}
        <TabsContent value="top" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Top 8 asesores por saldo ATC
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarWalletsAExcel(wallets)}
              disabled={wallets.length === 0}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>

          {topAsesores.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Sin wallets. Se crean automáticamente al procesar encuestas con ATC activo.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAsesores.map((w, idx) => {
                const stats = (w.stats ?? {}) as any;
                return (
                  <Card key={w.loginNormalizado} className={idx < 3 ? 'border-l-4 border-l-pasivo' : ''}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6 text-center shrink-0">
                        {idx + 1}°
                      </span>
                      <AsesorAvatar
                        login={w.loginNormalizado}
                        nombre={w.nombre}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{w.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">{w.loginNormalizado}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {stats.totalPromotores ?? 0} prom.
                          </Badge>
                          {w.rachaActual > 0 && (
                            <Badge className="text-[10px] bg-promotor text-white">
                              Racha {w.rachaActual}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-claro-red tabular-nums">{w.saldo}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">ATC</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================ TAB: CANJES PENDIENTES ============================ */}
        <TabsContent value="canjes" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {canjesPendientes.length} canje{canjesPendientes.length !== 1 ? 's' : ''} pendiente{canjesPendientes.length !== 1 ? 's' : ''} de aprobación
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarCanjesAExcel(canjes)}
              disabled={canjes.length === 0}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>

          {canjesPendientes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay canjes pendientes. Todo al día.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {canjesPendientes.map((c) => (
                <Card key={c.id} className="border-pasivo/50">
                  <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-2xl" aria-hidden>{c.premioEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.premioNombre} · {c.costoATC} ATC</p>
                      <p className="text-xs text-muted-foreground">
                        {c.nombreAsesor} ({c.loginNormalizado}) · {new Date(c.solicitado).toLocaleString('es-GT')}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => atc.resolverCanje(c, 'aprobado', 'Entregado')}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => atc.resolverCanje(c, 'rechazado', 'Sin stock disponible')}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================ TAB: MOVIMIENTOS ============================ */}
        <TabsContent value="movimientos" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Últimos {Math.min(movimientosRecientes.length, 10)} movimientos de ATC
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarTransaccionesAExcel(transacciones)}
              disabled={transacciones.length === 0}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>

          {movimientosRecientes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Sin movimientos registrados.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosRecientes.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.creado ? new Date(t.creado).toLocaleString('es-GT', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{t.loginNormalizado}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{t.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {t.descripcion}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${t.monto >= 0 ? 'text-promotor' : 'text-detractor'}`}>
                        {t.monto >= 0 ? '+' : ''}{t.monto}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ============================ TAB: BASES DE DATOS ============================ */}
        <TabsContent value="bases-datos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BDStatusPanel />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cómo funciona el failover</CardTitle>
                <CardDescription>Sistema de rotación automática entre BDs Neon</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p className="flex items-start gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span>La app usa la primera BD disponible de la lista. Si una BD falla (cuota agotada, timeout, suspendida), el sistema prueba automáticamente la siguiente.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span>Cada BD Neon free tier tiene <strong>cuota mensual limitada</strong> (compute hours + storage + data transfer). Cuando se agota, la app rota a la siguiente sin interrumpir el servicio.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span>El panel muestra cuántas BDs están operativas (X/N). Cuando quedan <strong>2 o menos</strong>, se muestra una alerta pidiendo crear nuevas BDs.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <span>Para crear nuevas BDs: entra a <a href="https://console.neon.tech" target="_blank" rel="noreferrer" className="text-claro-red underline">console.neon.tech</a>, crea un proyecto nuevo, copia la connection string y agrégala en <code className="text-[10px] bg-muted px-1 py-0.5 rounded">src/lib/db.ts</code> → <code className="text-[10px] bg-muted px-1 py-0.5 rounded">BD_URLS_INTERNAS</code>.</span>
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold mb-1">⚠️ Importante</p>
                  <p>Cada BD tiene su propio set de datos. La app no replica automáticamente entre BDs — solo rota cuando una cae. Asegúrate de cargar los datos (HC, encuestas) en la BD activa.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------
// Componente auxiliar: barra de distribución
// ------------------------------------------------------------

function DistribucionBar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
