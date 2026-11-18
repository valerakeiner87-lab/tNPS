'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Loader2, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { getTMODailyAsesor, getConfigTMOLineas } from '@/app/actions/neon-actions';

interface TMODaily {
  fecha: string;
  tmo: number;
  interacciones: number;
}

function formatearSegundos(segundos: number): string {
  if (!segundos || segundos <= 0) return '—';
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatearFechaCorta(fechaIso: string): string {
  try {
    const d = new Date(fechaIso + 'T00:00:00');
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' });
  } catch {
    return fechaIso;
  }
}

export function TMOSupervisorView() {
  const perfil = useStore((s) => s.perfil);
  const areaActiva = useStore((s) => s.areaActiva);

  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [umbralLineas, setUmbralLineas] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      import('@/app/actions/neon-actions').then((m) => m.getTMODailyMesActual(areaActiva)),
      getConfigTMOLineas(),
    ])
      .then(([rows, configLineas]) => {
        setData(rows as any[]);
        const umbrales: Record<string, number> = {};
        for (const c of configLineas as any[]) {
          umbrales[c.linea] = Number(c.tmoMaximo);
        }
        setUmbralLineas(umbrales);
      })
      .catch(() => {
        setData([]);
      })
      .finally(() => setCargando(false));
  }, [areaActiva]);

  // Consolidar por asesor: { login, nombre, lob, tmoMesAvg, tmo7diasAvg, interacciones }
  const consolidado = useMemo(() => {
    const ahora = new Date();
    const hace7dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fechaCorte7 = hace7dias.toISOString().slice(0, 10);

    const porAsesor = new Map<
      string,
      {
        login: string;
        nombre: string;
        lob: string;
        mes: { totalManejo: number; totalInt: number };
        dias7: { totalManejo: number; totalInt: number };
        interacciones: number;
        umbral: number | null;
      }
    >();

    for (const r of data) {
      const login = r.loginNormalizado || r.documento || '—';
      const nombre = r.nombreAsesor || login;
      const lob = r.lob || '—';
      const fecha = r.fecha || '';
      const tmo = Number(r.tmo) || 0;
      const interacciones = Number(r.interacciones) || 0;
      if (interacciones === 0) continue;

      const key = login;
      const entry =
        porAsesor.get(key) ||
        {
          login,
          nombre,
          lob,
          mes: { totalManejo: 0, totalInt: 0 },
          dias7: { totalManejo: 0, totalInt: 0 },
          interacciones: 0,
          umbral: null,
        };
      // manejoTotal = tmo * interacciones
      const manejo = tmo * interacciones;
      entry.mes.totalManejo += manejo;
      entry.mes.totalInt += interacciones;
      entry.interacciones += interacciones;
      if (fecha >= fechaCorte7) {
        entry.dias7.totalManejo += manejo;
        entry.dias7.totalInt += interacciones;
      }
      // Umbral por LOB
      if (entry.umbral === null && umbralLineas[lob]) {
        entry.umbral = umbralLineas[lob];
      }
      porAsesor.set(key, entry);
    }

    const arr = Array.from(porAsesor.values()).map((e) => ({
      ...e,
      tmoMes: e.mes.totalInt > 0 ? Math.round((e.mes.totalManejo / e.mes.totalInt) * 10) / 10 : 0,
      tmo7dias: e.dias7.totalInt > 0 ? Math.round((e.dias7.totalManejo / e.dias7.totalInt) * 10) / 10 : 0,
    }));

    // Sort by TMO mes actual (ascendente — lowest first = best)
    arr.sort((a, b) => a.tmoMes - b.tmoMes);
    return arr;
  }, [data, umbralLineas]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (consolidado.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Timer className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Sin datos TMO para esta área</p>
          <p className="text-sm text-muted-foreground">
            Carga el archivo TMO diario desde la pestaña de carga para ver el detalle por asesor.
          </p>
        </CardContent>
      </Card>
    );
  }

  const top5 = new Set(consolidado.slice(0, 5).map((a) => a.login));
  const bottom5 = new Set(consolidado.slice(-5).map((a) => a.login));

  const exportarExcel = async () => {
    const { exportarTablaAExcel } = await import('@/lib/excel-export');
    const filas = consolidado.map((a, i) => ({
      '#': i + 1,
      Asesor: a.nombre,
      Login: a.login,
      LOB: a.lob,
      'TMO 7 días (s)': a.tmo7dias,
      'TMO mes (s)': a.tmoMes,
      Interacciones: a.interacciones,
      'Umbral línea (s)': a.umbral ?? '—',
      Estado: a.umbral && a.tmoMes > a.umbral ? '❌ sobre umbral' : '✅ dentro del umbral',
    }));
    exportarTablaAExcel(filas, 'TMO Asesores', `tmo_asesores_${areaActiva}_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card className="header-claro text-white border-0">
        <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wide">Supervisión TMO</p>
              <p className="text-xl font-bold">
                TMO por asesor · {areaActiva === 'digital' ? 'Digital' : 'Telefónico'}
              </p>
            </div>
          </div>
          <button
            onClick={exportarExcel}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white px-3 py-2 text-sm transition-colors"
          >
            📊 Exportar Excel
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle por asesor</CardTitle>
          <CardDescription>
            Ordenado de menor a mayor TMO (mejor primero). 🟢 Top 5 mejor · 🔴 Top 5 peor · Umbral
            según la línea del asesor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-[65vh] overflow-y-auto scroll-fino">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b">
                    <th className="text-left p-2.5 font-medium">#</th>
                    <th className="text-left p-2.5 font-medium">Asesor</th>
                    <th className="text-left p-2.5 font-medium hidden sm:table-cell">LOB</th>
                    <th className="text-right p-2.5 font-medium">TMO 7d</th>
                    <th className="text-right p-2.5 font-medium">TMO mes</th>
                    <th className="text-right p-2.5 font-medium hidden sm:table-cell">Interacciones</th>
                    <th className="text-center p-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidado.map((a, i) => {
                    const esTop = top5.has(a.login);
                    const esBottom = bottom5.has(a.login);
                    const sobreUmbral = a.umbral !== null && a.tmoMes > a.umbral;
                    return (
                      <tr
                        key={a.login}
                        className={`border-b hover:bg-accent/30 ${
                          esTop ? 'bg-promotor/5' : esBottom ? 'bg-detractor/5' : ''
                        }`}
                      >
                        <td className="p-2.5 text-muted-foreground tabular-nums">
                          {esTop && '🟢'}
                          {esBottom && '🔴'}
                          {!esTop && !esBottom && i + 1}
                        </td>
                        <td className="p-2.5">
                          <p className="font-medium truncate max-w-44">{a.nombre}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-44">
                            @{a.login}
                          </p>
                        </td>
                        <td className="p-2.5 hidden sm:table-cell text-xs">{a.lob}</td>
                        <td className="p-2.5 text-right tabular-nums">
                          {formatearSegundos(a.tmo7dias)}
                          <p className="text-[10px] text-muted-foreground">{a.tmo7dias}s</p>
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-semibold">
                          {formatearSegundos(a.tmoMes)}
                          <p className="text-[10px] text-muted-foreground">{a.tmoMes}s</p>
                        </td>
                        <td className="p-2.5 text-right tabular-nums hidden sm:table-cell">
                          {a.interacciones.toLocaleString('es-GT')}
                        </td>
                        <td className="p-2.5 text-center">
                          {a.umbral === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : sobreUmbral ? (
                            <span className="inline-flex items-center gap-1 text-xs text-detractor font-medium">
                              <TrendingUp className="h-3 w-3" /> sobre umbral
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-promotor font-medium">
                              <TrendingDown className="h-3 w-3" /> dentro
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Vista TMO del asesor: muestra su tendencia diaria del mes actual */
export function TMOAsesorView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const areaActiva = useStore((s) => s.areaActiva);

  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<TMODaily[]>([]);
  const [umbral, setUmbral] = useState<number | null>(null);

  const login = perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '';

  useEffect(() => {
    Promise.all([
      getTMODailyAsesor(login),
      getConfigTMOLineas(),
    ])
      .then(([rows, configLineas]) => {
        setData(rows as TMODaily[]);
        // Buscar el umbral según el LOB del asesor
        const lob = (perfilAsesor?.lob || '').trim();
        const lobLower = lob.toLowerCase();
        const cfg = (configLineas as any[]).find((c) => {
          const cLinea = (c.linea || '').toLowerCase();
          const cNorm = (c.lineaNormalizada || '').toLowerCase();
          return (
            cLinea === lobLower ||
            cNorm === lobLower.replace(/[^a-z0-9]/g, '_') ||
            lobLower.includes(cNorm) ||
            cNorm.includes(lobLower.replace(/[^a-z0-9]/g, '_'))
          );
        });
        setUmbral(cfg ? Number(cfg.tmoMaximo) : null);
      })
      .catch(() => setData([]))
      .finally(() => setCargando(false));
  }, [login, perfilAsesor?.lob]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        fecha: formatearFechaCorta(d.fecha),
        tmo: Math.round(d.tmo * 10) / 10,
        interacciones: d.interacciones,
      })),
    [data]
  );

  const kpis = useMemo(() => {
    if (data.length === 0) {
      return { promedio: 0, mejor: null, peor: null, total: 0 };
    }
    const totalInt = data.reduce((s, d) => s + d.interacciones, 0);
    const totalManejo = data.reduce((s, d) => s + d.tmo * d.interacciones, 0);
    const promedio = totalInt > 0 ? Math.round((totalManejo / totalInt) * 10) / 10 : 0;
    const mejor = data.reduce((a, b) => (a.tmo < b.tmo ? a : b));
    const peor = data.reduce((a, b) => (a.tmo > b.tmo ? a : b));
    return { promedio, mejor, peor, total: totalInt };
  }, [data]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <Timer className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Aún no tienes datos TMO</p>
          <p className="text-sm text-muted-foreground">
            Tu supervisor está cargando los datos diarios. Vuelve más tarde.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="header-claro text-white border-0">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
            <Timer className="h-6 w-6" />
          </div>
          <div>
            <p className="text-white/70 text-xs uppercase tracking-wide">Mi TMO · mes actual</p>
            <p className="text-xl font-bold">{perfilAsesor?.nombre || perfil?.nombre}</p>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">TMO promedio</p>
            <p className="text-2xl font-bold tabular-nums">{formatearSegundos(kpis.promedio)}</p>
            <p className="text-xs text-muted-foreground">{kpis.promedio}s</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-promotor">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Mejor día</p>
            <p className="text-2xl font-bold text-promotor tabular-nums">
              {formatearSegundos(kpis.mejor?.tmo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.mejor ? formatearFechaCorta(kpis.mejor.fecha) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-detractor">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Peor día</p>
            <p className="text-2xl font-bold text-detractor tabular-nums">
              {formatearSegundos(kpis.peor?.tmo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.peor ? formatearFechaCorta(kpis.peor.fecha) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-claro-blue">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Interacciones</p>
            <p className="text-2xl font-bold tabular-nums">{kpis.total.toLocaleString('es-GT')}</p>
            <p className="text-xs text-muted-foreground">en el mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendencia */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Mi tendencia TMO del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Sin datos suficientes.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  label={{
                    value: 'segundos',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: 'var(--muted-foreground)' },
                  }}
                />
                <ReTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _n, item) => [
                    `${value}s`,
                    `${item.payload.fecha} · ${item.payload.interacciones} int.`,
                  ]}
                />
                {umbral !== null && (
                  <ReferenceLine
                    y={umbral}
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    label={{
                      value: `Umbral ${umbral}s`,
                      position: 'right',
                      fill: 'var(--destructive)',
                      fontSize: 11,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="tmo"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--primary)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
