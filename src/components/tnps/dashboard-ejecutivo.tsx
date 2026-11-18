'use client';

// ============================================================
// v3.0.5 — Dashboard Ejecutivo
// Vista resumen para Admin/Supervisor con KPIs, tendencias,
// distribución, top 5 asesores y comparativa Digital vs Telefónico.
// Todos los datos se calculan en cliente a partir del store.
// ============================================================

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  BarChart3,
  Coins,
  PieChart as PieIcon,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { calcularKPIs } from '@/lib/metrics';
import { calcularTendencia } from '@/lib/metrics';
import type { Encuesta } from '@/lib/types';

const COLORES = {
  promotor: '#16A34A',
  pasivo: '#F59E0B',
  detractor: '#DC2626',
  digital: '#0EA5E9',
  telefonico: '#8B5CF6',
  primary: 'var(--primary)',
};

function calcularIndicePromedio(encuestas: Encuesta[]): number {
  let suma = 0;
  let n = 0;
  for (const e of encuestas) {
    if (typeof e.indicePromedio === 'number' && e.indicePromedio > 0) {
      suma += e.indicePromedio;
      n++;
    }
  }
  return n > 0 ? Math.round((suma / n) * 100) / 100 : 0;
}

interface KPIEjecutivo {
  titulo: string;
  valor: string;
  subtitulo: string;
  icono: React.ReactNode;
  colorTexto: string;
}

export function DashboardEjecutivo() {
  const kpis = useStore((s) => s.kpisFiltrados);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const asesoresConsolidados = useStore((s) => s.asesoresConsolidados);
  const encuestasTodas = useStore((s) => s.encuestas);
  const wallets = useATCStore((s) => s.wallets);

  // ---------- Datos derivados ----------
  const indicePromedio = useMemo(
    () => calcularIndicePromedio(encuestasFiltradas),
    [encuestasFiltradas]
  );

  const atcEnCirculacion = useMemo(
    () => wallets.reduce((acc, w) => acc + (w.saldo || 0), 0),
    [wallets]
  );

  const totalAsesoresActivos = asesoresConsolidados.length;

  const datosTendencia = useMemo(
    () => calcularTendencia(encuestasFiltradas, 'dia'),
    [encuestasFiltradas]
  );

  const datosDistribucion = useMemo(
    () => [
      { name: 'Promotores', value: kpis.promotores, color: COLORES.promotor },
      { name: 'Pasivos', value: kpis.pasivos, color: COLORES.pasivo },
      { name: 'Detractores', value: kpis.detractores, color: COLORES.detractor },
    ],
    [kpis]
  );

  const top5Asesores = useMemo(() => {
    return [...asesoresConsolidados]
      .filter((a) => a.kpis.total >= 3) // mínimo 3 encuestas para entrar al top
      .sort((a, b) => b.kpis.tNPS - a.kpis.tNPS)
      .slice(0, 5);
  }, [asesoresConsolidados]);

  const comparativaAreas = useMemo(() => {
    // v3.3.0: Solo área Digital. Se conserva el array para que el BarChart
    // siga funcionando sin cambios en la UI.
    const digital = encuestasTodas.filter((e) => (e.area ?? 'digital') === 'digital');
    const kDigital = calcularKPIs(digital);
    return [
      {
        area: 'Digital',
        tNPS: Math.round(kDigital.tNPS * 10) / 10,
        pctPromotores: Math.round(kDigital.pctPromotores * 10) / 10,
        indicePromedio: calcularIndicePromedio(digital),
        color: COLORES.digital,
      },
    ];
  }, [encuestasTodas]);

  const kpisEjecutivos: KPIEjecutivo[] = [
    {
      titulo: 'tNPS Global',
      valor: `${kpis.tNPS >= 0 ? '+' : ''}${kpis.tNPS.toFixed(1)}`,
      subtitulo: `${kpis.total.toLocaleString('es-GT')} encuestas`,
      icono: <TrendingUp className="h-5 w-5" />,
      colorTexto:
        kpis.tNPS >= 50
          ? 'text-promotor'
          : kpis.tNPS >= 0
          ? 'text-pasivo'
          : 'text-detractor',
    },
    {
      titulo: 'Total Encuestas',
      valor: kpis.total.toLocaleString('es-GT'),
      subtitulo: 'En el período filtrado',
      icono: <BarChart3 className="h-5 w-5" />,
      colorTexto: 'text-foreground',
    },
    {
      titulo: 'ATC en Circulación',
      valor: atcEnCirculacion.toLocaleString('es-GT'),
      subtitulo: `${wallets.length} wallets activas`,
      icono: <Coins className="h-5 w-5" />,
      colorTexto: 'text-claro-blue',
    },
    {
      titulo: 'Asesores Activos',
      valor: totalAsesoresActivos.toLocaleString('es-GT'),
      subtitulo: 'Con encuestas en el período',
      icono: <Users className="h-5 w-5" />,
      colorTexto: 'text-foreground',
    },
    {
      titulo: 'Promedio Índice',
      valor: indicePromedio.toFixed(2),
      subtitulo: 'Sobre 5.0',
      icono: <Star className="h-5 w-5" />,
      colorTexto: 'text-claro-blue',
    },
  ];

  if (kpis.total === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <PieIcon className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden />
          <p className="font-medium">No hay datos para el dashboard ejecutivo</p>
          <p className="text-sm text-muted-foreground">
            Ajusta los filtros de fecha o carga nuevos archivos desde la pestaña Carga.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== KPI Cards Row ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpisEjecutivos.map((k) => (
          <Card key={k.titulo} className="border-l-4 border-l-primary/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {k.titulo}
                  </p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${k.colorTexto}`}>
                    {k.valor}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{k.subtitulo}</p>
                </div>
                <div className="shrink-0 text-muted-foreground/70">{k.icono}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== Charts Side by Side ===== */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* tNPS trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden />
              Evolución del tNPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {datosTendencia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Sin datos suficientes para graficar.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosTendencia} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
                      `${item.payload.fecha} · ${item.payload.total} encuestas`,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="tNPS"
                    stroke={COLORES.primary}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORES.primary }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribución P/Pa/D */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="h-4 w-4" aria-hidden />
              Distribución Promotores / Pasivos / Detractores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={datosDistribucion}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={(entry) => `${(entry as { value: number }).value}`}
                >
                  {datosDistribucion.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ===== Top 5 Asesores por tNPS ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" aria-hidden />
            Top 5 Asesores por tNPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {top5Asesores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay asesores con al menos 3 encuestas en el período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Asesor</TableHead>
                    <TableHead className="text-right">tNPS</TableHead>
                    <TableHead className="text-right">Encuestas</TableHead>
                    <TableHead className="text-right">Índice prom.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top5Asesores.map((a, idx) => {
                    const indice = calcularIndicePromedio(a.encuestas);
                    return (
                      <TableRow key={a.loginNormalizado}>
                        <TableCell className="font-bold text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{a.nombre}</div>
                          <div className="text-xs text-muted-foreground">{a.loginNormalizado}</div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold tabular-nums ${
                            a.kpis.tNPS >= 50
                              ? 'text-promotor'
                              : a.kpis.tNPS >= 0
                              ? 'text-pasivo'
                              : 'text-detractor'
                          }`}
                        >
                          {a.kpis.tNPS >= 0 ? '+' : ''}
                          {a.kpis.tNPS.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.kpis.total.toLocaleString('es-GT')}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {indice.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Áreas: comparativa Digital vs Telefónico ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Comparativa de Áreas: Digital vs Telefónico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={comparativaAreas} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="area" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <ReTooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tNPS" name="tNPS" fill={COLORES.digital} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pctPromotores" name="% Promotores" fill={COLORES.promotor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="indicePromedio" name="Índice prom. (×10)" fill={COLORES.pasivo} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            El &quot;Índice promedio&quot; se muestra multiplicado por 10 para que sea visible
            en la misma escala que tNPS y % Promotores.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
