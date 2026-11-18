'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, KeyRound, Loader2, Plus, Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  listarUsuariosGestionAction,
  crearUsuarioAction,
  actualizarUsuarioAction,
  eliminarUsuarioAction,
  resetPasswordAction,
  type UsuarioGestion,
  type Rol,
} from '@/app/actions/usuarios-actions';
import { resetPasswordMasivo } from '@/app/actions/neon-actions';

export function GestionUsuariosView() {
  const [usuarios, setUsuarios] = useState<UsuarioGestion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [dialogoCrear, setDialogoCrear] = useState(false);
  const [dialogoEditar, setDialogoEditar] = useState<UsuarioGestion | null>(null);
  const [guardando, setGuardando] = useState(false);

  // v3.0: Reset masivo
  const [dialogoResetMasivo, setDialogoResetMasivo] = useState(false);
  const [resetFiltro, setResetFiltro] = useState<'todos' | 'area' | 'lob'>('todos');
  const [resetArea, setResetArea] = useState<'digital' | 'telefonico'>('digital');
  const [resetLob, setResetLob] = useState('');
  const [resetExcluirAdmins, setResetExcluirAdmins] = useState(true);
  const [resetNuevoPassword, setResetNuevoPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMasivoProcesando, setResetMasivoProcesando] = useState(false);

  // Form crear
  const [fUsername, setFUsername] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fName, setFName] = useState('');
  const [FRol, setFRol] = useState<Rol>('ASESOR');
  const [fArea, setFArea] = useState<'digital' | 'telefonico'>('digital');
  const [fEmail, setFEmail] = useState('');
  const [fDocumento, setFDocumento] = useState('');

  // Form editar
  const [eName, setEName] = useState('');
  const [eRol, setERol] = useState<Rol>('ASESOR');
  const [eArea, setEArea] = useState<'digital' | 'telefonico'>('digital');
  const [eEmail, setEEmail] = useState('');
  const [eDocumento, setEDocumento] = useState('');
  const [eActivo, setEActivo] = useState(true);
  const [ePassword, setEPassword] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const lista = await listarUsuariosGestionAction();
      setUsuarios(lista);
    } finally {
      setCargando(false);
    }
  }

  const filtrados = busqueda.trim()
    ? usuarios.filter((u) =>
        u.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.username.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : usuarios;

  // v3.0: Estimación de cuántos usuarios se verán afectados por el reset masivo
  const estimacionAfectados = useMemo(() => {
    let lista = usuarios;
    if (resetExcluirAdmins) {
      lista = lista.filter((u) => u.role !== 'ADMIN');
    }
    if (resetFiltro === 'area') {
      lista = lista.filter((u) => u.area === resetArea);
    } else if (resetFiltro === 'lob') {
      const q = resetLob.toLowerCase().trim();
      // No podemos saber el LOB directamente desde el modelo User (está en AsesorHC).
      // Mostramos una estimación basada en el área (en el backend el filtro es exacto).
      lista = lista.filter((u) => u.area === 'digital' || u.area === 'telefonico');
      // Heuristic: si el LOB contiene "whatsapp" → área digital; si contiene "telefonic" → telefonico
      if (q.includes('whatsapp')) lista = lista.filter((u) => u.area === 'digital');
      if (q.includes('telefon')) lista = lista.filter((u) => u.area === 'telefonico');
    }
    return lista.length;
  }, [usuarios, resetExcluirAdmins, resetFiltro, resetArea, resetLob]);

  async function handleResetMasivo() {
    if (resetNuevoPassword.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (resetNuevoPassword !== resetConfirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (
      !confirm(
        `⚠️ Estás a punto de cambiar la contraseña de ${estimacionAfectados} usuario(s). ` +
          `¿Estás seguro de continuar?`
      )
    )
      return;

    setResetMasivoProcesando(true);
    try {
      const res = await resetPasswordMasivo({
        filtro: resetFiltro,
        area: resetFiltro === 'area' ? resetArea : undefined,
        lob: resetFiltro === 'lob' ? resetLob : undefined,
        nuevoPassword: resetNuevoPassword,
        excluirAdmins: resetExcluirAdmins,
      });
      if ((res as any).ok) {
        toast.success(
          `Reset masivo completado: ${(res as any).actualizados ?? estimacionAfectados} usuario(s) afectado(s).`
        );
        setDialogoResetMasivo(false);
        setResetNuevoPassword('');
        setResetConfirmPassword('');
        setResetLob('');
      } else {
        toast.error((res as any).error || 'Error en el reset masivo.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error inesperado.');
    } finally {
      setResetMasivoProcesando(false);
    }
  }

  async function handleCrear() {
    setGuardando(true);
    try {
      const res = await crearUsuarioAction({
        username: fUsername,
        password: fPassword,
        name: fName,
        role: FRol,
        area: fArea,
        email: fEmail || undefined,
        documento: fDocumento || undefined,
      });
      if (res.ok) {
        toast.success(`Usuario "${fUsername}" creado correctamente.`);
        setDialogoCrear(false);
        limpiarFormCrear();
        cargar();
      } else {
        toast.error(res.error || 'Error al crear usuario.');
      }
    } finally {
      setGuardando(false);
    }
  }

  async function handleEditar() {
    if (!dialogoEditar) return;
    setGuardando(true);
    try {
      const res = await actualizarUsuarioAction({
        id: dialogoEditar.id,
        name: eName,
        role: eRol,
        area: eArea,
        email: eEmail,
        documento: eDocumento,
        activo: eActivo,
        password: ePassword || undefined,
      });
      if (res.ok) {
        toast.success('Usuario actualizado.');
        setDialogoEditar(null);
        cargar();
      } else {
        toast.error(res.error || 'Error al actualizar.');
      }
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(u: UsuarioGestion) {
    if (!confirm(`¿Eliminar (desactivar) al usuario "${u.name || u.username}"?`)) return;
    const res = await eliminarUsuarioAction(u.id);
    if (res.ok) {
      toast.success('Usuario desactivado.');
      cargar();
    } else {
      toast.error(res.error || 'Error.');
    }
  }

  async function handleResetPassword(u: UsuarioGestion) {
    if (
      !confirm(
        `¿Resetear la contraseña de "${u.name || u.username}"?\n\n` +
          `Se establecerá su documento (cédula) como contraseña y deberá cambiarla al ingresar.`
      )
    )
      return;
    try {
      const res = await resetPasswordAction(u.id);
      if (res.ok) {
        toast.success(
          'Contraseña reseteada al documento del asesor. Deberá cambiarla al ingresar.'
        );
        cargar();
      } else {
        toast.error(res.error || 'Error al resetear la contraseña.');
      }
    } catch (e) {
      console.error('Error reseteando contraseña:', e);
      toast.error('Error inesperado al resetear la contraseña.');
    }
  }

  function limpiarFormCrear() {
    setFUsername('');
    setFPassword('');
    setFName('');
    setFRol('ASESOR');
    setFArea('digital');
    setFEmail('');
    setFDocumento('');
  }

  function abrirEditar(u: UsuarioGestion) {
    setDialogoEditar(u);
    setEName(u.name);
    setERol(u.role);
    setEArea(u.area as 'digital' | 'telefonico');
    setEEmail(u.email || '');
    setEDocumento(u.documento);
    setEActivo(u.activo);
    setEPassword('');
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-claro-red" /> Gestión de usuarios
              </CardTitle>
              <CardDescription>
                Crea, edita y desactiva usuarios. Puedes asignar roles de asesor, supervisor o admin.
              </CardDescription>
            </div>
            <Button onClick={() => setDialogoCrear(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo usuario
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialogoResetMasivo(true)}
              className="gap-2"
              title="Resetear contraseñas en lote"
            >
              <KeyRound className="h-4 w-4" /> Reset masivo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, username o email…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>

          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay usuarios.</p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '—'}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{u.username}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'ADMIN' ? 'destructive' : u.role === 'SUPERVISOR' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.area}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email || '—'}</TableCell>
                      <TableCell>
                        {u.activo ? (
                          <span className="flex items-center gap-1 text-xs text-promotor">
                            <UserCheck className="h-3.5 w-3.5" /> Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-detractor">
                            <UserX className="h-3.5 w-3.5" /> Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => abrirEditar(u)} className="gap-1">
                            <Edit3 className="h-3 w-3" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(u)}
                            className="gap-1"
                            title="Resetear contraseña al documento del asesor"
                          >
                            <KeyRound className="h-3 w-3" /> Reset contraseña
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEliminar(u)}
                            className="text-detractor hover:text-detractor"
                            title="Desactivar usuario"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Total: {usuarios.length} usuarios ({usuarios.filter((u) => u.activo).length} activos,{' '}
            {usuarios.filter((u) => !u.activo).length} inactivos).
          </p>
        </CardContent>
      </Card>

      {/* Dialog: crear usuario */}
      <Dialog open={dialogoCrear} onOpenChange={setDialogoCrear}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              El usuario podrá iniciar sesión inmediatamente con el username y contraseña que definas aquí.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Username *</Label>
              <Input id="u-username" placeholder="jperez" value={fUsername} onChange={(e) => setFUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">Contraseña *</Label>
              <Input id="u-password" type="password" placeholder="••••••" value={fPassword} onChange={(e) => setFPassword(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input id="u-name" placeholder="Juan Pérez" value={fName} onChange={(e) => setFName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-rol">Rol</Label>
              <Select value={FRol} onValueChange={(v) => setFRol(v as Rol)}>
                <SelectTrigger id="u-rol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASESOR">Asesor</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-area">Área</Label>
              <Select value={fArea} onValueChange={(v) => setFArea(v as 'digital' | 'telefonico')}>
                <SelectTrigger id="u-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="telefonico">Telefónico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email (opcional)</Label>
              <Input id="u-email" type="email" placeholder="juan@claro.com" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-doc">Cédula (opcional)</Label>
              <Input id="u-doc" placeholder="205012345" value={fDocumento} onChange={(e) => setFDocumento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoCrear(false)}>Cancelar</Button>
            <Button
              disabled={!fUsername.trim() || !fPassword || guardando}
              onClick={handleCrear}
              className="gap-2"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar usuario */}
      <Dialog open={!!dialogoEditar} onOpenChange={(a) => !a && setDialogoEditar(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar: {dialogoEditar?.name || dialogoEditar?.username}</DialogTitle>
            <DialogDescription>
              Cambia los datos del usuario. Deja la contraseña vacía si no quieres cambiarla.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="e-name">Nombre</Label>
              <Input id="e-name" value={eName} onChange={(e) => setEName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-rol">Rol</Label>
              <Select value={eRol} onValueChange={(v) => setERol(v as Rol)}>
                <SelectTrigger id="e-rol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASESOR">Asesor</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-area">Área</Label>
              <Select value={eArea} onValueChange={(v) => setEArea(v as 'digital' | 'telefonico')}>
                <SelectTrigger id="e-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="telefonico">Telefónico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email</Label>
              <Input id="e-email" type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-doc">Cédula</Label>
              <Input id="e-doc" value={eDocumento} onChange={(e) => setEDocumento(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="e-pass">Nueva contraseña (dejar vacío para no cambiar)</Label>
              <Input id="e-pass" type="password" placeholder="••••••" value={ePassword} onChange={(e) => setEPassword(e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Usuario activo</p>
                <p className="text-xs text-muted-foreground">Si está inactivo, no puede iniciar sesión</p>
              </div>
              <Switch checked={eActivo} onCheckedChange={setEActivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoEditar(null)}>Cancelar</Button>
            <Button disabled={guardando} onClick={handleEditar} className="gap-2">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset masivo de contraseñas */}
      <Dialog open={dialogoResetMasivo} onOpenChange={setDialogoResetMasivo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Reset masivo de contraseñas
            </DialogTitle>
            <DialogDescription>
              Cambia la contraseña de muchos usuarios en una sola operación. Los usuarios afectados
              deberán cambiarla en su próximo login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Filtro */}
            <div className="space-y-1.5">
              <Label>Aplicar a</Label>
              <Select
                value={resetFiltro}
                onValueChange={(v) => setResetFiltro(v as 'todos' | 'area' | 'lob')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  <SelectItem value="area">Por área</SelectItem>
                  <SelectItem value="lob">Por LOB (línea de negocio)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resetFiltro === 'area' && (
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Select
                  value={resetArea}
                  onValueChange={(v) => setResetArea(v as 'digital' | 'telefonico')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="telefonico">Telefónico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {resetFiltro === 'lob' && (
              <div className="space-y-1.5">
                <Label htmlFor="reset-lob">LOB (texto libre)</Label>
                <Input
                  id="reset-lob"
                  placeholder="Ej. WhatsApp Fijo Soporte"
                  value={resetLob}
                  onChange={(e) => setResetLob(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Se comparará con el LOB de la tabla de asesores HC.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                id="excluir-admins"
                checked={resetExcluirAdmins}
                onCheckedChange={(v) => setResetExcluirAdmins(v === true)}
              />
              <Label htmlFor="excluir-admins" className="text-sm font-normal cursor-pointer">
                Excluir administradores
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reset-pass">Nueva contraseña</Label>
                <Input
                  id="reset-pass"
                  type="password"
                  placeholder="••••••"
                  value={resetNuevoPassword}
                  onChange={(e) => setResetNuevoPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-pass2">Confirmar</Label>
                <Input
                  id="reset-pass2"
                  type="password"
                  placeholder="••••••"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  ⚠️ Esto cambiará la contraseña de {estimacionAfectados} usuario(s) y los forzará a
                  cambiarla en su próximo login.
                </p>
                <p className="text-xs mt-0.5">
                  Asegúrate de comunicar la nueva contraseña por un canal seguro.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoResetMasivo(false)}>Cancelar</Button>
            <Button
              onClick={handleResetMasivo}
              disabled={
                resetMasivoProcesando ||
                !resetNuevoPassword ||
                resetNuevoPassword !== resetConfirmPassword ||
                resetNuevoPassword.length < 4
              }
              className="gap-2"
            >
              {resetMasivoProcesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Aplicar reset masivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
