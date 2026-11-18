'use client';

import { Button } from '@/components/ui/button';
import type { GrupoTNPS } from '@/lib/types';
import { useStore } from '@/lib/store';

const OPCIONES: { valor: GrupoTNPS | 'todos'; etiqueta: string; claseActiva: string }[] = [
  { valor: 'todos', etiqueta: 'Todos', claseActiva: 'bg-claro-navy text-white' },
  { valor: 'Promotor', etiqueta: 'Promotores', claseActiva: 'bg-promotor text-white' },
  { valor: 'Pasivo', etiqueta: 'Pasivos', claseActiva: 'bg-pasivo text-white' },
  { valor: 'Detractor', etiqueta: 'Detractores', claseActiva: 'bg-detractor text-white' },
];

export function FiltroGrupo() {
  const filtroGrupo = useStore((s) => s.filtroGrupo);
  const setFiltroGrupo = useStore((s) => s.setFiltroGrupo);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtro por grupo tNPS">
      {OPCIONES.map((op) => (
        <Button
          key={op.valor}
          size="sm"
          variant="outline"
          onClick={() => setFiltroGrupo(op.valor)}
          className={`gap-1.5 h-8 ${filtroGrupo === op.valor ? op.claseActiva : ''}`}
          aria-pressed={filtroGrupo === op.valor}
        >
          <span className="hidden sm:inline">{op.etiqueta}</span>
        </Button>
      ))}
    </div>
  );
}
