'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Encuesta, Granularidad } from '@/lib/types';
import { calcularTendencia, calcularTendenciaAcumulada } from '@/lib/metrics';

interface PropsTrendChart {
  encuestas: Encuesta[];
  titulo?: string;
  altura?: number;
  mostrarSelector?: boolean;
}

export function TrendChart({
  encuestas,
  titulo = 'Tendencia tNPS',
  altura = 280,
  mostrarSelector = true,
}: PropsTrendChart) {
  const [granularidad, setGranularidad] = useState<Granularidad>('dia');
  const [modo, setModo] = useState<'periodo' | 'acumulada'>('periodo');

  const datos = useMemo(() => {
    return modo === 'periodo'
      ? calcularTendencia(encuestas, granularidad)
      : calcularTendenciaAcumulada(encuestas, granularidad);
  }, [encuestas, granularidad, modo]);

  if (encuestas.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No hay datos suficientes para graficar la tendencia.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {titulo}
          <span className="text-xs font-normal text-muted-foreground">
            ({modo === 'periodo' ? 'por período' : 'acumulada'})
          </span>
        </h3>
        {mostrarSelector && (
          <div className="flex flex-wrap gap-2">
            <Tabs value={modo} onValueChange={(v) => setModo(v as 'periodo' | 'acumulada')}>
              <TabsList className="h-8">
                <TabsTrigger value="periodo" className="text-xs px-3 h-7">Por período</TabsTrigger>
                <TabsTrigger value="acumulada" className="text-xs px-3 h-7">Acumulada</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={granularidad} onValueChange={(v) => setGranularidad(v as Granularidad)}>
              <TabsList className="h-8">
                <TabsTrigger value="dia" className="text-xs px-3 h-7">Día</TabsTrigger>
                <TabsTrigger value="semana" className="text-xs px-3 h-7">Semana</TabsTrigger>
                <TabsTrigger value="mes" className="text-xs px-3 h-7">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={altura}>
        {modo === 'periodo' ? (
          <LineChart data={datos} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <ReTooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _n, item) => [
                `tNPS ${value}`,
                `${item.payload.fecha} · ${item.payload.total} encuestas (P ${item.payload.promotores} / Pa ${item.payload.pasivos} / D ${item.payload.detractores})`,
              ]}
            />
            <Line
              type="monotone"
              dataKey="tNPS"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--primary)' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={datos} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTendencia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis domain={[-100, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <ReTooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _n, item) => [
                `tNPS ${value} (acumulado)`,
                `${item.payload.fecha} · ${item.payload.total} encuestas acumuladas`,
              ]}
            />
            <Area
              type="monotone"
              dataKey="tNPS"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#gradTendencia)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
