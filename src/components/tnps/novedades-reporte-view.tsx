'use client';

/**
 * v3.4.0 — NovedadesReporteView
 * ---------------------------------
 * Formulario SIMPLIFICADO de novedades para el asesor.
 *
 * Sólo 4 campos:
 *  - Fecha de la novedad (date)
 *  - Documento (auto-rellenado con la cédula del asesor, read-only)
 *  - Tipo de novedad (select)
 *  - Número de Ticket / Caso (text)
 *
 * Las novedades se guardan vía `guardarNovedad` y se exponen al admin
 * en AdminNovedadesView y AdminValidacionView (cruce con Horas Robot).
 */
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Send,
  Ticket as TicketIcon,
  XCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { guardarNovedad, leerNovedades } from '@/lib/firestore-data';
import type { Novedad } from '@/lib/neon-data';

/**
 * Tipos de novedad disponibles.
 * Mantenemos el catálogo amplio para cubrir fallas técnicas, ausencias,
 * novedades operativas y de gestión. El admin puede filtrar por tipo.
 */
const TIPOS_NOVEDAD = [
  'Falla de herramienta/sistema',
  'Caída de red',
  'Ticket de soporte TI',
  'Capacitación no programada',
  'Extensión de chat/caso complejo',
  'Deslogueo autorizado',
  'Pausa autorizada',
  'Reunión no programada',
  'Salida anticipada justificada',
  'Llegada tarde justificada',
  'Otro',
];

function fmtFecha(fecha: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return fecha;
  }
}

function EstadoNovedadBadge({ estado }: { estado: string }) {
  const e = (estado || '').toLowerCase();
  if (e === 'aprobada' || e === 'aprobado') {
    return (
      <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Aprobada
      </Badge>
    );
  }
  if (e === 'rechazada' || e === 'rechazado') {
    return (
      <Badge variant="outline" className="border-red-400/60 text-red-700 dark:text-red-300">
        <XCircle className="h-3 w-3 mr-1" /> Rechazada
      </Badge>
    );
  }
  if (e === 'ajustado') {
    return (
      <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Tiempo ajustado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3 mr-1" /> Pendiente
    </Badge>
  );
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NovedadesReporteView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const docAsesor = perfilAsesor?.documento || perfil?.documento || '';
  const nombreAsesor = perfilAsesor?.nombre ?? perfil?.nombre ?? '';

  // 4 campos del formulario
  const [fecha, setFecha] = useState<string>(hoyISO());
  const [tipo, setTipo] = useState<string>(TIPOS_NOVEDAD[0]);
  const [ticket, setTicket] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);

  // Listado de novedades previas del asesor
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargandoLista, setCargandoLista] = useState<boolean>(false);

  async function cargarNovedades() {
    if (!docAsesor) return;
    setCargandoLista(true);
    try {
      const res = await leerNovedades(docAsesor);
      setNovedades(res || []);
    } catch {
      setNovedades([]);
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    cargarNovedades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docAsesor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docAsesor) {
      toast.error('No se pudo determinar tu cédula. Cierra sesión y vuelve a ingresar.');
      return;
    }
    if (!fecha) {
      toast.error('Selecciona la fecha de la novedad.');
      return;
    }
    if (!tipo) {
      toast.error('Selecciona el tipo de novedad.');
      return;
    }
    if (!ticket.trim()) {
      toast.error('Ingresa el número de ticket o caso asociado.');
      return;
    }

    setEnviando(true);
    try {
      const nueva: Novedad = {
        id: crypto.randomUUID(),
        documento: docAsesor,
        nombre: nombreAsesor,
        fecha,
        // El formulario simplificado no captura horaInicio/horaFin;
        // se dejan vacíos. El tiempo a justificar se calcula en el cruce
        // con Horas Robot (Program_Time − Horas a pagar).
        horaInicio: '',
        horaFin: '',
        duracion: 0,
        tipo,
        ticket: ticket.trim(),
        // El campo descripción queda opcional: usamos el tipo como descripción
        // automática para mantener compatibilidad con el modelo Novedad.
        descripcion: `${tipo} — Ticket ${ticket.trim()}`,
        evidenciaUrl: null,
        estado: 'pendiente',
      };
      await guardarNovedad(nueva);
      toast.success('Novedad reportada. El supervisor la verá en el panel de validación.');
      // Reset
      setFecha(hoyISO());
      setTipo(TIPOS_NOVEDAD[0]);
      setTicket('');
      // Recargar lista
      await cargarNovedades();
    } catch (err) {
      console.error('Error guardando novedad:', err);
      toast.error('Error al guardar la novedad. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (perfil?.rol !== 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" /> Reportar novedad
          </CardTitle>
          <CardDescription>
            Reporta un incidente que afectó tu tiempo facturado: fallas de herramienta,
            caídas de red, tickets de soporte TI, capacitaciones no programadas o deslogueos
            autorizados. Tu supervisor verá la novedad en el panel de validación y la cruzará
            con las Horas Robot para justificar el tiempo faltante.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Formulario simplificado (4 campos) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Formulario de novedad</CardTitle>
          <CardDescription>
            Completa los 4 campos. El documento se toma automáticamente de tu sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {/* 1. Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha">1. Fecha de la novedad *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>

              {/* 2. Documento (auto, read-only) */}
              <div className="space-y-2">
                <Label htmlFor="documento">2. Documento (cédula)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="documento"
                    type="text"
                    value={docAsesor}
                    readOnly
                    className="bg-muted/40 font-mono"
                    aria-readonly
                  />
                  <Badge variant="outline" className="border-promotor/40 text-promotor whitespace-nowrap">
                    Auto
                  </Badge>
                </div>
                {nombreAsesor && (
                  <p className="text-xs text-muted-foreground">{nombreAsesor}</p>
                )}
              </div>

              {/* 3. Tipo de novedad */}
              <div className="space-y-2">
                <Label htmlFor="tipo">3. Tipo de novedad *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_NOVEDAD.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Ticket */}
              <div className="space-y-2">
                <Label htmlFor="ticket">4. Número de ticket / caso *</Label>
                <div className="relative">
                  <TicketIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ticket"
                    type="text"
                    value={ticket}
                    onChange={(e) => setTicket(e.target.value)}
                    placeholder="Ej. INC-12345 o 70630"
                    required
                    className="pl-8 font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ticket o caso asociado al incidente.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={enviando} className="gap-2">
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {enviando ? 'Enviando…' : 'Enviar novedad'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Listado de novedades previas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Mis novedades ({novedades.length})</CardTitle>
              <CardDescription>Historial de tus novedades reportadas.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={cargarNovedades} disabled={cargandoLista}>
              {cargandoLista ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refrescar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {cargandoLista ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando novedades…
            </div>
          ) : novedades.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No has reportado novedades todavía. Usa el formulario de arriba para reportar
                tu primer incidente.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-96 overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                      {novedades.some((n) => n.respuesta) && <TableHead>Respuesta</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novedades.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs whitespace-nowrap">{fmtFecha(n.fecha)}</TableCell>
                        <TableCell className="text-xs">{n.tipo}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {n.ticket ? (
                            <span className="inline-flex items-center gap-1">
                              <TicketIcon className="h-3 w-3 text-violet-600" />
                              {n.ticket}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EstadoNovedadBadge estado={n.estado} />
                        </TableCell>
                        {novedades.some((x) => x.respuesta) && (
                          <TableCell className="text-xs max-w-64">
                            {n.respuesta ? (
                              <p className="truncate" title={n.respuesta}>{n.respuesta}</p>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
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
