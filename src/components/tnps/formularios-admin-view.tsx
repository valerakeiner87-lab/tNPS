'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  eliminarFormularioAction,
  guardarFormularioAction,
  listarFormulariosAction,
  toggleFormularioActivoAction,
  type FormularioData,
  type PreguntaData,
} from '@/app/actions/learning-actions';
import { cn } from '@/lib/utils';

type TipoPregunta = 'opcion_multiple' | 'verdadero_falso';
type Diseno = 'clasico' | 'tarjetas' | 'quiz' | 'encuesta';
type AsignacionTipo = 'todos' | 'asesor' | 'area' | 'linea';

interface PreguntaDraft extends PreguntaData {
  _key?: string;
}

/** Color del badge de categoría (v3.0.7). */
function colorCategoriaBadge(cat: string): string {
  const c = (cat || '').toLowerCase();
  if (c.includes('producto')) return 'bg-claro-blue/10 text-claro-blue border-claro-blue/30 dark:text-claro-blue';
  if (c.includes('soft') || c.includes('skill')) return 'bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300';
  if (c.includes('proceso')) return 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300';
  if (c.includes('servicio')) return 'bg-promotor/10 text-promotor border-promotor/30';
  if (c.includes('vent')) return 'bg-detractor/10 text-detractor border-detractor/30';
  return 'bg-primary/10 text-primary border-primary/30';
}

function nuevaPregunta(orden: number): PreguntaDraft {
  return {
    _key: Math.random().toString(36).slice(2),
    tipo: 'opcion_multiple',
    enunciado: '',
    opciones: ['', ''],
    respuestaCorrecta: 0,
    explicacion: '',
    orden,
  };
}

type FormularioDraft = Omit<FormularioData, 'preguntas'> & { preguntas: PreguntaDraft[] };

/** Admin view para CRUD de formularios de aprendizaje. */
export function FormulariosAdminView() {
  const [formularios, setFormularios] = useState<FormularioData[]>([]);
  const [cargando, setCargando] = useState(true);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [draft, setDraft] = useState<FormularioDraft | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const lista = await listarFormulariosAction();
      setFormularios(lista);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar formularios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirNuevo() {
    setDraft({
      id: '',
      titulo: '',
      descripcion: '',
      categoria: '',
      diseño: 'clasico',
      maxIntentos: 1,
      atcPorRespuesta: 1,
      atcBonus: 5,
      activo: true,
      imagenUrl: null,
      asignacionTipo: 'todos',
      asignacionValor: '',
      preguntas: [nuevaPregunta(0)],
    });
    setDialogoAbierto(true);
  }

  function abrirEditar(f: FormularioData) {
    setDraft({
      ...f,
      preguntas:
        f.preguntas && f.preguntas.length > 0
          ? f.preguntas.map((p, i) => ({ ...p, _key: Math.random().toString(36).slice(2), orden: i }))
          : [nuevaPregunta(0)],
    });
    setDialogoAbierto(true);
  }

  async function guardar() {
    if (!draft) return;
    if (!draft.titulo.trim()) {
      toast.error('El título es obligatorio.');
      return;
    }
    if (draft.preguntas.length === 0) {
      toast.error('Agrega al menos una pregunta.');
      return;
    }
    // Validar preguntas
    for (let i = 0; i < draft.preguntas.length; i++) {
      const p = draft.preguntas[i];
      if (!p.enunciado.trim()) {
        toast.error(`Pregunta ${i + 1}: el enunciado es obligatorio.`);
        return;
      }
      if (p.tipo === 'opcion_multiple') {
        const opcionesValidas = (p.opciones || []).filter((o) => o.trim() !== '');
        if (opcionesValidas.length < 2) {
          toast.error(`Pregunta ${i + 1}: necesita al menos 2 opciones.`);
          return;
        }
      }
    }
    setGuardando(true);
    try {
      const payload: FormularioData = {
        ...draft,
        preguntas: draft.preguntas.map((p, i) => ({
          id: p.id,
          formularioId: p.formularioId,
          tipo: p.tipo,
          enunciado: p.enunciado,
          opciones: p.tipo === 'opcion_multiple'
            ? (p.opciones || []).filter((o) => o.trim() !== '')
            : ['Verdadero', 'Falso'],
          respuestaCorrecta: p.tipo === 'verdadero_falso'
            ? (p.respuestaCorrecta === 1 ? 1 : 0)
            : Math.max(0, Math.min((p.opciones || []).length - 1, p.respuestaCorrecta)),
          esVerdadero: p.tipo === 'verdadero_falso' ? p.respuestaCorrecta === 1 : null,
          explicacion: p.explicacion || '',
          imagenUrl: p.imagenUrl || null,
          orden: i,
        })),
      };
      const res = await guardarFormularioAction(payload);
      if (res.ok) {
        toast.success('Formulario guardado.');
        setDialogoAbierto(false);
        await cargar();
      } else {
        toast.error(res.error || 'Error al guardar el formulario.');
      }
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este formulario? Se perderán las preguntas y respuestas.')) return;
    const res = await eliminarFormularioAction(id);
    if (res.ok) {
      toast.success('Formulario eliminado.');
      await cargar();
    } else {
      toast.error(res.error || 'Error.');
    }
  }

  async function toggleActivo(f: FormularioData, nuevoValor: boolean) {
    const res = await toggleFormularioActivoAction(f.id, nuevoValor);
    if (res.ok) {
      toast.success(`Formulario ${nuevoValor ? 'activado' : 'desactivado'}.`);
      await cargar();
    } else {
      toast.error('Error al cambiar estado.');
    }
  }

  // === Operaciones sobre preguntas ===
  function agregarPregunta() {
    if (!draft) return;
    setDraft({
      ...draft,
      preguntas: [...draft.preguntas, nuevaPregunta(draft.preguntas.length)],
    });
  }
  function eliminarPregunta(idx: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      preguntas: draft.preguntas.filter((_, i) => i !== idx).map((p, i) => ({ ...p, orden: i })),
    });
  }
  function actualizarPregunta(idx: number, patch: Partial<PreguntaDraft>) {
    if (!draft) return;
    const nuevas = [...draft.preguntas];
    nuevas[idx] = { ...nuevas[idx], ...patch };
    setDraft({ ...draft, preguntas: nuevas });
  }
  function agregarOpcion(idx: number) {
    if (!draft) return;
    const p = draft.preguntas[idx];
    actualizarPregunta(idx, { opciones: [...(p.opciones || []), ''] });
  }
  function eliminarOpcion(idx: number, oi: number) {
    if (!draft) return;
    const p = draft.preguntas[idx];
    const opciones = (p.opciones || []).filter((_, i) => i !== oi);
    const nuevaCorrecta = p.respuestaCorrecta >= opciones.length ? 0 : p.respuestaCorrecta;
    actualizarPregunta(idx, { opciones, respuestaCorrecta: nuevaCorrecta });
  }
  function actualizarOpcion(idx: number, oi: number, valor: string) {
    if (!draft) return;
    const p = draft.preguntas[idx];
    const opciones = [...(p.opciones || [])];
    opciones[oi] = valor;
    actualizarPregunta(idx, { opciones });
  }

  const categoriasExistentes = Array.from(new Set(formularios.map((f) => f.categoria).filter(Boolean)));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="font-semibold">Formularios de aprendizaje</p>
            <p className="text-xs text-muted-foreground">
              Crea cuestionarios para que los asesores aprendan y ganen ATC.
            </p>
          </div>
          <Button onClick={abrirNuevo} className="gap-2">
            <Plus className="h-4 w-4" /> Crear formulario
          </Button>
        </CardContent>
      </Card>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : formularios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aún no hay formularios. Crea el primero con el botón de arriba.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden animar-fade-in">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-center">Preguntas</TableHead>
                <TableHead className="text-center">Asignación</TableHead>
                <TableHead className="text-center">ATC</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formularios.map((f) => (
                <TableRow key={f.id} className={cn('hover:bg-accent/40', !f.activo && 'opacity-60')}>
                  <TableCell>
                    <p className="font-medium">{f.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                      {f.descripcion}
                    </p>
                  </TableCell>
                  <TableCell>
                    {f.categoria ? (
                      <Badge variant="outline" className={cn('text-[10px] capitalize', colorCategoriaBadge(f.categoria))}>
                        {f.categoria}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {f.preguntas?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">
                      {f.asignacionTipo}
                      {f.asignacionValor ? `: ${f.asignacionValor}` : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    <span className="text-promotor">+{f.atcPorRespuesta}/resp</span>
                    <br />
                    <span className="text-claro-blue">+{f.atcBonus} bonus</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={f.activo}
                      onCheckedChange={(v) => toggleActivo(f, v)}
                      aria-label="Activar/desactivar formulario"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirEditar(f)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => eliminar(f.id)}
                        className="text-detractor hover:text-detractor"
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

      {/* === Dialog crear/editar formulario === */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar formulario' : 'Nuevo formulario'}</DialogTitle>
            <DialogDescription>
              Configura el formulario y agrega preguntas. Los asesores ganan ATC por cada respuesta
              correcta.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              {/* Básico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="f-titulo">Título *</Label>
                  <Input
                    id="f-titulo"
                    placeholder="Ej. Producto Móvil Postpago"
                    value={draft.titulo}
                    onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="f-desc">Descripción</Label>
                  <Textarea
                    id="f-desc"
                    placeholder="¿Qué aprenderá el asesor con este formulario?"
                    value={draft.descripcion}
                    onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-categoria">Categoría</Label>
                  <Input
                    id="f-categoria"
                    list="categorias-existentes"
                    placeholder="Ej. Producto, Soft Skills, Proceso"
                    value={draft.categoria}
                    onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}
                  />
                  <datalist id="categorias-existentes">
                    {categoriasExistentes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-diseno">Diseño</Label>
                  <Select
                    value={draft.diseño}
                    onValueChange={(v) => setDraft({ ...draft, diseño: v })}
                  >
                    <SelectTrigger id="f-diseno">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clasico">Clásico (todas a la vez)</SelectItem>
                      <SelectItem value="tarjetas">Tarjetas (flip)</SelectItem>
                      <SelectItem value="quiz">Quiz (una a la vez)</SelectItem>
                      <SelectItem value="encuesta">Encuesta (estilo encuesta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-intentos">Máximo de intentos (0 = ilimitado)</Label>
                  <Input
                    id="f-intentos"
                    type="number"
                    min={0}
                    value={draft.maxIntentos}
                    onChange={(e) =>
                      setDraft({ ...draft, maxIntentos: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-atc-resp">ATC por respuesta correcta</Label>
                  <Input
                    id="f-atc-resp"
                    type="number"
                    min={0}
                    value={draft.atcPorRespuesta}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        atcPorRespuesta: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-atc-bonus">ATC bonus por completar todo</Label>
                  <Input
                    id="f-atc-bonus"
                    type="number"
                    min={0}
                    value={draft.atcBonus}
                    onChange={(e) =>
                      setDraft({ ...draft, atcBonus: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-asig-tipo">Asignación</Label>
                  <Select
                    value={draft.asignacionTipo}
                    onValueChange={(v) =>
                      setDraft({ ...draft, asignacionTipo: v as AsignacionTipo, asignacionValor: '' })
                    }
                  >
                    <SelectTrigger id="f-asig-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los asesores</SelectItem>
                      <SelectItem value="asesor">Asesor específico</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="linea">Línea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.asignacionTipo !== 'todos' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="f-asig-valor">
                      {draft.asignacionTipo === 'asesor'
                        ? 'Login del asesor'
                        : draft.asignacionTipo === 'area'
                          ? 'Área (digital/telefonico)'
                          : 'Línea'}
                    </Label>
                    <Input
                      id="f-asig-valor"
                      placeholder={
                        draft.asignacionTipo === 'asesor'
                          ? 'ej. moises.rocha'
                          : draft.asignacionTipo === 'area'
                            ? 'digital o telefonico'
                            : 'ej. Móvil'
                      }
                      value={draft.asignacionValor || ''}
                      onChange={(e) =>
                        setDraft({ ...draft, asignacionValor: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Preguntas */}
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Preguntas ({draft.preguntas.length})</p>
                  <Button size="sm" variant="outline" onClick={agregarPregunta} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Agregar pregunta
                  </Button>
                </div>

                {draft.preguntas.map((p, idx) => (
                  <div key={p._key || `p-${idx}`} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        P{idx + 1}
                      </Badge>
                      <Select
                        value={p.tipo}
                        onValueChange={(v) =>
                          actualizarPregunta(idx, {
                            tipo: v as TipoPregunta,
                            opciones: v === 'verdadero_falso' ? ['Verdadero', 'Falso'] : p.opciones?.length ? p.opciones : ['', ''],
                            respuestaCorrecta: 0,
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="opcion_multiple">Opción múltiple</SelectItem>
                          <SelectItem value="verdadero_falso">Verdadero / Falso</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-detractor"
                        onClick={() => eliminarPregunta(idx)}
                        aria-label="Eliminar pregunta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Enunciado de la pregunta"
                      value={p.enunciado}
                      onChange={(e) => actualizarPregunta(idx, { enunciado: e.target.value })}
                    />
                    {p.tipo === 'opcion_multiple' && (
                      <div className="space-y-1.5">
                        {(p.opciones || []).map((op, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correcta-${idx}`}
                              checked={p.respuestaCorrecta === oi}
                              onChange={() => actualizarPregunta(idx, { respuestaCorrecta: oi })}
                              aria-label="Marcar como correcta"
                            />
                            <Input
                              placeholder={`Opción ${oi + 1}`}
                              value={op}
                              onChange={(e) => actualizarOpcion(idx, oi, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => eliminarOpcion(idx, oi)}
                              aria-label="Eliminar opción"
                              disabled={(p.opciones || []).length <= 2}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => agregarOpcion(idx)}
                          className="gap-1.5"
                        >
                          <Plus className="h-3 w-3" /> Agregar opción
                        </Button>
                      </div>
                    )}
                    {p.tipo === 'verdadero_falso' && (
                      <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`correcta-vf-${idx}`}
                            checked={p.respuestaCorrecta === 1}
                            onChange={() => actualizarPregunta(idx, { respuestaCorrecta: 1 })}
                          />
                          Verdadero
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`correcta-vf-${idx}`}
                            checked={p.respuestaCorrecta === 0}
                            onChange={() => actualizarPregunta(idx, { respuestaCorrecta: 0 })}
                          />
                          Falso
                        </label>
                      </div>
                    )}
                    <Textarea
                      placeholder="Explicación (se mostrará después de responder)"
                      value={p.explicacion}
                      onChange={(e) => actualizarPregunta(idx, { explicacion: e.target.value })}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar formulario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
