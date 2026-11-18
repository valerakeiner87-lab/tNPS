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
// 🔢 2048 — Juego de fusión numérica
// ============================================================
// Mecánica: flechas para mover todas las celdas en una dirección.
// Celdas iguales se fusionan. Cada fusión suma al score.
// Meta: llegar a 2048 (o más). Game over cuando no hay movimientos.

type Grid = number[][];
const SIZE = 4;

function crearGridVacio(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function agregarAzar(grid: Grid): Grid {
  const vacias: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) vacias.push([r, c]);
    }
  }
  if (vacias.length === 0) return grid;
  const [r, c] = vacias[Math.floor(Math.random() * vacias.length)];
  const nuevo = grid.map((row) => [...row]);
  nuevo[r][c] = Math.random() < 0.9 ? 2 : 4;
  return nuevo;
}

function nuevoJuego(): Grid {
  return agregarAzar(agregarAzar(crearGridVacio()));
}

function rotar(grid: Grid): Grid {
  // Rota 90° en sentido horario
  const nuevo = crearGridVacio();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      nuevo[c][SIZE - 1 - r] = grid[r][c];
    }
  }
  return nuevo;
}

function moverIzquierda(grid: Grid): { grid: Grid; ganadoPuntos: number; movido: boolean } {
  let ganadoPuntos = 0;
  let movido = false;
  const nuevo = grid.map((fila) => {
    // Filtrar no-ceros
    const filtrada = fila.filter((v) => v !== 0);
    // Fusionar
    const resultado: number[] = [];
    for (let i = 0; i < filtrada.length; i++) {
      if (i < filtrada.length - 1 && filtrada[i] === filtrada[i + 1]) {
        const fusion = filtrada[i] * 2;
        resultado.push(fusion);
        ganadoPuntos += fusion;
        i++; // saltar el siguiente
      } else {
        resultado.push(filtrada[i]);
      }
    }
    // Rellenar con ceros
    while (resultado.length < SIZE) resultado.push(0);
    if (resultado.some((v, i) => v !== fila[i])) movido = true;
    return resultado;
  });
  return { grid: nuevo, ganadoPuntos, movido };
}

function mover(grid: Grid, dir: 'izquierda' | 'derecha' | 'arriba' | 'abajo'): { grid: Grid; ganadoPuntos: number; movido: boolean } {
  let g = grid.map((f) => [...f]);
  let rotaciones = 0;
  if (dir === 'arriba') rotaciones = 3;
  else if (dir === 'derecha') rotaciones = 2;
  else if (dir === 'abajo') rotaciones = 1;

  for (let i = 0; i < rotaciones; i++) g = rotar(g);
  const res = moverIzquierda(g);
  let gFinal = res.grid;
  for (let i = 0; i < (4 - rotaciones) % 4; i++) gFinal = rotar(gFinal);
  return { grid: gFinal, ganadoPuntos: res.ganadoPuntos, movido: res.movido };
}

function hayMovimientos(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

const COLORS: Record<number, string> = {
  0: 'bg-muted/30 text-transparent',
  2: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
  4: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200',
  8: 'bg-orange-200 dark:bg-orange-900/60 text-orange-900 dark:text-orange-100',
  16: 'bg-orange-300 dark:bg-orange-800 text-orange-950 dark:text-orange-50',
  32: 'bg-red-300 dark:bg-red-900/60 text-red-950 dark:text-red-50',
  64: 'bg-red-400 dark:bg-red-800 text-red-950 dark:text-red-50',
  128: 'bg-yellow-400 dark:bg-yellow-700 text-yellow-950 dark:text-yellow-50',
  256: 'bg-yellow-500 dark:bg-yellow-600 text-yellow-950 dark:text-yellow-50',
  512: 'bg-emerald-400 dark:bg-emerald-700 text-emerald-950 dark:text-emerald-50',
  1024: 'bg-emerald-500 dark:bg-emerald-600 text-white',
  2048: 'bg-gradient-to-br from-claro-red to-claro-navy text-white',
  4096: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white',
};

export function Game2048({ onClose }: Props) {
  const [grid, setGrid] = useState<Grid>(nuevoJuego);
  const [score, setScore] = useState(0);
  const [mejorTile, setMejorTile] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [ganado, setGanado] = useState(false);
  const [yaGano2048, setYaGano2048] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const savingRef = useRef(false);
  const movimientosRef = useRef(0);

  const reiniciar = useCallback(() => {
    setGrid(nuevoJuego());
    setScore(0);
    setMejorTile(0);
    setGameOver(false);
    setGanado(false);
    setYaGano2048(false);
    startedAtRef.current = Date.now();
    movimientosRef.current = 0;
  }, []);

  const handleMover = useCallback((dir: 'izquierda' | 'derecha' | 'arriba' | 'abajo') => {
    if (gameOver) return;
    setGrid((gPrev) => {
      const res = mover(gPrev, dir);
      if (!res.movido) return gPrev;
      movimientosRef.current++;
      const nuevoGrid = agregarAzar(res.grid);
      const maxTile = Math.max(...nuevoGrid.flat());
      setScore((s) => s + res.ganadoPuntos);
      setMejorTile(maxTile);
      if (maxTile >= 2048 && !yaGano2048) {
        setYaGano2048(true);
        setGanado(true);
        // Guardar partida al alcanzar 2048
        if (!savingRef.current) {
          savingRef.current = true;
          const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
          guardarPartidaJuegoAction({
            juego: '2048',
            puntaje: score + res.ganadoPuntos,
            nivel: 1,
            duracionSeg,
            ganado: true,
            atcGanado: 0,
            datos: { maxTile, movimientos: movimientosRef.current, score: score + res.ganadoPuntos },
          })
            .then(() => toast.success(`🔢 ¡2048 alcanzado! Puntaje: ${score + res.ganadoPuntos}`))
            .catch(() => undefined)
            .finally(() => { savingRef.current = false; });
        }
      }
      if (!hayMovimientos(nuevoGrid)) {
        setGameOver(true);
        // Guardar partida al perder
        if (!savingRef.current) {
          savingRef.current = true;
          const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
          guardarPartidaJuegoAction({
            juego: '2048',
            puntaje: score + res.ganadoPuntos,
            nivel: 1,
            duracionSeg,
            ganado: maxTile >= 2048,
            atcGanado: 0,
            datos: { maxTile, movimientos: movimientosRef.current, scoreFinal: score + res.ganadoPuntos },
          })
            .then(() => toast.info(`🔢 Partida registrada. Puntaje: ${score + res.ganadoPuntos}`))
            .catch(() => undefined)
            .finally(() => { savingRef.current = false; });
        }
      }
      return nuevoGrid;
    });
  }, [gameOver, score, yaGano2048]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleMover('izquierda'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleMover('derecha'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); handleMover('arriba'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); handleMover('abajo'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMover]);

  // Touch swipe
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMover(dx > 0 ? 'derecha' : 'izquierda');
    } else {
      handleMover(dy > 0 ? 'abajo' : 'arriba');
    }
    touchStartRef.current = null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Trophy className="h-3 w-3" /> Puntaje: {score}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" /> Mejor: {mejorTile}
          </Badge>
          <Badge variant="outline">{movimientosRef.current} mov</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reiniciar} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </div>

      {/* Grid 4x4 */}
      <div
        className="grid grid-cols-4 gap-2 max-w-md mx-auto p-2 bg-muted/40 rounded-lg"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {grid.flat().map((val, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-md flex items-center justify-center font-bold text-xl sm:text-2xl transition-all duration-200 ${
              COLORS[val] || COLORS[4096]
            } ${val > 999 ? 'text-base sm:text-lg' : ''}`}
          >
            {val > 0 ? val : ''}
          </div>
        ))}
      </div>

      {/* Controles para móvil */}
      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto sm:hidden">
        <div></div>
        <Button variant="outline" onClick={() => handleMover('arriba')}>↑</Button>
        <div></div>
        <Button variant="outline" onClick={() => handleMover('izquierda')}>←</Button>
        <Button variant="outline" onClick={() => handleMover('abajo')}>↓</Button>
        <Button variant="outline" onClick={() => handleMover('derecha')}>→</Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Usa las flechas del teclado (o desliza en móvil) para mover las celdas. Celdas iguales se fusionan.
      </p>

      {ganado && !gameOver && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 text-center space-y-2">
          <p className="text-2xl">🎉 ¡Llegaste a 2048!</p>
          <p className="text-sm">Puntaje actual: <strong>{score}</strong>. ¿Hasta dónde puedes llegar?</p>
          <Button onClick={() => setGanado(false)} variant="outline">Seguir jugando</Button>
        </div>
      )}

      {gameOver && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 text-center space-y-2">
          <p className="text-2xl">💔 Game Over</p>
          <p className="text-sm">
            Puntaje final: <strong>{score}</strong> · Mejor celda: <strong>{mejorTile}</strong> · Movimientos: <strong>{movimientosRef.current}</strong>
          </p>
          <Button onClick={reiniciar} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Jugar de nuevo
          </Button>
        </div>
      )}
    </div>
  );
}
