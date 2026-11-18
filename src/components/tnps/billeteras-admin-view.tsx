'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Tag,
  Trash2,
  Wallet2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import type { CanjeATC, PremioATC } from '@/lib/atc-types';
import { exportarCanjesAExcel, exportarWalletsAExcel } from '@/lib/excel-export';
import { AsesorAvatar } from '@/components/tnps/asesor-avatar';
import {
  guardarPremioAction,
  eliminarPremioAction,
  leerTodosPremiosAction,
} from '@/app/actions/premios-actions';
import { cn } from '@/lib/utils';

// Las 6 líneas disponibles para el requisito de línea
const LINEAS_REQUERIDAS = [
  'WhatsApp Fijo Soporte',
  'WhatsApp Fijo Información',
  'WhatsApp Móvil',
  'Móvil Telefónico',
  'Fijo Información Telefónico',
  'Fijo Soporte Telefónico',
];

/** v3.0.4: etiqueta legible para el tipo de duración del premio */
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

/** Color tailwind según el área del premio */
function colorAreaBadge(area?: string): string {
  if (area === 'digital') return 'text-claro-red border-claro-red/30';
  if (area === 'telefonico') return 'text-claro-blue border-claro-blue/30';
  return 'text-muted-foreground';
}

export function BilleterasAdminView() {
  const perfil = useStore((s) => s.perfil);
  const atc = useATCStore();
  const { wallets, canjes } = atc;

  const [busqueda, setBusqueda] = useState('');
  const [ajusteWallet, setAjusteWallet] = useState<string | null>(null);
  const [montoAjuste, setMontoAjuste] = useState(10);
  const [motivoAjuste, setMotivoAjuste] = useState('');

  // v3.1.2: Recálculo ATC
  const [recalculando, setRecalculando] = useState(false);
  const [dialogoRecalculo, setDialogoRecalculo] = useState(false);
  const [recalculoDias, setRecalculoDias] = useState(3);
  const [recalculoLogin, setRecalculoLogin] = useState<string | null>(null);

  // === Premios: estado y filtros ===
  const [dialogoPremio, setDialogoPremio] = useState(false);
  const [premioEdit, setPremioEdit] = useState<Partial<PremioATC>>({});
  const [guardandoPremio, setGuardandoPremio] = useState(false);
  const [todosPremios, setTodosPremios] = useState<PremioATC[]>([]);
  const [busquedaPremio, setBusquedaPremio] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

  // Forzar sincronización al montar
  useEffect(() => {
    atc.sincronizar(true).catch(() => undefined);
    cargarTodosPremios();
  }, [atc]);

  async function cargarTodosPremios() {
    try {
      const lista = await leerTodosPremiosAction();
      setTodosPremios(lista);
    } catch {
      setTodosPremios([]);
    }
  }

  const walletsFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return [...wallets]
      .sort((a, b) => b.saldo - a.saldo)
      .filter(
        (w) =>
          !q ||
          w.nombre.toLowerCase().includes(q) ||
          w.loginNormalizado.toLowerCase().includes(q)
      );
  }, [wallets, busqueda]);

  const canjesPendientes = canjes.filter((c) => c.estado === 'pendiente');

  // === Lista de categorías existentes (para el dropdown) ===
  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>();
    for (const p of todosPremios) {
      if (p.categoria && p.categoria.trim()) set.add(p.categoria.trim());
    }
    return Array.from(set).sort();
  }, [todosPremios]);

  // === Premios filtrados por búsqueda y categoría ===
  const premiosFiltrados = useMemo(() => {
    const q = busquedaPremio.toLowerCase().trim();
    return todosPremios.filter((p) => {
      const matchQ = !q || p.nombre.toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q);
      const matchCat = categoriaFiltro === 'todas' || p.categoria === categoriaFiltro;
      return matchQ && matchCat;
    });
  }, [todosPremios, busquedaPremio, categoriaFiltro]);

  // === Conteo activos/inactivos ===
  const premiosActivos = useMemo(
    () => todosPremios.filter((p) => p.activo).length,
    [todosPremios]
  );
  const premiosInactivos = todosPremios.length - premiosActivos;

  if (!perfil?.esAdmin && perfil?.rol !== 'supervisor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium">Vista administrativa</p>
          <p className="text-sm text-muted-foreground">Acceso exclusivo para supervisores y administradores.</p>
        </CardContent>
      </Card>
    );
  }

  const saldoTotal = wallets.reduce((s, w) => s + w.saldo, 0);

  function abrirNuevoPremio() {
    setPremioEdit({
      nombre: '',
      descripcion: '',
      costoATC: 10,
      categoria: 'General',
      emoji: '🎁',
      stock: -1,
      activo: true,
      area: 'ambas',
      tmoMaximoRequerido: 0,
      lineaRequerida: '',
      autoAprobacion: false,
      // v3.0.4: duración + límite de reclamos
      duracionTipo: null,
      duracionValor: 0,
      maxReclamosPorAsesor: 0,
      // v3.0.7: canje por racha
      canjePorRacha: false,
      promotoresRequeridosRacha: 3,
      tipoCanje: 'monedas',
    });
    setDialogoPremio(true);
  }

  function abrirEditarPremio(p: PremioATC) {
    setPremioEdit({ ...p });
    setDialogoPremio(true);
  }

  async function guardarPremio() {
    if (!premioEdit.nombre?.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    setGuardandoPremio(true);
    try {
      const res = await guardarPremioAction({
        ...premioEdit,
        tmoMaximoRequerido:
          typeof premioEdit.tmoMaximoRequerido === 'number' && premioEdit.tmoMaximoRequerido > 0
            ? premioEdit.tmoMaximoRequerido
            : null,
        lineaRequerida:
          typeof premioEdit.lineaRequerida === 'string' && premioEdit.lineaRequerida.trim().length > 0
            ? premioEdit.lineaRequerida
            : null,
        // v3.0.4: duración + límite de reclamos
        duracionTipo:
          (premioEdit.duracionTipo as string) && (premioEdit.duracionTipo as string) !== 'ninguno'
            ? premioEdit.duracionTipo
            : null,
        duracionValor:
          (premioEdit.duracionTipo as string) && (premioEdit.duracionTipo as string) !== 'ninguno'
            ? Math.max(0, Number(premioEdit.duracionValor) || 0)
            : 0,
        maxReclamosPorAsesor: Math.max(0, Number(premioEdit.maxReclamosPorAsesor) || 0),
        // v3.0.7: canje por racha
        canjePorRacha: Boolean(premioEdit.canjePorRacha),
        promotoresRequeridosRacha:
          Number(premioEdit.promotoresRequeridosRacha) > 0
            ? Math.max(1, Math.floor(Number(premioEdit.promotoresRequeridosRacha)))
            : 3,
        tipoCanje: ['monedas', 'racha', 'ambas'].includes(premioEdit.tipoCanje as string)
          ? (premioEdit.tipoCanje as 'monedas' | 'racha' | 'ambas')
          : 'monedas',
      } as Partial<PremioATC>);
      if (res.ok) {
        toast.success('Premio guardado correctamente.');
        setDialogoPremio(false);
        await cargarTodosPremios();
        // Refrescar el catálogo activo (atc store) para que los asesores lo vean
        atc.sincronizar(true).catch(() => undefined);
      } else {
        toast.error(res.error || 'Error al guardar el premio.');
      }
    } finally {
      setGuardandoPremio(false);
    }
  }

  async function eliminarPremio(id: string) {
    if (!confirm('¿Eliminar este premio del catálogo?')) return;
    const res = await eliminarPremioAction(id);
    if (res.ok) {
      toast.success('Premio eliminado.');
      await cargarTodosPremios();
      atc.sincronizar(true).catch(() => undefined);
    } else {
      toast.error(res.error || 'Error.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-pasivo">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Wallets activas</p>
            <p className="text-2xl font-bold tabular-nums">{wallets.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">ATC en circulación</p>
            <p className="text-2xl font-bold tabular-nums">{saldoTotal.toLocaleString('es-GT')} ATC</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-pasivo">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Canjes pendientes</p>
            <p className="text-2xl font-bold tabular-nums">{canjesPendientes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-promotor">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Premios en catálogo</p>
            <p className="text-2xl font-bold tabular-nums">
              {premiosActivos}
              <span className="text-sm font-normal text-muted-foreground"> / {todosPremios.length}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">activos / total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="canjes">
            Canjes {canjesPendientes.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{canjesPendientes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="premios">Premios</TabsTrigger>
        </TabsList>

        {/* Wallets */}
        <TabsContent value="wallets" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar asesor…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
                aria-label="Buscar wallet"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarWalletsAExcel(walletsFiltradas)}
              disabled={walletsFiltradas.length === 0}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => { setRecalculoLogin(null); setDialogoRecalculo(true); }}
              className="gap-1.5"
              title="Recalcular ATC basado en encuestas de los últimos días"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recalcular ATC</span>
              <span className="sm:hidden">Recalc.</span>
            </Button>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead className="text-center">Saldo</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Racha</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Prom. / Pas. / Detr.</TableHead>
                    <TableHead className="text-center">Ajustar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletsFiltradas.map((w, i) => (
                    <TableRow key={w.loginNormalizado}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AsesorAvatar
                            login={w.loginNormalizado}
                            nombre={w.nombre}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-52">{w.nombre}</p>
                            <p className="text-xs text-muted-foreground">{w.loginNormalizado}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold tabular-nums">{w.saldo}</span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden sm:table-cell">{w.rachaActual ?? 0}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums hidden md:table-cell">
                        {w.stats.totalPromotores} / {w.stats.totalPasivos} / {w.stats.totalDetractores}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" onClick={() => setAjusteWallet(w.loginNormalizado)} aria-label="Ajustar saldo">
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          {walletsFiltradas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin wallets. Se crean automáticamente al procesar encuestas con ATC activo.
            </p>
          )}
        </TabsContent>

        {/* Canjes */}
        <TabsContent value="canjes" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {canjes.length} canje{canjes.length !== 1 ? 's' : ''} en total
              {canjesPendientes.length > 0 && (
                <span className="ml-2 text-pasivo font-medium">· {canjesPendientes.length} pendiente{canjesPendientes.length !== 1 ? 's' : ''}</span>
              )}
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
          {canjes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay solicitudes de canje.
              </CardContent>
            </Card>
          ) : (
            canjes.map((c: CanjeATC) => (
              <Card key={c.id} className={c.estado === 'pendiente' ? 'border-pasivo/50' : ''}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-2xl" aria-hidden>{c.premioEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {c.premioNombre} · {c.costoATC} ATC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.nombreAsesor} ({c.loginNormalizado}) · {new Date(c.solicitado).toLocaleString('es-GT')}
                    </p>
                    {c.comentario && <p className="text-xs text-muted-foreground">{c.comentario}</p>}
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
                    {c.estado === 'aprobado' ? 'Aprobado' : c.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </Badge>
                  {c.estado === 'pendiente' && (
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => atc.resolverCanje(c, 'aprobado', 'Entregado')}>Aprobar</Button>
                      <Button size="sm" variant="outline" onClick={() => atc.resolverCanje(c, 'rechazado', 'Sin stock disponible')}>Rechazar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Premios */}
        <TabsContent value="premios" className="space-y-3">
          {/* Toolbar: búsqueda + filtro por categoría + nuevo */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar premio por nombre…"
                value={busquedaPremio}
                onChange={(e) => setBusquedaPremio(e.target.value)}
                className="pl-8"
                aria-label="Buscar premio"
              />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-48" aria-label="Filtrar por categoría">
                <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categoriasExistentes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={abrirNuevoPremio} className="gap-2">
              <Plus className="h-4 w-4" /> Crear premio
            </Button>
          </div>

          {/* Conteo activos / inactivos */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-promotor" />
              {premiosActivos} activo{premiosActivos !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              {premiosInactivos} inactivo{premiosInactivos !== 1 ? 's' : ''}
            </Badge>
            <span className="text-xs text-muted-foreground">
              · {premiosFiltrados.length} mostrado{premiosFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid de premios */}
          {todosPremios.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center space-y-2">
                <div className="text-5xl" aria-hidden>🎁</div>
                <p className="font-medium">No hay premios creados</p>
                <p className="text-sm text-muted-foreground">
                  No hay premios creados. Crea el primero con el botón &quot;Crear premio&quot;.
                </p>
                <Button onClick={abrirNuevoPremio} className="gap-2 mt-2">
                  <Plus className="h-4 w-4" /> Crear premio
                </Button>
              </CardContent>
            </Card>
          ) : premiosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay premios que coincidan con los filtros.
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {premiosFiltrados.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    'flex flex-col hover:shadow-md transition-shadow',
                    !p.activo && 'opacity-60'
                  )}
                >
                  <CardContent className="p-4 flex-1 flex flex-col gap-2">
                    {/* Emoji prominente + estado */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <span className="text-4xl" aria-hidden>{p.emoji || '🎁'}</span>
                      </div>
                      <Badge variant={p.activo ? 'default' : 'secondary'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    {/* Nombre + costo */}
                    <p className="font-semibold leading-tight">{p.nombre}</p>
                    <Badge variant="secondary" className="font-bold w-fit">{p.costoATC} ATC</Badge>

                    {/* Descripción */}
                    {p.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.descripcion}</p>
                    )}

                    {/* Badges: categoría, área, stock */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.categoria && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Tag className="h-2.5 w-2.5" /> {p.categoria}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('text-[10px] capitalize', colorAreaBadge(p.area))}>
                        {p.area || 'ambas'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Stock: {p.stock < 0 ? '∞' : p.stock}
                      </Badge>
                    </div>

                    {/* Badges de restricciones */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.tmoMaximoRequerido && p.tmoMaximoRequerido > 0 ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-500/40 gap-1 text-[10px]">
                          🔒 TMO ≤ {p.tmoMaximoRequerido}s
                        </Badge>
                      ) : null}
                      {p.lineaRequerida ? (
                        <Badge variant="outline" className="text-[10px]">
                          📞 {p.lineaRequerida}
                        </Badge>
                      ) : null}
                      {p.duracionTipo && p.duracionValor && p.duracionValor > 0 ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-blue-700 border-blue-500/40">
                          ⏱️ {p.duracionValor} {labelDuracionTipo(p.duracionTipo)}
                        </Badge>
                      ) : null}
                      {typeof p.maxReclamosPorAsesor === 'number' && p.maxReclamosPorAsesor > 0 ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-purple-700 border-purple-500/40">
                          🔢 Límite: {p.maxReclamosPorAsesor} reclamo{p.maxReclamosPorAsesor === 1 ? '' : 's'}
                        </Badge>
                      ) : null}
                      {p.autoAprobacion ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-promotor border-promotor/40">
                          ⚡ Auto-aprobado
                        </Badge>
                      ) : null}
                      {p.canjePorRacha ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-orange-700 border-orange-500/40 dark:text-orange-300">
                          🔥 Canjeable por racha
                        </Badge>
                      ) : null}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1.5 mt-1 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => abrirEditarPremio(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => eliminarPremio(p.id)}
                        className="text-detractor hover:text-detractor gap-1.5"
                        aria-label="Eliminar premio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: ajuste manual de saldo */}
      <DialogAjuste
        abierto={!!ajusteWallet}
        login={ajusteWallet}
        onCerrar={() => setAjusteWallet(null)}
        onConfirmar={async () => {
          if (ajusteWallet) {
            await atc.ajustarSaldo(ajusteWallet, montoAjuste, motivoAjuste);
            setAjusteWallet(null);
            setMotivoAjuste('');
            setMontoAjuste(10);
          }
        }}
        monto={montoAjuste}
        setMonto={setMontoAjuste}
        motivo={motivoAjuste}
        setMotivo={setMotivoAjuste}
      />

      {/* Dialog: crear/editar premio */}
      <Dialog open={dialogoPremio} onOpenChange={setDialogoPremio}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle>
              {premioEdit.id ? 'Editar premio' : 'Nuevo premio'}
            </DialogTitle>
            <DialogDescription>
              Configura los campos del premio. Los campos con requisito de TMO y línea son opcionales
              pero, si se setean, validan que el asesor cumpla antes de poder canjearlo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* === Sección: Básico === */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm font-semibold">Básico</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-nombre">Nombre *</Label>
                  <Input
                    id="p-nombre"
                    placeholder="Ej. Tarjeta de regalo Q50"
                    value={premioEdit.nombre || ''}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-desc">Descripción</Label>
                  <Input
                    id="p-desc"
                    placeholder="Breve descripción del premio"
                    value={premioEdit.descripcion || ''}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, descripcion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-emoji">Emoji (visual del premio)</Label>
                  <Input
                    id="p-emoji"
                    placeholder="🎁"
                    value={premioEdit.emoji || ''}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, emoji: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    El emoji es la imagen principal del premio en el catálogo.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-categoria">Categoría</Label>
                  <Input
                    id="p-categoria"
                    placeholder="General, Alimentos, Tecnología…"
                    value={premioEdit.categoria || ''}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, categoria: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-area">Área</Label>
                  <Select
                    value={premioEdit.area || 'ambas'}
                    onValueChange={(v) => setPremioEdit((p) => ({ ...p, area: v as any }))}
                  >
                    <SelectTrigger id="p-area">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambas">Ambas</SelectItem>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="telefonico">Telefónico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* === Sección: Costos === */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-sm font-semibold">Costos</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-costo">Costo en ATC *</Label>
                  <Input
                    id="p-costo"
                    type="number"
                    min={1}
                    value={premioEdit.costoATC ?? 10}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, costoATC: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-stock">Stock (-1 = ilimitado)</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    value={premioEdit.stock ?? -1}
                    onChange={(e) => setPremioEdit((p) => ({ ...p, stock: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* === Sección: Restricciones === */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-detractor" />
                <p className="text-sm font-semibold">Restricciones</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-tmo">TMO máximo requerido (segundos)</Label>
                  <Input
                    id="p-tmo"
                    type="number"
                    min={0}
                    placeholder="0 = sin requisito"
                    value={premioEdit.tmoMaximoRequerido ?? 0}
                    onChange={(e) =>
                      setPremioEdit((p) => ({ ...p, tmoMaximoRequerido: Number(e.target.value) }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Si es {'>'} 0, el asesor debe tener un TMO promedio (últimos 7 días) ≤ este valor
                    para poder canjear.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-linea">Línea requerida</Label>
                  <Select
                    value={premioEdit.lineaRequerida || 'none'}
                    onValueChange={(v) =>
                      setPremioEdit((p) => ({
                        ...p,
                        lineaRequerida: v === 'none' ? '' : v,
                      }))
                    }
                  >
                    <SelectTrigger id="p-linea">
                      <SelectValue placeholder="Cualquier línea" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Cualquier línea</SelectItem>
                      {LINEAS_REQUERIDAS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Si se setea, solo los asesores de esta línea pueden canjear.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-dur-tipo">Duración del premio</Label>
                  <Select
                    value={(premioEdit.duracionTipo as string) || 'ninguno'}
                    onValueChange={(v) =>
                      setPremioEdit((p) => ({
                        ...p,
                        duracionTipo: (v === 'ninguno' ? null : v) as any,
                        duracionValor: v === 'ninguno' ? 0 : p.duracionValor ?? 1,
                      }))
                    }
                  >
                    <SelectTrigger id="p-dur-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Sin duración</SelectItem>
                      <SelectItem value="hora">Hora(s)</SelectItem>
                      <SelectItem value="dia">Día(s)</SelectItem>
                      <SelectItem value="semana">Semana(s)</SelectItem>
                      <SelectItem value="mes">Mes(es)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Tiempo durante el cual el premio sigue vigente tras ser reclamado.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-dur-valor">Cantidad (duración)</Label>
                  <Input
                    id="p-dur-valor"
                    type="number"
                    min={0}
                    placeholder="Ej. 2"
                    disabled={!premioEdit.duracionTipo}
                    value={premioEdit.duracionValor ?? 0}
                    onChange={(e) =>
                      setPremioEdit((p) => ({ ...p, duracionValor: Number(e.target.value) }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Número de unidades (horas, días, etc.).
                  </p>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-max-reclamos">Máximo de reclamos por asesor</Label>
                  <Input
                    id="p-max-reclamos"
                    type="number"
                    min={0}
                    placeholder="0 = ilimitado"
                    value={premioEdit.maxReclamosPorAsesor ?? 0}
                    onChange={(e) =>
                      setPremioEdit((p) => ({
                        ...p,
                        maxReclamosPorAsesor: Number(e.target.value),
                      }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Cuántas veces puede un mismo asesor reclamar este premio (0 = ilimitado).
                  </p>
                </div>
              </div>
            </div>

            {/* === Sección: Canje por Racha === */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <p className="text-sm font-semibold">Canje por Racha</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">¿Se puede canjear por racha de promotores?</p>
                    <p className="text-xs text-muted-foreground">
                      Si está activo, los asesores podrán canjear este premio usando una racha de
                      promotores en lugar de (o además de) ATC.
                    </p>
                  </div>
                  <Switch
                    checked={!!premioEdit.canjePorRacha}
                    onCheckedChange={(v) => setPremioEdit((p) => ({ ...p, canjePorRacha: v }))}
                  />
                </div>
                {premioEdit.canjePorRacha && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-prom-racha">Promotores requeridos para racha</Label>
                      <Input
                        id="p-prom-racha"
                        type="number"
                        min={1}
                        value={premioEdit.promotoresRequeridosRacha ?? 3}
                        onChange={(e) =>
                          setPremioEdit((p) => ({
                            ...p,
                            promotoresRequeridosRacha: Math.max(1, Number(e.target.value)),
                          }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Mínimo 1 (recomendado: 3 promotores seguidos).
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-tipo-canje">Tipo de canje</Label>
                      <Select
                        value={(premioEdit.tipoCanje as string) || 'monedas'}
                        onValueChange={(v) =>
                          setPremioEdit((p) => ({ ...p, tipoCanje: v as any }))
                        }
                      >
                        <SelectTrigger id="p-tipo-canje">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monedas">Solo monedas (ATC)</SelectItem>
                          <SelectItem value="racha">Solo racha</SelectItem>
                          <SelectItem value="ambas">Ambas opciones</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Define cómo el asesor puede canjear este premio.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* === Sección: Resumen de condiciones (v3.0.9) === */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-claro-blue" />
                <p className="text-sm font-semibold">Resumen de condiciones</p>
              </div>
              {(() => {
                const condiciones: string[] = [];
                if (
                  typeof premioEdit.tmoMaximoRequerido === 'number' &&
                  premioEdit.tmoMaximoRequerido > 0
                ) {
                  condiciones.push(`TMO ≤ ${premioEdit.tmoMaximoRequerido}s`);
                }
                if (premioEdit.lineaRequerida && premioEdit.lineaRequerida.trim()) {
                  condiciones.push(`Línea: ${premioEdit.lineaRequerida}`);
                }
                if (
                  premioEdit.duracionTipo &&
                  (premioEdit.duracionTipo as string) !== 'ninguno' &&
                  (premioEdit.duracionValor ?? 0) > 0
                ) {
                  condiciones.push(
                    `Duración: ${premioEdit.duracionValor} ${labelDuracionTipo(
                      premioEdit.duracionTipo as string
                    )}`
                  );
                }
                if (
                  typeof premioEdit.maxReclamosPorAsesor === 'number' &&
                  premioEdit.maxReclamosPorAsesor > 0
                ) {
                  condiciones.push(
                    `Máx ${premioEdit.maxReclamosPorAsesor} reclamo${
                      premioEdit.maxReclamosPorAsesor === 1 ? '' : 's'
                    }`
                  );
                }
                if (premioEdit.canjePorRacha) {
                  condiciones.push(
                    `Canjeable por racha (${premioEdit.promotoresRequeridosRacha ?? 3} promotores)`
                  );
                }
                if (condiciones.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground italic">
                      Este premio no tiene condiciones adicionales — cualquier asesor puede canjearlo.
                    </p>
                  );
                }
                return (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <p className="text-muted-foreground mb-1">
                      Este premio tendrá las siguientes condiciones:
                    </p>
                    <p className="font-medium">Condiciones: {condiciones.join(', ')}</p>
                  </div>
                );
              })()}
            </div>

            {/* === Sección: Aprobación === */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-promotor" />
                <p className="text-sm font-semibold">Aprobación</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Auto-aprobación</p>
                    <p className="text-xs text-muted-foreground">
                      Si está activo, los canjes se aprueban automáticamente. Si no, quedan pendientes.
                    </p>
                  </div>
                  <Switch
                    checked={!!premioEdit.autoAprobacion}
                    onCheckedChange={(v) => setPremioEdit((p) => ({ ...p, autoAprobacion: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Premio activo</p>
                    <p className="text-xs text-muted-foreground">
                      Si está inactivo, los asesores no verán el premio en su catálogo.
                    </p>
                  </div>
                  <Switch
                    checked={!!premioEdit.activo}
                    onCheckedChange={(v) => setPremioEdit((p) => ({ ...p, activo: v }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoPremio(false)}>Cancelar</Button>
            <Button onClick={guardarPremio} disabled={guardandoPremio} className="gap-2">
              {guardandoPremio ? 'Guardando…' : 'Guardar premio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* v3.1.2: Diálogo de recálculo ATC */}
      <Dialog open={dialogoRecalculo} onOpenChange={setDialogoRecalculo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Recalcular ATC
            </DialogTitle>
            <DialogDescription>
              Recalcula los ATC de los asesores basándose en sus encuestas de los últimos días.
              Solo cuenta promotores, pasivos y detractores — omite juegos, formularios y ajustes admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Días a recalcular</Label>
              <Select value={String(recalculoDias)} onValueChange={(v) => setRecalculoDias(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último 1 día</SelectItem>
                  <SelectItem value="3">Últimos 3 días</SelectItem>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="14">Últimos 14 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">⚠️ Importante</p>
              <p>Esta acción recalculará los ATC basándose en las encuestas del período seleccionado.
              Los puntos de juegos, formularios, logros y ajustes admin no se verán afectados.
              Se registrará en auditoría quién hizo el recálculo.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogoRecalculo(false)} disabled={recalculando}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setRecalculando(true);
                try {
                  const { recalcularATCTodosAction } = await import('@/app/actions/recalcular-actions');
                  const result = await recalcularATCTodosAction(recalculoDias);
                  if (result.ok && result.resumen) {
                    const r = result.resumen;
                    toast.success(
                      `Recálculo completado: ${r.procesados} asesores procesados, ${r.conCambios} con cambios.`
                    );
                    // Recargar wallets
                    atc.sincronizar().catch(() => undefined);
                  } else {
                    toast.error(result.error || 'Error en el recálculo.');
                  }
                } catch (err) {
                  toast.error('Error inesperado en el recálculo.');
                } finally {
                  setRecalculando(false);
                  setDialogoRecalculo(false);
                }
              }}
              disabled={recalculando}
              className="gap-2"
            >
              {recalculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {recalculando ? 'Recalculando...' : 'Recalcular a todos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogAjuste({
  abierto,
  login,
  onCerrar,
  onConfirmar,
  monto,
  setMonto,
  motivo,
  setMotivo,
}: {
  abierto: boolean;
  login: string | null;
  onCerrar: () => void;
  onConfirmar: () => void;
  monto: number;
  setMonto: (n: number) => void;
  motivo: string;
  setMotivo: (s: string) => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet2 className="h-4 w-4" /> Ajustar saldo de {login}
          </DialogTitle>
          <DialogDescription>
            Usa valores positivos para bonificar (+) o negativos para descontar (−). Quedará registrado en
            el ledger como AJUSTE_ADMIN.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="monto-ajuste">Monto (ATC)</Label>
            <Input id="monto-ajuste" type="number" value={monto} onChange={(e) => setMonto(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-ajuste">Motivo</Label>
            <Input
              id="motivo-ajuste"
              placeholder="Ej. Premio por campaña de fin de mes"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={onConfirmar} disabled={monto === 0 || !motivo.trim()}>Aplicar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
