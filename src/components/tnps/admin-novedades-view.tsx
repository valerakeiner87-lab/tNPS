'use client';

/**
 * v3.4.0 — AdminNovedadesView
 * ------------------------------
 * Panel para que el supervisor/admin vea TODAS las novedades
 * ingresadas por los asesores.
 *
 * Funcionalidades:
 *  - Listado completo de novedades (fecha, documento, nombre, tipo, ticket, estado)
 *  - Filtros: fecha, estado, tipo, búsqueda por documento/ticket/nombre
 *  - Acción por fila: aprobar / rechazar / marcar tiempo ajustado
 *  - Exportar a Excel
 *  - KPIs: total, pendientes, aprobadas, rechazadas, ajustadas
 *
 * Las novedades llegan del store (vía leerNovedades()).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Inbox,
  Loader2,
  Search,
  Ticket as TicketIcon,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { actualizarNovedad, leerNovedades } from '@/lib/firestore-data';
import type { Novedad } from '@/lib/neon-data';
import { exportarTablaAExcel } from '@/lib/excel-export';

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

function EstadoBadge({ estado }: { estado: string }) {
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

export function AdminNovedadesView() {
  const perfil = useStore((s) => s.perfil);

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroFecha, setFiltroFecha] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');

  async function cargar() {
    setCargando(true);
    try {
      const res = await leerNovedades();
      setNovedades(res || []);
    } catch {
      setNovedades([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const fechasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const n of novedades) {
      if (n.fecha) set.add(n.fecha);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [novedades]);

  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const n of novedades) {
      if (n.tipo) set.add(n.tipo);
    }
    return Array.from(set).sort();
  }, [novedades]);

  const novedadesFiltradas = useMemo(() => {
    return novedades
      .filter((n) => {
        if (filtroFecha !== 'todas' && n.fecha !== filtroFecha) return false;
        if (filtroEstado !== 'todas') {
          const e = (n.estado || '').toLowerCase();
          if (filtroEstado === 'pendiente' && e !== 'pendiente' && e !== '') return false;
          if (filtroEstado === 'aprobada' && !(e === 'aprobada' || e === 'aprobado' || e === 'ajustado')) return false;
          if (filtroEstado === 'rechazada' && !(e === 'rechazada' || e === 'rechazado')) return false;
        }
        if (filtroTipo !== 'todas' && n.tipo !== filtroTipo) return false;
        if (busqueda) {
          const q = busqueda.toLowerCase();
          const haystack = `${n.documento} ${n.nombre} ${n.tipo} ${n.ticket ?? ''}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return (a.nombre || '').localeCompare(b.nombre || '');
      });
  }, [novedades, filtroFecha, filtroEstado, filtroTipo, busqueda]);

  // KPIs
  const total = novedades.length;
  const pendientes = novedades.filter((n) => {
    const e = (n.estado || '').toLowerCase();
    return e === 'pendiente' || e === '';
  }).length;
  const aprobadas = novedades.filter((n) => {
    const e = (n.estado || '').toLowerCase();
    return e === 'aprobada' || e === 'aprobado' || e === 'ajustado';
  }).length;
  const rechazadas = novedades.filter((n) => {
    const e = (n.estado || '').toLowerCase();
    return e === 'rechazada' || e === 'rechazado';
  }).length;

  async function aprobar(n: Novedad) {
    setProcesandoId(n.id);
    try {
      await actualizarNovedad(n.id, 'aprobada', 'Novedad aprobada por el supervisor.');
      toast.success(`Novedad de ${n.nombre} aprobada.`);
      await cargar();
    } catch (err) {
      console.error(err);
      toast.error('Error al aprobar la novedad.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazar(n: Novedad) {
    setProcesandoId(n.id);
    try {
      await actualizarNovedad(n.id, 'rechazada', 'Novedad rechazada por el supervisor.');
      toast.info(`Novedad de ${n.nombre} rechazada.`);
      await cargar();
    } catch (err) {
      console.error(err);
      toast.error('Error al rechazar la novedad.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function ajustar(n: Novedad) {
    setProcesandoId(n.id);
    try {
      // Marca la novedad como "ajustado" — el cálculo de tiempo se hace en
      // AdminValidacionView usando el cruce con Horas Robot.
      await actualizarNovedad(n.id, 'ajustado', 'Tiempo ajustado según cruce con Horas Robot.');
      toast.success(`Tiempo ajustado para ${n.nombre}.`);
      await cargar();
    } catch (err) {
      console.error(err);
      toast.error('Error al ajustar el tiempo.');
    } finally {
      setProcesandoId(null);
    }
  }

  function exportar() {
    if (novedadesFiltradas.length === 0) {
      toast.info('No hay novedades para exportar.');
      return;
    }
    const filas = novedadesFiltradas.map((n, idx) => ({
      '#': idx + 1,
      'Fecha': n.fecha,
      'Documento': n.documento,
      'Nombre': n.nombre,
      'Tipo': n.tipo,
      'Ticket': n.ticket ?? '',
      'Descripción': n.descripcion,
      'Estado': n.estado,
      'Procesado por': n.procesadoPor ?? '',
      'Respuesta': n.respuesta ?? '',
    }));
    const nombre = `novedades-${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportarTablaAExcel(filas as unknown as Record<string, unknown>[], 'Novedades', nombre);
    toast.success(`Se exportaron ${filas.length} novedades a ${nombre}.`);
  }

  if (perfil?.rol === 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para supervisores y administradores</p>
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
            <ClipboardList className="h-5 w-5 text-primary" /> Novedades ingresadas por asesores
          </CardTitle>
          <CardDescription>
            Listado completo de las novedades que los asesores reportan desde el formulario
            simplificado (Fecha, Documento, Tipo, Ticket). Aprueba, rechaza o marca el tiempo
            como ajustado según el cruce con Horas Robot.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">{pendientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aprobadas / Ajustadas</p>
            <p className="text-2xl font-bold tabular-nums text-promotor">{aprobadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rechazadas</p>
            <p className="text-2xl font-bold tabular-nums text-pasivo">{rechazadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + acciones */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Filtra por fecha, estado, tipo o búsqueda libre.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="gap-1">
                {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refrescar'}
              </Button>
              <Button variant="outline" size="sm" onClick={exportar} className="gap-1">
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por documento, nombre, ticket o tipo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="min-w-[180px]">
              <Select value={filtroFecha} onValueChange={setFiltroFecha}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las fechas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las fechas</SelectItem>
                  {fechasDisponibles.map((f) => (
                    <SelectItem key={f} value={f}>
                      {fmtFecha(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="aprobada">Aprobadas / Ajustadas</SelectItem>
                  <SelectItem value="rechazada">Rechazadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los tipos</SelectItem>
                  {tiposDisponibles.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Novedades ({novedadesFiltradas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando novedades…
            </div>
          ) : novedadesFiltradas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {total === 0
                  ? 'Aún no se han reportado novedades. Cuando un asesor complete el formulario, aparecerán aquí.'
                  : 'No hay novedades que coincidan con los filtros seleccionados.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[65vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novedadesFiltradas.map((n) => {
                      const e = (n.estado || '').toLowerCase();
                      const esAprobada = e === 'aprobada' || e === 'aprobado' || e === 'ajustado';
                      const esRechazada = e === 'rechazada' || e === 'rechazado';
                      return (
                        <TableRow key={n.id}>
                          <TableCell className="text-xs whitespace-nowrap">{fmtFecha(n.fecha)}</TableCell>
                          <TableCell className="text-xs font-mono">{n.documento}</TableCell>
                          <TableCell className="text-xs">{n.nombre || '—'}</TableCell>
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
                            <EstadoBadge estado={n.estado} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              {esAprobada ? (
                                <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Procesada
                                </span>
                              ) : esRechazada ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={procesandoId === n.id}
                                    onClick={() => aprobar(n)}
                                    className="gap-1 h-7 text-xs border-emerald-400/60 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                                  >
                                    {procesandoId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    Aprobar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={procesandoId === n.id}
                                    onClick={() => ajustar(n)}
                                    className="gap-1 h-7 text-xs border-blue-400/60 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
                                  >
                                    <Clock className="h-3 w-3" />
                                    Ajustar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={procesandoId === n.id}
                                    onClick={() => rechazar(n)}
                                    className="gap-1 h-7 text-xs border-red-400/60 text-red-700 hover:bg-red-50 dark:text-red-300"
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
