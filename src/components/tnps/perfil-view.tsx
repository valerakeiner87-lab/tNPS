'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Edit3,
  Flame,
  Loader2,
  Medal,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  getPerfilUsuarioAction,
  actualizarPerfilAction,
  buscarUsuariosAction,
  type PerfilUsuario,
  type UsuarioBusqueda,
} from '@/app/actions/logros-actions';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';
import { AsesorAvatar } from '@/components/tnps/asesor-avatar';
import { calcularKPIs } from '@/lib/metrics';
import { getRendimientoAsesor } from '@/app/actions/neon-actions';
import { cn } from '@/lib/utils';

function formatearTiempoCalificacion(segundos: number): string {
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

/**
 * Perfil del asesor: avatar, métricas tNPS, logros, billetera ATC.
 * v3.0 — Añade: rendimiento detallado, avatar upload, tendencias tNPS/TMO.
 */
export function PerfilView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);
  const encuestasFiltradas = useStore((s) => s.encuestasFiltradas);
  const asesoresRanking = useStore((s) => s.asesoresRanking);
  const setTab = useStore((s) => s.setTab);
  const miWallet = useATCStore((s) => s.miWallet);

  const [miPerfil, setMiPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [bio, setBio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [perfilAjeno, setPerfilAjeno] = useState<PerfilUsuario | null>(null);

  // Rendimiento detallado (server action)
  const [rendimiento, setRendimiento] = useState<any | null>(null);
  const [cargandoRend, setCargandoRend] = useState(true);

  useEffect(() => {
    cargarPerfil();
  }, []);

  useEffect(() => {
    if (busqueda.trim().length >= 2) {
      const timer = setTimeout(() => {
        buscarUsuariosAction(busqueda).then(setResultados).catch(() => setResultados([]));
      }, 300);
      return () => clearTimeout(timer);
    } else if (resultados.length > 0) {
      setResultados([]);
    }
  }, [busqueda]);

  async function cargarPerfil(userId?: string) {
    setCargando(true);
    try {
      const p = await getPerfilUsuarioAction(userId);
      if (userId) {
        setPerfilAjeno(p);
      } else {
        setMiPerfil(p);
        setBio(p?.bio || '');
        // Cargar rendimiento solo si es mi perfil y hay loginNormalizado
        const login = p?.loginNormalizado || perfil?.loginNormalizado;
        const area = (perfil?.area || 'digital') as 'digital' | 'telefonico';
        if (login) {
          setCargandoRend(true);
          getRendimientoAsesor(login, area)
            .then((r) => setRendimiento(r))
            .catch(() => setRendimiento(null))
            .finally(() => setCargandoRend(false));
        } else {
          setCargandoRend(false);
        }
      }
    } finally {
      setCargando(false);
    }
  }

  async function guardarPerfil() {
    setGuardando(true);
    try {
      await actualizarPerfilAction(undefined, bio || null);
      await cargarPerfil();
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  // === Métricas del asesor (encuestasFiltradas ya está filtrado por login) ===
  const misKPIs = useMemo(() => calcularKPIs(encuestasFiltradas), [encuestasFiltradas]);

  // Login propio del asesor (para buscar posición en el ranking del área)
  const loginPropio =
    perfilAsesor?.loginNormalizado ||
    perfil?.loginNormalizado ||
    miPerfil?.loginNormalizado ||
    '';

  const posicionRanking = useMemo(() => {
    if (!loginPropio || asesoresRanking.length === 0) return null;
    const idx = asesoresRanking.findIndex((a) => a.loginNormalizado === loginPropio);
    return idx >= 0 ? idx + 1 : null;
  }, [asesoresRanking, loginPropio]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const perfilMostrado = perfilAjeno || miPerfil;
  const esMio = !perfilAjeno;

  // Color del tNPS según valor (>=50 promotor, >=0 pasivo, <0 detractor)
  const colorTNPS =
    misKPIs.tNPS >= 50 ? 'text-promotor' : misKPIs.tNPS >= 0 ? 'text-pasivo' : 'text-detractor';

  const totalGastado = miWallet?.stats?.totalGastado ?? 0;
  const areaUsuario = (perfil?.area || 'digital') as 'digital' | 'telefonico';

  return (
    <div className="space-y-4">
      {/* === Encabezado: avatar + datos básicos + editar === */}
      {perfilMostrado && (
        <Card className="header-claro text-white border-0">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="relative">
                <AsesorAvatar
                  login={perfilMostrado.loginNormalizado || perfilMostrado.username}
                  nombre={perfilMostrado.name || perfilMostrado.username}
                  avatarUrl={perfilMostrado.avatarUrl}
                  size="xl"
                  className="ring-4 ring-white/30"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{perfilMostrado.name || perfilMostrado.username}</h2>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                    @{perfilMostrado.username}
                  </span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs capitalize">
                    {perfilMostrado.role.toLowerCase()}
                  </span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs capitalize">
                    {perfilMostrado.area}
                  </span>
                </div>
                {perfilMostrado.bio && <p className="text-sm text-white/80 mt-2">{perfilMostrado.bio}</p>}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {esMio && (
                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => setEditando(true)}>
                      <Edit3 className="h-3.5 w-3.5" /> Editar perfil
                    </Button>
                  )}
                  {esMio && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => setTab('mi-billetera')}
                    >
                      <Wallet className="h-3.5 w-3.5" /> Mi billetera
                    </Button>
                  )}
                </div>
              </div>
              {perfilAjeno && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                  onClick={() => setPerfilAjeno(null)}
                >
                  <X className="h-4 w-4" /> Cerrar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Rendimiento detallado (v3.0) === */}
      {esMio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Rendimiento detallado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargandoRend ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !rendimiento || rendimiento.totalEncuestas === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aún no hay datos suficientes para mostrar tu rendimiento. Sigue recibiendo
                encuestas para ver tus métricas detalladas.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Punto fuerte + índice promedio destacado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                    <span className="text-4xl" aria-hidden>
                      {rendimiento.puntoFuerteEmoji || '⭐'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Punto fuerte
                      </p>
                      <p className="font-bold text-lg leading-tight">{rendimiento.puntoFuerte}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
                    <div className="flex items-center gap-0.5" aria-hidden>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={cn(
                            'h-5 w-5',
                            rendimiento.indicePromedio !== null &&
                              i <= Math.round(rendimiento.indicePromedio)
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-muted text-muted-foreground/40'
                          )}
                        />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Índice promedio
                      </p>
                      <p className="font-bold text-lg tabular-nums">
                        {rendimiento.indicePromedio ?? '—'}
                        <span className="text-sm font-normal text-muted-foreground"> / 5</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tiempo de calificación + frecuencia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Tiempo de calificación</p>
                    <p className="text-xl font-bold tabular-nums">
                      {formatearTiempoCalificacion(rendimiento.promedioTiempoCalificacion || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Promedio entre atención y registro de la encuesta
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase">Frecuencia de respuesta</p>
                    <p className="text-xl font-bold tabular-nums">
                      {rendimiento.frecuenciaRespuestaHoras > 0
                        ? `${rendimiento.frecuenciaRespuestaHoras}h`
                        : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cada cuántas horas recibes una encuesta
                    </p>
                  </div>
                </div>

                {/* Índices individuales con barra de progreso */}
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Índices individuales
                  </p>
                  <IndiceBarra
                    nombre={areaUsuario === 'telefonico' ? 'AMABILIDAD' : 'TIEMPO'}
                    valor={areaUsuario === 'telefonico' ? rendimiento.indiceAmabilidad : rendimiento.indiceTiempo}
                  />
                  <IndiceBarra nombre="CONOCIMIENTO" valor={rendimiento.indiceConocimiento} />
                  <IndiceBarra nombre="SOLUCION" valor={rendimiento.indiceSolucion} />
                </div>

                {/* Tendencia tNPS del mes */}
                {rendimiento.tnpsTendencia && rendimiento.tnpsTendencia.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Tendencia tNPS del mes
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={rendimiento.tnpsTendencia.map((t: any) => ({
                          fecha: formatearFechaCorta(t.fecha),
                          tNPS: t.tNPS,
                        }))}
                        margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <YAxis domain={[-100, 100]} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="tNPS"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tendencia TMO del mes */}
                {rendimiento.tmoTendencia && rendimiento.tmoTendencia.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                      Tendencia TMO del mes
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={rendimiento.tmoTendencia.map((t: any) => ({
                          fecha: formatearFechaCorta(t.fecha),
                          tmo: t.tmo,
                        }))}
                        margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [`${value}s`, 'TMO']}
                        />
                        <Line
                          type="monotone"
                          dataKey="tmo"
                          stroke="#1A3F7A"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === Mis Métricas (solo para mi perfil) === */}
      {esMio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Mis métricas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* tNPS destacado + totales por grupo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center flex flex-col justify-center">
                <p className="text-xs text-muted-foreground uppercase">Mi tNPS</p>
                <p className={cn('text-4xl font-bold tabular-nums', colorTNPS)}>
                  {misKPIs.tNPS > 0 ? '+' : ''}
                  {misKPIs.tNPS}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Score promedio: {misKPIs.scorePromedio.toFixed(1)}
                </p>
              </div>

              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Encuestas</p>
                  <p className="text-2xl font-bold tabular-nums">{misKPIs.total}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Promotores</p>
                  <p className="text-2xl font-bold text-promotor tabular-nums">{misKPIs.promotores}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Pasivos</p>
                  <p className="text-2xl font-bold text-pasivo tabular-nums">{misKPIs.pasivos}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase">Detractores</p>
                  <p className="text-2xl font-bold text-detractor tabular-nums">{misKPIs.detractores}</p>
                </div>
              </div>
            </div>

            {/* Racha y Ranking */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <Flame
                  className={cn(
                    'h-8 w-8 shrink-0',
                    (miPerfil?.rachaActual ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase">Racha actual</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {miPerfil?.rachaActual ?? 0}{' '}
                    <span className="text-sm font-normal text-muted-foreground">días</span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <Medal
                  className={cn(
                    'h-8 w-8 shrink-0',
                    posicionRanking ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase">Ranking del área</p>
                  {posicionRanking ? (
                    <p className="text-2xl font-bold tabular-nums">
                      #{posicionRanking}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        de {asesoresRanking.length}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground py-1">Sin posición todavía</p>
                  )}
                </div>
              </div>
            </div>

            {/* Distribución porcentual */}
            {misKPIs.total > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase mb-2">Distribución</p>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-promotor"
                    style={{ width: `${misKPIs.pctPromotores}%` }}
                    title={`Promotores ${misKPIs.pctPromotores}%`}
                  />
                  <div
                    className="bg-pasivo"
                    style={{ width: `${misKPIs.pctPasivos}%` }}
                    title={`Pasivos ${misKPIs.pctPasivos}%`}
                  />
                  <div
                    className="bg-detractor"
                    style={{ width: `${misKPIs.pctDetractores}%` }}
                    title={`Detractores ${misKPIs.pctDetractores}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                  <span className="text-promotor">{misKPIs.pctPromotores}%</span>
                  <span className="text-pasivo">{misKPIs.pctPasivos}%</span>
                  <span className="text-detractor">{misKPIs.pctDetractores}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === Resumen de billetera (solo para mi perfil) === */}
      {esMio && miPerfil && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Mi billetera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 p-4 text-white text-center">
                <p className="text-xs uppercase opacity-80">Saldo ATC</p>
                <p className="text-3xl font-bold tabular-nums">{miPerfil.saldo}</p>
                <p className="text-xs opacity-80">disponible para canjear</p>
              </div>
              <div className="rounded-xl border p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Total ganado</p>
                <p className="text-2xl font-bold text-promotor tabular-nums">+{miPerfil.totalGanado}</p>
                <p className="text-xs text-muted-foreground">ATC históricos</p>
              </div>
              <div className="rounded-xl border p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Total gastado</p>
                <p className="text-2xl font-bold text-pasivo tabular-nums">-{totalGastado}</p>
                <p className="text-xs text-muted-foreground">ATC en premios</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() => setTab('mi-billetera')}
            >
              <Wallet className="h-3.5 w-3.5" /> Ir a billetera completa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* === Logros ampliados === */}
      {perfilMostrado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Logros ({perfilMostrado.logros.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perfilMostrado.logros.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aún no has desbloqueado logros. ¡Sigue recibiendo encuestas promotor para ganar tus
                primeras medallas!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {perfilMostrado.logros.map((ul) => (
                  <div
                    key={ul.id}
                    className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3 animar-aparecer"
                  >
                    <span className="text-3xl shrink-0" aria-hidden>{ul.logro?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-tight">{ul.logro?.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {ul.logro?.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {ul.logro?.puntosRecompensa ? (
                          <Badge variant="outline" className="text-amber-600 text-[10px]">
                            +{ul.logro.puntosRecompensa} ATC
                          </Badge>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(ul.otorgadoEn).toLocaleDateString('es-GT')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === Buscador social (sección secundaria) === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Buscar asesores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o login (ej. glendaj.duarte)…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          {resultados.length > 0 && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto scroll-fino">
              {resultados.map((u) => (
                <button
                  key={u.id}
                  onClick={() => cargarPerfil(u.id)}
                  className="w-full flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-accent/40 transition-colors"
                >
                  <AsesorAvatar
                    login={u.username}
                    nombre={u.name || u.username}
                    avatarUrl={u.avatarUrl}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name || u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{u.username} · {u.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Trophy className="h-3 w-3" /> {u.totalLogros}
                    </Badge>
                    <Badge variant="outline">{u.saldo} ATC</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === Dialog: editar perfil === */}
      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Cuéntanos algo sobre ti…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{bio.length}/200</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarPerfil} disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Sub-componente: barra de progreso de un índice (1-5) ===
function IndiceBarra({ nombre, valor }: { nombre: string; valor: number | null }) {
  const v = typeof valor === 'number' ? valor : 0;
  const pct = Math.min((v / 5) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{nombre}</span>
        <span className="tabular-nums text-muted-foreground">
          {valor !== null ? valor.toFixed(2) : '—'} / 5
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
