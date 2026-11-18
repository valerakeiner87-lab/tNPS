'use client';

/**
 * v3.3.0 Fase 2 — AdminWfmView
 * -----------------------------
 * Panel de gestión WFM para supervisores/admins.
 *
 * Muestra todas las sugerencias de turno enviadas por asesores.
 *  - Filtros: semana, prioridad, tipo de restricción
 *  - Tabla con: Documento, Nombre, Turno Sugerido, Descanso, Restricción,
 *    Prioridad, Comentario, Estado
 *  - Acciones: aprobar / rechazar sugerencias
 *  - Exportar a Excel
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Inbox,
  Loader2,
  Search,
  XCircle,
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
import {
  actualizarSugerenciaTurno,
  leerSugerenciasTurno,
} from '@/lib/firestore-data';
import type { SugerenciaTurno } from '@/lib/neon-data';
import { exportarTablaAExcel } from '@/lib/excel-export';

function EstadoSugerenciaBadge({ estado }: { estado: string }) {
  const e = (estado || '').toLowerCase();
  if (e === 'aprobada' || e === 'aprobado' || e === 'asignado' || e === 'asignada') {
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
  return (
    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
      Pendiente
    </Badge>
  );
}

export function AdminWfmView() {
  const perfil = useStore((s) => s.perfil);

  const [sugerencias, setSugerencias] = useState<SugerenciaTurno[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todas');
  const [filtroRestriccion, setFiltroRestriccion] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');

  async function cargar() {
    setCargando(true);
    try {
      const res = await leerSugerenciasTurno();
      setSugerencias(res || []);
    } catch {
      setSugerencias([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const semanasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const s of sugerencias) if (s.semana) set.add(s.semana);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [sugerencias]);

  const prioridadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const s of sugerencias) if (s.prioridad) set.add(s.prioridad);
    return Array.from(set).sort();
  }, [sugerencias]);

  const restriccionesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const s of sugerencias) if (s.tipoRestriccion) set.add(s.tipoRestriccion);
    return Array.from(set).sort();
  }, [sugerencias]);

  const filtradas = useMemo(() => {
    return sugerencias
      .filter((s) => filtroSemana === 'todas' || s.semana === filtroSemana)
      .filter((s) => filtroPrioridad === 'todas' || s.prioridad === filtroPrioridad)
      .filter((s) => filtroRestriccion === 'todas' || s.tipoRestriccion === filtroRestriccion)
      .filter((s) => {
        if (!busqueda) return true;
        const q = busqueda.toLowerCase();
        return (
          s.documento.toLowerCase().includes(q) ||
          s.nombre.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.semana !== b.semana) return a.semana < b.semana ? 1 : -1;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [sugerencias, filtroSemana, filtroPrioridad, filtroRestriccion, busqueda]);

  async function aprobar(id: string) {
    setProcesandoId(id);
    try {
      await actualizarSugerenciaTurno(id, 'aprobada');
      toast.success('Sugerencia aprobada.');
      await cargar();
    } catch (err) {
      console.error('Error aprobando sugerencia:', err);
      toast.error('Error al aprobar la sugerencia.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazar(id: string) {
    setProcesandoId(id);
    try {
      await actualizarSugerenciaTurno(id, 'rechazada');
      toast.success('Sugerencia rechazada.');
      await cargar();
    } catch (err) {
      console.error('Error rechazando sugerencia:', err);
      toast.error('Error al rechazar la sugerencia.');
    } finally {
      setProcesandoId(null);
    }
  }

  function exportar() {
    if (filtradas.length === 0) {
      toast.info('No hay filas para exportar.');
      return;
    }
    const filasExcel = filtradas.map((s, idx) => ({
      '#': idx + 1,
      'Documento': s.documento,
      'Nombre': s.nombre,
      'Semana': s.semana,
      'Turno Sugerido': s.turnoSugerido,
      'Descanso': s.descanso,
      'Tipo Restricción': s.tipoRestriccion,
      'Prioridad': s.prioridad,
      'Comentario': s.comentario,
      'Estado': s.estado,
    }));
    const nombre = `gestion-wfm-${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportarTablaAExcel(filasExcel as unknown as Record<string, unknown>[], 'WFM', nombre);
    toast.success(`Se exportaron ${filtradas.length} sugerencias a ${nombre}.`);
  }

  if (perfil?.rol === 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para supervisores y administradores</p>
        </CardContent>
      </Card>
    );
  }

  // KPIs
  const total = sugerencias.length;
  const pendientes = sugerencias.filter((s) => (s.estado || '').toLowerCase() === 'pendiente').length;
  const aprobadas = sugerencias.filter(
    (s) => ['aprobada', 'aprobado', 'asignado', 'asignada'].includes((s.estado || '').toLowerCase())
  ).length;
  const rechazadas = sugerencias.filter(
    (s) => ['rechazada', 'rechazado'].includes((s.estado || '').toLowerCase())
  ).length;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Gestión WFM
          </CardTitle>
          <CardDescription>
            Todas las sugerencias de turno enviadas por asesores. Filtra por semana, prioridad o
            tipo de restricción, y aprueba o rechaza cada solicitud.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total sugerencias</p>
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
            <p className="text-xs text-muted-foreground">Aprobadas</p>
            <p className="text-2xl font-bold tabular-nums text-promotor">{aprobadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rechazadas</p>
            <p className="text-2xl font-bold tabular-nums text-detractor">{rechazadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por documento o nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="min-w-[150px]">
              <Select value={filtroSemana} onValueChange={setFiltroSemana}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las semanas</SelectItem>
                  {semanasDisponibles.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las prioridades</SelectItem>
                  {prioridadesDisponibles.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Select value={filtroRestriccion} onValueChange={setFiltroRestriccion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Restricción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las restricciones</SelectItem>
                  {restriccionesDisponibles.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportar} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button variant="ghost" onClick={cargar} disabled={cargando}>
              {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refrescar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sugerencias ({filtradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando sugerencias…
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-hidden>
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No hay sugerencias con estos filtros.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[65vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Semana</TableHead>
                      <TableHead>Turno Sugerido</TableHead>
                      <TableHead>Descanso</TableHead>
                      <TableHead>Restricción</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Comentario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((s) => {
                      const esPendiente = (s.estado || '').toLowerCase() === 'pendiente';
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs font-mono">{s.documento}</TableCell>
                          <TableCell className="text-xs">{s.nombre || '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{s.semana}</TableCell>
                          <TableCell className="text-xs font-mono">{s.turnoSugerido}</TableCell>
                          <TableCell className="text-xs">{s.descanso}</TableCell>
                          <TableCell className="text-xs">{s.tipoRestriccion}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline">
                              {s.prioridad}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-48">
                            <p className="truncate" title={s.comentario}>{s.comentario || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <EstadoSugerenciaBadge estado={s.estado} />
                          </TableCell>
                          <TableCell className="text-right">
                            {esPendiente ? (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={procesandoId === s.id}
                                  onClick={() => aprobar(s.id)}
                                  className="gap-1 border-emerald-400/60 text-emerald-700 dark:text-emerald-300"
                                >
                                  {procesandoId === s.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={procesandoId === s.id}
                                  onClick={() => rechazar(s.id)}
                                  className="gap-1 border-red-400/60 text-red-700 dark:text-red-300"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Rechazar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Procesada</span>
                            )}
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
