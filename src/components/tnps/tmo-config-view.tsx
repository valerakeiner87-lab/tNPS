'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Settings, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getConfigTMOLineas, saveConfigTMOLinea } from '@/app/actions/neon-actions';

interface ConfigLinea {
  id: string;
  linea: string;
  lineaNormalizada: string;
  area: string;
  tmoMaximo: number;
  descripcion: string;
}

export function TMOConfigView() {
  const [lineas, setLineas] = useState<ConfigLinea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  // Copia editable: { [id]: { tmoMaximo, descripcion } }
  const [draft, setDraft] = useState<Record<string, { tmoMaximo: number; descripcion: string }>>({});

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = (await getConfigTMOLineas()) as ConfigLinea[];
      setLineas(data);
      const initial: Record<string, { tmoMaximo: number; descripcion: string }> = {};
      for (const l of data) {
        initial[l.id] = { tmoMaximo: l.tmoMaximo, descripcion: l.descripcion || '' };
      }
      setDraft(initial);
    } catch (err) {
      toast.error('Error al cargar configuración TMO.');
    } finally {
      setCargando(false);
    }
  }

  async function guardar(id: string) {
    const d = draft[id];
    if (!d) return;
    if (d.tmoMaximo <= 0) {
      toast.error('El TMO máximo debe ser mayor a 0.');
      return;
    }
    setGuardando(id);
    try {
      const res = await saveConfigTMOLinea(id, d.tmoMaximo, d.descripcion);
      if ((res as any).ok) {
        toast.success('Configuración guardada.');
        await cargar();
      } else {
        toast.error((res as any).error || 'Error al guardar.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error inesperado al guardar.');
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lineasDigital = lineas.filter((l) => l.area === 'digital');
  const lineasTelefonico = lineas.filter((l) => l.area === 'telefonico');

  function renderLinea(l: ConfigLinea) {
    const d = draft[l.id] ?? { tmoMaximo: l.tmoMaximo, descripcion: l.descripcion };
    const modificado =
      d.tmoMaximo !== l.tmoMaximo || (d.descripcion || '') !== (l.descripcion || '');
    return (
      <Card
        key={l.id}
        className={modificado ? 'border-primary/60 shadow-sm' : ''}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{l.linea}</p>
                <Badge variant={l.area === 'digital' ? 'default' : 'secondary'}>
                  {l.area === 'digital' ? 'Digital' : 'Telefónico'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: <code className="font-mono">{l.id}</code>
              </p>
            </div>
            {modificado && (
              <Badge variant="outline" className="text-primary border-primary/40">
                Sin guardar
              </Badge>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`tmo-${l.id}`} className="text-xs flex items-center gap-1">
                <Timer className="h-3 w-3" /> TMO máximo (segundos)
              </Label>
              <Input
                id={`tmo-${l.id}`}
                type="number"
                min={1}
                value={d.tmoMaximo}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [l.id]: { ...prev[l.id], tmoMaximo: Number(e.target.value) },
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {Math.floor(d.tmoMaximo / 60)}m {d.tmoMaximo % 60}s
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`desc-${l.id}`} className="text-xs">
                Descripción
              </Label>
              <Input
                id={`desc-${l.id}`}
                placeholder="Ej. Umbral operativo para la línea"
                value={d.descripcion}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [l.id]: { ...prev[l.id], descripcion: e.target.value },
                  }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => guardar(l.id)}
              disabled={!modificado || guardando === l.id}
              className="gap-1.5"
            >
              {guardando === l.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="header-claro text-white border-0">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wide">Configuración TMO</p>
            <p className="text-xl font-bold">Umbrales por línea</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" /> Líneas Digitales
          </CardTitle>
          <CardDescription>
            Define el TMO máximo (en segundos) que se espera para cada línea digital. Estos umbrales
            se usan para resaltar asesores fuera de rango y validar requisitos de canje de premios.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {lineasDigital.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
              No hay líneas digitales configuradas.
            </p>
          ) : (
            lineasDigital.map(renderLinea)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" /> Líneas Telefónicas
          </CardTitle>
          <CardDescription>Umbrales TMO para las líneas de call center.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {lineasTelefonico.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
              No hay líneas telefónicas configuradas.
            </p>
          ) : (
            lineasTelefonico.map(renderLinea)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
