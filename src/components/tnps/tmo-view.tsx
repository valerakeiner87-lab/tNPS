'use client';

import { useStore } from '@/lib/store';
import { TMOSupervisorView, TMOAsesorView } from './tmo-supervisor-view';

/**
 * Vista TMO (dispatcher):
 * - Asesor → ve su propia tendencia diaria del mes con umbral de su línea.
 * - Supervisor/Admin → ve la tabla consolidada de todos los asesores del área.
 */
export function TMOView() {
  const perfil = useStore((s) => s.perfil);
  const rol = perfil?.rol;

  if (rol === 'asesor') {
    return <TMOAsesorView />;
  }
  return <TMOSupervisorView />;
}
