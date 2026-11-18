'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Trophy, Zap } from 'lucide-react';
import { guardarPartidaJuegoAction } from '@/app/actions/learning-actions';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

// ============================================================
// 🧠 Memory — Juego de memoria con parejas de cartas
// ============================================================

type Simbolo = '🎮' | '🚀' | '🎯' | '⚡' | '🔥' | '💎' | '🌈' | '⭐' | '🎨' | '🎭' | '🎲' | '🎪';

interface Carta {
  id: number;
  simbolo: Simbolo;
  volteada: boolean;
  emparejada: boolean;
}

const TODOS_SIMBOLOS: Simbolo[] = ['🎮', '🚀', '🎯', '⚡', '🔥', '💎', '🌈', '⭐', '🎨', '🎭', '🎲', '🎪'];

const NIVELES: { nivel: number; pares: number; label: string; cols: string }[] = [
  { nivel: 1, pares: 6, label: 'Fácil (12 cartas)', cols: 'grid-cols-4' },
  { nivel: 2, pares: 8, label: 'Medio (16 cartas)', cols: 'grid-cols-4' },
  { nivel: 3, pares: 10, label: 'Difícil (20 cartas)', cols: 'grid-cols-5' },
  { nivel: 4, pares: 12, label: 'Experto (24 cartas)', cols: 'grid-cols-6' },
];

function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function crearMazo(pares: number): Carta[] {
  const simbolos = TODOS_SIMBOLOS.slice(0, pares);
  const cartas: Carta[] = [];
  simbolos.forEach((s, i) => {
    cartas.push({ id: i * 2, simbolo: s, volteada: false, emparejada: false });
    cartas.push({ id: i * 2 + 1, simbolo: s, volteada: false, emparejada: false });
  });
  return barajar(cartas);
}

export function Memory({ onClose }: Props) {
  const [nivel, setNivel] = useState(1);
  const [cartas, setCartas] = useState<Carta[]>(() => crearMazo(NIVELES[0].pares));
  const [volteadas, setVolteadas] = useState<number[]>([]); // índices
  const [movimientos, setMovimientos] = useState(0);
  const [paresEncontrados, setParesEncontrados] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [ganado, setGanado] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const startedAtRef = useRef<number>(0);
  const savingRef = useRef(false);
  const lockRef = useRef(false);

  const configNivel = NIVELES.find((n) => n.nivel === nivel) || NIVELES[0];

  const iniciar = useCallback((nivelN: number = 1) => {
    const cfg = NIVELES.find((n) => n.nivel === nivelN) || NIVELES[0];
    setNivel(nivelN);
    setCartas(crearMazo(cfg.pares));
    setVolteadas([]);
    setMovimientos(0);
    setParesEncontrados(0);
    setGanado(false);
    setCorriendo(true);
    setTiempo(0);
    startedAtRef.current = Date.now();
    lockRef.current = false;
  }, []);

  // Timer
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => {
      setTiempo(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [corriendo]);

  // Verificar par cuando hay 2 volteadas
  useEffect(() => {
    if (volteadas.length !== 2) return;
    lockRef.current = true;
    const [i1, i2] = volteadas;
    if (cartas[i1].simbolo === cartas[i2].simbolo) {
      // Match!
      setTimeout(() => {
        setCartas((prev) => prev.map((c, idx) =>
          idx === i1 || idx === i2 ? { ...c, emparejada: true, volteada: true } : c
        ));
        setVolteadas([]);
        setParesEncontrados((p) => p + 1);
        lockRef.current = false;
      }, 500);
    } else {
      // No match — voltear de nuevo
      setTimeout(() => {
        setCartas((prev) => prev.map((c, idx) =>
          idx === i1 || idx === i2 ? { ...c, volteada: false } : c
        ));
        setVolteadas([]);
        lockRef.current = false;
      }, 900);
    }
    setMovimientos((m) => m + 1);
  }, [volteadas, cartas]);

  // Verificar victoria
  useEffect(() => {
    if (paresEncontrados > 0 && paresEncontrados === configNivel.pares) {
      const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setGanado(true);
      setCorriendo(false);
      // Puntaje: mas pares, mas nivel, menos movimientos, menos tiempo = mas puntos
      const puntaje = Math.max(0, Math.round(
        (configNivel.pares * 100) +
        (nivel * 50) -
        (movimientos - configNivel.pares) * 10 -
        duracionSeg
      ));
      if (savingRef.current) return;
      savingRef.current = true;
      guardarPartidaJuegoAction({
        juego: 'memory',
        puntaje,
        nivel,
        duracionSeg,
        ganado: true,
        atcGanado: 0,
        datos: { pares: configNivel.pares, movimientos, tiempo: duracionSeg },
      })
        .then(() => toast.success(`🧠 ¡Memoria perfecta! Puntaje: ${puntaje}`))
        .catch(() => undefined)
        .finally(() => { savingRef.current = false; });
    }
  }, [paresEncontrados, configNivel.pares, nivel, movimientos]);

  function clickCarta(idx: number) {
    if (lockRef.current || ganado) return;
    if (cartas[idx].volteada || cartas[idx].emparejada) return;
    setCartas((prev) => prev.map((c, i) => i === idx ? { ...c, volteada: true } : c));
    setVolteadas((prev) => [...prev, idx]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Trophy className="h-3 w-3" /> Nivel {nivel}
          </Badge>
          <Badge variant="outline">⏱ {tiempo}s</Badge>
          <Badge variant="outline">🎯 {movimientos} mov</Badge>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" /> {paresEncontrados}/{configNivel.pares} pares
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => iniciar(nivel)} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>

      {/* Selector de nivel */}
      <div className="flex flex-wrap gap-2">
        {NIVELES.map((n) => (
          <Button
            key={n.nivel}
            size="sm"
            variant={nivel === n.nivel ? 'default' : 'outline'}
            onClick={() => iniciar(n.nivel)}
          >
            {n.label}
          </Button>
        ))}
      </div>

      {/* Tablero */}
      <div className={`grid ${configNivel.cols} gap-2 max-w-xl mx-auto`}>
        {cartas.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => clickCarta(idx)}
            disabled={c.emparejada || c.volteada || ganado}
            className={`aspect-square rounded-lg text-3xl sm:text-4xl font-bold transition-all duration-300 flex items-center justify-center ${
              c.emparejada
                ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-400 dark:ring-emerald-600 opacity-70'
                : c.volteada
                  ? 'bg-claro-red/15 ring-2 ring-claro-red/50'
                  : 'bg-gradient-to-br from-claro-navy to-claro-blue-2 text-white hover:scale-105 hover:shadow-md'
            }`}
            aria-label={`Carta ${idx + 1}${c.volteada || c.emparejada ? ': ' + c.simbolo : ''}`}
          >
            {c.volteada || c.emparejada ? c.simbolo : '?'}
          </button>
        ))}
      </div>

      {ganado && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 text-center space-y-2">
          <p className="text-2xl">🎉 ¡Memoria perfecta!</p>
          <p className="text-sm">
            Completaste el nivel {nivel} en <strong>{movimientos} movimientos</strong> y <strong>{tiempo}s</strong>.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => iniciar(nivel)} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Jugar de nuevo
            </Button>
            {nivel < 4 && (
              <Button variant="outline" onClick={() => iniciar(nivel + 1)}>
                Siguiente nivel →
              </Button>
            )}
          </div>
        </div>
      )}

      {!corriendo && !ganado && (
        <div className="text-center py-4">
          <Button onClick={() => iniciar(1)} className="gap-2">
            🧠 Empezar a jugar
          </Button>
        </div>
      )}
    </div>
  );
}
