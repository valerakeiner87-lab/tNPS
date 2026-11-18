'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PropsKPICard {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  color?: 'claro' | 'promotor' | 'pasivo' | 'detractor' | 'neutro';
  /** Nodo opcional (ícono lucide) para la esquina de la tarjeta */
  icono?: ReactNode;
  className?: string;
}

const colores: Record<string, string> = {
  claro: 'text-claro-red',
  promotor: 'text-promotor',
  pasivo: 'text-pasivo',
  detractor: 'text-detractor',
  neutro: 'text-foreground',
};

const bordes: Record<string, string> = {
  claro: 'border-l-claro-red',
  promotor: 'border-l-promotor',
  pasivo: 'border-l-pasivo',
  detractor: 'border-l-detractor',
  neutro: 'border-l-border',
};

export function KPICard({
  titulo,
  valor,
  subtitulo,
  color = 'neutro',
  icono,
  className,
}: PropsKPICard) {
  return (
    <Card
      className={cn(
        'border-l-4 shadow-sm hover:shadow-md transition-all animar-kpi',
        bordes[color],
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {titulo}
            </p>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', colores[color])}>{valor}</p>
            {subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>}
          </div>
          {icono && <div className="shrink-0 text-muted-foreground/70">{icono}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
