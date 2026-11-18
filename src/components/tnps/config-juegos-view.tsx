'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Gamepad2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { getConfigJuegosAction, saveConfigJuegoAction } from '@/app/actions/racha-actions';
import { cn } from '@/lib/utils';

interface ConfigJuego {
  id: string;
  juego: string;
  descripcion?: string;
  activo: boolean;
  areaActiva?: string;
  atcPorPartida?: number;
  atcMaximoDiario?: number;
}

const JUEGOS_META: Record<string, { emoji: string; nombre: string }> = {
  culebrita: { emoji: '🐍', nombre: 'Culebrita' },
  breakout: { emoji: '🧱', nombre: 'Breakout' },
  sudoku: { emoji: '🔢', nombre: 'Sudoku' },
  solitario: { emoji: '🃏', nombre: 'Solitario' },
};

export function ConfigJuegosView() {
  const perfil = useStore((s) => s.perfil);
  const [configs, setConfigs] = useState<ConfigJuego[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const lista = await getConfigJuegosAction();
      setConfigs(lista as ConfigJuego[]);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar la configuración de juegos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!perfil?.esAdmin && perfil?.rol !== 'supervisor' && perfil?.rol !== 'admin') {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden />
          <p className="font-medium">Vista administrativa</p>
          <p className="text-sm text-muted-foreground">
            Acceso exclusivo para supervisores y administradores.
          </p>
        </CardContent>
      </Card>
    );
  }

  function actualizarCampo(id: string, campo: keyof ConfigJuego, valor: any) {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c))
    );
  }

  async function guardar(c: ConfigJuego) {
    setGuardando(c.id);
    try {
      const res = await saveConfigJuegoAction({
        id: c.id,
        activo: c.activo,
        areaActiva: c.areaActiva || 'ambas',
        atcPorPartida: Number(c.atcPorPartida) || 1,
        atcMaximoDiario: Number(c.atcMaximoDiario) || 10,
      });
      if (res.ok) {
        toast.success(`${JUEGOS_META[c.juego]?.nombre || c.juego} guardado.`);
      } else {
        toast.error(res.error || 'Error al guardar.');
      }
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gamepad2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Configuración de Juegos</p>
            <p className="text-xs text-muted-foreground">
              Activa o desactiva los juegos que pueden jugar los asesores, define las áreas
              donde están disponibles y cuántos ATC ganan por partida.
            </p>
          </div>
        </CardContent>
      </Card>

      {cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Juegos disponibles</CardTitle>
            <CardDescription>
              Los cambios se guardan por fila con el botón Guardar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Juego</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead>Área activa</TableHead>
                    <TableHead className="text-center">ATC / partida</TableHead>
                    <TableHead className="text-center">ATC máx. diario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No hay configuración de juegos todavía. Recarga la página.
                      </TableCell>
                    </TableRow>
                  ) : (
                    configs.map((c) => {
                      const meta = JUEGOS_META[c.juego] || { emoji: '🎮', nombre: c.juego };
                      return (
                        <TableRow key={c.id} className={cn(!c.activo && 'opacity-60')}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                              <div className="min-w-0">
                                <p className="font-medium">{meta.nombre}</p>
                                <p className="text-xs text-muted-foreground capitalize">{c.juego}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={!!c.activo}
                              onCheckedChange={(v) => actualizarCampo(c.id, 'activo', v)}
                              aria-label={`Activar ${meta.nombre}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={c.areaActiva || 'ambas'}
                              onValueChange={(v) => actualizarCampo(c.id, 'areaActiva', v)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ambas">Ambas</SelectItem>
                                <SelectItem value="digital">Digital</SelectItem>
                                <SelectItem value="telefonico">Telefónico</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              value={c.atcPorPartida ?? 1}
                              onChange={(e) =>
                                actualizarCampo(c.id, 'atcPorPartida', Math.max(0, Number(e.target.value)))
                              }
                              className="w-20 text-center mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              value={c.atcMaximoDiario ?? 10}
                              onChange={(e) =>
                                actualizarCampo(c.id, 'atcMaximoDiario', Math.max(0, Number(e.target.value)))
                              }
                              className="w-20 text-center mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {c.activo ? (
                                <Badge variant="outline" className="text-promotor border-promotor/40 gap-1 text-[10px]">
                                  ● Activo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px]">
                                  ○ Inactivo
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                onClick={() => guardar(c)}
                                disabled={guardando === c.id}
                                className="gap-1.5"
                              >
                                {guardando === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                Guardar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
