'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

type Dificultad = 'facil' | 'medio' | 'dificil';

const SIZE: Record<Dificultad, number> = { facil: 4, medio: 9, dificil: 9 };
const ATC: Record<Dificultad, number> = { facil: 5, medio: 10, dificil: 20 };

/** Genera un sudoku completo y válido (backtracking). Tamaño 4x4 o 9x9. */
function generarSolucion(size: number): number[][] {
  const base = size === 4 ? 2 : 3; // raíz cuadrada
  const sol: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  function validar(r: number, c: number, n: number): boolean {
    for (let i = 0; i < size; i++) {
      if (sol[r][i] === n || sol[i][c] === n) return false;
    }
    const br = Math.floor(r / base) * base;
    const bc = Math.floor(c / base) * base;
    for (let i = 0; i < base; i++) {
      for (let j = 0; j < base; j++) {
        if (sol[br + i][bc + j] === n) return false;
      }
    }
    return true;
  }
  function resolver(): boolean {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (sol[r][c] === 0) {
          const nums = [...Array(size)].map((_, i) => i + 1).sort(() => Math.random() - 0.5);
          for (const n of nums) {
            if (validar(r, c, n)) {
              sol[r][c] = n;
              if (resolver()) return true;
              sol[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  resolver();
  return sol;
}

/** Quita celdas según la dificultad para crear el puzzle inicial. */
function crearPuzzle(sol: number[][], dificultad: Dificultad): { inicial: boolean[][]; tablero: number[][] } {
  const size = sol.length;
  const quitar = dificultad === 'facil' ? 0.4 : dificultad === 'medio' ? 0.55 : 0.7;
  const tablero = sol.map((r) => [...r]);
  const inicial = Array.from({ length: size }, () => Array(size).fill(true));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (Math.random() < quitar) {
        tablero[r][c] = 0;
        inicial[r][c] = false;
      }
    }
  }
  return { inicial, tablero };
}

/** Sudoku — variantes 4x4 (fácil) y 9x9 (medio/difícil). */
export function Sudoku({ onClose }: Props) {
  const [dificultad, setDificultad] = useState<Dificultad>('facil');
  const [size, setSize] = useState<number>(4);
  const [solucion, setSolucion] = useState<number[][]>([]);
  const [tablero, setTablero] = useState<number[][]>([]);
  const [inicial, setInicial] = useState<boolean[][]>([]);
  const [celdasConflictivas, setCeldasConflictivas] = useState<Set<string>>(new Set());
  const [completado, setCompletado] = useState(false);
  const [empezo, setEmpezo] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());

  const iniciar = useCallback((d: Dificultad) => {
    const s = SIZE[d];
    const sol = generarSolucion(s);
    const { inicial, tablero } = crearPuzzle(sol, d);
    setDificultad(d);
    setSize(s);
    setSolucion(sol);
    setTablero(tablero);
    setInicial(inicial);
    setCeldasConflictivas(new Set());
    setCompletado(false);
    setEmpezo(true);
    setStartedAt(Date.now());
  }, []);

  const calcularConflictos = useCallback((tab: number[][]) => {
    const set = new Set<string>();
    const size = tab.length;
    const base = size === 4 ? 2 : 3;
    // Filas y columnas
    for (let r = 0; r < size; r++) {
      const filas: Record<number, number[]> = {};
      const cols: Record<number, number[]> = {};
      for (let c = 0; c < size; c++) {
        const v = tab[r][c];
        if (v !== 0) {
          (filas[v] = filas[v] || []).push(c);
        }
        const v2 = tab[c][r];
        if (v2 !== 0) {
          (cols[v2] = cols[v2] || []).push(c);
        }
      }
      Object.values(filas).forEach((cs) => {
        if (cs.length > 1) cs.forEach((c) => set.add(`${r},${c}`));
      });
      Object.values(cols).forEach((rs) => {
        if (rs.length > 1) rs.forEach((r) => set.add(`${r},${r}`));
      });
    }
    // Cajas
    for (let br = 0; br < size; br += base) {
      for (let bc = 0; bc < size; bc += base) {
        const vistos: Record<number, Array<[number, number]>> = {};
        for (let r = 0; r < base; r++) {
          for (let c = 0; c < base; c++) {
            const v = tab[br + r][bc + c];
            if (v !== 0) {
              (vistos[v] = vistos[v] || []).push([br + r, bc + c]);
            }
          }
        }
        Object.values(vistos).forEach((cells) => {
          if (cells.length > 1) cells.forEach(([r, c]) => set.add(`${r},${c}`));
        });
      }
    }
    return set;
  }, []);

  const setValor = useCallback(
    (r: number, c: number, v: number) => {
      if (inicial[r][c] || completado) return;
      setTablero((prev) => {
        const nuevo = prev.map((row) => [...row]);
        nuevo[r][c] = v;
        const conflictos = calcularConflictos(nuevo);
        setCeldasConflictivas(conflictos);
        // ¿Completado correctamente?
        const lleno = nuevo.every((row) => row.every((x) => x !== 0));
        if (lleno && conflictos.size === 0) {
          setCompletado(true);
          const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
          guardarPartidaJuegoAction({
            juego: 'sudoku',
            puntaje: ATC[dificultad] * 10,
            nivel: dificultad === 'facil' ? 1 : dificultad === 'medio' ? 2 : 3,
            duracionSeg,
            ganado: true,
            atcGanado: 0, // v3.1.1: los juegos no dan ATC
            datos: { dificultad, size: nuevo.length },
          })
            .then(() => {
              toast.success(`🔢 ¡Sudoku completado!`);
            })
            .catch(() => undefined);
        }
        return nuevo;
      });
    },
    [inicial, completado, calcularConflictos, dificultad, startedAt]
  );

  const numeros = useMemo(() => Array.from({ length: size }, (_, i) => i + 1), [size]);
  const base = size === 4 ? 2 : 3;

  // Iniciar al montar (solo la primera vez)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    iniciar('facil');
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <div className="space-y-1">
          <Label htmlFor="sudoku-dificultad" className="text-xs">
            Dificultad
          </Label>
          <Select
            value={dificultad}
            onValueChange={(v) => iniciar(v as Dificultad)}
          >
            <SelectTrigger id="sudoku-dificultad" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facil">Fácil (4x4) · +{ATC.facil} ATC</SelectItem>
              <SelectItem value="medio">Medio (9x9) · +{ATC.medio} ATC</SelectItem>
              <SelectItem value="dificil">Difícil (9x9) · +{ATC.dificil} ATC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline">+{ATC[dificultad]} ATC al completar</Badge>
      </div>

      <div
        className="grid bg-slate-800 p-1 rounded-lg shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gap: '2px',
        }}
      >
        {tablero.map((row, r) =>
          row.map((v, c) => {
            const esInicial = inicial[r]?.[c];
            const conflictiva = celdasConflictivas.has(`${r},${c}`);
            const bordeDerecho = (c + 1) % base === 0 && c + 1 < size;
            const bordeAbajo = (r + 1) % base === 0 && r + 1 < size;
            return (
              <button
                key={`${r},${c}`}
                type="button"
                disabled={esInicial || completado}
                onClick={() => {
                  // Click: incrementa el valor
                  const siguiente = v === 0 ? 1 : v >= size ? 0 : v + 1;
                  setValor(r, c, siguiente);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!esInicial) setValor(r, c, 0);
                }}
                className={cn(
                  'flex items-center justify-center font-semibold tabular-nums transition-colors',
                  'hover:bg-slate-600',
                  esInicial
                    ? 'bg-slate-900 text-white cursor-not-allowed'
                    : 'bg-slate-700 text-amber-300 cursor-pointer',
                  conflictiva && 'bg-red-700 text-white',
                  size === 4 ? 'h-12 w-12 text-2xl' : 'h-8 w-8 sm:h-9 sm:w-9 text-sm',
                  bordeDerecho && 'mr-1',
                  bordeAbajo && 'mb-1'
                )}
                title={esInicial ? 'Valor inicial' : 'Click para incrementar · Click derecho para borrar'}
              >
                {v !== 0 ? v : ''}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => iniciar(dificultad)} className="gap-2">
          🔄 Nuevo sudoku
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Salir
        </Button>
      </div>

      {completado && (
        <p className="text-sm font-medium text-center text-promotor">
          🎉 ¡Sudoku completo! Ganaste <strong>{ATC[dificultad]} ATC</strong>.
        </p>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-md">
        Click en una celda para incrementar el valor (0 → 1 → 2 → … → vacío). Click derecho para
        borrar. Las celdas en rojo tienen conflictos. Completa sin conflictos para ganar ATC.
      </p>
    </div>
  );
}
