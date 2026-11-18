'use client';

import { useEffect, useState } from 'react';
import { Database, Gift, RefreshCw, Search, Settings, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import type { PremioATC } from '@/lib/atc-types';
import { leerAdmins } from '@/lib/atc-firestore';
import { obtenerEstadisticasCache } from '@/lib/store';
import { cacheLimpiarTodo } from '@/lib/cache';
import { guardarPremioAction, leerPremiosAction, leerTodosPremiosAction, eliminarPremioAction, reiniciarWalletsAction } from '@/app/actions/premios-actions';

const CLAVE_ADMIN = 'Colombia110*';

export function AdminView({ initialTab = 'usuarios' }: { initialTab?: string }) {
  const perfil = useStore((s) => s.perfil);
  const borrarDatos = useStore((s) => s.borrarDatos);
  const migrarLogins = useStore((s) => s.migrarLogins);
  const eliminarDuplicados = useStore((s) => s.eliminarDuplicados);
  const procesandoCarga = useStore((s) => s.procesandoCarga);
  const atc = useATCStore();
  const { config } = atc;

  const [tab, setTab] = useState(initialTab);

  // Búsqueda de asesores
  const [busquedaAsesor, setBusquedaAsesor] = useState('');
  const asesoresHC = useStore((s) => s.asesoresHC);

  // Gestión de admins
  const [admins, setAdmins] = useState<string[]>([]);
  const [nuevoAdminUid, setNuevoAdminUid] = useState('');

  // Premios
  const [dialogoPremio, setDialogoPremio] = useState(false);
  const [premioEdit, setPremioEdit] = useState<Partial<PremioATC>>({});

  // Zona de peligro
  const [dialogoPeligro, setDialogoPeligro] = useState<'reset' | 'borrar-todo' | 'borrar-enc' | 'borrar-hc' | 'borrar-tmo' | null>(null);
  const [clave, setClave] = useState('');

  // Estadísticas de caché
  const [statsCache, setStatsCache] = useState<Awaited<ReturnType<typeof obtenerEstadisticasCache>> | null>(null);

  useEffect(() => {
    leerAdmins().then(setAdmins).catch(() => setAdmins([]));
    obtenerEstadisticasCache().then(setStatsCache).catch(() => undefined);
  }, []);

  const asesoresFiltrados = busquedaAsesor
    ? asesoresHC.filter(
        (a) =>
          a.nombre.toLowerCase().includes(busquedaAsesor.toLowerCase()) ||
          a.usuarioCic.toLowerCase().includes(busquedaAsesor.toLowerCase()) ||
          a.documento.includes(busquedaAsesor)
      )
    : [];

  if (!perfil?.esAdmin && perfil?.rol !== 'supervisor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium">Acceso exclusivo para supervisores y administradores</p>
          <p className="text-sm text-muted-foreground">
            Tu UID debe estar registrado en la colección <code className="bg-muted px-1 rounded">admins</code>{' '}
            o tener rol de supervisor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="usuarios" className="gap-1.5 flex-1 sm:flex-none"><Users className="h-4 w-4" /> Usuarios</TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 flex-1 sm:flex-none"><Settings className="h-4 w-4" /> Configuraciones</TabsTrigger>
          <TabsTrigger value="sistema" className="gap-1.5 flex-1 sm:flex-none"><Database className="h-4 w-4" /> Sistema</TabsTrigger>
        </TabsList>

        {/* ================= USUARIOS ================= */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Búsqueda de asesores (HC)</CardTitle>
              <CardDescription>
                Busca por nombre, login o documento en la colección <code className="bg-muted px-1 rounded text-xs">asesores_hc</code>{' '}
                ({asesoresHC.length} registros).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej. Kevin Camargo / kevin.camargo / 2050…"
                  value={busquedaAsesor}
                  onChange={(e) => setBusquedaAsesor(e.target.value)}
                  className="pl-8"
                  aria-label="Buscar asesor"
                />
              </div>
              {busquedaAsesor && (
                <div className="max-h-72 overflow-y-auto scroll-fino space-y-1">
                  {asesoresFiltrados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin resultados.</p>
                  ) : (
                    asesoresFiltrados.slice(0, 30).map((a) => (
                      <div key={a.documento || a.usuarioCic} className="rounded-lg border p-2.5 text-sm flex flex-wrap gap-x-4 gap-y-0.5">
                        <p className="font-medium min-w-40">{a.nombre}</p>
                        <p className="text-xs text-muted-foreground">CIC: {a.usuarioCic}</p>
                        <p className="text-xs text-muted-foreground">Doc: {a.documento}</p>
                        <p className="text-xs text-muted-foreground">LOB: {a.lob}</p>
                        <p className="text-xs text-muted-foreground">Sede: {a.sede}</p>
                        <p className="text-xs text-muted-foreground">Jefe: {a.supervisor}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-claro-red" /> Gestión de administradores
              </CardTitle>
              <CardDescription>
                Los UID registrados en <code className="bg-muted px-1 rounded text-xs">admins</code> tienen
                acceso total (configuración, borrado de DB, gestión de premios).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {admins.length === 0 && <p className="text-sm text-muted-foreground">No hay admins registrados (aparte de reglas manuales).</p>}
                {admins.map((uid) => (
                  <div key={uid} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                    <span className="font-mono max-w-48 truncate">{uid}</span>
                    <button
                      className="text-detractor hover:underline"
                      onClick={async () => {
                        await atc.gestionarAdmin(uid, false);
                        setAdmins(await leerAdmins());
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="UID del nuevo administrador"
                  value={nuevoAdminUid}
                  onChange={(e) => setNuevoAdminUid(e.target.value)}
                  className="flex-1"
                />
                <Button
                  disabled={!nuevoAdminUid.trim()}
                  onClick={async () => {
                    await atc.gestionarAdmin(nuevoAdminUid.trim(), true);
                    setAdmins(await leerAdmins());
                    setNuevoAdminUid('');
                  }}
                >
                  Agregar admin
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tu UID: <code className="bg-muted px-1 rounded">{perfil.uid}</code>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= CONFIGURACIONES ================= */}
        <TabsContent value="config" className="space-y-4">
          {/* ATC */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4 text-claro-red" /> Configuración ATC</CardTitle>
              <CardDescription>
                Valores vigentes del sistema de incentivos. Los cambios aplican a las próximas cargas de encuestas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">Sistema ATC activo</p>
                  <p className="text-xs text-muted-foreground">Activa/desactiva toda la gamificación</p>
                </div>
                <Switch
                  checked={config.sistemaATCActivo}
                  onCheckedChange={(v) => atc.actualizarConfig({ sistemaATCActivo: v })}
                  aria-label="Activar sistema ATC"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ['saldoInicial', 'Saldo inicial semanal', 1, 500],
                  ['puntosPromotor', 'Puntos por promotor', 1, 100],
                  ['puntosPromotorRacha', 'Puntos por racha', 1, 100],
                  ['puntosPasivo', 'Puntos por pasivo (0 = no resta)', -50, 50],
                  ['puntosDetractor', 'Puntos por detractor', -50, 0],
                  ['rachaVentanaMinutos', 'Ventana de racha (min)', 5, 240],
                ] as const).map(([campo, etiqueta, min, max]) => (
                  <div key={campo} className="space-y-1.5">
                    <Label htmlFor={`cfg-${campo}`}>{etiqueta}</Label>
                    <Input
                      id={`cfg-${campo}`}
                      type="number"
                      min={min}
                      max={max}
                      value={(config[campo] as number) ?? 0}
                      onChange={(e) => {
                        const valor = Number(e.target.value);
                        atc.actualizarConfig({ [campo]: valor }).catch(() => undefined);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="destructive" onClick={() => setDialogoPeligro('reset')} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Reiniciar wallets
                </Button>
                <Button variant="outline" onClick={() => setDialogoPremio(true)} className="gap-2">
                  <Gift className="h-4 w-4" /> Nuevo premio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Premios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catálogo de premios ({atc.premios.length})</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {atc.premios.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                  Catálogo vacío. Agrega el primer premio para tus asesores.
                </p>
              )}
              {atc.premios.map((p) => (
                <div key={p.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl" aria-hidden>{p.emoji}</span>
                    <Badge variant={p.activo ? 'default' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <p className="font-semibold text-sm">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.descripcion}</p>
                  <p className="text-sm font-bold">{p.costoATC} ATC · stock: {p.stock < 0 ? '∞' : p.stock}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPremioEdit(p); setDialogoPremio(true); }}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => atc.eliminarPremio(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-detractor" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= SISTEMA ================= */}
        <TabsContent value="sistema" className="space-y-4">
          {/* Caché */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado del caché local (Dexie / IndexedDB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statsCache ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Encuestas</p>
                      <p className="text-xl font-bold">{statsCache.encuestas.toLocaleString('es-GT')}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Asesores HC</p>
                      <p className="text-xl font-bold">{statsCache.asesoresHC.toLocaleString('es-GT')}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">TMO</p>
                      <p className="text-xl font-bold">{statsCache.tmo ? 'Sí' : '—'}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Reads ahorrados</p>
                      <p className="text-xl font-bold text-promotor">{statsCache.readsAhorradas.toLocaleString('es-GT')}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await cacheLimpiarTodo();
                      setStatsCache(await obtenerEstadisticasCache());
                      toast.success('Caché local limpiado. La próxima visita hará descarga completa.');
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Limpiar caché local
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando estadísticas del caché…</p>
              )}
            </CardContent>
          </Card>

          {/* Gestión de archivos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gestión de archivos</CardTitle>
              <CardDescription>Carga individual de archivos desde el panel administrativo. HC, Qualtrics Digital y TMO se cargan desde aquí.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <GestionArchivo etiqueta="Cargar HC" aceptar=".xlsx,.xls,.csv" onArchivo={(f) => useStore.getState().cargarSoloHC(f)} />
              <GestionArchivo etiqueta="Cargar Qualtrics Digital" aceptar=".xlsx,.xls,.csv" onArchivo={(f) => useStore.getState().cargarSoloQualtrics(f)} />
              <GestionArchivo etiqueta="Cargar TMO" aceptar=".xlsx,.xls" onArchivo={(f) => useStore.getState().cargarArchivoTMO(f)} />
            </CardContent>
          </Card>

          {/* Migración de logins y eliminación de duplicados */}
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amber-600" /> Migración y limpieza de datos
              </CardTitle>
              <CardDescription>
                Herramientas para arreglar datos del sistema. Úsalas si los asesores no ven
                sus encuestas o si aparecen duplicadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                  Migrar logins
                </p>
                <p className="text-xs text-muted-foreground">
                  Re-normaliza los <code className="bg-muted px-1 rounded text-xs">loginNormalizado</code> y{' '}
                  <code className="bg-muted px-1 rounded text-xs">usuarioCic</code> de todas las encuestas y
                  asesores HC, aplicando la función actual (limpia el prefijo{' '}
                  <code className="bg-muted px-1 rounded text-xs">CLAROGT_</code>).
                  Úsalo si los asesores no ven sus encuestas tras un cambio de normalización.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={procesandoCarga}
                  onClick={async () => {
                    if (!confirm('¿Migrar los logins de TODAS las encuestas y asesores HC?')) return;
                    await migrarLogins();
                    setStatsCache(await obtenerEstadisticasCache().catch(() => statsCache));
                  }}
                  className="gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  {procesandoCarga ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Migrar logins ahora
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5 text-amber-600" />
                  Eliminar encuestas duplicadas
                </p>
                <p className="text-xs text-muted-foreground">
                  Detecta y elimina encuestas duplicadas por <code className="bg-muted px-1 rounded text-xs">idTransaccion</code>.
                  Conserva el doc con ID <code className="bg-muted px-1 rounded text-xs">enc_&lt;idTransaccion&gt;</code> (formato nuevo)
                  y borra los duplicados con ID posicional viejo (<code className="bg-muted px-1 rounded text-xs">enc_N</code>).
                  Úsalo si ves que las encuestas aparecen repetidas por asesor.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={procesandoCarga}
                  onClick={async () => {
                    if (!confirm('¿Eliminar encuestas duplicadas? Se conservará una copia por idTransaccion.')) return;
                    await eliminarDuplicados();
                    setStatsCache(await obtenerEstadisticasCache().catch(() => statsCache));
                  }}
                  className="gap-2 border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  {procesandoCarga ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Eliminar duplicados ahora
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Zona de peligro */}
          <Card className="border-detractor/50">
            <CardHeader>
              <CardTitle className="text-base text-detractor">Zona de peligro</CardTitle>
              <CardDescription>
                Acciones irreversibles sobre el sistema. Requieren la clave de administrador.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-detractor/50 text-detractor" onClick={() => setDialogoPeligro('borrar-enc')}>
                Borrar solo encuestas
              </Button>
              <Button variant="outline" className="border-detractor/50 text-detractor" onClick={() => setDialogoPeligro('borrar-hc')}>
                Borrar solo HC
              </Button>
              <Button variant="outline" className="border-detractor/50 text-detractor" onClick={() => setDialogoPeligro('borrar-tmo')}>
                Borrar solo TMO
              </Button>
              <Button variant="destructive" onClick={() => setDialogoPeligro('borrar-todo')} className="gap-2">
                <Trash2 className="h-4 w-4" /> Borrar TODOS los datos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: premios */}
      <Dialog open={dialogoPremio} onOpenChange={setDialogoPremio}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{premioEdit?.id ? 'Editar premio' : 'Nuevo premio'}</DialogTitle>
            <DialogDescription>Configura el premio del catálogo ATC.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="premio-nombre">Nombre</Label>
              <Input id="premio-nombre" value={premioEdit?.nombre ?? ''} onChange={(e) => setPremioEdit((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premio-emoji">Emoji</Label>
              <Input id="premio-emoji" placeholder="☕" value={premioEdit?.emoji ?? ''} onChange={(e) => setPremioEdit((p) => ({ ...p, emoji: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="premio-desc">Descripción</Label>
              <Input id="premio-desc" value={premioEdit?.descripcion ?? ''} onChange={(e) => setPremioEdit((p) => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premio-costo">Costo (ATC)</Label>
              <Input id="premio-costo" type="number" min={1} value={premioEdit?.costoATC ?? 10} onChange={(e) => setPremioEdit((p) => ({ ...p, costoATC: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premio-stock">Stock (−1 = ∞)</Label>
              <Input id="premio-stock" type="number" min={-1} value={premioEdit?.stock ?? -1} onChange={(e) => setPremioEdit((p) => ({ ...p, stock: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premio-categoria">Categoría</Label>
              <Input id="premio-categoria" placeholder="Alimentos" value={premioEdit?.categoria ?? ''} onChange={(e) => setPremioEdit((p) => ({ ...p, categoria: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premio-diario">Límite diario (0 = ∞)</Label>
              <Input id="premio-diario" type="number" min={0} value={premioEdit?.umbralDiario ?? 0} onChange={(e) => setPremioEdit((p) => ({ ...p, umbralDiario: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Auto-aprobación</p>
                <p className="text-xs text-muted-foreground">Los canjes se aprueban sin supervisión</p>
              </div>
              <Switch checked={premioEdit?.autoAprobacion ?? false} onCheckedChange={(v) => setPremioEdit((p) => ({ ...p, autoAprobacion: v }))} />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">Visible en el catálogo del asesor</p>
              </div>
              <Switch checked={premioEdit?.activo ?? true} onCheckedChange={(v) => setPremioEdit((p) => ({ ...p, activo: v }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="premio-imagen">URL de imagen (opcional)</Label>
              <Input
                id="premio-imagen"
                placeholder="https://… (URL directa de la imagen del premio)"
                value={premioEdit?.imagenUrl ?? ''}
                onChange={(e) => setPremioEdit((p) => ({ ...p, imagenUrl: e.target.value }))}
              />
              {premioEdit?.imagenUrl && (
                <img src={premioEdit.imagenUrl} alt="Preview" className="h-20 w-20 rounded-lg object-cover border" />
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="premio-area">Área del premio</Label>
              <Select
                value={premioEdit?.area ?? 'ambas'}
                onValueChange={(v) => setPremioEdit((p) => ({ ...p, area: v as 'digital' | 'telefonico' | 'ambas' }))}
              >
                <SelectTrigger id="premio-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambas">Ambas áreas (Digital y Telefónico)</SelectItem>
                  <SelectItem value="digital">Solo Digital</SelectItem>
                  <SelectItem value="telefonico">Solo Telefónico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogoPremio(false); setPremioEdit({}); }}>Cancelar</Button>
            <Button
              disabled={!premioEdit?.nombre || !premioEdit?.emoji}
              onClick={async () => {
                const res = await guardarPremioAction({
                  id: premioEdit?.id ?? '',
                  nombre: premioEdit?.nombre ?? '',
                  emoji: premioEdit?.emoji ?? '',
                  descripcion: premioEdit?.descripcion ?? '',
                  costoATC: premioEdit?.costoATC ?? 10,
                  categoria: premioEdit?.categoria ?? 'General',
                  stock: premioEdit?.stock ?? -1,
                  umbralDiario: premioEdit?.umbralDiario ?? 0,
                  umbralSemanal: premioEdit?.umbralSemanal ?? 0,
                  autoAprobacion: premioEdit?.autoAprobacion ?? false,
                  activo: premioEdit?.activo ?? true,
                  creado: premioEdit?.creado ?? new Date().toISOString(),
                  imagenUrl: premioEdit?.imagenUrl || undefined,
                  area: premioEdit?.area || 'ambas',
                });
                if (res.ok) {
                  setDialogoPremio(false);
                  setPremioEdit({});
                  toast.success('Premio guardado correctamente.');
                  // Recargar premios via Server Action
                  const premiosNuevos = await leerTodosPremiosAction();
                  useATCStore.setState({ premios: premiosNuevos });
                } else {
                  toast.error(res.error || 'Error al guardar el premio.');
                }
              }}
            >
              Guardar premio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: zona de peligro */}
      <Dialog open={!!dialogoPeligro} onOpenChange={(a) => { if (!a) { setDialogoPeligro(null); setClave(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-detractor" />
              {dialogoPeligro === 'reset' && 'Reiniciar todas las wallets'}
              {dialogoPeligro === 'borrar-enc' && 'Borrar encuestas'}
              {dialogoPeligro === 'borrar-hc' && 'Borrar asesores HC'}
              {dialogoPeligro === 'borrar-tmo' && 'Borrar TMO'}
              {dialogoPeligro === 'borrar-todo' && 'Borrar TODOS los datos'}
            </DialogTitle>
            <DialogDescription>
              {dialogoPeligro === 'reset'
                ? `Todos los saldos volverán a ${config.saldoInicial} ATC. Esta acción no se puede deshacer.`
                : dialogoPeligro === 'borrar-todo'
                  ? 'Se eliminarán encuestas, HC, TMO, metadata y análisis de alertas. Esta acción NO se puede deshacer.'
                  : 'Esta acción no se puede deshacer.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="clave-admin">Clave de administrador</Label>
            <Input id="clave-admin" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••••" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogoPeligro(null); setClave(''); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={clave !== CLAVE_ADMIN}
              onClick={async () => {
                if (!dialogoPeligro) return;
                if (dialogoPeligro === 'reset') {
                  const res = await reiniciarWalletsAction();
                  if (res.ok) {
                    toast.success(`${res.count} wallets reiniciadas al saldo inicial.`);
                  } else {
                    toast.error(res.error || 'Error al reiniciar wallets.');
                  }
                } else {
                  await borrarDatos(
                    dialogoPeligro === 'borrar-enc' ? 'encuestas'
                      : dialogoPeligro === 'borrar-hc' ? 'hc'
                        : dialogoPeligro === 'borrar-tmo' ? 'tmo'
                          : 'todo',
                    clave
                  );
                }
                setDialogoPeligro(null);
                setClave('');
                setStatsCache(await obtenerEstadisticasCache().catch(() => statsCache));
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Input de archivo estilizado para la gestión administrativa */
function GestionArchivo({
  etiqueta,
  aceptar,
  onArchivo,
}: {
  etiqueta: string;
  aceptar: string;
  onArchivo: (archivo: File) => void;
}) {
  return (
    <label className="cursor-pointer rounded-lg border-2 border-dashed px-4 py-2 text-sm hover:border-claro-red/60 hover:bg-accent/40 transition-colors">
      <input
        type="file"
        accept={aceptar}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArchivo(f);
          e.target.value = '';
        }}
      />
      {etiqueta}
    </label>
  );
}
