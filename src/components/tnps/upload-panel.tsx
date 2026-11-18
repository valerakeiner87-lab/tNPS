'use client';

import { useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileBarChart,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Lock,
  MessageSquare,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';

interface ArchivoSlot {
  key: 'hc' | 'qualtrics' | 'tmo' | 'adherencia' | 'horasRobot' | 'bitacora';
  archivo: File | null;
  setArchivo: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  etiqueta: string;
  descripcion: string;
  icono: React.ComponentType<{ className?: string }>;
  iconoBg: string;
  iconoColor: string;
}

// Mapeo explícito de clases de color (Tailwind no soporta clases dinámicas).
const COLORES = {
  red: { bg: 'bg-claro-red/10', text: 'text-claro-red' },
  blue: { bg: 'bg-claro-blue/10', text: 'text-claro-blue' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
} as const;

export function UploadPanel() {
  const perfil = useStore((s) => s.perfil);
  const procesarTodosArchivos = useStore((s) => s.procesarTodosArchivos);
  const metadata = useStore((s) => s.metadata);
  const procesandoCarga = useStore((s) => s.procesandoCarga);
  const encuestas = useStore((s) => s.encuestas);
  const asesoresHC = useStore((s) => s.asesoresHC);
  const datosTMO = useStore((s) => s.datosTMO);
  const datosAdherencia = useStore((s) => s.datosAdherencia);
  const datosHorasRobot = useStore((s) => s.datosHorasRobot);
  const datosBitacora = useStore((s) => s.datosBitacora);
  const setTab = useStore((s) => s.setTab);

  const [archivoHC, setArchivoHC] = useState<File | null>(null);
  const [archivoQualtrics, setArchivoQualtrics] = useState<File | null>(null);
  const [archivoTMO, setArchivoTMO] = useState<File | null>(null);
  const [archivoAdherencia, setArchivoAdherencia] = useState<File | null>(null);
  const [archivoHorasRobot, setArchivoHorasRobot] = useState<File | null>(null);
  const [archivoBitacora, setArchivoBitacora] = useState<File | null>(null);
  const [resumen, setResumen] = useState<{ procesados: string[]; errores: string[] } | null>(null);

  const inputHC = useRef<HTMLInputElement>(null);
  const inputQualtrics = useRef<HTMLInputElement>(null);
  const inputTMO = useRef<HTMLInputElement>(null);
  const inputAdherencia = useRef<HTMLInputElement>(null);
  const inputHorasRobot = useRef<HTMLInputElement>(null);
  const inputBitacora = useRef<HTMLInputElement>(null);

  const FORMATOS_ACEPTADOS = '.xlsx,.xls,.xlsb,.csv';

  if (!perfil?.puedeEscribir) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            Solo los supervisores y administradores pueden cargar archivos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const slots: ArchivoSlot[] = [
    {
      key: 'hc',
      archivo: archivoHC,
      setArchivo: setArchivoHC,
      inputRef: inputHC,
      etiqueta: 'HC (Health Check)',
      descripcion: 'Lista de asesores activos y sus datos. Común para Digital y Telefónico.',
      icono: Users,
      iconoBg: COLORES.red.bg,
      iconoColor: COLORES.red.text,
    },
    {
      key: 'qualtrics',
      archivo: archivoQualtrics,
      setArchivo: setArchivoQualtrics,
      inputRef: inputQualtrics,
      etiqueta: 'Qualtrics Digital',
      descripcion: 'Encuestas de satisfacción WhatsApp/Chat · 55 columnas.',
      icono: MessageSquare,
      iconoBg: COLORES.red.bg,
      iconoColor: COLORES.red.text,
    },
    {
      key: 'tmo',
      archivo: archivoTMO,
      setArchivo: setArchivoTMO,
      inputRef: inputTMO,
      etiqueta: 'TMO (Genesys)',
      descripcion: 'Tiempo Medio Operativo · hoja "BD NEW". Actualiza Digital + Telefónico.',
      icono: Clock,
      iconoBg: COLORES.blue.bg,
      iconoColor: COLORES.blue.text,
    },
    {
      key: 'adherencia',
      archivo: archivoAdherencia,
      setArchivo: setArchivoAdherencia,
      inputRef: inputAdherencia,
      etiqueta: 'Adherencia',
      descripcion: 'Métricas de agentes · hoja "PROGRAMACION". TMO, PPH, %OCC, %ADH, %UTL.',
      icono: Activity,
      iconoBg: COLORES.purple.bg,
      iconoColor: COLORES.purple.text,
    },
    {
      key: 'horasRobot',
      archivo: archivoHorasRobot,
      setArchivo: setArchivoHorasRobot,
      inputRef: inputHorasRobot,
      etiqueta: 'Horas Robot',
      descripcion: 'Horas robot.xlsx · hoja "Horas Genesys". Program_Time vs. Horas a pagar.',
      icono: FileBarChart,
      iconoBg: COLORES.emerald.bg,
      iconoColor: COLORES.emerald.text,
    },
    {
      key: 'bitacora',
      archivo: archivoBitacora,
      setArchivo: setArchivoBitacora,
      inputRef: inputBitacora,
      etiqueta: 'Bitácora Deslogueos',
      descripcion: 'Bitacora Deslogueos Autorizados.xlsx · hoja "Deslogueos Autorizados".',
      icono: FileSpreadsheet,
      iconoBg: COLORES.orange.bg,
      iconoColor: COLORES.orange.text,
    },
  ];

  function limpiarTodos() {
    setArchivoHC(null);
    setArchivoQualtrics(null);
    setArchivoTMO(null);
    setArchivoAdherencia(null);
    setArchivoHorasRobot(null);
    setArchivoBitacora(null);
    [inputHC, inputQualtrics, inputTMO, inputAdherencia, inputHorasRobot, inputBitacora].forEach(
      (ref) => {
        if (ref.current) ref.current.value = '';
      }
    );
    setResumen(null);
  }

  async function procesarTodo() {
    const r = await procesarTodosArchivos({
      hc: archivoHC,
      qualtrics: archivoQualtrics,
      tmo: archivoTMO,
      adherencia: archivoAdherencia,
      horasRobot: archivoHorasRobot,
      bitacora: archivoBitacora,
    });
    setResumen(r);
    // Limpiar inputs después de procesar (los datos ya quedan en BD)
    [inputHC, inputQualtrics, inputTMO, inputAdherencia, inputHorasRobot, inputBitacora].forEach(
      (ref) => {
        if (ref.current) ref.current.value = '';
      }
    );
    setArchivoHC(null);
    setArchivoQualtrics(null);
    setArchivoTMO(null);
    setArchivoAdherencia(null);
    setArchivoHorasRobot(null);
    setArchivoBitacora(null);
  }

  const hayArchivos =
    archivoHC || archivoQualtrics || archivoTMO || archivoAdherencia || archivoHorasRobot || archivoBitacora;

  function zona(slot: ArchivoSlot) {
    const Icono = slot.icono;
    const tieneArchivo = !!slot.archivo;
    return (
      <button
        key={slot.key}
        type="button"
        onClick={() => slot.inputRef.current?.click()}
        className={`w-full rounded-xl border-2 border-dashed p-4 text-left transition-colors hover:border-claro-red/60 hover:bg-accent/40 ${
          tieneArchivo ? 'border-promotor/50 bg-promotor/5' : 'border-border'
        }`}
      >
        <input
          ref={slot.inputRef}
          type="file"
          accept={FORMATOS_ACEPTADOS}
          className="sr-only"
          onChange={(e) => slot.setArchivo(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${slot.iconoBg}`}>
            <Icono className={`h-5 w-5 ${slot.iconoColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{slot.etiqueta}</p>
              {tieneArchivo && (
                <Badge variant="outline" className="border-promotor/40 text-promotor">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Listo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tieneArchivo
                ? `${slot.archivo!.name} (${(slot.archivo!.size / 1024).toFixed(0)} KB)`
                : slot.descripcion}
            </p>
          </div>
          {tieneArchivo ? (
            <FileCheck2 className="h-5 w-5 text-promotor shrink-0" />
          ) : (
            <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-l-4 border-l-claro-red">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-claro-red" />
                Carga unificada de archivos
              </CardTitle>
              <CardDescription>
                Selecciona todos los archivos que necesites cargar y haz clic en{' '}
                <strong>"Procesar todos"</strong> una sola vez. Los datos se guardan en la base de
                datos y se recargan automáticamente al iniciar sesión — no necesitas volver a
                subirlos.
              </CardDescription>
            </div>
            <Badge className="bg-claro-red text-white">
              <MessageSquare className="h-3 w-3 mr-1" /> Digital
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado actual en BD */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-muted px-2 py-1 border">
              {encuestas.length.toLocaleString('es-GT')} encuestas
            </span>
            <span className="rounded-md bg-muted px-2 py-1 border">
              {asesoresHC.length.toLocaleString('es-GT')} asesores HC
            </span>
            {datosTMO && (
              <span className="rounded-md bg-claro-blue/10 px-2 py-1 border border-claro-blue/30 text-claro-blue">
                TMO: {datosTMO.totalAsesores} asesores
              </span>
            )}
            {datosAdherencia && (
              <span className="rounded-md bg-purple-100/60 dark:bg-purple-950/30 px-2 py-1 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300">
                Adherencia: {datosAdherencia.totalRegistros} registros
              </span>
            )}
            {datosHorasRobot && (
              <span className="rounded-md bg-emerald-100/60 dark:bg-emerald-950/30 px-2 py-1 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
                Horas Robot: {datosHorasRobot.totalRegistros} registros
              </span>
            )}
            {datosBitacora && (
              <span className="rounded-md bg-orange-100/60 dark:bg-orange-950/30 px-2 py-1 border border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300">
                Bitácora: {datosBitacora.totalRegistros} deslogueos
              </span>
            )}
          </div>

          {/* Grid 2x3 de zonas de carga */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {slots.map(zona)}
          </div>

          {/* Botones principales */}
          <div className="flex flex-wrap gap-2 items-center pt-2">
            <Button
              onClick={procesarTodo}
              disabled={!hayArchivos || procesandoCarga}
              className="gap-2"
              size="lg"
            >
              {procesandoCarga ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileUp className="h-5 w-5" />
              )}
              {procesandoCarga ? 'Procesando…' : 'Procesar todos'}
            </Button>
            <Button
              variant="outline"
              onClick={limpiarTodos}
              disabled={!hayArchivos || procesandoCarga}
              className="gap-2"
            >
              Limpiar selección
            </Button>
            {encuestas.length > 0 && (
              <Button variant="ghost" onClick={() => setTab('global')} className="gap-2 ml-auto">
                Ver dashboard →
              </Button>
            )}
          </div>

          {/* Resumen de la última carga */}
          {resumen && (
            <div
              className={`rounded-lg border p-3 text-sm space-y-1 ${
                resumen.errores.length > 0
                  ? 'border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                  : 'border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {resumen.procesados.length > 0 && (
                <p>
                  <strong>Procesados ({resumen.procesados.length}):</strong>{' '}
                  {resumen.procesados.join(', ')}
                </p>
              )}
              {resumen.errores.length > 0 && (
                <p>
                  <strong>Errores ({resumen.errores.length}):</strong>{' '}
                  {resumen.errores.join(' · ')}
                </p>
              )}
              {resumen.procesados.length === 0 && resumen.errores.length === 0 && (
                <p>No se seleccionó ningún archivo.</p>
              )}
            </div>
          )}

          {/* Nota informativa */}
          <div className="flex items-start gap-2 rounded-md border border-pasivo/30 bg-pasivo/5 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-pasivo shrink-0 mt-0.5" />
            <p>
              Todos los archivos se procesan y se guardan en la base de datos Neon con failover
              automático. Al recargar la página o iniciar sesión en otro dispositivo, los datos se
              cargan automáticamente desde la BD — <strong>no es necesario volver a subirlos</strong>.
              Formatos soportados: <code className="bg-muted px-1 rounded ml-1">.xlsx</code>
              <code className="bg-muted px-1 rounded ml-1">.xls</code>
              <code className="bg-muted px-1 rounded ml-1">.xlsb</code>
              <code className="bg-muted px-1 rounded ml-1">.csv</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metadata de la última carga */}
      {metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Última carga registrada</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <p><span className="text-muted-foreground">Fecha:</span> {new Date(metadata.fechaCarga).toLocaleString('es-GT')}</p>
            <p><span className="text-muted-foreground">Cargada por:</span> {metadata.cargadoPor}</p>
            <p><span className="text-muted-foreground">Archivo HC:</span> {metadata.archivoHCNombre}</p>
            <p><span className="text-muted-foreground">Archivo Qualtrics:</span> {metadata.archivoQualtricsNombre}</p>
            <p><span className="text-muted-foreground">Total encuestas:</span> {metadata.totalEncuestas.toLocaleString('es-GT')}</p>
            <p><span className="text-muted-foreground">Total asesores HC:</span> {metadata.totalAsesoresHC.toLocaleString('es-GT')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
