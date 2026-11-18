'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { getEncuestasArea } from '@/app/actions/neon-actions';
import type { Encuesta, Linea } from '@/lib/types';
import { cn } from '@/lib/utils';

// ============================================================
// Tipos
// ============================================================
interface EntradaPodio {
  login: string;
  nombre: string;
  encuestas: number;
  tnps: number; // ya redondeado (-100..100)
}

interface PodioData {
  top10: EntradaPodio[];
  top5Lob: EntradaPodio[];
  miPosicionGlobal: number; // 0 = no está
  totalGlobal: number;
  miPosicionLob: number; // 0 = no está
  totalLob: number;
  miLob: Linea | null;
  area: string;
  loginActual: string;
}

interface CacheEntry {
  data: PodioData;
  ts: number;
}

// ============================================================
// Constantes
// ============================================================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ============================================================
// Helpers de caché
// ============================================================
function leerCache(login: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(`podio-cache-${login}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL) return null; // expirado
    return parsed;
  } catch {
    return null;
  }
}

function guardarCache(login: string, data: PodioData) {
  try {
    localStorage.setItem(`podio-cache-${login}`, JSON.stringify({ data, ts: Date.now() } as CacheEntry));
  } catch {
    /* noop */
  }
}

// ============================================================
// Helpers de cálculo
// ============================================================

/** Agrupa encuestas por login y calcula tNPS de cada asesor. */
function calcularPodio(encuestas: Encuesta[]): EntradaPodio[] {
  const porAsesor = new Map<
    string,
    { nombre: string; encuestas: number; promotores: number; detractores: number }
  >();
  for (const e of encuestas) {
    const login = e.loginNormalizado;
    if (!login) continue;
    const actual = porAsesor.get(login) ?? {
      nombre: e.usuario || login,
      encuestas: 0,
      promotores: 0,
      detractores: 0,
    };
    actual.encuestas++;
    if (e.grupo === 'Promotor') actual.promotores++;
    if (e.grupo === 'Detractor') actual.detractores++;
    porAsesor.set(login, actual);
  }
  const arr: EntradaPodio[] = Array.from(porAsesor.entries()).map(([login, d]) => ({
    login,
    nombre: d.nombre,
    encuestas: d.encuestas,
    tnps: d.encuestas > 0 ? Math.round(((d.promotores - d.detractores) / d.encuestas) * 100) : 0,
  }));
  // v3.0.7: Ordenar por más encuestas primero, luego por tNPS desc
  // score = encuestas * 100 + tnps (mayor = mejor)
  arr.sort((a, b) => {
    const sa = a.encuestas * 100 + a.tnps;
    const sb = b.encuestas * 100 + b.tnps;
    return sb - sa;
  });
  return arr;
}

/** Calcula el podio completo (global + LOB) a partir de las encuestas del área. */
function calcularPodioCompleto(
  encuestas: Encuesta[],
  loginActual: string,
  area: string,
  miLobFallback?: Linea | null
): PodioData {
  const todo = calcularPodio(encuestas);

  // Determinar el LOB del asesor actual
  let miLob: Linea | null = miLobFallback ?? null;
  if (!miLob) {
    const propia = encuestas.find((e) => e.loginNormalizado === loginActual);
    if (propia?.linea) miLob = propia.linea;
  }

  // Podio Global: top 10 del área
  const top10 = todo.slice(0, 10);
  const miPosicionGlobal = loginActual
    ? todo.findIndex((a) => a.login === loginActual) + 1
    : 0;
  const totalGlobal = todo.length;

  // Podio por LOB: filtrar encuestas por el LOB del asesor actual
  let top5Lob: EntradaPodio[] = [];
  let miPosicionLob = 0;
  let totalLob = 0;
  if (miLob) {
    const encuestasLob = encuestas.filter((e) => e.linea === miLob);
    const arrLob = calcularPodio(encuestasLob);
    top5Lob = arrLob.slice(0, 5);
    miPosicionLob = loginActual
      ? arrLob.findIndex((a) => a.login === loginActual) + 1
      : 0;
    totalLob = arrLob.length;
  }

  return {
    top10,
    top5Lob,
    miPosicionGlobal,
    totalGlobal,
    miPosicionLob,
    totalLob,
    miLob,
    area,
    loginActual,
  };
}

/** Calcula "hace X minutos" a partir de un timestamp. */
function hace(tiempo: number): string {
  const diff = Math.max(0, Date.now() - tiempo);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hace menos de 1 min';
  if (min === 1) return 'hace 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'hace 1 hora';
  return `hace ${h} horas`;
}

/** Color del tNPS según valor (>=50 promotor, >=0 pasivo, <0 detractor). */
function colorTNPS(tnps: number): string {
  if (tnps >= 50) return 'text-promotor';
  if (tnps >= 0) return 'text-pasivo';
  return 'text-detractor';
}

// ============================================================
// Componente principal
// ============================================================
export function PodioGlobal() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const [data, setData] = useState<PodioData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cacheTs, setCacheTs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tick para forzar re-render del "hace X min" cada minuto
  const [, setTick] = useState(0);

  const loginActual =
    perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '';
  const area = (perfil?.area || 'digital') as 'digital' | 'telefonico';
  // LOB preferido del store (puede ser undefined para asesores sintéticos)
  const miLobStore = perfilAsesor?.linea ?? null;

  // === Carga inicial: leer caché primero, si no válido, fetch ===
  useEffect(() => {
    if (!loginActual) return;
    // 1. Leer caché
    const cache = leerCache(loginActual);
    if (cache && cache.data.area === area) {
      setData(cache.data);
      setCacheTs(cache.ts);
      // Caché válido (< 5 min) → no refetch
      return;
    }
    // 2. Sin caché válido → fetch
    void refrescar(false);
  }, [loginActual, area]);

  // === Tick para refrescar "hace X minutos" cada 60s ===
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  async function refrescar(forzar: boolean) {
    if (!loginActual) return;
    if (!forzar) {
      // Si hay caché válido, no hacer nada
      const cache = leerCache(loginActual);
      if (cache && cache.data.area === area) {
        setData(cache.data);
        setCacheTs(cache.ts);
        return;
      }
    }
    setCargando(true);
    setError(null);
    try {
      const encuestas = await getEncuestasArea(area);
      const podio = calcularPodioCompleto(encuestas, loginActual, area, miLobStore);
      guardarCache(loginActual, podio);
      setData(podio);
      setCacheTs(Date.now());
    } catch (e) {
      console.error('Error al cargar podio:', e);
      setError('No se pudo cargar el podio. Intenta de nuevo con el botón Refrescar.');
    } finally {
      setCargando(false);
    }
  }

  // === Loading inicial (sin datos en caché) ===
  if (!data && cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data && error) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => refrescar(true)} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header con posición + refresh */}
      <Card className="header-claro text-white border-0">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-pasivo" aria-hidden />
            <div>
              <p className="font-bold text-base">Podio del área {area === 'digital' ? 'Digital' : 'Telefónico'}</p>
              <p className="text-xs text-white/70">
                {data.miPosicionGlobal > 0
                  ? `Estás en el puesto #${data.miPosicionGlobal} de ${data.totalGlobal} asesores`
                  : 'Aún no apareces en el podio — sigue recibiendo encuestas'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cacheTs && (
              <span className="text-xs text-white/60">Última actualización: {hace(cacheTs)}</span>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refrescar(true)}
              disabled={cargando}
              className="gap-1.5"
            >
              {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refrescar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* === Podio Global === */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-pasivo" />
              Podio Global — Top 10
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ranking de toda el área ({data.totalGlobal} asesores)
            </p>
          </CardHeader>
          <CardContent>
            <PodioList
              entries={data.top10}
              loginActual={loginActual}
              emptyText="Aún no hay encuestas suficientes para armar el podio global."
            />
          </CardContent>
        </Card>

        {/* === Podio por LOB === */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Podio por LOB — Top 5
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {data.miLob
                ? `Asesores de tu línea: ${data.miLob} (${data.totalLob} asesores)`
                : 'No se pudo determinar tu línea.'}
              {data.miPosicionLob > 0 && (
                <span className="ml-1">· Estás en el puesto #{data.miPosicionLob}</span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {data.miLob ? (
              <PodioList
                entries={data.top5Lob}
                loginActual={loginActual}
                emptyText="Aún no hay encuestas en tu línea."
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se pudo determinar tu línea de negocio.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Sub-componente: lista del podio
// ============================================================
function PodioList({
  entries,
  loginActual,
  emptyText,
}: {
  entries: EntradaPodio[];
  loginActual: string;
  emptyText: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyText}</p>;
  }
  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto scroll-fino">
      {entries.map((a, i) => {
        const esMio = a.login === loginActual;
        return (
          <div
            key={a.login}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
              esMio
                ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30'
                : 'hover:bg-accent/50'
            )}
          >
            <span
              className={cn(
                'w-8 text-center font-bold shrink-0',
                i === 0 ? 'text-2xl' : i === 1 ? 'text-xl text-pasivo' : i === 2 ? 'text-xl text-amber-700' : ''
              )}
            >
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}°`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate flex items-center gap-1.5">
                {a.nombre}
                {esMio && (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4">Tú</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{a.encuestas} encuestas</p>
            </div>
            <span className={cn('font-bold tabular-nums shrink-0', colorTNPS(a.tnps))}>
              {a.tnps > 0 ? '+' : ''}
              {a.tnps}
            </span>
          </div>
        );
      })}
    </div>
  );
}
