'use client';

import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FiltroFecha } from '@/lib/types';
import { useStore } from '@/lib/store';
import { es } from 'date-fns/locale';

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function etiquetaFiltro(filtro: FiltroFecha): string {
  switch (filtro.tipo) {
    case 'todo':
      return 'Todas las fechas';
    case 'dia':
      return `Día ${filtro.valor}`;
    case 'mes':
      return `Mes ${filtro.valor}`;
    case 'anio':
      return `Año ${filtro.valor}`;
    case 'rango':
      return `${filtro.desde ?? '…'} → ${filtro.hasta ?? '…'}`;
  }
}

export function FiltroFechas() {
  const filtroFecha = useStore((s) => s.filtroFecha);
  const setFiltroFecha = useStore((s) => s.setFiltroFecha);

  const quick = (filtro: FiltroFecha) => setFiltroFecha(filtro);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">{etiquetaFiltro(filtroFecha)}</span>
          <span className="sm:hidden">Fechas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={filtroFecha.tipo === 'todo' ? 'default' : 'outline'} onClick={() => quick({ tipo: 'todo' })}>
            Todo
          </Button>
          <Button size="sm" variant={filtroFecha.tipo === 'dia' && filtroFecha.valor === hoyISO() ? 'default' : 'outline'} onClick={() => quick({ tipo: 'dia', valor: hoyISO() })}>
            Hoy
          </Button>
          <Button size="sm" variant={filtroFecha.tipo === 'rango' && filtroFecha.desde === haceDiasISO(7) ? 'default' : 'outline'} onClick={() => quick({ tipo: 'rango', desde: haceDiasISO(7), hasta: hoyISO() })}>
            Últimos 7 días
          </Button>
          <Button size="sm" variant={filtroFecha.tipo === 'rango' && filtroFecha.desde === haceDiasISO(30) ? 'default' : 'outline'} onClick={() => quick({ tipo: 'rango', desde: haceDiasISO(30), hasta: hoyISO() })}>
            Últimos 30 días
          </Button>
          <Button size="sm" variant={filtroFecha.tipo === 'mes' && filtroFecha.valor === mesActual() ? 'default' : 'outline'} onClick={() => quick({ tipo: 'mes', valor: mesActual() })}>
            Mes actual
          </Button>
          <Button size="sm" variant="outline" onClick={() => quick({ tipo: 'anio', valor: String(new Date().getFullYear()) })}>
            Año actual
          </Button>
        </div>

        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Rango personalizado</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Calendar
                mode="single"
                locale={es}
                selected={filtroFecha.desde ? new Date(filtroFecha.desde + 'T12:00:00') : undefined}
                onSelect={(d) =>
                  d && quick({ tipo: 'rango', desde: d.toISOString().slice(0, 10), hasta: filtroFecha.hasta })
                }
                className="rounded-md border"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <InputFecha
              etiqueta="Desde"
              valor={filtroFecha.desde ?? ''}
              onChange={(v) => quick({ tipo: 'rango', desde: v, hasta: filtroFecha.hasta })}
            />
            <InputFecha
              etiqueta="Hasta"
              valor={filtroFecha.hasta ?? ''}
              onChange={(v) => quick({ tipo: 'rango', desde: filtroFecha.desde, hasta: v })}
            />
          </div>
        </div>

        <div className="border-t pt-3">
          <Select
            value={filtroFecha.tipo === 'mes' ? filtroFecha.valor : undefined}
            onValueChange={(v) => quick({ tipo: 'mes', valor: v })}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Filtrar por mes específico" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return (
                  <SelectItem key={valor} value={valor}>
                    {valor}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InputFecha({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex-1 space-y-1">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <input
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      />
    </label>
  );
}
