'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownCircle, ArrowUpCircle, Download, Loader2, RefreshCw, Search, Wallet2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import type { TipoTransaccion, TransaccionATC } from '@/lib/atc-types';
import { exportarTransaccionesAExcel } from '@/lib/excel-export';

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

/**
 * Módulo de Centralización de ATC.
 *
 * Muestra TODAS las transacciones ATC en circulación (ledger completo),
 * con filtros por tipo, asesor y fecha. Solo accesible para admins y
 * supervisores. Permite ver el flujo de ATC: ingresos (promotores,
 * rachas, saldos iniciales, apelaciones ganadas) y egresos (pasivos,
 * detractores, canjes, apelaciones perdidas).
 */
export function CentralizacionATCView() {
  const perfil = useStore((s) => s.perfil);
  const atc = useATCStore();
  const { transacciones, wallets, config, sincronizando } = atc;

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroDireccion, setFiltroDireccion] = useState<'todos' | 'ingreso' | 'egreso'>('todos');

  // Sincronizar al montar para tener datos frescos
  useEffect(() => {
    atc.sincronizar(true).catch(() => undefined);
  }, [atc]);

  // Filtrado (antes del early return para respetar las reglas de hooks)
  const transaccionesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return [...transacciones]
      .filter((t) => {
        if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
        if (filtroDireccion === 'ingreso' && t.monto <= 0) return false;
        if (filtroDireccion === 'egreso' && t.monto >= 0) return false;
        if (q) {
          const nombreWallet = wallets.find((w) => w.loginNormalizado === t.loginNormalizado)?.nombre ?? '';
          return (
            t.loginNormalizado.toLowerCase().includes(q) ||
            nombreWallet.toLowerCase().includes(q) ||
            t.descripcion.toLowerCase().includes(q) ||
            t.tipo.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (b.creado || b.fecha || '').localeCompare(a.creado || a.fecha || ''));
  }, [transacciones, busqueda, filtroTipo, filtroDireccion, wallets]);

  // KPIs
  const totalIngresos = transacciones.filter((t) => t.monto > 0).reduce((s, t) => s + t.monto, 0);
  const totalEgresos = transacciones.filter((t) => t.monto < 0).reduce((s, t) => s + Math.abs(t.monto), 0);
  const saldoCirculacion = wallets.reduce((s, w) => s + w.saldo, 0);
  const totalGastado = wallets.reduce((s, w) => s + (w.stats?.totalGastado ?? 0), 0);

  if (!perfil?.esAdmin && perfil?.rol !== 'supervisor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Activity className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium">Acceso exclusivo para supervisores y administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-claro-red" /> Centralización de ATC
              </CardTitle>
              <CardDescription>
                Ledger completo de transacciones ATC en circulación. Supervisa el flujo de puntos
                entre ingresos (promotores, rachas, saldos) y egresos (detractores, canjes).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportarTransaccionesAExcel(transaccionesFiltradas)}
                disabled={transaccionesFiltradas.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Excel</span>
              </Button>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-promotor">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">ATC en circulación</p>
                <p className="text-2xl font-bold tabular-nums text-promotor">
                  {saldoCirculacion.toLocaleString('es-GT')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <ArrowUpCircle className="h-3 w-3" /> Total ingresos
                </p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">
                  +{totalIngresos.toLocaleString('es-GT')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-detractor">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <ArrowDownCircle className="h-3 w-3" /> Total egresos
                </p>
                <p className="text-2xl font-bold tabular-nums text-detractor">
                  −{totalEgresos.toLocaleString('es-GT')}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-pasivo">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total canjeado</p>
                <p className="text-2xl font-bold tabular-nums text-pasivo">
                  {totalGastado.toLocaleString('es-GT')}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transacciones ({transaccionesFiltradas.length.toLocaleString('es-GT')})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por asesor, login, descripción o tipo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-56" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {Object.entries(TIPOS_TRADUCION).map(([tipo, label]) => (
                  <SelectItem key={tipo} value={tipo}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroDireccion} onValueChange={(v) => setFiltroDireccion(v as 'todos' | 'ingreso' | 'egreso')}>
              <SelectTrigger className="w-40" aria-label="Filtrar por dirección">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Ingresos y egresos</SelectItem>
                <SelectItem value="ingreso">Solo ingresos</SelectItem>
                <SelectItem value="egreso">Solo egresos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {transacciones.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay transacciones ATC registradas. Aparecerán aquí cuando los asesores reciban
              encuestas o se canjeen premios.
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[65vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-32">Fecha</TableHead>
                      <TableHead>Asesor</TableHead>
                      <TableHead className="w-44">Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right w-24">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transaccionesFiltradas.slice(0, 500).map((t) => {
                      const nombreWallet = wallets.find((w) => w.loginNormalizado === t.loginNormalizado)?.nombre ?? t.loginNormalizado;
                      const fecha = t.creado || t.fecha;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {fecha ? new Date(fecha).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm truncate max-w-44">{nombreWallet}</p>
                            <p className="text-xs text-muted-foreground">{t.loginNormalizado}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={COLOR_TIPO[t.tipo]} variant="outline">
                              {TIPOS_TRADUCION[t.tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-64">
                            {t.descripcion}
                          </TableCell>
                          <TableCell className={`text-right font-bold tabular-nums ${t.monto >= 0 ? 'text-promotor' : 'text-detractor'}`}>
                            {t.monto >= 0 ? '+' : ''}
                            {t.monto}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {transaccionesFiltradas.length > 500 && (
                <p className="text-xs text-muted-foreground text-center py-2 border-t">
                  Mostrando 500 de {transaccionesFiltradas.length.toLocaleString('es-GT')}. Afina el filtro para ver más.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen por tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet2 className="h-4 w-4" /> Resumen por tipo
          </CardTitle>
          <CardDescription>
            Distribución de transacciones por categoría. Útil para detectar desequilibrios
            (muchos detractores vs pocos promotores, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(TIPOS_TRADUCION).map(([tipo, label]) => {
              const transaccionesTipo = transacciones.filter((t) => t.tipo === tipo);
              const count = transaccionesTipo.length;
              const monto = transaccionesTipo.reduce((s, t) => s + t.monto, 0);
              if (count === 0) return null;
              return (
                <div key={tipo} className="rounded-lg border p-3 space-y-1">
                  <Badge className={COLOR_TIPO[tipo as TipoTransaccion]} variant="outline">
                    {label}
                  </Badge>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                  <p className={`text-sm font-medium ${monto >= 0 ? 'text-promotor' : 'text-detractor'}`}>
                    {monto >= 0 ? '+' : ''}
                    {monto.toLocaleString('es-GT')} ATC
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
