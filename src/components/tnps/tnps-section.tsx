'use client';

/**
 * v3.4.3 — TnpsSection
 * -----------------------
 * Sección contenedora de TNPS con 3 subpestañas internas:
 *   1. Resumen TNPS (TnpsResumenView)
 *   2. Encuestas TNPS (TnpsEncuestasView)
 *   3. Calculadora TNPS (TnpsCalculadoraView)
 *
 * El asesor ve un tab bar horizontal en la parte superior con las 3 opciones.
 */
import { useState } from 'react';
import { BarChart3, Calculator as CalcIcon, ListChecks } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TnpsResumenView } from './tnps-resumen-view';
import { TnpsEncuestasView } from './tnps-encuestas-view';
import { TnpsCalculadoraView } from './tnps-calculadora-view';

type SubtabTnps = 'resumen' | 'encuestas' | 'calculadora';

export function TnpsSection() {
  const [subtab, setSubtab] = useState<SubtabTnps>('resumen');

  return (
    <div className="space-y-4">
      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as SubtabTnps)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="resumen" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Resumen TNPS
          </TabsTrigger>
          <TabsTrigger value="encuestas" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Encuestas TNPS
          </TabsTrigger>
          <TabsTrigger value="calculadora" className="gap-1.5">
            <CalcIcon className="h-3.5 w-3.5" /> Calculadora TNPS
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {subtab === 'resumen' && <TnpsResumenView />}
        {subtab === 'encuestas' && <TnpsEncuestasView />}
        {subtab === 'calculadora' && <TnpsCalculadoraView />}
      </div>
    </div>
  );
}
