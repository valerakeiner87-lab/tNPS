'use client';

import { useEffect, useState } from 'react';
import { Gamepad2, Loader2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { listarPartidasJuegoAction } from '@/app/actions/learning-actions';
import { Culebrita } from './juegos/culebrita';
import { Breakout } from './juegos/breakout';
import { Sudoku } from './juegos/sudoku';
import { Solitario } from './juegos/solitario';
import { Memory } from './juegos/memory';
import { Game2048 } from './juegos/game2048';

type JuegoId = 'culebrita' | 'breakout' | 'sudoku' | 'solitario' | 'memory' | '2048';

interface JuegoDef {
  id: JuegoId;
  emoji: string;
  titulo: string;
  descripcion: string;
  atcInfo: string;
}

const JUEGOS: JuegoDef[] = [
  {
    id: 'culebrita',
    emoji: '🐍',
    titulo: 'Culebrita',
    descripcion: 'Clásico juego de la serpiente. Come y crece sin chocar.',
    atcInfo: 'Juego de ocio — entretenimiento',
  },
  {
    id: 'breakout',
    emoji: '🧱',
    titulo: 'Breakout',
    descripcion: 'Rompe los ladrillos con la pelota.',
    atcInfo: 'Juego de ocio — entretenimiento',
  },
  {
    id: 'sudoku',
    emoji: '🔢',
    titulo: 'Sudoku',
    descripcion: 'Completa el sudoku con diferentes dificultades.',
    atcInfo: 'Juego de ocio — entretenimiento',
  },
  {
    id: 'solitario',
    emoji: '🃏',
    titulo: 'Solitario',
    descripcion: 'El clásico juego de cartas (Klondike).',
    atcInfo: 'Juego de ocio — entretenimiento',
  },
  {
    id: 'memory',
    emoji: '🧠',
    titulo: 'Memory',
    descripcion: 'Juego de memoria: encuentra las parejas. 4 niveles de dificultad.',
    atcInfo: 'Juego de memoria — entrena tu mente',
  },
  {
    id: '2048',
    emoji: '🎯',
    titulo: '2048',
    descripcion: 'Fusiona celdas iguales para llegar a 2048 (o más).',
    atcInfo: 'Juego de estrategia — adictivo',
  },
];

/** Vista principal de la zona de juegos. */
export function JuegosView() {
  const perfil = useStore((s) => s.perfil);
  const [juegoActivo, setJuegoActivo] = useState<JuegoId | null>(null);
  const [mejoresPuntajes, setMejoresPuntajes] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        // Cargar partidas del usuario actual para mostrar high score
        const partidas = await listarPartidasJuegoAction().catch(() => []);
        const mejores: Record<string, number> = {};
        for (const p of partidas as any[]) {
          const j = p.juego as string;
          const pts = Number(p.puntaje) || 0;
          if (!mejores[j] || pts > mejores[j]) mejores[j] = pts;
        }
        setMejoresPuntajes(mejores);
      } finally {
        setCargando(false);
      }
    })();
  }, [perfil?.loginNormalizado]);

  function cerrarJuego() {
    setJuegoActivo(null);
    // Recargar puntajes tras cerrar
    (async () => {
      const partidas = await listarPartidasJuegoAction().catch(() => []);
      const mejores: Record<string, number> = {};
      for (const p of partidas as any[]) {
        const j = p.juego as string;
        const pts = Number(p.puntaje) || 0;
        if (!mejores[j] || pts > mejores[j]) mejores[j] = pts;
      }
      setMejoresPuntajes(mejores);
    })();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold">Zona de juegos</p>
            <p className="text-xs text-muted-foreground">
              Juega por diversión en tu tiempo de ocio. Registra tu puntaje más alto!
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {JUEGOS.map((j) => {
          const high = mejoresPuntajes[j.id];
          return (
            <Card key={j.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-2">
                <div className="text-5xl mb-1" aria-hidden>
                  {j.emoji}
                </div>
                <CardTitle className="text-base">{j.titulo}</CardTitle>
                <CardDescription className="line-clamp-2">{j.descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 mt-auto space-y-2">
                <Badge variant="outline" className="text-[10px] gap-1 w-full justify-center">
                  🎮 {j.atcInfo}
                </Badge>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {high !== undefined ? `Mejor: ${high} pts` : 'Sin partidas aún'}
                </div>
                <Button className="w-full gap-2" onClick={() => setJuegoActivo(j.id)}>
                  ▶️ Jugar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {cargando && (
        <p className="text-xs text-muted-foreground text-center flex items-center gap-2 justify-center">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando tus mejores puntajes…
        </p>
      )}

      {/* === Dialog de juego (pantalla completa) === */}
      <Dialog open={!!juegoActivo} onOpenChange={(a) => !a && cerrarJuego()}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {juegoActivo && (
                <>
                  <span className="text-2xl">{JUEGOS.find((j) => j.id === juegoActivo)?.emoji}</span>
                  {JUEGOS.find((j) => j.id === juegoActivo)?.titulo}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Cierra el diálogo para volver a la zona de juegos. Tu progreso se guarda
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {juegoActivo === 'culebrita' && <Culebrita onClose={cerrarJuego} />}
            {juegoActivo === 'breakout' && <Breakout onClose={cerrarJuego} />}
            {juegoActivo === 'sudoku' && <Sudoku onClose={cerrarJuego} />}
            {juegoActivo === 'solitario' && <Solitario onClose={cerrarJuego} />}
            {juegoActivo === 'memory' && <Memory onClose={cerrarJuego} />}
            {juegoActivo === '2048' && <Game2048 onClose={cerrarJuego} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
