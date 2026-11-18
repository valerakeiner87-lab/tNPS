'use client';

/**
 * v3.4.5 — AdminValidacionView
 * --------------------------------
 * Panel para supervisores/admins de validación de tiempos diarios.
 *
 * Replica la lógica del HTML de referencia "Validador de Horas Robot":
 *  1. Carga Horas Robot (Program_Time, Horas a pagar, Start/End Date, Entrada/Salida real) por asesor/día.
 *  2. Carga Bitácora de Deslogueos Autorizados (tiempo no pago).
 *  3. Carga Novedades ingresadas por los asesores (formulario).
 *  4. Por cada combinación [documento + fecha] muestra:
 *      - Horas Programadas (Program_Time)
 *      - Horas Robot (Horas a pagar)
 *      - Faltante (Program_Time − Horas a pagar)
 *      - Deslogueo autorizado (si existe en la bitácora)
 *      - Novedades presentadas (todas las del asesor para esa fecha)
 *      - Tiempo a justificar (faltante, hasta cubrirse)
 *      - Acción: "Tiempo Ajustado"
 *
 * v3.4.5: Cada fila es clickeable y abre un Dialog con el detalle completo:
 *  - Turno programado (Start_Date → End_Date) vs. turno real (Entrada/Salida real)
 *  - Hora de conexión y de deslogueo
 *  - Justificación de salida anticipada (cruce con bitácora)
 *  - Justificación de tardanza (cruce con bitácora de disponibilidad)
 *  - Ecuación del tiempo + acción ajustar con nota del supervisor
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Inbox,
  Loader2,
  Search,
  Ticket as TicketIcon,
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
import type { RegistroHorasRobot, DeslogueoAutorizado } from '@/lib/types';
import {
  actualizarNominaDiaria,
  leerNovedades,
} from '@/lib/firestore-data';
import type { Novedad } from '@/lib/neon-data';
import { exportarTablaAExcel } from '@/lib/excel-export';
import { ValidacionDetalleDialog } from './validacion-detalle-dialog';

const TARIFA_POR_HORA_COP = 8338; // COP/hora (SMMLV 2026, 210h/mes)
const MONEDA = 'COP';

function fmtCOP(valor: number): string {
  const v = Math.round(valor || 0);
  return `$ ${v.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${MONEDA}`;
}

function fmtHoras(segundos: number): string {
  if (!segundos || segundos <= 0) return '0h';
  const h = segundos / 3600;
  const hInt = Math.floor(h);
  const m = Math.round((h - hInt) * 60);
  if (m === 0) return `${hInt}h`;
  return `${hInt}h ${String(m).padStart(2, '0')}m`;
}

function fmtTiempo(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

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

/** Convierte "HH:MM" o "HH:MM:SS" a segundos */
function hhmmASegundos(s: string): number {
  if (!s) return 0;
  const partes = s.split(':');
  if (partes.length === 3) {
    return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
  }
  if (partes.length === 2) {
    return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60;
  }
  return 0;
}

interface FilaValidacion {
  documento: string;
  nombre: string;
  fecha: string;
  lob: string;
  supervisor: string;
  horasProgramadas: number; // segundos
  horasRobot: number; // segundos (Horas a pagar)
  tiempoFaltante: number; // segundos (Program_Time − Horas a pagar)
  deslogueoSeg: number; // segundos de deslogueo autorizado (AHORRO)
  deslogueo: DeslogueoAutorizado | null;
  novedades: Novedad[];
  estadoAjuste: string;
  valorDia: number;
  // Tiempo a ingresar como novedad:
  // = min(faltante, deslogueo + novedades_aprobadas_o_ajustadas)
  tiempoAIngresar: number;
}

export function AdminValidacionView() {
  const datosHorasRobot = useStore((s) => s.datosHorasRobot);
  const datosBitacora = useStore((s) => s.datosBitacora);
  const perfil = useStore((s) => s.perfil);

  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroFecha, setFiltroFecha] = useState<string>('todas');
  const [soloFaltantes, setSoloFaltantes] = useState<boolean>(false);
  const [soloConNovedades, setSoloConNovedades] = useState<boolean>(false);
  const [cargandoNovedades, setCargandoNovedades] = useState<boolean>(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  // v3.4.5: estado para el dialog de detalle
  const [filaSeleccionada, setFilaSeleccionada] = useState<FilaValidacion | null>(null);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroHorasRobot | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState<boolean>(false);

  useEffect(() => {
    setCargandoNovedades(true);
    leerNovedades()
      .then((res) => setNovedades(res || []))
      .catch(() => setNovedades([]))
      .finally(() => setCargandoNovedades(false));
  }, []);

  const fechasDisponibles = useMemo(() => {
    if (!datosHorasRobot?.registros?.length) return [] as string[];
    return Array.from(new Set(datosHorasRobot.registros.map((r) => r.fecha).filter(Boolean))).sort((a, b) =>
      a < b ? 1 : a > b ? -1 : 0
    );
  }, [datosHorasRobot]);

  // Mapa de deslogueos por documento+fecha
  const deslogueoPorDocFecha = useMemo(() => {
    const mapa = new Map<string, DeslogueoAutorizado>();
    if (!datosBitacora?.deslogueos) return mapa;
    for (const d of datosBitacora.deslogueos) {
      const key = `${d.documento}|${d.fecha}`;
      // Si hay varios deslogueos para el mismo doc+fecha, sumamos los ahorros
      const prev = mapa.get(key);
      if (prev) {
        // Combinar: acumular el ahorro en el registro existente
        const prevSeg = hhmmASegundos(prev.ahorro);
        const newSeg = hhmmASegundos(d.ahorro);
        const total = prevSeg + newSeg;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        mapa.set(key, {
          ...prev,
          ahorro: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        });
      } else {
        mapa.set(key, d);
      }
    }
    return mapa;
  }, [datosBitacora]);

  // Mapa de novedades por documento+fecha → lista
  const novedadesPorDocFecha = useMemo(() => {
    const mapa = new Map<string, Novedad[]>();
    for (const n of novedades) {
      const key = `${n.documento}|${n.fecha}`;
      const arr = mapa.get(key) ?? [];
      arr.push(n);
      mapa.set(key, arr);
    }
    return mapa;
  }, [novedades]);

  const filas: FilaValidacion[] = useMemo(() => {
    if (!datosHorasRobot?.registros?.length) return [];
    return datosHorasRobot.registros
      .map((r: RegistroHorasRobot) => {
        const key = `${r.documento}|${r.fecha}`;
        const deslogueo = deslogueoPorDocFecha.get(key) ?? null;
        const deslogueoSeg = deslogueo ? hhmmASegundos(deslogueo.ahorro) : 0;
        const novsDelDoc = novedadesPorDocFecha.get(key) ?? [];
        // Tiempo a ingresar: solo se consideran novedades aprobadas/ajustadas
        const novsValidas = novsDelDoc.filter((n) => {
          const e = (n.estado || '').toLowerCase();
          return e === 'aprobada' || e === 'aprobado' || e === 'ajustado';
        });
        // El tiempo justificado es el mínimo entre el faltante y
        // (deslogueo + novedades). El HTML de referencia acumula:
        // tiempoNovedad = faltante + deslogueos (cuando se aprueba).
        // Aquí respetamos: lo justificado no puede exceder el faltante.
        const justificado = Math.min(r.faltante, deslogueoSeg);
        const tiempoAIngresar = Math.max(0, justificado);
        const estadoAjuste = novsDelDoc.length > 0
          ? (novsValidas.length > 0 ? 'ajustado' : 'pendiente')
          : (deslogueo ? 'con-deslogueo' : 'sin-novedad');
        const valorDia = (r.horasAPagar + tiempoAIngresar) / 3600 * TARIFA_POR_HORA_COP;
        return {
          documento: r.documento,
          nombre: r.nombre,
          fecha: r.fecha,
          lob: r.lob,
          supervisor: r.supervisor,
          horasProgramadas: r.programTime,
          horasRobot: r.horasAPagar,
          tiempoFaltante: r.faltante,
          deslogueoSeg,
          deslogueo,
          novedades: novsDelDoc,
          estadoAjuste,
          valorDia,
          tiempoAIngresar,
        };
      })
      .filter((f) => {
        if (filtroFecha !== 'todas' && f.fecha !== filtroFecha) return false;
        if (soloFaltantes && f.tiempoFaltante <= 0) return false;
        if (soloConNovedades && f.novedades.length === 0) return false;
        if (busqueda) {
          const q = busqueda.toLowerCase();
          if (
            !f.documento.toLowerCase().includes(q) &&
            !f.nombre.toLowerCase().includes(q) &&
            !(f.lob || '').toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [datosHorasRobot, deslogueoPorDocFecha, novedadesPorDocFecha, filtroFecha, soloFaltantes, soloConNovedades, busqueda]);

  async function ajustarTiempo(fila: FilaValidacion) {
    if (fila.tiempoFaltante <= 0 && fila.deslogueoSeg <= 0) {
      toast.info('No hay tiempo faltante ni deslogueo para ajustar.');
      return;
    }
    setProcesandoId(`${fila.documento}|${fila.fecha}`);
    try {
      const tiempoAjustadoSeg = fila.tiempoAIngresar;
      const valorMonetario = (fila.horasRobot + tiempoAjustadoSeg) / 3600 * TARIFA_POR_HORA_COP;
      await actualizarNominaDiaria(
        fila.documento,
        fila.fecha,
        tiempoAjustadoSeg,
        valorMonetario,
        'ajustado'
      );
      toast.success(
        `Tiempo ajustado para ${fila.nombre} el ${fmtFecha(fila.fecha)}: +${fmtHoras(tiempoAjustadoSeg)}. Valor: ${fmtCOP(valorMonetario)}.`
      );
      // Recargar novedades
      const res = await leerNovedades();
      setNovedades(res || []);
    } catch (err) {
      console.error('Error ajustando tiempo:', err);
      toast.error('Error al ajustar el tiempo. Intenta de nuevo.');
    } finally {
      setProcesandoId(null);
    }
  }

  function exportar() {
    if (filas.length === 0) {
      toast.info('No hay filas para exportar.');
      return;
    }
    const filasExcel = filas.map((f, idx) => ({
      '#': idx + 1,
      'Documento': f.documento,
      'Nombre': f.nombre,
      'Fecha': f.fecha,
      'LOB': f.lob,
      'Supervisor': f.supervisor,
      'Horas Programadas (h)': (f.horasProgramadas / 3600).toFixed(2),
      'Horas Robot (h)': (f.horasRobot / 3600).toFixed(2),
      'Faltante (h)': (f.tiempoFaltante / 3600).toFixed(2),
      'Deslogueo Autorizado (h)': (f.deslogueoSeg / 3600).toFixed(2),
      'Novedades': f.novedades.length,
      'Tiempo a Ingresar (h)': (f.tiempoAIngresar / 3600).toFixed(2),
      'Estado': f.estadoAjuste,
      'Valor Día (COP)': Math.round(f.valorDia),
    }));
    const nombre = `validacion-tiempos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportarTablaAExcel(filasExcel as unknown as Record<string, unknown>[], 'Validación', nombre);
    toast.success(`Se exportaron ${filas.length} filas a ${nombre}.`);
  }

  if (perfil?.rol === 'asesor') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para supervisores y administradores</p>
        </CardContent>
      </Card>
    );
  }

  if (!datosHorasRobot || datosHorasRobot.totalRegistros === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">No hay datos de Horas Robot</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Carga el archivo <strong>Horas robot.xlsx</strong> desde la pestaña "Carga" para
              habilitar la validación de tiempos. El cruce con novedades y bitácora requiere
              este archivo.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // KPIs
  const totalFilas = filas.length;
  const filasConFaltante = filas.filter((f) => f.tiempoFaltante > 0).length;
  const filasConDeslogueo = filas.filter((f) => f.deslogueoSeg > 0).length;
  const filasConNovedades = filas.filter((f) => f.novedades.length > 0).length;
  const filasAjustadas = filas.filter((f) => f.estadoAjuste === 'ajustado').length;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Validación de tiempos
          </CardTitle>
          <CardDescription>
            Cruce de <strong>Horas Robot</strong> (Program_Time vs. Horas a pagar) con
            <strong> Novedades</strong> ingresadas por asesor y <strong>Bitácora de Deslogueos</strong>.
            Ajusta el tiempo faltante cuando haya una novedad o deslogueo justificado.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total registros</p>
            <p className="text-2xl font-bold tabular-nums">{totalFilas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Con faltante</p>
            <p className="text-2xl font-bold tabular-nums text-pasivo">{filasConFaltante}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Con novedades</p>
            <p className="text-2xl font-bold tabular-nums text-violet-600">{filasConNovedades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Con deslogueo</p>
            <p className="text-2xl font-bold tabular-nums text-orange-600">{filasConDeslogueo}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de archivos cargados */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="rounded-md bg-emerald-100/60 dark:bg-emerald-950/30 px-2 py-1 border border-emerald-200 dark:border-emerald-900">
          Horas Robot: <strong className="text-emerald-700 dark:text-emerald-300">{datosHorasRobot.totalRegistros}</strong> registros
        </span>
        {datosBitacora && (
          <span className="rounded-md bg-orange-100/60 dark:bg-orange-950/30 px-2 py-1 border border-orange-200 dark:border-orange-900">
            Bitácora: <strong className="text-orange-700 dark:text-orange-300">{datosBitacora.totalRegistros}</strong> deslogueos
          </span>
        )}
        {!datosBitacora && (
          <span className="rounded-md bg-muted px-2 py-1 border">
            Bitácora: <strong>no cargada</strong> (cárgala en la pestaña Carga para activar el cruce con deslogueos)
          </span>
        )}
        <span className="rounded-md bg-violet-100/60 dark:bg-violet-950/30 px-2 py-1 border border-violet-200 dark:border-violet-900">
          Novedades: <strong className="text-violet-700 dark:text-violet-300">{novedades.length}</strong> ingresadas
        </span>
      </div>

      {/* Filtros + exportar */}
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
                placeholder="Buscar por documento, nombre o LOB…"
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
            <Button
              variant={soloFaltantes ? 'default' : 'outline'}
              onClick={() => setSoloFaltantes((v) => !v)}
            >
              {soloFaltantes ? 'Solo con faltante' : 'Todos'}
            </Button>
            <Button
              variant={soloConNovedades ? 'default' : 'outline'}
              onClick={() => setSoloConNovedades((v) => !v)}
            >
              {soloConNovedades ? 'Solo con novedades' : 'Sin filtro novedades'}
            </Button>
            <Button variant="outline" onClick={exportar} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Validación por asesor ({filas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoNovedades ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando novedades…
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[65vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Prog.</TableHead>
                      <TableHead className="text-right">Robot</TableHead>
                      <TableHead className="text-right">Faltante</TableHead>
                      <TableHead className="text-right">Deslogueo</TableHead>
                      <TableHead>Novedades</TableHead>
                      <TableHead className="text-right">A Ingresar</TableHead>
                      <TableHead className="text-right">Valor día</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map((f) => {
                      const key = `${f.documento}|${f.fecha}`;
                      const esAjustado = f.estadoAjuste === 'ajustado';
                      // v3.4.5: handler para abrir el dialog de detalle
                      const abrirDetalle = () => {
                        // Buscar el registro Horas Robot completo
                        const reg = datosHorasRobot?.registros.find(
                          (r) => r.documento === f.documento && r.fecha === f.fecha
                        ) ?? null;
                        setFilaSeleccionada(f);
                        setRegistroSeleccionado(reg);
                        setDialogoAbierto(true);
                      };
                      return (
                        <TableRow
                          key={key}
                          onClick={abrirDetalle}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="text-xs font-mono">{f.documento}</TableCell>
                          <TableCell className="text-xs">{f.nombre || '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtFecha(f.fecha)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{fmtHoras(f.horasProgramadas)}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{fmtHoras(f.horasRobot)}</TableCell>
                          <TableCell className={`text-right tabular-nums text-xs ${f.tiempoFaltante > 0 ? 'text-pasivo font-semibold' : 'text-promotor'}`}>
                            {f.tiempoFaltante > 0 ? fmtHoras(f.tiempoFaltante) : 'OK'}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-xs ${f.deslogueoSeg > 0 ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                            {f.deslogueoSeg > 0 ? fmtTiempo(f.deslogueoSeg) : '—'}
                          </TableCell>
                          <TableCell>
                            {f.novedades.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="border-violet-400/60 text-violet-700 dark:text-violet-300 w-fit">
                                  {f.novedades.length} nov.
                                </Badge>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {f.novedades.slice(0, 2).map((n) => (
                                    <span key={n.id} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                      <TicketIcon className="h-2.5 w-2.5" />
                                      {n.ticket ?? '—'}
                                    </span>
                                  ))}
                                  {f.novedades.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">+{f.novedades.length - 2}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-xs ${f.tiempoAIngresar > 0 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}`}>
                            {f.tiempoAIngresar > 0 ? fmtHoras(f.tiempoAIngresar) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-semibold text-promotor">
                            {fmtCOP(f.valorDia)}
                          </TableCell>
                          <TableCell className="text-right">
                            {esAjustado ? (
                              <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Ajustado
                              </Badge>
                            ) : f.tiempoFaltante > 0 || f.deslogueoSeg > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={procesandoId === key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  ajustarTiempo(f);
                                }}
                                className="gap-1"
                              >
                                {procesandoId === key ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                Ajustar
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin ajuste</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          No hay registros con estos filtros.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Tarifa de referencia:</strong> {fmtCOP(TARIFA_POR_HORA_COP)}/hora.
            El valor del día se calcula como (horas robot + tiempo a ingresar) × tarifa.
          </p>
          <p>
            <strong>Tiempo a ingresar:</strong> mínimo entre el tiempo faltante y el deslogueo
            autorizado (de la bitácora). Las novedades aprobadas en la pestaña
            "Novedades Ingresadas" validan el ajuste ante el asesor.
          </p>
          <p>
            <XCircle className="h-3 w-3 inline mr-1 text-muted-foreground" />
            Si un asesor tiene una novedad pendiente, revísala en la pestaña
            <strong> "Novedades Ingresadas"</strong> antes de ajustar el tiempo.
          </p>
        </CardContent>
      </Card>

      {/* v3.4.5 — Dialog de detalle al hacer clic en una fila */}
      <ValidacionDetalleDialog
        fila={filaSeleccionada}
        registroHorasRobot={registroSeleccionado}
        deslogueosFecha={
          datosBitacora?.deslogueos.filter((d) => d.fecha === filaSeleccionada?.fecha) ?? []
        }
        abierto={dialogoAbierto}
        onCerrar={() => {
          setDialogoAbierto(false);
          setFilaSeleccionada(null);
          setRegistroSeleccionado(null);
        }}
        onAjustado={async () => {
          // Recargar novedades tras ajustar
          const res = await leerNovedades();
          setNovedades(res || []);
        }}
      />
    </div>
  );
}
