'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type TipoTema = 'light' | 'dark';
export type PaletaTema = 'claro' | 'femenino' | 'masculino' | 'ocean' | 'sunset';

export interface ConfigTema {
  tipo: TipoTema;
  paleta: PaletaTema;
}

const STORAGE_KEY = 'atc-tema';

const PALETAS: Array<{
  id: PaletaTema;
  nombre: string;
  emoji: string;
  primary: string;
  accent: string;
  bg: string;
}> = [
  { id: 'claro', nombre: 'Claro', emoji: '🔴', primary: '#DA291C', accent: '#7B0F08', bg: '#FFF1F0' },
  { id: 'femenino', nombre: 'Femenino', emoji: '💖', primary: '#E91E63', accent: '#9C27B0', bg: '#FCE4EC' },
  { id: 'masculino', nombre: 'Masculino', emoji: '🔵', primary: '#2196F3', accent: '#1976D2', bg: '#E3F2FD' },
  { id: 'ocean', nombre: 'Ocean', emoji: '🌊', primary: '#009688', accent: '#00695C', bg: '#E0F2F1' },
  { id: 'sunset', nombre: 'Sunset', emoji: '🌅', primary: '#FF5722', accent: '#E64A19', bg: '#FBE9E7' },
];

/** Aplica los CSS variables de la paleta elegida a :root y .dark */
function aplicarTema(tipo: TipoTema, paleta: PaletaTema) {
  const root = document.documentElement;
  const p = PALETAS.find((x) => x.id === paleta) ?? PALETAS[0];

  // Modo (claro/oscuro)
  if (tipo === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-paleta', paleta);

  // Variables de paleta — afectan tanto a light como a dark
  root.style.setProperty('--primary', p.primary);
  root.style.setProperty('--ring', p.primary);
  root.style.setProperty('--sidebar-primary', p.primary);
  root.style.setProperty('--sidebar-ring', p.primary);
  root.style.setProperty('--chart-1', p.primary);
  root.style.setProperty('--chart-2', p.accent);

  // En dark, suavizamos un poco el primary para que no quede tan saturado
  if (tipo === 'dark') {
    root.style.setProperty('--primary-foreground', '#ffffff');
  } else {
    root.style.setProperty('--primary-foreground', '#ffffff');
  }
}

/** Lee la config guardada en localStorage (safe para SSR) */
export function leerTemaGuardado(): ConfigTema {
  if (typeof window === 'undefined') return { tipo: 'light', paleta: 'claro' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tipo: 'light', paleta: 'claro' };
    const parsed = JSON.parse(raw);
    return {
      tipo: parsed.tipo === 'dark' ? 'dark' : 'light',
      paleta: PALETAS.some((p) => p.id === parsed.paleta) ? parsed.paleta : 'claro',
    };
  } catch {
    return { tipo: 'light', paleta: 'claro' };
  }
}

function guardarTema(c: ConfigTema) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {}
}

interface ThemeSettingsProps {
  /**children opcional para usar como trigger custom */
  children?: React.ReactNode;
}

export function ThemeSettings({ children }: ThemeSettingsProps) {
  const [config, setConfig] = useState<ConfigTema>({ tipo: 'light', paleta: 'claro' });
  const [mounted, setMounted] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // Cargar configuración al montar
  useEffect(() => {
    const guardado = leerTemaGuardado();
    setConfig(guardado);
    aplicarTema(guardado.tipo, guardado.paleta);
    setMounted(true);
  }, []);

  function cambiar(nueva: ConfigTema) {
    setConfig(nueva);
    aplicarTema(nueva.tipo, nueva.paleta);
    guardarTema(nueva);
  }

  const paletaActual = PALETAS.find((p) => p.id === config.paleta);

  const trigger = children ?? (
    <Button
      variant="outline"
      size="icon"
      aria-label="Configurar tema"
      className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
    >
      {mounted && config.tipo === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Palette className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Apariencia</p>
          </div>

          {/* Tipo: claro / oscuro */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Modo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cambiar({ ...config, tipo: 'light' })}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-sm font-medium transition-all',
                  config.tipo === 'light'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Sun className="h-4 w-4" /> Claro
                {config.tipo === 'light' && <Check className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => cambiar({ ...config, tipo: 'dark' })}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg border-2 p-2.5 text-sm font-medium transition-all',
                  config.tipo === 'dark'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Moon className="h-4 w-4" /> Oscuro
                {config.tipo === 'dark' && <Check className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Paleta */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Paleta de color
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {PALETAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => cambiar({ ...config, paleta: p.id })}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 p-2 text-left transition-all',
                    config.paleta === p.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
                      style={{ background: p.primary }}
                      aria-hidden
                    />
                    <span
                      className="h-7 w-7 -ml-2.5 rounded-full border-2 border-white shadow-sm"
                      style={{ background: p.accent }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-2xl" aria-hidden>{p.emoji}</span>
                  <span className="flex-1 text-sm font-medium">{p.nombre}</span>
                  {config.paleta === p.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            Paleta actual: <strong>{paletaActual?.emoji} {paletaActual?.nombre}</strong>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
