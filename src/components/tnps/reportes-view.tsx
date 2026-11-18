'use client';

// ============================================================
// v3.0.5 — Reportes (export CSV)
// 4 tarjetas con botón de descarga que abren /api/reportes
// en una pestaña nueva. El backend se encarga del CSV.
// ============================================================

import {
  BookOpen,
  Coins,
  Download,
  FileBarChart,
  FileText,
  Gift,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ReporteDef {
  tipo: 'tnps' | 'atc' | 'canjes' | 'formularios';
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  color: string;
}

const REPORTES: ReporteDef[] = [
  {
    tipo: 'tnps',
    titulo: 'Reporte tNPS',
    descripcion: 'Descarga todas las encuestas con índices',
    icono: <FileBarChart className="h-6 w-6" />,
    color: 'text-promotor',
  },
  {
    tipo: 'atc',
    titulo: 'Reporte ATC',
    descripcion: 'Descarga todas las transacciones ATC',
    icono: <Coins className="h-6 w-6" />,
    color: 'text-claro-blue',
  },
  {
    tipo: 'canjes',
    titulo: 'Reporte Canjes',
    descripcion: 'Descarga todos los canjes solicitados',
    icono: <Gift className="h-6 w-6" />,
    color: 'text-pasivo',
  },
  {
    tipo: 'formularios',
    titulo: 'Reporte Formularios',
    descripcion: 'Descarga todas las respuestas de formularios',
    icono: <BookOpen className="h-6 w-6" />,
    color: 'text-foreground',
  },
];

export function ReportesView() {
  function descargar(tipo: ReporteDef['tipo']) {
    window.open(`/api/reportes?tipo=${tipo}`, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Nota informativa */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-claro-blue shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium">Reportes en formato CSV</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Los reportes se descargan en formato CSV (compatible con Excel). Haz clic en
              &quot;Descargar CSV&quot; para abrir el archivo en una pestaña nueva y guardarlo en tu equipo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Grid de reportes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTES.map((r) => (
          <Card key={r.tipo} className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 ${r.color}`}>{r.icono}</div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base">{r.titulo}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.descripcion}</p>
                </div>
              </div>
              <Button
                className="gap-2 self-start"
                onClick={() => descargar(r.tipo)}
                aria-label={`Descargar ${r.titulo} en CSV`}
              >
                <Download className="h-4 w-4" />
                Descargar CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie con recordatorio */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0" aria-hidden />
          <p>
            Si la descarga no inicia, revisa el bloqueador de ventanas emergentes del navegador y
            vuelve a intentarlo. Los archivos se generan en tiempo real con los datos actuales de la
            base de datos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
