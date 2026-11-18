'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { guardarPartidaJuegoAction } from '@/app/actions/learning-actions';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

const W = 480;
const H = 360;
const PADDLE_W = 80;
const PADDLE_H = 12;
const BRICK_ROWS = 4;
const BRICK_COLS = 9;
const BRICK_H = 16;
const BRICK_GAP = 4;
const BRICK_TOP = 40;
const BALL_R = 7;

type PowerUp = 'normal' | 'paddle_grande' | 'multiball' | 'slow';

/** 🧱 Breakout — minimal canvas-based. */
export function Breakout({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nivel, setNivel] = useState(1);
  const [score, setScore] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ganado, setGanado] = useState(false);

  // Refs para mantener estado entre loops
  const stateRef = useRef({
    paddleX: (W - PADDLE_W) / 2,
    ball: { x: W / 2, y: H - 40, vx: 3, vy: -3 },
    balls: [{ x: W / 2, y: H - 40, vx: 3, vy: -3 }] as Array<{ x: number; y: number; vx: number; vy: number }>,
    bricks: [] as Array<{ x: number; y: number; vivo: boolean; powerUp: PowerUp }>,
    powerUpActivo: 'normal' as PowerUp,
    paddleW: PADDLE_W,
    keys: { left: false, right: false },
    score: 0,
    nivel: 1,
    startedAt: Date.now(),
    ended: false,
    saving: false,
  });

  const initBricks = useCallback((nivelN: number) => {
    const bricks: Array<{ x: number; y: number; vivo: boolean; powerUp: PowerUp }> = [];
    const offsetTop = BRICK_TOP;
    const totalW = W - 40;
    const brickW = (totalW - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        // 1 de cada 6 ladrillos tendrá un power-up
        const esPowerUp = Math.random() < 0.16;
        const pu: PowerUp = esPowerUp
          ? (['paddle_grande', 'multiball', 'slow'] as PowerUp[])[Math.floor(Math.random() * 3)]
          : 'normal';
        bricks.push({
          x: 20 + c * (brickW + BRICK_GAP),
          y: offsetTop + r * (BRICK_H + BRICK_GAP),
          vivo: true,
          powerUp: pu,
        });
      }
    }
    return bricks;
  }, []);

  const nivelVelocidad = useCallback((n: number) => 3 + (n - 1) * 0.8, []);

  const iniciar = useCallback(
    (nivelN: number = 1) => {
      const s = stateRef.current;
      s.paddleX = (W - PADDLE_W) / 2;
      s.paddleW = PADDLE_W;
      const v = nivelVelocidad(nivelN);
      s.balls = [{ x: W / 2, y: H - 40, vx: v, vy: -v }];
      s.bricks = initBricks(nivelN);
      s.powerUpActivo = 'normal';
      s.score = nivelN === 1 ? 0 : s.score;
      s.nivel = nivelN;
      s.startedAt = Date.now();
      s.ended = false;
      setNivel(nivelN);
      setScore(s.score);
      setGameOver(false);
      setGanado(false);
      setCorriendo(true);
    },
    [initBricks, nivelVelocidad]
  );

  const dibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    // Fondo
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Ladrillos
    s.bricks.forEach((b) => {
      if (!b.vivo) return;
      const brickW = (W - 40 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
      let color = '#3b82f6';
      if (b.powerUp === 'paddle_grande') color = '#a855f7';
      else if (b.powerUp === 'multiball') color = '#22c55e';
      else if (b.powerUp === 'slow') color = '#f59e0b';
      ctx.fillStyle = color;
      ctx.fillRect(b.x, b.y, brickW, BRICK_H);
    });

    // Paddle
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(s.paddleX, H - 20, s.paddleW, PADDLE_H);

    // Pelotas
    s.balls.forEach((ball) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    });

    // Power-up activo
    if (s.powerUpActivo !== 'normal') {
      ctx.fillStyle = '#fde68a';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Power-up: ${s.powerUpActivo}`, 8, 16);
    }
  }, []);

  const terminar = useCallback(
    (gano: boolean) => {
      const s = stateRef.current;
      if (s.ended) return;
      s.ended = true;
      setCorriendo(false);
      setGameOver(true);
      setGanado(gano);
      if (s.saving) return;
      s.saving = true;
      const duracionSeg = Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000));
      guardarPartidaJuegoAction({
        juego: 'breakout',
        puntaje: s.score,
        nivel: s.nivel,
        duracionSeg,
        ganado: gano,
        atcGanado: 0, // v3.1.1: los juegos no dan ATC
        datos: { powerUp: s.powerUpActivo },
      })
        .then(() => {
          toast.info(`🧱 Partida registrada. Puntaje: ${s.score}`);
        })
        .catch(() => undefined)
        .finally(() => {
          s.saving = false;
        });
    },
    []
  );

  // Loop de animación
  useEffect(() => {
    if (!corriendo) return;
    let raf = 0;
    function tick() {
      const s = stateRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Mover paddle
      if (s.keys.left) s.paddleX = Math.max(0, s.paddleX - 7);
      if (s.keys.right) s.paddleX = Math.min(W - s.paddleW, s.paddleX + 7);

      const factorLento = s.powerUpActivo === 'slow' ? 0.6 : 1;

      // Mover pelotas
      const nuevasBalls: Array<{ x: number; y: number; vx: number; vy: number }> = [];
      for (const ball of s.balls) {
        let nx = ball.x + ball.vx * factorLento;
        let ny = ball.y + ball.vy * factorLento;
        let nvx = ball.vx;
        let nvy = ball.vy;

        // Paredes
        if (nx < BALL_R) {
          nx = BALL_R;
          nvx = Math.abs(nvx);
        } else if (nx > W - BALL_R) {
          nx = W - BALL_R;
          nvx = -Math.abs(nvx);
        }
        if (ny < BALL_R) {
          ny = BALL_R;
          nvy = Math.abs(nvy);
        }

        // Paddle
        if (
          ny + BALL_R >= H - 20 &&
          ny + BALL_R <= H - 20 + PADDLE_H &&
          nx >= s.paddleX &&
          nx <= s.paddleX + s.paddleW &&
          nvy > 0
        ) {
          nvy = -Math.abs(nvy);
          // Pequeño ángulo según donde golpea
          const hit = (nx - s.paddleX) / s.paddleW; // 0..1
          nvx = (hit - 0.5) * 8;
        }

        // Suelo (pelota perdida)
        if (ny > H + BALL_R) {
          continue; // No agregar a nuevasBalls = eliminada
        }

        // Ladrillos
        const brickW = (W - 40 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
        for (const b of s.bricks) {
          if (!b.vivo) continue;
          if (
            nx + BALL_R >= b.x &&
            nx - BALL_R <= b.x + brickW &&
            ny + BALL_R >= b.y &&
            ny - BALL_R <= b.y + BRICK_H
          ) {
            b.vivo = false;
            s.score += 10;
            setScore(s.score);
            nvy = -nvy;
            // Power-up
            if (b.powerUp === 'paddle_grande') {
              s.paddleW = PADDLE_W * 1.5;
              s.powerUpActivo = 'paddle_grande';
            } else if (b.powerUp === 'slow') {
              s.powerUpActivo = 'slow';
            } else if (b.powerUp === 'multiball') {
              // Duplica la pelota
              nuevasBalls.push({ x: nx, y: ny, vx: -nvx, vy: nvy });
              s.powerUpActivo = 'multiball';
            }
            break;
          }
        }

        nuevasBalls.push({ x: nx, y: ny, vx: nvx, vy: nvy });
      }
      s.balls = nuevasBalls;

      // Si no quedan pelotas, game over
      if (s.balls.length === 0) {
        terminar(false);
        return;
      }

      // ¿Nivel completado?
      if (s.bricks.every((b) => !b.vivo)) {
        if (s.nivel < 3) {
          // Avanzar al siguiente nivel
          s.nivel += 1;
          setNivel(s.nivel);
          const v = nivelVelocidad(s.nivel);
          s.balls = [{ x: W / 2, y: H - 40, vx: v, vy: -v }];
          s.bricks = initBricks(s.nivel);
          s.powerUpActivo = 'normal';
          s.paddleW = PADDLE_W;
          toast.info(`🧱 ¡Nivel ${s.nivel}! Más rápido…`);
        } else {
          terminar(true);
          return;
        }
      }

      dibujar();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [corriendo, dibujar, initBricks, nivelVelocidad, terminar]);

  // Controles
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') stateRef.current.keys.left = true;
      if (k === 'arrowright' || k === 'd') stateRef.current.keys.right = true;
    }
    function up(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') stateRef.current.keys.left = false;
      if (k === 'arrowright' || k === 'd') stateRef.current.keys.right = false;
    }
    function mouse(e: MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      stateRef.current.paddleX = Math.max(0, Math.min(W - stateRef.current.paddleW, x - stateRef.current.paddleW / 2));
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousemove', mouse);
    }
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (canvas) canvas.removeEventListener('mousemove', mouse);
    };
  }, []);

  // Dibujar al montar
  useEffect(() => {
    dibujar();
  }, [dibujar]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <Badge variant="outline">Nivel {nivel} / 3</Badge>
        <Badge variant="outline" className="gap-1">
          🏆 {score} pts
        </Badge>
        <Badge variant="outline" className="gap-1">
          +{ganado ? 2 * nivel : 0} ATC
        </Badge>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border-2 border-slate-700 shadow-lg max-w-full"
        aria-label="Tablero de breakout"
      />

      <div className="flex flex-wrap items-center gap-2">
        {!corriendo && !gameOver && (
          <Button onClick={() => iniciar(1)} className="gap-2">
            ▶️ Iniciar
          </Button>
        )}
        {gameOver && (
          <Button onClick={() => iniciar(1)} className="gap-2">
            🔄 Jugar de nuevo
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Salir
        </Button>
      </div>

      {gameOver && (
        <p className="text-sm font-medium text-center">
          {ganado ? '🎉 ¡Ganaste!' : '💀 Game Over'} · Puntaje: <strong>{score}</strong> · ATC:{' '}
          <strong>{ganado ? 2 * nivel : 0}</strong>
        </p>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-md">
        Mueve la paleta con ← → / A D o con el mouse. Rompe todos los ladrillos para avanzar de
        nivel. 3 niveles con dificultad creciente. Power-ups: paddle grande 🟣, multiball 🟢,
        slow ⚠️. Ganas 2 ATC por nivel completado.
      </p>
    </div>
  );
}
