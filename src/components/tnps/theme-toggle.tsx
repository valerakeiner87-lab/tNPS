'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { ThemeSettings, leerTemaGuardado, type ConfigTema } from './theme-settings';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/**
 * Botón compacto que abre el popover de configuración de tema.
 * Mantiene la apariencia original (sol/luna) para no confundir al usuario.
 */
export function ThemeToggle() {
  const { theme } = useTheme();
  const [config, setConfig] = useState<ConfigTema>({ tipo: 'light', paleta: 'claro' });

  useEffect(() => {
    const guardado = leerTemaGuardado();
    setConfig(guardado);
  }, []);

  const esOscuro = (theme === 'dark') || config.tipo === 'dark';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <ThemeSettings>
              <button
                type="button"
                aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white transition-colors"
              >
                {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </ThemeSettings>
          </div>
        </TooltipTrigger>
        <TooltipContent>Apariencia</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
