'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ExternalLink, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GrupoTNPS } from '@/lib/types';
import { useStore } from '@/lib/store';
import { calcularTendenciaAcumulada } from '@/lib/metrics';
import { getMetadata } from '@/app/actions/neon-actions';
import { KPICard } from './kpi-card';
import { TrendChart } from './trend-chart';
import { EncuestaDetalleDialog } from './encuesta-detalle-dialog';

export function MisEncuestasView() {
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const perfil = useStore((s) => s.perfil);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const kpis = useStore((s) => s.kpisFiltrados);
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoTNPS | 'todos'>('todos');

  // ID de encuesta seleccionada para el popup
  const [encuestaSeleccionada, setEncuestaSeleccionada] = useState<string | null>(null);

  // Última actualización (metadata)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>('');

  useEffect(() => {
    getMetadata()
      .then((meta) => {
        if (meta?.fechaCargaTs) {
          try {
            const d = new Date(Number(meta.fechaCargaTs));
            setUltimaActualizacion(
              d.toLocaleString('es-GT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            );
          } catch {}
        } else if (meta?.fechaCarga) {
          setUltimaActualizacion(meta.fechaCarga);
        }
      })
      .catch(() => undefined);
  }, []);

  const encuestas = useMemo(
    () =>
      encuestasFiltradas
        .filter((e) => filtroGrupo === 'todos' || e.grupo === filtroGrupo)
        .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')),
    [encuestasFiltradas, filtroGrupo]
  );

  const tendencia = useMemo(() => calcularTendenciaAcumulada(encuestasFiltradas, 'dia'), [encuestasFiltradas]);

  if (perfil?.rol !== 'asesor' || !perfilAsesor) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ListChecks className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu login de red y documento para ver tus encuestas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {ultimaActualizacion && (
        <div className="text-xs text-muted-foreground text-right">
          Última actualización: <strong className="tabular-nums">{ultimaActualizacion}</strong>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Hola {perfilAsesor.nombre.split(' ')[0]}
          </CardTitle>
          <CardDescription>
            Este es tu historial de encuestas tNPS. ¡Sigue sumando promotores para ganar ATC!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPICard
              titulo="Mi tNPS"
              valor={`${kpis.tNPS >= 0 ? '+' : ''}${kpis.tNPS.toFixed(1)}`}
              subtitulo={`${kpis.total} encuestas`}
              color={kpis.tNPS >= 50 ? 'promotor' : kpis.tNPS >= 0 ? 'pasivo' : 'detractor'}
            />
            <KPICard titulo="Promotores" valor={kpis.promotores} color="promotor" />
            <KPICard titulo="Pasivos" valor={kpis.pasivos} color="pasivo" />
            <KPICard titulo="Detractores" valor={kpis.detractores} color="detractor" />
            <KPICard titulo="Score promedio" valor={kpis.scorePromedio.toFixed(2)} />
          </div>
        </CardContent>
      </Card>

      {encuestasFiltradas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mi tendencia acumulada</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart encuestas={encuestasFiltradas} titulo="Mi tNPS al cierre del día" altura={220} mostrarSelector={false} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mis encuestas ({encuestas.length})</CardTitle>
          <CardDescription className="text-xs">
            💡 Haz clic en cualquier fila para ver el detalle completo de la encuesta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={filtroGrupo} onValueChange={(v) => setFiltroGrupo(v as GrupoTNPS | 'todos')}>
            <TabsList>
              <TabsTrigger value="todos">Todas</TabsTrigger>
              <TabsTrigger value="Promotor">Promotoras</TabsTrigger>
              <TabsTrigger value="Pasivo">Pasivas</TabsTrigger>
              <TabsTrigger value="Detractor">Detractoras</TabsTrigger>
            </TabsList>
          </Tabs>

          {encuestas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no tienes encuestas con estos filtros.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[55vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>ID Transacción</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="hidden md:table-cell">Tipificación</TableHead>
                      <TableHead className="text-center">Grupo</TableHead>
                      <TableHead>Comentarios</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encuestas.map((e) => (
                      <TableRow
                        key={e.id}
                        onClick={() => setEncuestaSeleccionada(e.id)}
                        className="cursor-pointer hover:bg-accent/40 transition-colors"
                      >
                        <TableCell className="text-center font-bold tabular-nums">{e.tnps}</TableCell>
                        <TableCell>
                          <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded break-all">
                            {e.idTransaccion || '—'}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.fechaDia}
                          <p className="text-muted-foreground">{e.horaExacta}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs max-w-40">
                          <p className="truncate">{e.nivel1 || '—'}</p>
                          <p className="truncate text-muted-foreground">{e.nivel2 || ''}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              e.grupo === 'Promotor'
                                ? 'bg-promotor text-white'
                                : e.grupo === 'Pasivo'
                                  ? 'bg-pasivo text-white'
                                  : 'bg-detractor text-white'
                            }
                          >
                            {e.grupo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-64 align-top">
                          {e.razon && (
                            <p className="whitespace-pre-wrap break-words line-clamp-2" title={e.razon}>
                              {e.razon}
                            </p>
                          )}
                          {e.comentarioSolucion && (
                            <p
                              className="whitespace-pre-wrap break-words text-muted-foreground line-clamp-2 mt-0.5"
                              title={e.comentarioSolucion}
                            >
                              {e.comentarioSolucion}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <ExternalLink className="h-3.5 w-3.5" aria-label="Ver detalle" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EncuestaDetalleDialog
        encuestaId={encuestaSeleccionada}
        area={perfil.area}
        open={!!encuestaSeleccionada}
        onOpenChange={(o) => !o && setEncuestaSeleccionada(null)}
      />
    </div>
  );
}
