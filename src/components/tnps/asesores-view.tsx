'use client';

import { useMemo, useState } from 'react';
import { Award, ChevronDown, ChevronUp, Download, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AsesorConsolidado, Linea } from '@/lib/types';
import { LINEAS } from '@/lib/types';
import { useStore } from '@/lib/store';
import { AgenteDetalle } from './agente-detalle';
import { AsesorPerfilSupervisor } from './asesor-perfil-supervisor';
import { AsesorAvatar } from './asesor-avatar';
import { exportarTablaAExcel } from '@/lib/excel-export';

type Orden = 'tnps-desc' | 'tnps-asc' | 'encuestas-desc' | 'alertas-desc';

export function AsesoresView() {
  const asesores = useStore((s) => s.asesoresConsolidados);
  const perfil = useStore((s) => s.perfil);
  const [busqueda, setBusqueda] = useState('');
  const [filtroLinea, setFiltroLinea] = useState<string>('todas');
  const [orden, setOrden] = useState<Orden>('tnps-desc');
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<AsesorConsolidado | null>(null);
  // v3.0.4: si true abre el perfil supervisor completo; si false, el AgenteDetalle clásico.
  const [abrirPerfilSupervisor, setAbrirPerfilSupervisor] = useState(false);

  const filtrados = useMemo(() => {
    let lista = [...asesores];
    const q = busqueda.toLowerCase().trim();
    if (q) {
      lista = lista.filter(
        (a) =>
          a.nombre.toLowerCase().includes(q) ||
          a.loginNormalizado.toLowerCase().includes(q) ||
          a.documento.includes(q)
      );
    }
    if (filtroLinea !== 'todas') {
      lista = lista.filter((a) => a.linea === filtroLinea);
    }
    switch (orden) {
      case 'tnps-asc':
        lista.sort((a, b) => a.kpis.tNPS - b.kpis.tNPS);
        break;
      case 'encuestas-desc':
        lista.sort((a, b) => b.kpis.total - a.kpis.total);
        break;
      case 'alertas-desc':
        lista.sort((a, b) => b.alertas - a.alertas);
        break;
      default:
        lista.sort((a, b) => b.kpis.tNPS - a.kpis.tNPS);
    }
    return lista;
  }, [asesores, busqueda, filtroLinea, orden]);

  if (asesores.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Aún no hay asesores con encuestas</p>
          <p className="text-sm text-muted-foreground">Carga el HC y el archivo Qualtrics para generar el ranking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, login o documento…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
            aria-label="Buscar asesor"
          />
        </div>
        <Select value={filtroLinea} onValueChange={setFiltroLinea}>
          <SelectTrigger className="w-44" aria-label="Filtrar por línea">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las líneas</SelectItem>
            {LINEAS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
          <SelectTrigger className="w-48" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tnps-desc"><ChevronDown className="h-3.5 w-3.5" /> tNPS (mayor primero)</SelectItem>
            <SelectItem value="tnps-asc"><ChevronUp className="h-3.5 w-3.5" /> tNPS (menor primero)</SelectItem>
            <SelectItem value="encuestas-desc">Más encuestas</SelectItem>
            <SelectItem value="alertas-desc">Más alertas</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const filas = filtrados.map((a, idx) => ({
              '#': idx + 1,
              'Asesor': a.nombre,
              'Login': a.loginNormalizado,
              'Documento': a.documento,
              'Línea': a.linea,
              'Encuestas': a.kpis.total,
              'Promotores': a.kpis.promotores,
              'Pasivos': a.kpis.pasivos,
              'Detractores': a.kpis.detractores,
              'tNPS': a.kpis.tNPS.toFixed(1),
              'Alertas': a.alertas,
            }));
            exportarTablaAExcel(filas, 'Asesores', `asesores-${new Date().toISOString().slice(0,10)}.xlsx`);
          }}
          disabled={filtrados.length === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Excel</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Mostrando {filtrados.length} de {asesores.length} asesores · Clic en una fila para ver el detalle
      </p>

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto scroll-fino">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Asesor</TableHead>
                <TableHead className="hidden md:table-cell">Línea</TableHead>
                <TableHead className="text-center">Encuestas</TableHead>
                <TableHead className="text-center hidden sm:table-cell" aria-label="Promotores">Prom.</TableHead>
                <TableHead className="text-center hidden sm:table-cell" aria-label="Pasivos">Pas.</TableHead>
                <TableHead className="text-center hidden sm:table-cell" aria-label="Detractores">Detr.</TableHead>
                <TableHead className="text-center">tNPS</TableHead>
                <TableHead className="text-center" aria-label="Alertas">Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((a, i) => (
                <TableRow
                  key={a.loginNormalizado}
                  className="cursor-pointer"
                  onClick={() => {
                    setAsesorSeleccionado(a);
                    // v3.0.4: supervisor/admin abre el perfil completo; asesor sigue viendo el detalle clásico.
                    setAbrirPerfilSupervisor(perfil?.rol === 'supervisor' || perfil?.rol === 'admin');
                  }}
                >
                  <TableCell className="text-center font-semibold">
                    {['1°', '2°', '3°'].includes(String(i + 1)) ? `${i + 1}°` : i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <AsesorAvatar
                        login={a.loginNormalizado}
                        nombre={a.nombre}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-52">{a.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-52">{a.loginNormalizado}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {a.linea}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{a.kpis.total}</TableCell>
                  <TableCell className="text-center tabular-nums text-promotor hidden sm:table-cell">{a.kpis.promotores}</TableCell>
                  <TableCell className="text-center tabular-nums text-pasivo hidden sm:table-cell">{a.kpis.pasivos}</TableCell>
                  <TableCell className="text-center tabular-nums text-detractor hidden sm:table-cell">{a.kpis.detractores}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`font-bold tabular-nums ${
                        a.kpis.tNPS >= 50 ? 'text-promotor' : a.kpis.tNPS >= 0 ? 'text-pasivo' : 'text-detractor'
                      }`}
                    >
                      {a.kpis.tNPS >= 0 ? '+' : ''}
                      {a.kpis.tNPS.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {a.tieneAlertas ? (
                      <Badge variant="destructive" className="animar-latido">{a.alertas}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {filtrados.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados para “{busqueda}”. Intenta con otro nombre, login o documento.
          </CardContent>
        </Card>
      )}

      {abrirPerfilSupervisor ? (
        <AsesorPerfilSupervisor
          asesor={asesorSeleccionado}
          abierto={!!asesorSeleccionado}
          onCerrar={() => setAsesorSeleccionado(null)}
        />
      ) : (
        <AgenteDetalle
          asesor={asesorSeleccionado}
          abierto={!!asesorSeleccionado}
          onCerrar={() => setAsesorSeleccionado(null)}
        />
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Award className="h-3.5 w-3.5 text-pasivo" />
        La línea del asesor se determina por el HC, salvo que el 60%+ de sus encuestas pertenezcan a otra
        línea (realidad operativa).
      </p>
    </div>
  );
}
