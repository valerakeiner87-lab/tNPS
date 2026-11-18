'use client';

/* eslint-disable react-hooks/set-state-in-effect */
// ============================================================
// v3.0.5 — Torneos (Admin/Supervisor)
// Lista de torneos en tarjetas + diálogo Crear/Editar.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Edit3,
  Loader2,
  Medal,
  Plus,
  Trash2,
  Trophy,
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
import { Textarea } from '@/components/ui/textarea';
import {
  guardarTorneoAction,
  eliminarTorneoAction,
  listarTorneosAction,
} from '@/app/actions/audit-actions';

interface Torneo {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  area: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  premio: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

const TIPOS = [
  { value: 'tnps', label: 'tNPS' },
  { value: 'atc', label: 'ATC' },
  { value: 'promotores', label: 'Promotores' },
  { value: 'rachas', label: 'Rachas' },
];

const AREAS = [
  { value: 'digital', label: 'Digital' },
  { value: 'telefonico', label: 'Telefónico' },
  { value: 'ambas', label: 'Ambas' },
];

function formatearFechaCorta(fecha: string): string {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

const COLOR_TIPO: Record<string, string> = {
  tnps: 'bg-claro-blue/15 text-claro-blue',
  atc: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  promotores: 'bg-promotor/15 text-promotor',
  rachas: 'bg-pasivo/15 text-pasivo',
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dentroDeRango(inicio: string, fin: string): boolean {
  if (!inicio || !fin) return false;
  const hoy = hoyISO();
  return hoy >= inicio && hoy <= fin;
}

interface FormState {
  id?: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  area: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  premio: string;
}

function formVacio(): FormState {
  return {
    nombre: '',
    descripcion: '',
    tipo: 'tnps',
    area: 'ambas',
    fechaInicio: hoyISO(),
    fechaFin: hoyISO(),
    activo: true,
    premio: '',
  };
}

export function TorneosView() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());
  const [aEliminar, setAEliminar] = useState<Torneo | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarTorneosAction();
      setTorneos(Array.isArray(res) ? (res as Torneo[]) : []);
    } catch (err) {
      console.error('TorneosView: error al cargar', err);
      toast.error('No se pudieron cargar los torneos.');
      setTorneos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirCrear() {
    setForm(formVacio());
    setDialogoAbierto(true);
  }

  function abrirEditar(t: Torneo) {
    setForm({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion || '',
      tipo: t.tipo || 'tnps',
      area: t.area || 'ambas',
      fechaInicio: t.fechaInicio || hoyISO(),
      fechaFin: t.fechaFin || hoyISO(),
      activo: t.activo ?? true,
      premio: t.premio || '',
    });
    setDialogoAbierto(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      toast.error('El nombre del torneo es obligatorio.');
      return;
    }
    if (form.fechaFin < form.fechaInicio) {
      toast.error('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }
    setGuardando(true);
    try {
      const res = await guardarTorneoAction({
        id: form.id,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        tipo: form.tipo,
        area: form.area,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        activo: form.activo,
        premio: form.premio.trim(),
      });
      if (!res.ok) {
        toast.error(res.error || 'No se pudo guardar el torneo.');
        return;
      }
      toast.success(form.id ? 'Torneo actualizado.' : 'Torneo creado.');
      setDialogoAbierto(false);
      await cargar();
    } catch (err) {
      console.error('TorneosView: error al guardar', err);
      toast.error('Ocurrió un error al guardar el torneo.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      const res = await eliminarTorneoAction(aEliminar.id);
      if (!res.ok) {
        toast.error('No se pudo eliminar el torneo.');
        return;
      }
      toast.success('Torneo eliminado.');
      setAEliminar(null);
      await cargar();
    } catch (err) {
      console.error('TorneosView: error al eliminar', err);
      toast.error('Ocurrió un error al eliminar el torneo.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header con botón crear */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-500" aria-hidden />
            Torneos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea y administra torneos para motivar a los asesores. Los torneos activos se muestran
            en el podio y el inicio.
          </p>
        </div>
        <Button onClick={abrirCrear} className="gap-2">
          <Plus className="h-4 w-4" />
          Crear Torneo
        </Button>
      </div>

      {/* Lista */}
      {cargando && torneos.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando torneos…
          </CardContent>
        </Card>
      ) : torneos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
            <p className="font-medium">No hay torneos creados todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea el primer torneo para motivar a tu equipo.
            </p>
            <Button onClick={abrirCrear} className="gap-2 mt-2">
              <Plus className="h-4 w-4" />
              Crear Torneo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {torneos.map((t) => {
            const enCurso = dentroDeRango(t.fechaInicio, t.fechaFin);
            const estadoActivo = t.activo && enCurso;
            return (
              <Card key={t.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{t.nombre}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge variant="secondary" className={`text-[10px] ${COLOR_TIPO[t.tipo] ?? ''}`}>
                          {(TIPOS.find((x) => x.value === t.tipo)?.label) || t.tipo}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {AREAS.find((x) => x.value === t.area)?.label || t.area}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            estadoActivo
                              ? 'bg-promotor/15 text-promotor'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {estadoActivo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                    <Medal className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />
                  </div>

                  {t.descripcion && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{t.descripcion}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    <span>
                      {formatearFechaCorta(t.fechaInicio)} — {formatearFechaCorta(t.fechaFin)}
                    </span>
                  </div>

                  {t.premio && (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold">
                        Premio
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-200 line-clamp-2">{t.premio}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 flex-1"
                      onClick={() => abrirEditar(t)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setAEliminar(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Diálogo Crear/Editar ===== */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {form.id ? 'Editar Torneo' : 'Crear Torneo'}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del torneo. Los campos con * son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="t-nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="t-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Torneo de Promotores Q1"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="t-desc">Descripción</Label>
              <Textarea
                id="t-desc"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Reglas y objetivos del torneo…"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-tipo">Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger id="t-tipo" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="t-area">Área</Label>
                <Select
                  value={form.area}
                  onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
                >
                  <SelectTrigger id="t-area" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-inicio">Fecha Inicio</Label>
                <Input
                  id="t-inicio"
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="t-fin">Fecha Fin</Label>
                <Input
                  id="t-fin"
                  type="date"
                  value={form.fechaFin}
                  onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="t-premio">Premio</Label>
              <Input
                id="t-premio"
                value={form.premio}
                onChange={(e) => setForm((f) => ({ ...f, premio: e.target.value }))}
                placeholder="Ej: Tarjeta de Q500 + día libre"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2 rounded-md border p-3">
              <Switch
                id="t-activo"
                checked={form.activo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))}
              />
              <Label htmlFor="t-activo" className="cursor-pointer">
                <span className="font-medium">Torneo activo</span>
                <p className="text-xs text-muted-foreground">
                  Los torneos activos se muestran en el podio y el inicio.
                </p>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              {form.id ? 'Guardar cambios' : 'Crear torneo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Confirmar eliminar ===== */}
      <Dialog open={!!aEliminar} onOpenChange={(o) => !o && setAEliminar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar torneo
            </DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar <strong>{aEliminar?.nombre}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarEliminar}
              disabled={eliminando}
              className="gap-2"
            >
              {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
