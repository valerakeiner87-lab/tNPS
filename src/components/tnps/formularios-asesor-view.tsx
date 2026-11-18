'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  listarFormulariosAsesorAction,
  responderFormularioAction,
  type FormularioData,
  type PreguntaData,
} from '@/app/actions/learning-actions';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { cn } from '@/lib/utils';

/** Color de badge según categoría (v3.0.7). */
function colorCategoriaBadge(cat: string): string {
  const c = (cat || '').toLowerCase();
  if (c.includes('producto')) return 'bg-claro-blue/10 text-claro-blue border-claro-blue/30';
  if (c.includes('soft') || c.includes('skill')) return 'bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300';
  if (c.includes('proceso')) return 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300';
  if (c.includes('servicio')) return 'bg-promotor/10 text-promotor border-promotor/30';
  if (c.includes('vent')) return 'bg-detractor/10 text-detractor border-detractor/30';
  return 'bg-primary/10 text-primary border-primary/30';
}

/** Genera N piezas de confetti con posiciones y colores aleatorios. */
function generarConfetti(n: number) {
  const colores = ['#DA291C', '#1A3F7A', '#16A34A', '#F59E0B', '#9333EA', '#0EA5E9'];
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 200,
    dur: 2 + Math.random() * 1.5,
    delay: Math.random() * 0.6,
    color: colores[i % colores.length],
  }));
}

/** Vista del asesor para ver y responder formularios. */
export function FormulariosAsesorView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const atc = useATCStore();

  const [formularios, setFormularios] = useState<FormularioData[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formularioActivo, setFormularioActivo] = useState<FormularioData | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ correctas: number; total: number; atcGanado: number } | null>(null);

  const login = perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '';
  const area = (perfil?.area || 'digital') as string;

  async function cargar() {
    if (!login) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const lista = await listarFormulariosAsesorAction(login, area);
      setFormularios(lista);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [login, area]);

  function abrirFormulario(f: FormularioData) {
    setFormularioActivo(f);
    setRespuestas({});
    setPreguntaActual(0);
    setResultado(null);
  }

  function cerrarFormulario() {
    setFormularioActivo(null);
    setRespuestas({});
    setPreguntaActual(0);
    setResultado(null);
  }

  async function enviar() {
    if (!formularioActivo) return;
    setEnviando(true);
    try {
      const respuestasArray = formularioActivo.preguntas!.map((p) => {
        const respuestaIdx = respuestas[p.id || p.enunciado] ?? -1;
        const correcta =
          p.tipo === 'verdadero_falso'
            ? (p.respuestaCorrecta === 1) === (respuestaIdx === 1)
            : respuestaIdx === p.respuestaCorrecta;
        const respuestaTexto =
          p.tipo === 'verdadero_falso'
            ? respuestaIdx === 1
              ? 'Verdadero'
              : respuestaIdx === 0
                ? 'Falso'
                : 'Sin responder'
            : (p.opciones?.[respuestaIdx] ?? 'Sin responder');
        return {
          preguntaId: p.id || p.enunciado,
          respuesta: respuestaTexto,
          correcta,
        };
      });
      const res = await responderFormularioAction({
        formularioId: formularioActivo.id,
        respuestas: respuestasArray,
      });
      if (res.ok) {
        setResultado({ correctas: res.correctas, total: res.total, atcGanado: res.atcGanado });
        if (res.atcGanado > 0) {
          toast.success(`🎓 ¡Ganaste ${res.atcGanado} ATC!`);
          atc.sincronizar(true).catch(() => undefined);
        } else {
          toast.info('Formulario enviado.');
        }
      } else {
        toast.error('No se pudo enviar el formulario (¿ya agotaste los intentos?).');
      }
    } finally {
      setEnviando(false);
    }
  }

  const atcPosible = useMemo(() => {
    if (!formularioActivo?.preguntas) return 0;
    return (
      formularioActivo.preguntas.length * formularioActivo.atcPorRespuesta +
      formularioActivo.atcBonus
    );
  }, [formularioActivo]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold">Aprendizaje</p>
            <p className="text-xs text-muted-foreground">
              Completa los formularios asignados y gana ATC por cada respuesta correcta.
            </p>
          </div>
        </CardContent>
      </Card>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : formularios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tienes formularios asignados todavía. ¡Vuelve más tarde!
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formularios.map((f) => (
            <Card key={f.id} className="flex flex-col hover:shadow-md transition-all borde-gradiente animar-escalar-fade">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{f.titulo}</CardTitle>
                  {f.categoria && (
                    <Badge variant="outline" className={cn('text-[10px] capitalize shrink-0', colorCategoriaBadge(f.categoria))}>
                      {f.categoria}
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2">{f.descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 mt-auto space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {f.preguntas?.length ?? 0} preguntas
                  </Badge>
                </div>
                <Badge variant="secondary" className="text-[10px] gap-1 w-full justify-center">
                  🪙 Hasta +{(f.preguntas?.length ?? 0) * f.atcPorRespuesta + f.atcBonus} ATC
                </Badge>
                <Button className="w-full gap-2" onClick={() => abrirFormulario(f)}>
                  <Sparkles className="h-3.5 w-3.5" /> Comenzar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* === Dialog responder formulario === */}
      <Dialog open={!!formularioActivo} onOpenChange={(a) => !a && cerrarFormulario()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> {formularioActivo?.titulo}
            </DialogTitle>
            <DialogDescription>
              {formularioActivo?.descripcion || 'Responde las preguntas y gana ATC.'}
            </DialogDescription>
          </DialogHeader>

          {formularioActivo && !resultado && (
            <FormularioResponder
              formulario={formularioActivo}
              respuestas={respuestas}
              setRespuestas={setRespuestas}
              preguntaActual={preguntaActual}
              setPreguntaActual={setPreguntaActual}
            />
          )}

          {resultado && formularioActivo && (
            <ResultadoFormulario
              formulario={formularioActivo}
              resultado={resultado}
              respuestas={respuestas}
            />
          )}

          <DialogFooter>
            {!resultado && formularioActivo && (
              <Button onClick={enviar} disabled={enviando} className="gap-2">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Enviar respuestas
              </Button>
            )}
            <Button variant="outline" onClick={cerrarFormulario}>
              {resultado ? 'Cerrar' : 'Cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Sub-componente que muestra las preguntas según el diseño. */
function FormularioResponder({
  formulario,
  respuestas,
  setRespuestas,
  preguntaActual,
  setPreguntaActual,
}: {
  formulario: FormularioData;
  respuestas: Record<string, number>;
  setRespuestas: (r: Record<string, number>) => void;
  preguntaActual: number;
  setPreguntaActual: (n: number) => void;
}) {
  const diseño = formulario.diseño || 'clasico';
  const preguntas = formulario.preguntas || [];
  const total = preguntas.length;

  function setResp(preguntaId: string, idx: number) {
    setRespuestas({ ...respuestas, [preguntaId]: idx });
  }

  if (diseño === 'quiz') {
    // Una pregunta a la vez con progress bar
    const p = preguntas[preguntaActual];
    const respondidas = Object.keys(respuestas).length;
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span>
              Pregunta {preguntaActual + 1} de {total}
            </span>
            <span className="text-muted-foreground">{respondidas}/{total} respondidas</span>
          </div>
          <Progress value={(respondidas / total) * 100} className="h-2" />
        </div>
        <PreguntaCard
          pregunta={p}
          respuestaIdx={respuestas[p.id || p.enunciado]}
          onRespuesta={(idx) => setResp(p.id || p.enunciado, idx)}
        />
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreguntaActual(Math.max(0, preguntaActual - 1))}
            disabled={preguntaActual === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreguntaActual(Math.min(total - 1, preguntaActual + 1))}
            disabled={preguntaActual === total - 1}
            className="gap-1"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // clasico / tarjetas / encuesta → todas a la vez (estilo simplificado)
  return (
    <div className="space-y-4">
      {preguntas.map((p, i) => (
        <PreguntaCard
          key={p.id || i}
          pregunta={p}
          indice={i + 1}
          respuestaIdx={respuestas[p.id || p.enunciado]}
          onRespuesta={(idx) => setResp(p.id || p.enunciado, idx)}
          tipoDiseno={diseño}
        />
      ))}
    </div>
  );
}

function PreguntaCard({
  pregunta,
  indice,
  respuestaIdx,
  onRespuesta,
  tipoDiseno = 'clasico',
}: {
  pregunta: PreguntaData;
  indice?: number;
  respuestaIdx: number | undefined;
  onRespuesta: (idx: number) => void;
  tipoDiseno?: string;
}) {
  const opciones =
    pregunta.tipo === 'verdadero_falso'
      ? ['Falso', 'Verdadero']
      : pregunta.opciones || [];

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        tipoDiseno === 'tarjetas' && 'bg-gradient-to-br from-primary/5 to-transparent'
      )}
    >
      <p className="text-sm font-medium">
        {indice ? `${indice}. ` : ''}
        {pregunta.enunciado}
      </p>
      <div className="grid gap-1.5">
        {opciones.map((op, oi) => {
          const seleccionada = respuestaIdx === oi;
          return (
            <button
              key={oi}
              type="button"
              onClick={() => onRespuesta(oi)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors',
                seleccionada
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:bg-accent/40'
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 shrink-0',
                  seleccionada ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                )}
              />
              <span>{op}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultadoFormulario({
  formulario,
  resultado,
  respuestas,
}: {
  formulario: FormularioData;
  resultado: { correctas: number; total: number; atcGanado: number };
  respuestas: Record<string, number>;
}) {
  const pct = resultado.total > 0 ? Math.round((resultado.correctas / resultado.total) * 100) : 0;
  const mostrarConfetti = pct === 100;
  const confetti = useMemo(() => (mostrarConfetti ? generarConfetti(40) : []), [mostrarConfetti]);
  return (
    <div className="space-y-4 relative">
      {/* Confetti CSS-only cuando es 100% */}
      {mostrarConfetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-20" aria-hidden>
          {confetti.map((p) => (
            <span
              key={p.id}
              className="confetti-pieza"
              style={{
                left: `${p.left}%`,
                background: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                ['--dx' as string]: `${p.dx}px`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          'rounded-xl border-2 p-4 text-center animar-escalar-fade relative overflow-hidden',
          pct === 100
            ? 'border-promotor/40 bg-promotor/5'
            : pct >= 60
              ? 'border-pasivo/40 bg-pasivo/5'
              : 'border-detractor/40 bg-detractor/5'
        )}
      >
        {formulario.categoria && (
          <Badge variant="outline" className={cn('text-[10px] capitalize mb-2', colorCategoriaBadge(formulario.categoria))}>
            {formulario.categoria}
          </Badge>
        )}
        <p className="text-xs text-muted-foreground uppercase">Resultado</p>
        <p className="text-4xl font-bold tabular-nums">
          {resultado.correctas} / {resultado.total}
        </p>
        <p className="text-sm text-muted-foreground">({pct}% correctas)</p>
        <Badge variant="secondary" className="mt-2 gap-1">
          🪙 +{resultado.atcGanado} ATC
        </Badge>
        {pct === 100 && (
          <p className="mt-2 text-promotor font-semibold text-sm">🎉 ¡Perfecto! Felicidades</p>
        )}
      </div>

      {/* Revisión de respuestas */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Revisión</p>
        {formulario.preguntas?.map((p, i) => {
          const respuestaIdx = respuestas[p.id || p.enunciado] ?? -1;
          const correcta =
            p.tipo === 'verdadero_falso'
              ? (p.respuestaCorrecta === 1) === (respuestaIdx === 1)
              : respuestaIdx === p.respuestaCorrecta;
          return (
            <div
              key={p.id || i}
              className={cn(
                'rounded-md border p-2 text-sm',
                correcta ? 'border-promotor/40 bg-promotor/5' : 'border-detractor/40 bg-detractor/5'
              )}
            >
              <div className="flex items-start gap-2">
                {correcta ? (
                  <CheckCircle2 className="h-4 w-4 text-promotor mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-detractor mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i + 1}. {p.enunciado}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tu respuesta:{' '}
                    <strong>
                      {p.tipo === 'verdadero_falso'
                        ? respuestaIdx === 1
                          ? 'Verdadero'
                          : respuestaIdx === 0
                            ? 'Falso'
                            : 'Sin responder'
                        : p.opciones?.[respuestaIdx] ?? 'Sin responder'}
                    </strong>
                    {!correcta && (
                      <>
                        {' '}
                        · Correcta:{' '}
                        <strong className="text-promotor">
                          {p.tipo === 'verdadero_falso'
                            ? p.respuestaCorrecta === 1
                              ? 'Verdadero'
                              : 'Falso'
                            : p.opciones?.[p.respuestaCorrecta]}
                        </strong>
                      </>
                    )}
                  </p>
                  {p.explicacion && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{p.explicacion}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
