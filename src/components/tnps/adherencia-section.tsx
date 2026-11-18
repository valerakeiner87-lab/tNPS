'use client';

/**
 * v3.4.3 — AdherenciaSection
 * ----------------------------
 * Sección contenedora de Adherencia con 2 subpestañas internas:
 *   1. Adherencia Detallada (MetricasAdherenciaDetalleView)
 *   2. Productividad y Asistencia (MetricasProductividadView)
 */
import { useState } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricasAdherenciaDetalleView } from './metricas-adherencia-detalle-view';
import { MetricasProductividadView } from './metricas-productividad-view';

type SubtabAdherencia = 'detallada' | 'productividad';

export function AdherenciaSection() {
  const [subtab, setSubtab] = useState<SubtabAdherencia>('detallada');

  return (
    <div className="space-y-4">
      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as SubtabAdherencia)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="detallada" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Adherencia Detallada
          </TabsTrigger>
          <TabsTrigger value="productividad" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Productividad y Asistencia
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {subtab === 'detallada' && <MetricasAdherenciaDetalleView />}
        {subtab === 'productividad' && <MetricasProductividadView />}
      </div>
    </div>
  );
}
