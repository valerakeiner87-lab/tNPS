'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AsesorTMO } from '@/lib/types';
import { TMO_LIMITE_SEGUNDOS } from '@/lib/types';

/** Gráfica de TMO promedio por asesor (barras horizontales, rojo si supera 970s) */
export function TMOChart({ asesores }: { asesores: AsesorTMO[] }) {
  const datos = useMemo(
    () =>
      [...asesores]
        .sort((a, b) => b.tmoPromedio - a.tmoPromedio)
        .slice(0, 25)
        .map((a) => ({
          nombre: (a.nombreHC || a.nombreGenesys || a.loginNormalizado).split(' ')[0] + ' ' +
            (a.nombreHC || a.nombreGenesys || '').split(' ').slice(1, 2).join(''),
          tmo: a.tmoPromedio,
          interacciones: a.totalInteracciones,
        })),
    [asesores]
  );

  if (datos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Sin datos TMO para graficar. ⏱️
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, datos.length * 30)}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
          label={{ value: 'segundos', position: 'insideBottomRight', fontSize: 10 }}
        />
        <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
        <ReTooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, _n, item) => [
            `${value.toFixed(1)}s ${value > TMO_LIMITE_SEGUNDOS ? '(!)' : ''}`,
            `${item.payload.nombre} · ${item.payload.interacciones} interacciones`,
          ]}
        />
        <ReferenceLine
          x={TMO_LIMITE_SEGUNDOS}
          stroke="#DC2626"
          strokeDasharray="6 3"
          label={{ value: `Límite ${TMO_LIMITE_SEGUNDOS}s`, fontSize: 10, fill: '#DC2626', position: 'top' }}
        />
        <Bar dataKey="tmo" radius={[0, 4, 4, 0]}>
          {datos.map((d) => (
            <Cell key={d.nombre} fill={d.tmo > TMO_LIMITE_SEGUNDOS ? '#DC2626' : d.tmo > 700 ? '#F59E0B' : '#16A34A'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
