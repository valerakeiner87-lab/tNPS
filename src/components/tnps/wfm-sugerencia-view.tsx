'use client';

/**
 * v3.3.0 Fase 2 — WfmSugerenciaView
 * ----------------------------------
 * Formulario para que el asesor envíe sugerencias de turno a WFM.
 *
 * Banner sticky con aviso (word-wrap: break-word).
 * Cédula (select con búsqueda) — lista predefinida.
 * Turno Sugerido (select) — 24 opciones predefinidas.
 * Descanso (select): LUNES a DOMINGO.
 * Tipo de Restricción (select): ESTUDIO, EMBARAZO, OTROS.
 * Prioridad (select): PRIORIDAD DESCANSO, PRIORIDAD TURNO.
 * Comentario (textarea).
 *
 * Submit → guardarSugerenciaTurno(...). Toast y listado de sugerencias previas.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Inbox, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { guardarSugerenciaTurno, leerSugerenciasTurno } from '@/lib/firestore-data';
import type { SugerenciaTurno } from '@/lib/neon-data';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lista predefinida de cédulas
const CEDULAS = [
  '1045707315', '1129506876', '1001915726', '1045704112', '1129513289',
  '1001918031', '1047034088', '1007355519', '1048323555', '1001999300',
  '1046697370', '1019097690', '1002134605', '1002344251', '1143134406',
  '1001823997', '1103497396', '1129537689', '1045755526',
];

const TURNOS_SUGERIDOS = [
  '0:00:00-7:00:00',
  '6:00:00-13:30:00',
  '6:30:00-14:00:00',
  '7:00:00-14:30:00',
  '8:00:00-15:30:00',
  '8:30:00-16:00:00',
  '9:00:00-16:30:00',
  '9:30:00-17:00:00',
  '10:00:00-17:30:00',
  '10:30:00-18:00:00',
  '11:00:00-18:30:00',
  '11:00:00-19:00:00',
  '12:00:00-19:30:00',
  '12:30:00-20:30:00',
  '13:00:00-20:30:00',
  '14:00:00-21:30:00',
  '14:30:00-22:00:00',
  '15:00:00-22:00:00',
  '15:30:00-23:00:00',
  '16:30:00-0:00:00',
  '16:30:00-1:00:00',
  '17:30:00-1:00:00',
  '19:30:00-1:00:00',
  '23:00:00-7:00:00',
];

const DESCANSOS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const TIPOS_RESTRICCION = ['ESTUDIO', 'EMBARAZO', 'OTROS'];
const PRIORIDADES = ['PRIORIDAD DESCANSO', 'PRIORIDAD TURNO'];

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Calcula la semana ISO actual (YYYY-Www). */
function semanaISOActual(): string {
  const d = new Date();
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth(), tmp.getUTCDate()));
  const yearStart = new Date(Date.UTC(firstThursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((firstThursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${firstThursday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function EstadoSugerenciaBadge({ estado }: { estado: string }) {
  const e = (estado || '').toLowerCase();
  if (e === 'aprobada' || e === 'aprobado' || e === 'asignado' || e === 'asignada') {
    return <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">Aprobada</Badge>;
  }
  if (e === 'rechazada' || e === 'rechazado') {
    return <Badge variant="outline" className="border-red-400/60 text-red-700 dark:text-red-300">Rechazada</Badge>;
  }
  return <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">Pendiente</Badge>;
}

export function WfmSugerenciaView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const docAsesor = perfilAsesor?.documento || perfil?.documento || '';
  const nombreAsesor = perfilAsesor?.nombre ?? perfil?.nombre ?? '';

  const [cedula, setCedula] = useState<string>(docAsesor);
  const [turnoSugerido, setTurnoSugerido] = useState<string>('');
  const [descanso, setDescanso] = useState<string>('');
  const [tipoRestriccion, setTipoRestriccion] = useState<string>('ESTUDIO');
  const [prioridad, setPrioridad] = useState<string>('PRIORIDAD TURNO');
  const [comentario, setComentario] = useState<string>('');
  const [popoverAbierto, setPopoverAbierto] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaTurno[]>([]);
  const [cargandoLista, setCargandoLista] = useState<boolean>(false);

  // Sincronizar cédula por defecto con documento del perfil
  useEffect(() => {
    if (docAsesor && !cedula) setCedula(docAsesor);
  }, [docAsesor, cedula]);

  const semanaActual = useMemo(() => semanaISOActual(), []);

  async function cargarSugerencias() {
    setCargandoLista(true);
    try {
      const res = await leerSugerenciasTurno();
      // Filtrar por cédula del asesor logueado
      const propias = (res || []).filter((s) => s.documento === docAsesor);
      setSugerencias(propias);
    } catch {
      setSugerencias([]);
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    cargarSugerencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docAsesor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula) {
      toast.error('Selecciona tu cédula.');
      return;
    }
    if (!turnoSugerido) {
      toast.error('Selecciona el turno sugerido.');
      return;
    }
    if (!descanso) {
      toast.error('Selecciona el día de descanso.');
      return;
    }
    if (!tipoRestriccion) {
      toast.error('Selecciona el tipo de restricción.');
      return;
    }
    if (!prioridad) {
      toast.error('Selecciona la prioridad.');
      return;
    }

    setEnviando(true);
    try {
      const nueva: SugerenciaTurno = {
        id: crypto.randomUUID(),
        documento: cedula,
        nombre: nombreAsesor,
        turnoSugerido,
        descanso,
        tipoRestriccion,
        prioridad,
        comentario: comentario.trim(),
        semana: semanaActual,
        estado: 'pendiente',
      };
      await guardarSugerenciaTurno(nueva);
      toast.success('Sugerencia enviada correctamente. WFM la revisará.');
      // Reset
      setTurnoSugerido('');
      setDescanso('');
      setTipoRestriccion('ESTUDIO');
      setPrioridad('PRIORIDAD TURNO');
      setComentario('');
      await cargarSugerencias();
    } catch (err) {
      console.error('Error guardando sugerencia:', err);
      toast.error('Error al enviar la sugerencia. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner sticky */}
      <div
        className="sticky top-2 z-20 rounded-xl border border-primary/40 bg-primary/10 text-foreground px-4 py-3 text-sm shadow-sm"
        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
        role="note"
      >
        <CalendarClock className="h-4 w-4 inline mr-2 text-primary" />
        Las sugerencias de turno las toma en cuenta el área de WFM; no está en la obligación de
        asignarlos a menos que tengas restricción de estudios.
      </div>

      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Sugerencia de turno
          </CardTitle>
          <CardDescription>
            Semana actual: <strong>{semanaActual}</strong>. Completa el formulario para enviar
            tu preferencia de turno y descanso a WFM.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Formulario */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Formulario de sugerencia</CardTitle>
          <CardDescription>Los campos marcados con * son obligatorios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Cédula (select con búsqueda) */}
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula *</Label>
                <Popover open={popoverAbierto} onOpenChange={setPopoverAbierto}>
                  <PopoverTrigger asChild>
                    <Button
                      id="cedula"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverAbierto}
                      className="w-full justify-between font-normal"
                    >
                      {cedula || 'Selecciona tu cédula…'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cédula…" />
                      <CommandList>
                        <CommandEmpty>No se encontró la cédula.</CommandEmpty>
                        <CommandGroup>
                          {CEDULAS.map((c) => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={(val) => {
                                setCedula(val);
                                setPopoverAbierto(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  cedula === c ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Si tu cédula no aparece en la lista, contacta a WFM.
                </p>
              </div>

              {/* Turno sugerido */}
              <div className="space-y-2">
                <Label htmlFor="turno">Turno sugerido *</Label>
                <Select value={turnoSugerido} onValueChange={setTurnoSugerido}>
                  <SelectTrigger id="turno" className="w-full">
                    <SelectValue placeholder="Selecciona el turno" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TURNOS_SUGERIDOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descanso */}
              <div className="space-y-2">
                <Label htmlFor="descanso">Descanso *</Label>
                <Select value={descanso} onValueChange={setDescanso}>
                  <SelectTrigger id="descanso" className="w-full">
                    <SelectValue placeholder="Selecciona el día de descanso" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESCANSOS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de restricción */}
              <div className="space-y-2">
                <Label htmlFor="tipo-restriccion">Tipo de restricción *</Label>
                <Select value={tipoRestriccion} onValueChange={setTipoRestriccion}>
                  <SelectTrigger id="tipo-restriccion" className="w-full">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESTRICCION.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prioridad */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prioridad">Prioridad *</Label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger id="prioridad" className="w-full sm:w-72">
                    <SelectValue placeholder="Selecciona la prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define qué es más importante para ti: el turno o el día de descanso.
                </p>
              </div>
            </div>

            {/* Comentario */}
            <div className="space-y-2">
              <Label htmlFor="comentario">Comentario (opcional)</Label>
              <Textarea
                id="comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Explica brevemente tu solicitud, por ejemplo: clase de la universidad los lunes de 7am a 10am."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={enviando} className="gap-2">
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {enviando ? 'Enviando…' : 'Enviar sugerencia'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Mis sugerencias ({sugerencias.length})</CardTitle>
              <CardDescription>Historial de tus sugerencias de turno enviadas.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={cargarSugerencias} disabled={cargandoLista}>
              {cargandoLista ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refrescar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cargandoLista ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando sugerencias…
            </div>
          ) : sugerencias.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No has enviado sugerencias todavía.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-96 overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Semana</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Descanso</TableHead>
                      <TableHead>Restricción</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Comentario</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugerencias.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs whitespace-nowrap">{s.semana}</TableCell>
                        <TableCell className="text-xs font-mono">{s.turnoSugerido}</TableCell>
                        <TableCell className="text-xs">{s.descanso}</TableCell>
                        <TableCell className="text-xs">{s.tipoRestriccion}</TableCell>
                        <TableCell className="text-xs">{s.prioridad}</TableCell>
                        <TableCell className="text-xs max-w-48 truncate" title={s.comentario}>
                          {s.comentario || '—'}
                        </TableCell>
                        <TableCell>
                          <EstadoSugerenciaBadge estado={s.estado} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
