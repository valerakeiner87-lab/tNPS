'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { guardarPartidaJuegoAction } from '@/app/actions/learning-actions';
import { toast } from 'sonner';

type Punto = { x: number; y: number };

const GRID = 20; // 20x20 celdas
const CELL = 18; // px por celda

type Modo = 'clasico' | 'paredes' | 'veloz';

interface Props {
  onClose: () => void;
}

/** 🐍 Culebrita — Canvas-based snake game. */
export function Culebrita({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Punto[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Punto>({ x: 1, y: 0 });
  const nextDirRef = useRef<Punto>({ x: 1, y: 0 });
  const foodRef = useRef<Punto>({ x: 14, y: 10 });
  const scoreRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const savingRef = useRef(false);

  const [modo, setModo] = useState<Modo>('clasico');
  const [score, setScore] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const velocidad = modo === 'veloz' ? 70 : 130;

  const colocarComida = useCallback(() => {
    let pos: Punto;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
    } while (snakeRef.current.some((s) => s.x === pos.x && s.y === pos.y));
    foodRef.current = pos;
  }, []);

  const dibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fondo
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, GRID * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(GRID * CELL, i * CELL);
      ctx.stroke();
    }
    // Comida
    const f = foodRef.current;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    // Serpiente
    snakeRef.current.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#22c55e' : '#16a34a';
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  const terminar = useCallback(
    (ganado: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (loopRef.current) clearInterval(loopRef.current);
      loopRef.current = null;
      setCorriendo(false);
      setGameOver(true);
      if (savingRef.current) return;
      savingRef.current = true;
      const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
      guardarPartidaJuegoAction({
        juego: 'culebrita',
        puntaje: scoreRef.current,
        nivel: 1,
        duracionSeg,
        ganado,
        atcGanado: 0, // v3.1.1: los juegos no dan ATC
        datos: { modo },
      })
        .then(() => {
          toast.info(`🐍 Partida registrada. Puntaje: ${scoreRef.current}`);
        })
        .catch(() => undefined)
        .finally(() => {
          savingRef.current = false;
        });
    },
    [modo]
  );

  const paso = useCallback(() => {
    const dir = nextDirRef.current;
    dirRef.current = dir;
    const cabeza = snakeRef.current[0];
    const nuevaCabeza = { x: cabeza.x + dir.x, y: cabeza.y + dir.y };

    // Paredes
    if (modo === 'paredes') {
      if (
        nuevaCabeza.x < 0 ||
        nuevaCabeza.x >= GRID ||
        nuevaCabeza.y < 0 ||
        nuevaCabeza.y >= GRID
      ) {
        terminar(false);
        return;
      }
    } else {
      // Clásico / veloz: atraviesa paredes
      nuevaCabeza.x = (nuevaCabeza.x + GRID) % GRID;
      nuevaCabeza.y = (nuevaCabeza.y + GRID) % GRID;
    }

    // Colisión con el propio cuerpo
    if (snakeRef.current.some((s) => s.x === nuevaCabeza.x && s.y === nuevaCabeza.y)) {
      terminar(false);
      return;
    }

    const nuevaSerpiente = [nuevaCabeza, ...snakeRef.current];
    // Comió?
    if (nuevaCabeza.x === foodRef.current.x && nuevaCabeza.y === foodRef.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      colocarComida();
    } else {
      nuevaSerpiente.pop();
    }
    snakeRef.current = nuevaSerpiente;
    dibujar();
  }, [modo, colocarComida, dibujar, terminar]);

  const iniciar = useCallback(() => {
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    scoreRef.current = 0;
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setScore(0);
    setGameOver(false);
    colocarComida();
    dibujar();
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(paso, velocidad);
    setCorriendo(true);
  }, [velocidad, colocarComida, dibujar, paso]);

  // Controles de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      const dir = dirRef.current;
      let nd: Punto | null = null;
      if ((k === 'arrowup' || k === 'w') && dir.y !== 1) nd = { x: 0, y: -1 };
      else if ((k === 'arrowdown' || k === 's') && dir.y !== -1) nd = { x: 0, y: 1 };
      else if ((k === 'arrowleft' || k === 'a') && dir.x !== 1) nd = { x: -1, y: 0 };
      else if ((k === 'arrowright' || k === 'd') && dir.x !== -1) nd = { x: 1, y: 0 };
      if (nd) {
        e.preventDefault();
        nextDirRef.current = nd;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Limpiar loop al desmontar
  useEffect(() => {
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, []);

  // Dibujo inicial
  useEffect(() => {
    dibujar();
  }, [dibujar]);

  // Cambiar modo: detener
  useEffect(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
      setCorriendo(false);
    }
  }, [modo]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <div className="space-y-1">
          <Label htmlFor="culebrita-modo" className="text-xs">
            Modo
          </Label>
          <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <SelectTrigger id="culebrita-modo" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clasico">Clásico (sin paredes)</SelectItem>
              <SelectItem value="paredes">Con paredes</SelectItem>
              <SelectItem value="veloz">Velocidad extrema</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="gap-1">
          🏆 {score} pts
        </Badge>
        <Badge variant="outline" className="gap-1">
          +{Math.floor(score / 10)} ATC
        </Badge>
      </div>

      <canvas
        ref={canvasRef}
        width={GRID * CELL}
        height={GRID * CELL}
        className="rounded-lg border-2 border-slate-700 shadow-lg max-w-full"
        aria-label="Tablero de culebrita"
      />

      <div className="flex flex-wrap items-center gap-2">
        {!corriendo && !gameOver && (
          <Button onClick={iniciar} className="gap-2">
            ▶️ Iniciar
          </Button>
        )}
        {corriendo && (
          <Button
            variant="outline"
            onClick={() => {
              if (loopRef.current) clearInterval(loopRef.current);
              loopRef.current = null;
              setCorriendo(false);
            }}
          >
            ⏸ Pausar
          </Button>
        )}
        {gameOver && (
          <Button onClick={iniciar} className="gap-2">
            🔄 Jugar de nuevo
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Salir
        </Button>
      </div>

      {gameOver && (
        <p className="text-sm font-medium text-center">
          🐍 ¡Game Over! Puntaje: <strong>{score}</strong> · ATC ganado:{' '}
          <strong>{Math.floor(score / 10)}</strong>
        </p>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-md">
        Usa las flechas o WASD para mover la serpiente. Come la manzana 🍎 para crecer y sumar
        puntos. Ganas 1 ATC por cada 10 puntos.
      </p>
    </div>
  );
}
