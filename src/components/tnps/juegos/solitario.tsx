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

type Palo = '♠' | '♥' | '♦' | '♣';
type Color = 'negro' | 'rojo';
interface Carta {
  id: string;
  valor: number; // 1=A, 11=J, 12=Q, 13=K
  palo: Palo;
  color: Color;
  bocaArriba: boolean;
}

type Dificultad = '1carta' | '3cartas' | 'vegas';

const PALOS: Palo[] = ['♠', '♥', '♦', '♣'];

function colorPalo(p: Palo): Color {
  return p === '♥' || p === '♦' ? 'rojo' : 'negro';
}

function crearMazo(): Carta[] {
  const mazo: Carta[] = [];
  for (const p of PALOS) {
    for (let v = 1; v <= 13; v++) {
      mazo.push({
        id: `${p}-${v}`,
        valor: v,
        palo: p,
        color: colorPalo(p),
        bocaArriba: false,
      });
    }
  }
  // Shuffle
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo;
}

function etiquetaValor(v: number): string {
  if (v === 1) return 'A';
  if (v === 11) return 'J';
  if (v === 12) return 'Q';
  if (v === 13) return 'K';
  return String(v);
}

/** Solitario (Klondike) minimal. */
export function Solitario({ onClose }: Props) {
  const [dificultad, setDificultad] = useState<Dificultad>('1carta');
  const [tableau, setTableau] = useState<Carta[][]>([]);
  const [fundaciones, setFundaciones] = useState<Carta[][]>([[], [], [], []]);
  const [stock, setStock] = useState<Carta[]>([]);
  const [waste, setWaste] = useState<Carta[]>([]);
  const [seleccion, setSeleccion] = useState<{ origen: string; idx: number; cartas: Carta[] } | null>(null);
  const [movimientos, setMovimientos] = useState(0);
  const [ganado, setGanado] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());

  const iniciar = useCallback((d: Dificultad) => {
    const mazo = crearMazo();
    const t: Carta[][] = [[], [], [], [], [], [], []];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let r = 0; r <= col; r++) {
        const carta = mazo[idx++];
        carta.bocaArriba = r === col; // La última boca arriba
        t[col].push(carta);
      }
    }
    const restantes = mazo.slice(idx);
    setTableau(t);
    setFundaciones([[], [], [], []]);
    setStock(restantes);
    setWaste([]);
    setSeleccion(null);
    setMovimientos(0);
    setGanado(false);
    setStartedAt(Date.now());
    setDificultad(d);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    iniciar('1carta');
  }, []);

  const robarStock = useCallback(() => {
    if (stock.length === 0) {
      // Reciclar waste
      if (waste.length === 0) return;
      setStock(waste.slice().reverse().map((c) => ({ ...c, bocaArriba: false })));
      setWaste([]);
      setMovimientos((m) => m + 1);
      return;
    }
    const n = dificultad === '1carta' ? 1 : 3;
    const robadas = stock.slice(-n).reverse().map((c) => ({ ...c, bocaArriba: true }));
    setStock(stock.slice(0, -n));
    setWaste([...waste, ...robadas]);
    setMovimientos((m) => m + 1);
  }, [stock, waste, dificultad]);

  /** Selecciona cartas desde una columna del tableau o waste/fundación. */
  const seleccionar = useCallback(
    (origen: string, idx: number, cartas: Carta[]) => {
      if (cartas.length === 0) return;
      // Solo se pueden mover grupos boca arriba del tableau
      if (origen.startsWith('tab') && !cartas[0].bocaArriba) return;
      setSeleccion({ origen, idx, cartas });
    },
    []
  );

  const limpiarSeleccion = useCallback(() => setSeleccion(null), []);

  const cumpleFundacion = (carta: Carta, fundacion: Carta[]): boolean => {
    if (fundacion.length === 0) return carta.valor === 1;
    const top = fundacion[fundacion.length - 1];
    return top.palo === carta.palo && carta.valor === top.valor + 1;
  };

  const cumpleTableau = (carta: Carta, destino: Carta[]): boolean => {
    if (destino.length === 0) return carta.valor === 13; // Solo K en casilla vacía
    const top = destino[destino.length - 1];
    if (!top.bocaArriba) return false;
    return top.color !== carta.color && carta.valor === top.valor - 1;
  };

  /** Mueve la selección al destino indicado. */
  const mover = useCallback(
    (destino: string) => {
      if (!seleccion) return;
      const { origen, idx, cartas } = seleccion;
      const cabeza = cartas[0];

      // Mismo origen → cancelar
      if (origen === destino) {
        limpiarSeleccion();
        return;
      }

      // === Validar destino ===
      let valido = false;
      let nuevasFundaciones = fundaciones.map((f) => [...f]);
      let nuevoTableau = tableau.map((t) => [...t]);
      let nuevoWaste = [...waste];
      let nuevoStock = [...stock];

      if (destino.startsWith('fund')) {
        const fi = Number(destino.slice(4));
        // Solo 1 carta a la fundación
        if (cartas.length !== 1) {
          toast.error('Solo puedes mover una carta a la fundación.');
          limpiarSeleccion();
          return;
        }
        if (!cumpleFundacion(cabeza, nuevasFundaciones[fi])) {
          toast.error('Movimiento inválido a la fundación.');
          limpiarSeleccion();
          return;
        }
        nuevasFundaciones[fi] = [...nuevasFundaciones[fi], cabeza];
        valido = true;
      } else if (destino.startsWith('tab')) {
        const ti = Number(destino.slice(3));
        if (!cumpleTableau(cabeza, nuevoTableau[ti])) {
          toast.error('Movimiento inválido al tableau.');
          limpiarSeleccion();
          return;
        }
        nuevoTableau[ti] = [...nuevoTableau[ti], ...cartas];
        valido = true;
      } else {
        limpiarSeleccion();
        return;
      }

      // === Remover del origen ===
      if (origen.startsWith('tab')) {
        const ti = Number(origen.slice(3));
        nuevoTableau[ti] = nuevoTableau[ti].slice(0, idx);
        // Voltear la última carta del origen si está boca abajo
        const ultima = nuevoTableau[ti][nuevoTableau[ti].length - 1];
        if (ultima && !ultima.bocaArriba) {
          ultima.bocaArriba = true;
        }
      } else if (origen === 'waste') {
        nuevoWaste = nuevoWaste.slice(0, -1);
      } else if (origen.startsWith('fund')) {
        const fi = Number(origen.slice(4));
        nuevasFundaciones[fi] = nuevasFundaciones[fi].slice(0, -1);
      }

      if (!valido) {
        limpiarSeleccion();
        return;
      }

      setFundaciones(nuevasFundaciones);
      setTableau(nuevoTableau);
      setWaste(nuevoWaste);
      setStock(nuevoStock);
      setMovimientos((m) => m + 1);
      limpiarSeleccion();

      // ¿Victoria? Todas las cartas en fundaciones
      const total = nuevasFundaciones.reduce((s, f) => s + f.length, 0);
      if (total === 52) {
        setGanado(true);
        const duracionSeg = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
        guardarPartidaJuegoAction({
          juego: 'solitario',
          puntaje: Math.max(0, 1000 - movimientos * 5),
          nivel: dificultad === '1carta' ? 1 : dificultad === '3cartas' ? 2 : 3,
          duracionSeg,
          ganado: true,
          atcGanado: 0, // v3.1.1: los juegos no dan ATC
          datos: { dificultad, movimientos: movimientos + 1 },
        })
          .then(() => {
            toast.success(`🃏 ¡Solitario completado!`);
          })
          .catch(() => undefined);
      }
    },
    [seleccion, fundaciones, tableau, waste, stock, movimientos, dificultad, startedAt, limpiarSeleccion]
  );

  const totalFundaciones = useMemo(
    () => fundaciones.reduce((s, f) => s + f.length, 0),
    [fundaciones]
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <div className="space-y-1">
          <Label htmlFor="sol-dificultad" className="text-xs">
            Dificultad
          </Label>
          <Select
            value={dificultad}
            onValueChange={(v) => iniciar(v as Dificultad)}
          >
            <SelectTrigger id="sol-dificultad" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1carta">Roba 1 carta</SelectItem>
              <SelectItem value="3cartas">Roba 3 cartas</SelectItem>
              <SelectItem value="vegas">Modo Vegas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline">Movimientos: {movimientos}</Badge>
        <Badge variant="outline">{totalFundaciones} / 52 en fundación</Badge>
        <Badge variant="outline" className="gap-1">
          +{ganado ? 15 : 0} ATC
        </Badge>
      </div>

      {/* Fila superior: stock, waste, fundaciones */}
      <div className="flex items-start gap-2 flex-wrap justify-center">
        {/* Stock */}
        <button
          type="button"
          onClick={robarStock}
          className={cn(
            'h-20 w-14 rounded-md border-2 border-slate-700 flex items-center justify-center text-2xl text-slate-400 hover:bg-slate-700/40 transition-colors',
            stock.length === 0 && 'bg-slate-800/60'
          )}
          title="Click para robar"
          aria-label="Mazo"
        >
          {stock.length > 0 ? '🂠' : '↻'}
        </button>
        {/* Waste */}
        <div
          className={cn(
            'h-20 w-14 rounded-md border-2 border-slate-700 flex items-center justify-center cursor-pointer',
            waste.length > 0 ? 'bg-white' : 'bg-slate-800/60',
            seleccion?.origen === 'waste' && 'ring-2 ring-amber-400'
          )}
          onClick={() => {
            const top = waste[waste.length - 1];
            if (top) seleccionar('waste', waste.length - 1, [top]);
          }}
        >
          {waste.length > 0 && (
            <CartaVista carta={waste[waste.length - 1]} />
          )}
        </div>

        <div className="w-4" />

        {/* Fundaciones */}
        {fundaciones.map((f, i) => (
          <div
            key={i}
            onClick={() => {
              if (seleccion) mover(`fund${i}`);
            }}
            className={cn(
              'h-20 w-14 rounded-md border-2 border-slate-700 flex items-center justify-center cursor-pointer',
              f.length === 0 ? 'bg-slate-800/60 text-slate-500' : 'bg-white',
              seleccion && 'hover:ring-2 hover:ring-amber-400'
            )}
          >
            {f.length === 0 ? (
              <span className="text-2xl opacity-40">A</span>
            ) : (
              <CartaVista carta={f[f.length - 1]} />
            )}
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="flex items-start gap-2 flex-wrap justify-center">
        {tableau.map((col, ci) => (
          <div
            key={ci}
            onClick={() => {
              if (seleccion) mover(`tab${ci}`);
            }}
            className={cn(
              'w-14 min-h-[80px] rounded-md border-2 border-slate-700 relative cursor-pointer flex flex-col items-center',
              col.length === 0 && 'bg-slate-800/60',
              seleccion && 'hover:ring-2 hover:ring-amber-400'
            )}
          >
            {col.length === 0 && (
              <span className="text-2xl opacity-40 mt-4">K</span>
            )}
            {col.map((carta, i) => {
              const seleccionada =
                seleccion?.origen === `tab${ci}` && i >= seleccion.idx;
              return (
                <div
                  key={carta.id}
                  className={cn(
                    'absolute w-14 rounded-md',
                    seleccionada && 'ring-2 ring-amber-400 z-10'
                  )}
                  style={{ top: i * 18 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (carta.bocaArriba) {
                      seleccionar(`tab${ci}`, i, col.slice(i));
                    } else if (i === col.length - 1) {
                      // Voltear si es la última
                      const nuevo = tableau.map((t, ti) =>
                        ti === ci
                          ? t.map((c, ci2) =>
                              ci2 === i ? { ...c, bocaArriba: true } : c
                            )
                          : t
                      );
                      setTableau(nuevo);
                    }
                  }}
                >
                  <CartaVista carta={carta} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => iniciar(dificultad)} className="gap-2">
          🔄 Nuevo juego
        </Button>
        {seleccion && (
          <Button variant="outline" onClick={limpiarSeleccion}>
            Cancelar selección
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Salir
        </Button>
      </div>

      {ganado && (
        <p className="text-sm font-medium text-center text-promotor">
          🎉 ¡Solitario completado en {movimientos} movimientos! Ganaste <strong>15 ATC</strong>.
        </p>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-md">
        Click en una carta boca arriba para seleccionarla (y las que tenga encima). Luego click en
        una fundación o columna del tableau para moverla. Click en el mazo para robar. Llena las 4
        fundaciones (A→K del mismo palo) para ganar 15 ATC.
      </p>
    </div>
  );
}

function CartaVista({ carta }: { carta: Carta }) {
  if (!carta.bocaArriba) {
    return (
      <div className="h-20 w-14 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-slate-500 text-xl">
        🂠
      </div>
    );
  }
  const etiqueta = etiquetaValor(carta.valor);
  const color = carta.color === 'rojo' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="h-20 w-14 rounded-md bg-white border border-slate-300 flex flex-col items-start justify-between p-1 shadow-sm">
      <div className={cn('text-xs font-bold leading-none', color)}>
        {etiqueta}
        <br />
        {carta.palo}
      </div>
      <div className={cn('text-xl leading-none self-center', color)}>{carta.palo}</div>
      <div className={cn('text-xs font-bold leading-none self-end rotate-180', color)}>
        {etiqueta}
        <br />
        {carta.palo}
      </div>
    </div>
  );
}
