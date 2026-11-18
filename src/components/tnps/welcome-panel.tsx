'use client';

import { FileSpreadsheet, FileText, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function WelcomePanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Bienvenido a ATC Digital</CardTitle>
          <CardDescription>
            Esta plataforma procesa las encuestas de Qualtrics y el Health Check (HC) de los asesores
            para calcular el tNPS del contact center de Claro Guatemala. Todo el procesamiento ocurre
            100% en tu navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {/* Qualtrics */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-claro-red">
              <FileSpreadsheet className="h-5 w-5" />
              <h3 className="font-semibold">Archivo Qualtrics</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Excel (.xlsx/.xls/.csv) con una sola hoja de encuestas. Columnas esperadas:
            </p>
            <div className="flex flex-wrap gap-1">
              {['GRUPO TNPS', 'TNPS', 'COLA', 'UNIDAD', 'USUARIO', 'FECHA DIA', 'ID TRANSACCION', 'RAZON TNPS', 'COMENTARIO SOLUCION', 'NIVEL 1-5'].map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] font-normal">{c}</Badge>
              ))}
            </div>
          </div>

          {/* HC */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-claro-navy dark:text-claro-blue-2">
              <FileText className="h-5 w-5" />
              <h3 className="font-semibold">Archivo HC (Health Check)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Excel con hojas <strong>ACTIVOS</strong> y <strong>TRANSICIONES</strong>. Columnas clave:
            </p>
            <div className="flex flex-wrap gap-1">
              {['DOCUMENTO SP', 'NOMBRE', 'USUARIO CIC', 'LOB', 'SUPERVISOR', 'SEDE', 'E-MAIL'].map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] font-normal">{c}</Badge>
              ))}
            </div>
          </div>

          {/* TMO */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-pasivo">
              <Timer className="h-5 w-5" />
              <h3 className="font-semibold">Archivo TMO</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Excel con hoja <strong>BD NEW</strong> (métricas por intervalo) y <strong>Activos1</strong>{' '}
              (mapeo Genesys → USUARIO CIC). Fórmula:
            </p>
            <p className="text-xs font-mono bg-muted rounded px-2 py-1">
              TMO = (Manejo_total / 1000) / Manejo
            </p>
            <p className="text-[11px] text-muted-foreground">Límite máximo: 970 segundos por interacción.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buenas prácticas de carga</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>Primero carga el <strong>HC</strong> y el archivo <strong>Qualtrics</strong> juntos (o por separado). La escritura es diferencial: solo se guardan los registros nuevos, ahorrando tiempo de procesamiento.</p>
          <p>Luego ejecuta el <strong>análisis de alertas</strong> desde la pestaña Alertas para detectar comentarios agresivos.</p>
          <p>3️⃣ Carga el <strong>TMO</strong> cuando tengas el reporte de Genesys actualizado (sobrescribe el snapshot anterior).</p>
          <p>El sistema <strong>ATC</strong> procesa los puntos automáticamente tras cada carga de encuestas.</p>
        </CardContent>
      </Card>
    </div>
  );
}
