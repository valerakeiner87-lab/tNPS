'use client';

/**
 * v3.4.3 — NominaSection
 * -------------------------
 * Sección contenedora de Nómina con 2 subpestañas internas:
 *   1. Nómina Consolidado (NominaConsolidadoView)
 *   2. Validación Diaria (NominaValidacionView)
 */
import { useState } from 'react';
import { Clock, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NominaConsolidadoView } from './nomina-consolidado-view';
import { NominaValidacionView } from './nomina-validacion-view';

type SubtabNomina = 'consolidado' | 'validacion';

export function NominaSection() {
  const [subtab, setSubtab] = useState<SubtabNomina>('consolidado');

  return (
    <div className="space-y-4">
      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as SubtabNomina)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="consolidado" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Nómina Consolidado
          </TabsTrigger>
          <TabsTrigger value="validacion" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Validación Diaria
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {subtab === 'consolidado' && <NominaConsolidadoView />}
        {subtab === 'validacion' && <NominaValidacionView />}
      </div>
    </div>
  );
}
