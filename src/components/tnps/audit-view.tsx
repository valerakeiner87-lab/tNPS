'use client';

/* eslint-disable react-hooks/set-state-in-effect */
// ============================================================
// v3.0.5 — Auditoría (solo ADMIN)
// Filtros por username y acción. Tabla con Fecha, Usuario, Acción,
// Descripción, IP. Cargar más en bloques de 100.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Filter, History, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuditLogAction } from '@/app/actions/audit-actions';

interface AuditEntryUI {
  id: string;
  username: string;
  accion: string;
  descripcion: string;
  ipOrigen?: string | null;
  createdAt: string | Date;
}

const ACCIONES = [
  { value: 'login', label: 'Inicio de sesión' },
  { value: 'logout', label: 'Cierre de sesión' },
  { value: 'create', label: 'Creación' },
  { value: 'update', label: 'Actualización' },
  { value: 'delete', label: 'Eliminación' },
  { value: 'upload', label: 'Carga de archivo' },
  { value: 'canje', label: 'Canje' },
  { value: 'config', label: 'Configuración' },
];

const COLOR_ACCION: Record<string, string> = {
  login: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  logout: 'bg-muted text-muted-foreground',
  create: 'bg-claro-blue/15 text-claro-blue',
  update: 'bg-pasivo/15 text-pasivo',
  delete: 'bg-detractor/15 text-detractor',
  upload: 'bg-promotor/15 text-promotor',
  canje: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  config: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

function formatearFecha(fecha: string | Date): string {
  try {
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return d.toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(fecha);
  }
}

export function AuditView() {
  const [username, setUsername] = useState('');
  const [accion, setAccion] = useState<string>('todas');
  const [entradas, setEntradas] = useState<AuditEntryUI[]>([]);
  const [cargando, setCargando] = useState(false);
  const [limite, setLimite] = useState(100);
  const [cargadoInicial, setCargadoInicial] = useState(false);

  const cargar = useCallback(
    async (nuevoLimite: number) => {
      setCargando(true);
      try {
        const res = await getAuditLogAction({
          username: username.trim() || undefined,
          accion: accion === 'todas' ? undefined : accion,
          limite: nuevoLimite,
        });
        setEntradas(Array.isArray(res) ? (res as AuditEntryUI[]) : []);
        setLimite(nuevoLimite);
      } catch (err) {
        console.error('AuditView: error al cargar', err);
        toast.error('No se pudo cargar el log de auditoría.');
        setEntradas([]);
      } finally {
        setCargando(false);
      }
    },
    [username, accion]
  );

  // Cargar los primeros 100 al montar
  useEffect(() => {
    if (cargadoInicial) return;
    setCargadoInicial(true);
    cargar(100);
  }, [cargadoInicial, cargar]);

  function onFiltrar() {
    cargar(100);
  }

  function onCargarMas() {
    cargar(limite + 100);
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="audit-username" className="text-xs font-medium text-muted-foreground">
                Usuario
              </label>
              <Input
                id="audit-username"
                placeholder="Filtrar por nombre de usuario…"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onFiltrar();
                }}
                className="mt-1"
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="audit-accion" className="text-xs font-medium text-muted-foreground">
                Acción
              </label>
              <Select value={accion} onValueChange={setAccion}>
                <SelectTrigger id="audit-accion" className="mt-1 w-full">
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las acciones</SelectItem>
                  {ACCIONES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onFiltrar} disabled={cargando} className="gap-2">
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                Filtrar
              </Button>
              <Button
                variant="outline"
                onClick={() => cargar(limite)}
                disabled={cargando}
                aria-label="Refrescar"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando las últimas <strong>{entradas.length}</strong> entradas (límite {limite}).
          </p>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Log de Auditoría</h2>
          </div>
          {cargando && entradas.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : entradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay entradas de auditoría con los filtros seleccionados.
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto scroll-fino">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-44">Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-32">Acción</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-32">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entradas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {formatearFecha(e.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{e.username || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${COLOR_ACCION[e.accion] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {e.accion || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="line-clamp-2">{e.descripcion || '—'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {e.ipOrigen || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cargar más */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onCargarMas} disabled={cargando} className="gap-2">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          Cargar más (siguientes 100)
        </Button>
      </div>
    </div>
  );
}
