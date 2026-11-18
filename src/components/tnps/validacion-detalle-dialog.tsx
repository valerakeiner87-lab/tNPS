'use client';

/**
 * v3.4.5 — ValidacionDetalleDialog
 * ----------------------------------
 * Dialog que muestra el detalle completo de un asesor en un día específico:
 *  - Turno programado (Start_Date → End_Date)
 *  - Turno real (Entrada real → Salida real)
 *  - Hora de conexión y de deslogueo
 *  - Si salió antes: ¿fue justificado? (cruce con Bitácora Deslogueos)
 *  - Si llegó tarde: ¿fue por disponibilidad de puesto? (cruce con Bitácora)
 *  - Novedades del asesor para esa fecha
 *  - Ecuación del tiempo: programado, robot, faltante, tiempo a ingresar
 *  - Acción "Tiempo Ajustado" que sincroniza con el asesor
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Timer,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RegistroHorasRobot, DeslogueoAutorizado } from '@/lib/types';
import { actualizarNominaDiaria, leerNovedades } from '@/lib/firestore-data';
import type { Novedad } from '@/lib/neon-data';
import { normalizarDocumento, documentosIguales } from '@/lib/utils';

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
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return fecha;
  }
}

function fmtHora(fechaISO: string | null): string {
  if (!fechaISO) return '—';
  try {
    const d = new Date(fechaISO);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtFechaHora(fechaISO: string | null): string {
  if (!fechaISO) return '—';
  try {
    const d = new Date(fechaISO);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Segundos entre dos datetimes (puede ser negativo si b < a) */
function diffSeg(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.round((db - da) / 1000);
}

/** hhmmASegundos: "07:30" → 27000 */
function hhmmASeg(s: string): number {
  if (!s) return 0;
  const partes = s.split(':');
  if (partes.length === 2) return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60;
  if (partes.length === 3) return parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
  return 0;
}

interface Props {
  fila: {
    documento: string;
    nombre: string;
    fecha: string;
    lob: string;
    supervisor: string;
    horasProgramadas: number;
    horasRobot: number;
    tiempoFaltante: number;
    deslogueoSeg: number;
    deslogueo: DeslogueoAutorizado | null;
    novedades: Novedad[];
    estadoAjuste: string;
    valorDia: number;
    tiempoAIngresar: number;
  } | null;
  registroHorasRobot?: RegistroHorasRobot | null;
  deslogueosFecha?: DeslogueoAutorizado[];
  abierto: boolean;
  onCerrar: () => void;
  onAjustado?: () => void;
}

export function ValidacionDetalleDialog({
  fila,
  registroHorasRobot,
  deslogueosFecha,
  abierto,
  onCerrar,
  onAjustado,
}: Props) {
  const [procesando, setProcesando] = useState(false);
  const [nota, setNota] = useState('');

  const doc = fila?.documento || '';
  const fecha = fila?.fecha || '';

  // Cargar novedades del asesor (todas, no solo las aprobadas)
  const [todasNovedades, setTodasNovedades] = useState<Novedad[]>([]);
  useMemo(() => {
    if (!doc) return;
    leerNovedades(doc)
      .then((r) => setTodasNovedades(r || []))
      .catch(() => setTodasNovedades([]));
  }, [doc]);

  if (!fila || !registroHorasRobot) {
    return (
      <Dialog open={abierto} onOpenChange={onCerrar}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de validación</DialogTitle>
            <DialogDescription>
              Selecciona una fila para ver el detalle del asesor.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== Cálculos de puntualidad =====
  const startDate = registroHorasRobot.startDate;
  const endDate = registroHorasRobot.endDate;
  const entradaReal = registroHorasRobot.entradaReal;
  const salidaReal = registroHorasRobot.salidaReal;

  // Tardanza: Entrada real - Start Date (en segundos)
  // Si > 60 min = llegó tarde
  const tardanzaBrutaSeg = entradaReal && startDate ? diffSeg(startDate, entradaReal) : 0;
  const llegoTarde = tardanzaBrutaSeg > 60; // > 60 segundos = llegó tarde (umbral 1 min)

  // Salida anticipada: End Date - Salida real
  // Si Salida real < End Date → salió antes
  const salidaAntesSeg = salidaReal && endDate ? -diffSeg(salidaReal, endDate) : 0;
  // salidaAntesSeg > 0 significa que salidaReal < endDate (salió antes)
  const salioAntes = salidaAntesSeg > 60; // > 1 minuto

  // Repuesto: si salidaReal > endDate (se quedó más tiempo)
  const repuestoSeg = salidaReal && endDate ? diffSeg(endDate, salidaReal) : 0;
  const seQuedoMas = repuestoSeg > 60;

  // ===== Cruce con Bitácora =====
  // Buscar deslogueos autorizados para este asesor+fecha
  const deslogueosAsesor = (deslogueosFecha || []).filter((d) =>
    documentosIguales(d.documento, doc)
  );

  // Clasificar deslogueos por motivo
  const motivosDeslogueo = deslogueosAsesor.map((d) => ({
    motivo: d.novedad || 'Deslogueo autorizado',
    ahorroSeg: hhmmASeg(d.ahorro),
    diferenciaSeg: hhmmASeg(d.diferencia),
    horaIngreso: d.horaIngreso,
    horaDeslogueo: d.horaDeslogueo,
    horaSalida: d.horaSalida,
  }));

  // Justificación de salida anticipada: si hay deslogueo autorizado que cubre el tiempo
  const totalAhorroDeslogueo = motivosDeslogueo.reduce((a, m) => a + m.ahorroSeg, 0);
  const salidaAntesJustificada = salioAntes && totalAhorroDeslogueo >= salidaAntesSeg;
  const salidaAntesSinJustificar = salioAntes
    ? Math.max(0, salidaAntesSeg - totalAhorroDeslogueo)
    : 0;

  // Justificación de tardanza: buscar en la bitácora si hay un registro
  // de "Disponibilidad de Puestos" que justifique la tardanza
  // (por ahora usamos el mismo deslogueo si el motivo incluye "disponibilidad")
  const tieneJustificacionTardanza = deslogueosAsesor.some((d) => {
    const motivo = (d.novedad || '').toLowerCase();
    return (
      motivo.includes('disponibilidad') ||
      motivo.includes('puesto') ||
      motivo.includes('conexion') ||
      motivo.includes('conexión') ||
      motivo.includes('sistema') ||
      motivo.includes('energia') ||
      motivo.includes('energía')
    );
  });

  // ===== Novedades del formulario =====
  const novedadesFecha = todasNovedades.filter((n) => n.fecha === fecha);

  // ===== Tiempo a ingresar (cálculo) =====
  // faltante = programado - robot (lo que falta cubrir)
  // deslJust = min(deslogueos, faltante)
  const faltanteBruto = fila.tiempoFaltante;
  const deslJust = Math.min(totalAhorroDeslogueo, faltanteBruto);
  const faltanteNeto = Math.max(0, faltanteBruto - deslJust);
  // tiempo a ingresar = faltante neto (lo que no está justificado)
  const tiempoAIngresar = faltanteNeto;

  async function ajustarTiempo() {
    if (!fila) return;
    if (tiempoAIngresar <= 0 && !salioAntes && !llegoTarde) {
      toast.info('No hay tiempo faltante ni salida/tardanza que ajustar.');
      return;
    }
    setProcesando(true);
    try {
      // Capturar datos de fila antes del await (TS narrow)
      const f = fila;
      // El tiempo a ingresar es el faltante neto (lo no justificado por deslogueos)
      const tiempoAjustadoSeg = tiempoAIngresar;
      const valorMonetario = (f.horasRobot + tiempoAjustadoSeg) / 3600 * TARIFA_POR_HORA_COP;
      await actualizarNominaDiaria(
        f.documento,
        f.fecha,
        tiempoAjustadoSeg,
        valorMonetario,
        'ajustado'
      );
      // Guardar la nota como respuesta en las novedades del día (si las hay)
      if (nota.trim() && novedadesFecha.length > 0) {
        for (const n of novedadesFecha) {
          try {
            const { actualizarNovedad } = await import('@/lib/firestore-data');
            await actualizarNovedad(n.id, 'ajustado', nota.trim());
          } catch {}
        }
      }
      toast.success(
        `Tiempo ajustado para ${f.nombre} el ${fmtFecha(f.fecha)}: +${fmtHoras(tiempoAjustadoSeg)}. Valor: ${fmtCOP(valorMonetario)}.`
      );
      onAjustado?.();
      onCerrar();
    } catch (err) {
      console.error('Error ajustando tiempo:', err);
      toast.error('Error al ajustar el tiempo. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  function copiarJustificacion() {
    if (!fila) return;
    const f = fila;
    const txt =
      `${f.nombre} · CC ${f.documento} · ${fmtFecha(f.fecha)}\n` +
      `Programado: ${fmtHoras(f.horasProgramadas)} · Robot: ${fmtHoras(f.horasRobot)} · Faltante: ${fmtHoras(f.tiempoFaltante)}\n` +
      `Deslogueo autorizado: ${fmtTiempo(totalAhorroDeslogueo)}\n` +
      `Tiempo a ingresar: ${fmtHoras(tiempoAIngresar)}\n` +
      (llegoTarde ? `Tardanza: ${fmtTiempo(tardanzaBrutaSeg)} ${tieneJustificacionTardanza ? '(justificada)' : '(sin justificar)'}\n` : '') +
      (salioAntes ? `Salida anticipada: ${fmtTiempo(salidaAntesSeg)} ${salidaAntesJustificada ? '(justificada)' : `(sin justificar: ${fmtTiempo(salidaAntesSinJustificar)})`}\n` : '') +
      (nota ? `Nota: ${nota}\n` : '');
    navigator.clipboard.writeText(txt).then(() => {
      toast.success('Justificación copiada al portapapeles.');
    }).catch(() => {
      toast.error('No se pudo copiar al portapapeles.');
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scroll-fino">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            {fila.nombre}
          </DialogTitle>
          <DialogDescription>
            CC {fila.documento} · {fila.lob} · Supervisor: {fila.supervisor} · {fmtFecha(fila.fecha)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ===== TURNO PROGRAMADO vs TURNO REAL ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Turno programado vs. real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Programado */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Turno programado
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inicio:</span>
                      <span className="font-mono font-medium">{fmtHora(startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fin:</span>
                      <span className="font-mono font-medium">{fmtHora(endDate)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Duración:</span>
                      <span className="font-semibold tabular-nums">{fmtHoras(fila.horasProgramadas)}</span>
                    </div>
                  </div>
                </div>
                {/* Real */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Turno real
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conexión:</span>
                      <span className="font-mono font-medium">{fmtHora(entradaReal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deslogueo:</span>
                      <span className="font-mono font-medium">{fmtHora(salidaReal)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">Horas robot:</span>
                      <span className="font-semibold tabular-nums">{fmtHoras(fila.horasRobot)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Fechas exactas: {fmtFechaHora(startDate)} → {fmtFechaHora(endDate)}
                <br />
                Reales: {fmtFechaHora(entradaReal)} → {fmtFechaHora(salidaReal)}
              </p>
            </CardContent>
          </Card>

          {/* ===== AUXILIARES (uso de tiempos desde Horas Robot) ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Auxiliares (Horas Robot)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <AuxiliarItem label="Disponible" segundos={registroHorasRobot.disponible} />
                <AuxiliarItem label="En cola" segundos={registroHorasRobot.enCola} />
                <AuxiliarItem label="Ocupado" segundos={registroHorasRobot.ocupado} color="emerald" />
                <AuxiliarItem label="Capacitación" segundos={registroHorasRobot.capacitacion} color="blue" />
                <AuxiliarItem label="Comida" segundos={registroHorasRobot.comida} color="amber" />
                <AuxiliarItem label="Descanso" segundos={registroHorasRobot.descanso} color="amber" />
                <AuxiliarItem label="Reunión" segundos={registroHorasRobot.reunion} color="blue" />
                <AuxiliarItem label="Inactivo" segundos={registroHorasRobot.inactivo} color="red" />
                <AuxiliarItem label="Ausente" segundos={registroHorasRobot.ausente} color="red" />
              </div>
            </CardContent>
          </Card>

          {/* ===== PUNTUALIDAD ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" /> Puntualidad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tardanza */}
              <div className={`rounded-lg p-3 border ${llegoTarde ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20' : 'border-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-950/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Llegada tarde</span>
                  {llegoTarde ? (
                    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3 mr-1" /> {fmtTiempo(tardanzaBrutaSeg)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> A tiempo
                    </Badge>
                  )}
                </div>
                {llegoTarde && (
                  <div className="mt-2 text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Programado: {fmtHora(startDate)} · Real: {fmtHora(entradaReal)} · Diferencia: +{fmtTiempo(tardanzaBrutaSeg)}
                    </p>
                    {tieneJustificacionTardanza ? (
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ Justificada por disponibilidad de puesto / falla de conexión
                      </p>
                    ) : (
                      <p className="text-red-700 dark:text-red-300 font-medium">
                        ⚠ Sin registro en Disponibilidad de Puestos. La tardanza no está justificada.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Salida anticipada */}
              <div className={`rounded-lg p-3 border ${salioAntes ? (salidaAntesJustificada ? 'border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/15' : 'border-red-400/60 bg-red-50/40 dark:bg-red-950/15') : (seQuedoMas ? 'border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/15' : 'border-muted')}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Salida anticipada</span>
                  {salioAntes ? (
                    <Badge variant="outline" className={salidaAntesJustificada ? 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300' : 'border-red-400/60 text-red-700 dark:text-red-300'}>
                      {salidaAntesJustificada ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Justificada</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Sin justificar</>
                      )}
                      {' '}{fmtTiempo(salidaAntesSeg)}
                    </Badge>
                  ) : seQuedoMas ? (
                    <Badge variant="outline" className="border-emerald-400/60 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> +{fmtTiempo(repuestoSeg)} extra
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-muted text-muted-foreground">
                      OK
                    </Badge>
                  )}
                </div>
                {salioAntes && (
                  <div className="mt-2 text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Fin programado: {fmtHora(endDate)} · Salida real: {fmtHora(salidaReal)} · Salió {fmtTiempo(salidaAntesSeg)} antes
                    </p>
                    {salidaAntesJustificada ? (
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ Justificada por deslogueo autorizado ({fmtTiempo(totalAhorroDeslogueo)} en bitácora)
                      </p>
                    ) : (
                      <p className="text-red-700 dark:text-red-300 font-medium">
                        ⚠ Sin justificar: {fmtTiempo(salidaAntesSinJustificar)} descontados
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ===== ECUACIÓN DEL TIEMPO ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" /> Ecuación del tiempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Tiempo</TableHead>
                    <TableHead className="text-right">Decimal (h)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs">Programado</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtHoras(fila.horasProgramadas)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{(fila.horasProgramadas / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs">− Robot</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtHoras(fila.horasRobot)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{(fila.horasRobot / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs font-semibold">Faltante bruto</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-semibold text-pasivo">{fmtHoras(faltanteBruto)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-semibold text-pasivo">{(faltanteBruto / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs">🚪 Deslogueo autorizado</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmtTiempo(totalAhorroDeslogueo)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{(totalAhorroDeslogueo / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs">· Justifica faltante</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-emerald-600">−{fmtTiempo(deslJust)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-emerald-600">−{(deslJust / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell className="text-xs">→ Tiempo a ingresar</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-primary">{fmtHoras(tiempoAIngresar)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-primary">{(tiempoAIngresar / 3600).toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ===== DESLOGUEOS DE LA BITÁCORA ===== */}
          {motivosDeslogueo.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  🚪 Deslogueos en bitácora ({motivosDeslogueo.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead>Deslogueo</TableHead>
                      <TableHead>Salida</TableHead>
                      <TableHead className="text-right">Ahorro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {motivosDeslogueo.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{m.motivo}</TableCell>
                        <TableCell className="text-xs font-mono">{m.horaIngreso}</TableCell>
                        <TableCell className="text-xs font-mono">{m.horaDeslogueo}</TableCell>
                        <TableCell className="text-xs font-mono">{m.horaSalida}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-orange-600">{fmtTiempo(m.ahorroSeg)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ===== NOVEDADES DEL FORMULARIO ===== */}
          {novedadesFecha.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  📋 Novedades del formulario ({novedadesFecha.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novedadesFecha.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs">{n.tipo}</TableCell>
                        <TableCell className="text-xs font-mono">{n.ticket || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            (n.estado || '').toLowerCase() === 'aprobada' || (n.estado || '').toLowerCase() === 'ajustado'
                              ? 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300'
                              : (n.estado || '').toLowerCase() === 'rechazada'
                                ? 'border-red-400/60 text-red-700 dark:text-red-300'
                                : 'border-amber-400/60 text-amber-700 dark:text-amber-300'
                          }>
                            {n.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ===== NOTA DEL SUPERVISOR ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">📝 Nota del supervisor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Escribe una nota para el asesor. Se guardará como respuesta en sus novedades al ajustar el tiempo."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={copiarJustificacion} className="gap-2">
            <Download className="h-4 w-4" /> Copiar justificación
          </Button>
          <Button
            onClick={ajustarTiempo}
            disabled={procesando}
            className="gap-2"
          >
            {procesando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {procesando ? 'Ajustando…' : 'Tiempo Ajustado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Item individual de auxiliar (Disponible, Comida, Ocupado, etc.) */
function AuxiliarItem({
  label,
  segundos,
  color = 'default',
}: {
  label: string;
  segundos?: number;
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'red';
}) {
  const seg = segundos || 0;
  const tiene = seg > 0;
  const colorMap = {
    default: tiene
      ? 'border-foreground/20 text-foreground'
      : 'border-muted text-muted-foreground',
    emerald: 'border-emerald-400/60 text-emerald-700 dark:text-emerald-300',
    blue: 'border-blue-400/60 text-blue-700 dark:text-blue-300',
    amber: 'border-amber-400/60 text-amber-700 dark:text-amber-300',
    red: 'border-red-400/60 text-red-700 dark:text-red-300',
  };
  return (
    <div className={`rounded-lg border p-2 ${tiene ? colorMap[color] : colorMap.default}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70 truncate">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{fmtTiempo(seg)}</p>
    </div>
  );
}
