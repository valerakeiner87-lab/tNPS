'use client';

/**
 * v3.3.0 Fase 2 — TnpsEncuestasView
 * ---------------------------------
 * Vista de historial de encuestas tNPS del asesor:
 *  - Tabla con ID de caso, fecha, calificación, comentarios, tipificación
 *  - Filtro por fecha (desde / hasta)
 *  - Filtro por grupo tNPS (Promotor / Pasivo / Detractor / Todos)
 *
 * Usa `encuestasFiltradas` del store (ya filtradas por login del asesor).
 */
import { useMemo, useState } from 'react';
import { ExternalLink, ListChecks, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { GrupoTNPS } from '@/lib/types';
import { useStore } from '@/lib/store';
import { EncuestaDetalleDialog } from './encuesta-detalle-dialog';
import { KPICard } from './kpi-card';

export function TnpsEncuestasView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const kpis = useStore((s) => s.kpisFiltrados);

  const [filtroGrupo, setFiltroGrupo] = useState<GrupoTNPS | 'todos'>('todos');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [encuestaSeleccionada, setEncuestaSeleccionada] = useState<string | null>(null);

  const encuestas = useMemo(() => {
    return encuestasFiltradas
      .filter((e) => filtroGrupo === 'todos' || e.grupo === filtroGrupo)
      .filter((e) => !fechaDesde || e.fechaDia >= fechaDesde)
      .filter((e) => !fechaHasta || e.fechaDia <= fechaHasta)
      .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
  }, [encuestasFiltradas, filtroGrupo, fechaDesde, fechaHasta]);

  if (perfil?.rol !== 'asesor' || !perfilAsesor) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ListChecks className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">Vista exclusiva para asesores</p>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu login de red para ver tus encuestas.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (encuestasFiltradas.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center" aria-hidden>
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Aún no tienes encuestas</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cuando tus clientes respondan la encuesta tNPS, aquí verás el detalle de cada
              respuesta.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
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

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>
            Acota tus encuestas por grupo y por rango de fechas.
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
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="filtro-desde" className="text-xs text-muted-foreground">Desde</Label>
              <Input
                id="filtro-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="filtro-hasta" className="text-xs text-muted-foreground">Hasta</Label>
              <Input
                id="filtro-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            {(filtroGrupo !== 'todos' || fechaDesde || fechaHasta) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltroGrupo('todos');
                  setFechaDesde('');
                  setFechaHasta('');
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de encuestas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mis encuestas ({encuestas.length})</CardTitle>
          <CardDescription className="text-xs">
            Haz clic en cualquier fila para ver el detalle completo de la encuesta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {encuestas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tienes encuestas con estos filtros. Ajusta las fechas o el grupo para ver más.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-[55vh] overflow-y-auto scroll-fino">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-center">Calificación</TableHead>
                      <TableHead>ID caso</TableHead>
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
                            {e.idTransaccion || e.idInteraccion || '—'}
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
                          {!e.razon && !e.comentarioSolucion && (
                            <span className="text-muted-foreground/60">Sin comentarios</span>
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
