'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ============================================================
// AsesorAvatar — avatar personalizado para asesores
// ============================================================
// Estrategia:
// 1. Si el asesor tiene avatarUrl personalizada → la usa (AvatarImage).
// 2. Si no, genera un avatar DiceBear con seed = login (variante "thumbs"
//    para estilo amigable + colores de marca Claro).
// 3. Fallback: iniciales del nombre (avatar.tsx AvatarFallback).
// ============================================================

const CLARO_PALETTE = 'DA291C,1A3F7A,F59E0B,16A34A,0B1426';

interface Props {
  login: string;
  nombre?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

const TEXT_SIZE_MAP = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-2xl',
};

function getInitials(nombre: string): string {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 0 || !partes[0]) return '?';
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function getDiceBearUrl(seed: string): string {
  const safeSeed = encodeURIComponent(seed || 'asesor');
  // Usamos la variante "thumbs" que es amigable + colores de marca Claro
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${safeSeed}&backgroundColor=${CLARO_PALETTE}&backgroundType=gradientLinear&radius=50`;
}

function getBoringAvatarsUrl(seed: string, size: number): string {
  const safeSeed = encodeURIComponent(seed || 'asesor');
  return `https://boring-avatars.com/api/avatars/${size}/${safeSeed}?colors=${CLARO_PALETTE}`;
}

/**
 * AsesorAvatar — muestra el avatar de un asesor.
 * Prioriza la URL personalizada, luego generada automáticamente.
 */
export function AsesorAvatar({ login, nombre, avatarUrl, size = 'md', className }: Props) {
  const seed = login || nombre || 'asesor';
  const inicial = getInitials(nombre || login);

  // Si hay URL de avatar personalizada, intenta cargarla.
  // Si falla, AvatarFallback muestra la inicial.
  // Si no hay URL, generamos una con DiceBear.
  const generatedUrl = avatarUrl ?? getDiceBearUrl(seed);

  const sizeClass = SIZE_MAP[size];
  const textClass = TEXT_SIZE_MAP[size];

  return (
    <Avatar className={cn(sizeClass, 'border border-border/50 shadow-sm shrink-0', className)}>
      <AvatarImage
        src={generatedUrl}
        alt={`Avatar de ${nombre || login}`}
        className="object-cover"
      />
      <AvatarFallback
        className={cn(
          'bg-gradient-to-br from-claro-red to-claro-navy text-white font-bold',
          textClass
        )}
      >
        {inicial}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * AsesorAvatarGradient — variante con gradiente de marca Claro.
 * Útil cuando no hay avatar URL y se quiere un fallback elegante
 * sin depender de servicios externos.
 */
export function AsesorAvatarGradient({ login, nombre, size = 'md', className }: Props) {
  const inicial = getInitials(nombre || login);
  const sizeClass = SIZE_MAP[size];
  const textClass = TEXT_SIZE_MAP[size];

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full bg-gradient-to-br from-claro-red via-claro-blue-2 to-claro-navy',
        'flex items-center justify-center text-white font-bold shadow-sm shrink-0',
        textClass,
        className
      )}
      aria-label={`Avatar de ${nombre || login}`}
      role="img"
    >
      {inicial}
    </div>
  );
}
