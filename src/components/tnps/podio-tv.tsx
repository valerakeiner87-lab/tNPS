'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { AsesorAvatar } from './asesor-avatar';
import { cn } from '@/lib/utils';

interface Slide {
  tipo: 'top-tnps' | 'mejorar' | 'premios';
  titulo: string;
  subtitulo: string;
}

const SLIDES: Slide[] = [
  { tipo: 'top-tnps', titulo: '🏆 Top tNPS del Día', subtitulo: 'Mejores asesores por área' },
  { tipo: 'mejorar', titulo: '📈 Para Mejorar', subtitulo: 'Asesores con tNPS por debajo de 70' },
  { tipo: 'premios', titulo: '🎁 Premios Vigentes', subtitulo: 'Catálogo de premios disponibles' },
];

const SLIDE_DURATION = 8000; // 8 segundos por slide

export function PodioTV() {
  const perfil = useStore((s) => s.perfil);
  const areaActiva = useStore((s) => s.areaActiva);
  const encuestas = useStore((s) => s.encuestasFiltradas);
  const asesoresConsolidados = useStore((s) => s.asesoresConsolidados);
  const atc = useATCStore();
  const { premios, wallets } = atc;

  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrar por área activa
  const encuestasArea = encuestas.filter((e) => (e.area ?? 'digital') === areaActiva);
  const asesoresArea = asesoresConsolidados.filter((a) => {
    const asesorEncuestas = encuestasArea.filter((e) => e.loginNormalizado === a.loginNormalizado);
    return asesorEncuestas.length > 0;
  });

  // Top tNPS del día — v3.0.7: priorizar más encuestas + mejor tNPS
  // score = encuestas * 100 + tnps
  const topTnps = [...asesoresArea]
    .sort((a, b) => {
      const sa = a.kpis.total * 100 + a.kpis.tNPS;
      const sb = b.kpis.total * 100 + b.kpis.tNPS;
      return sb - sa;
    })
    .slice(0, 10);

  // Asesores por mejorar (tNPS < 70) — v3.0.7: mismo criterio (más encuestas primero)
  const paraMejorar = asesoresArea
    .filter((a) => a.kpis.tNPS < 70)
    .sort((a, b) => {
      const sa = a.kpis.total * 100 + a.kpis.tNPS;
      const sb = b.kpis.total * 100 + b.kpis.tNPS;
      return sb - sa;
    })
    .slice(0, 10);

  // Premios vigentes
  const premiosVigentes = premios.filter((p) => p.activo);

  // Auto-advance slides
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [playing]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const slideActual = SLIDES[slideIndex];

  const renderSlide = () => {
    switch (slideActual.tipo) {
      case 'top-tnps':
        return (
          <div className="space-y-3">
            {topTnps.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sin datos de tNPS para mostrar.</p>
            ) : (
              topTnps.map((a, i) => (
                <div
                  key={a.loginNormalizado}
                  className={cn(
                    'flex items-center gap-4 rounded-xl p-3 transition-all',
                    i === 0 ? 'bg-pasivo/10 border-2 border-pasivo' : 'bg-card border'
                  )}
                >
                  <span className={cn(
                    'text-2xl font-bold tabular-nums w-12 text-center',
                    i === 0 ? 'text-pasivo' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-promotor' : 'text-muted-foreground'
                  )}>
                    {i + 1}°
                  </span>
                  <AsesorAvatar login={a.loginNormalizado} nombre={a.nombre} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-lg">{a.nombre}</p>
                    <p className="text-xs text-muted-foreground">{a.linea} · {a.kpis.total} encuestas</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-3xl font-bold tabular-nums',
                      a.kpis.tNPS >= 50 ? 'text-promotor' : a.kpis.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'
                    )}>
                      {a.kpis.tNPS >= 0 ? '+' : ''}{a.kpis.tNPS.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">tNPS</p>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'mejorar':
        return (
          <div className="space-y-3">
            {paraMejorar.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-promotor mx-auto mb-2" />
                <p className="text-promotor font-semibold text-lg">¡Todos arriba de 70!</p>
                <p className="text-sm text-muted-foreground">No hay asesores que necesiten mejorar.</p>
              </div>
            ) : (
              paraMejorar.map((a, i) => (
                <div key={a.loginNormalizado} className="flex items-center gap-4 rounded-xl p-3 bg-detractor/5 border border-detractor/20">
                  <span className="text-xl font-bold tabular-nums w-12 text-center text-detractor">
                    {i + 1}°
                  </span>
                  <AsesorAvatar login={a.loginNormalizado} nombre={a.nombre} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-lg">{a.nombre}</p>
                    <p className="text-xs text-muted-foreground">{a.linea} · {a.kpis.total} encuestas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-detractor">
                      {a.kpis.tNPS >= 0 ? '+' : ''}{a.kpis.tNPS.toFixed(1)}
                    </p>
                    <Badge variant="destructive" className="text-[10px]">Por mejorar</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'premios':
        return (
          <div className="grid grid-cols-2 gap-3">
            {premiosVigentes.length === 0 ? (
              <p className="col-span-2 text-center text-muted-foreground py-8">Sin premios vigentes.</p>
            ) : (
              premiosVigentes.slice(0, 8).map((p) => (
                <div key={p.id} className="rounded-xl p-4 bg-card border flex items-center gap-3">
                  <span className="text-4xl" aria-hidden>{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.categoria}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-claro-red">{p.costoATC}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">ATC</p>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-2xl overflow-hidden bg-background',
        isFullscreen && 'fixed inset-0 z-50 rounded-none p-8 flex flex-col'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 header-claro text-white">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {slideActual.titulo}
          </h2>
          <p className="text-sm text-white/70">
            {slideActual.subtitulo} · Área: {areaActiva === 'digital' ? 'Digital' : 'Telefónico'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPlaying(!playing)}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSlideIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSlideIndex((prev) => (prev + 1) % SLIDES.length)}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className="border-white/25 bg-white/10 text-white hover:bg-white/20"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="flex gap-1 p-2 bg-muted/30">
        {SLIDES.map((s, i) => (
          <button
            key={s.tipo}
            onClick={() => setSlideIndex(i)}
            className={cn(
              'flex-1 h-1.5 rounded-full transition-all',
              i === slideIndex ? 'bg-claro-red' : 'bg-muted-foreground/30'
            )}
            aria-label={`Slide ${i + 1}: ${s.titulo}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-y-auto p-4', isFullscreen && 'max-w-5xl mx-auto w-full')}>
        {renderSlide()}
      </div>

      {/* Footer */}
      <div className="p-2 bg-muted/30 text-center text-xs text-muted-foreground">
        ATC {areaActiva === 'digital' ? 'Digital' : 'Telefónico'} · Claro Guatemala ·
        Slide {slideIndex + 1} de {SLIDES.length}
      </div>
    </div>
  );
}
