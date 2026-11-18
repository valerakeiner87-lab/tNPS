'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ScanSearch, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/lib/store';

const SEVERIDADES = ['todas', 'alta', 'moderada', 'leve'] as const;
type Severidad = (typeof SEVERIDADES)[number];

export function AlertasView() {
  const encuestas = useStore((s) => s.encuestasFiltradas);
  const perfil = useStore((s) => s.perfil);
  const analizarAlertas = useStore((s) => s.analizarAlertas);
  const analizandoAlertas = useStore((s) => s.analizandoAlertas);
  const [severidad, setSeveridad] = useState<Severidad>('todas');

  const alertas = useMemo(
    () =>
      encuestas
        .filter((e) => e.alertaAgresiva)
        .filter((e) => severidad === 'todas' || e.alertaSeveridad === severidad)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')),
    [encuestas, severidad]
  );

  const conteoSeveridad = useMemo(() => {
    const todas = encuestas.filter((e) => e.alertaAgresiva);
    return {
      total: todas.length,
      alta: todas.filter((e) => e.alertaSeveridad === 'alta').length,
      moderada: todas.filter((e) => e.alertaSeveridad === 'moderada').length,
      leve: todas.filter((e) => e.alertaSeveridad === 'leve').length,
    };
  }, [encuestas]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-detractor" /> Análisis de alertas
          </CardTitle>
          <CardDescription>
            Detección determinista por palabras clave (sin IA) sobre los campos <em>razón</em>,{' '}
            <em>comentario de solución</em> y <em>comentario adicional</em>. Los resultados se guardan en la
            colección <code className="bg-muted px-1 rounded text-[11px]">analisis_alertas</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="destructive" className="gap-1">Total: {conteoSeveridad.total}</Badge>
          <Badge variant="destructive" className="gap-1">Alta: {conteoSeveridad.alta}</Badge>
          <Badge className="bg-pasivo text-white gap-1">Moderada: {conteoSeveridad.moderada}</Badge>
          <Badge variant="outline" className="gap-1">Leve: {conteoSeveridad.leve}</Badge>

          <div className="ml-auto flex gap-2">
            <Select value={severidad} onValueChange={(v) => setSeveridad(v as Severidad)}>
              <SelectTrigger className="w-40" aria-label="Filtrar por severidad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las severidades</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="moderada">Moderada</SelectItem>
                <SelectItem value="leve">Leve</SelectItem>
              </SelectContent>
            </Select>

            {perfil?.puedeEscribir && (
              <Button onClick={() => analizarAlertas()} disabled={analizandoAlertas} className="gap-2">
                {analizandoAlertas ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                Ejecutar análisis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {alertas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-promotor" aria-hidden />
            <p className="font-medium">
              {conteoSeveridad.total === 0
                ? 'No hay comentarios agresivos detectados'
                : 'Sin alertas con esta severidad'}
            </p>
            <p className="text-sm text-muted-foreground">
              {conteoSeveridad.total === 0
                ? perfil?.puedeEscribir
                  ? 'Ejecuta el análisis para evaluar las encuestas cargadas con los filtros actuales.'
                  : 'Todo en orden por ahora. '
                : 'Cambia el filtro de severidad.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alertas.map((e) => (
            <Card
              key={e.id}
              className={`overflow-hidden ${
                e.alertaSeveridad === 'alta'
                  ? 'border-detractor/50'
                  : e.alertaSeveridad === 'moderada'
                    ? 'border-pasivo/50'
                    : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge
                    variant={e.alertaSeveridad === 'alta' ? 'destructive' : 'secondary'}
                    className="gap-1"
                  >
                    {e.alertaSeveridad === 'alta' ? 'Alta' : e.alertaSeveridad === 'moderada' ? 'Moderada' : 'Leve'}
                    {e.alertaSeveridad?.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">Score {e.tnps}</Badge>
                  <span className="text-sm font-medium">{e.usuario || e.loginNormalizado}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.fechaDia} {e.horaExacta} · {e.linea}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground hidden sm:block">{e.id}</span>
                </div>

                {e.alertaRazon && (
                  <p className="text-sm mb-2">
                    <strong>Keyword detectada:</strong>{' '}
                    <span className="rounded bg-detractor/10 text-detractor px-1.5 py-0.5 font-mono text-xs">
                      {e.alertaRazon}
                    </span>
                  </p>
                )}

                <div className="grid md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {e.razon && (
                    <p className="rounded bg-muted/60 p-2">
                      <strong className="text-foreground">Razón:</strong> {e.razon}
                    </p>
                  )}
                  {e.comentarioSolucion && (
                    <p className="rounded bg-muted/60 p-2">
                      <strong className="text-foreground">Solución:</strong> {e.comentarioSolucion}
                    </p>
                  )}
                  {e.comentarioAdicional && (
                    <p className="rounded bg-muted/60 p-2">
                      <strong className="text-foreground">Adicional:</strong> {e.comentarioAdicional}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
