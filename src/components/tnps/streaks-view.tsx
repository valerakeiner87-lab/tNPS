'use client';

/* eslint-disable react-hooks/set-state-in-effect */
// ============================================================
// v3.0.5 — Mis Rachas (asesor)
// Muestra las rachas actuales, mejores históricas y ATC bonus
// otorgados por rachas. Carga vía getStreaksAction.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CalendarCheck, Coins, Flame, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { getStreaksAction } from '@/app/actions/audit-actions';

interface StreakAsesor {
  id: string;
  loginNormalizado: string;
  tipo: string; // 'promotores_dia' | 'sin_detractores_semana' | 'login_diario'
  contador: number;
  mejorRacha: number;
  ultimaFecha: string;
  atcBonus: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface DefStreak {
  tipo: string;
  titulo: string;
  descripcion: string;
  unidad: string; // 'días' | 'semanas'
  icono: React.ReactNode;
  color: string;
}

const DEFS: DefStreak[] = [
  {
    tipo: 'promotores_dia',
    titulo: 'Racha de Promotores',
    descripcion: 'Días consecutivos con al menos un promotor y sin detractores.',
    unidad: 'días',
    icono: <Flame className="h-6 w-6" />,
    color: 'text-promotor',
  },
  {
    tipo: 'sin_detractores_semana',
    titulo: 'Sin Detractores',
    descripcion: 'Semanas consecutivas sin ningún detractor en tus encuestas.',
    unidad: 'semanas',
    icono: <CalendarCheck className="h-6 w-6" />,
    color: 'text-claro-blue',
  },
  {
    tipo: 'login_diario',
    titulo: 'Ingresos Diarios',
    descripcion: 'Días consecutivos iniciando sesión en la plataforma.',
    unidad: 'días',
    icono: <TrendingUp className="h-6 w-6" />,
    color: 'text-pasivo',
  },
];

function formatearFecha(fecha: string): string {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

export function StreaksView() {
  const perfil = useStore((s) => s.perfil);
  const perfilAsesor = useStore((s) => s.perfilAsesor);

  const [streaks, setStreaks] = useState<StreakAsesor[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargadoInicial, setCargadoInicial] = useState(false);

  const login = perfilAsesor?.loginNormalizado || perfil?.loginNormalizado || '';

  const cargar = useCallback(async () => {
    if (!login) return;
    setCargando(true);
    try {
      const res = await getStreaksAction(login);
      setStreaks(Array.isArray(res) ? (res as StreakAsesor[]) : []);
    } catch (err) {
      console.error('StreaksView: error al cargar', err);
      setStreaks([]);
    } finally {
      setCargando(false);
    }
  }, [login]);

  useEffect(() => {
    if (cargadoInicial) return;
    if (!login) return;
    setCargadoInicial(true);
    cargar();
  }, [cargadoInicial, login, cargar]);

  // Mapa por tipo
  const porTipo = useMemo(() => {
    const m = new Map<string, StreakAsesor>();
    for (const s of streaks) m.set(s.tipo, s);
    return m;
  }, [streaks]);

  // Totales
  const totalBonus = useMemo(
    () => streaks.reduce((acc, s) => acc + (s.atcBonus || 0), 0),
    [streaks]
  );
  const mejorGlobal = useMemo(
    () => streaks.reduce((acc, s) => Math.max(acc, s.mejorRacha || 0), 0),
    [streaks]
  );

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="h-5 w-5 text-pasivo" aria-hidden />
            Mis Rachas
          </h2>
          <p className="text-sm text-muted-foreground">
            Mantén tu buen trabajo para alargar tus rachas y ganar ATC bonus.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="gap-2">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refrescar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-promotor shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-promotor/10 flex items-center justify-center text-promotor">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mejor racha histórica
              </p>
              <p className="text-2xl font-bold tabular-nums text-promotor">{mejorGlobal}</p>
              <p className="text-xs text-muted-foreground">días/semanas consecutivos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-claro-blue shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-claro-blue/10 flex items-center justify-center text-claro-blue">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                ATC bonus por rachas
              </p>
              <p className="text-2xl font-bold tabular-nums text-claro-blue">{totalBonus}</p>
              <p className="text-xs text-muted-foreground">ATC acumulados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pasivo shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-pasivo/10 flex items-center justify-center text-pasivo">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Rachas activas
              </p>
              <p className="text-2xl font-bold tabular-nums text-pasivo">
                {streaks.filter((s) => s.contador > 0).length}
              </p>
              <p className="text-xs text-muted-foreground">en curso ahora mismo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalle por tipo de racha */}
      {cargando && streaks.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando tus rachas…
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEFS.map((def) => {
            const s = porTipo.get(def.tipo);
            const actual = s?.contador ?? 0;
            const mejor = s?.mejorRacha ?? 0;
            const bonus = s?.atcBonus ?? 0;
            const ultima = s?.ultimaFecha;
            return (
              <Card key={def.tipo} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`shrink-0 ${def.color}`}>{def.icono}</div>
                    {actual > 0 ? (
                      <Badge className="bg-promotor/15 text-promotor text-[10px]">En curso</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Sin racha
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{def.titulo}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{def.descripcion}</p>
                  </div>

                  <div className="rounded-md bg-muted/40 px-3 py-2 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Actual</span>
                    <span className={`text-2xl font-bold tabular-nums ${actual > 0 ? def.color : 'text-muted-foreground'}`}>
                      {actual}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{def.unidad}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border px-2.5 py-1.5">
                      <p className="text-muted-foreground">Mejor histórica</p>
                      <p className="font-semibold tabular-nums">
                        {mejor} <span className="text-muted-foreground font-normal">{def.unidad}</span>
                      </p>
                    </div>
                    <div className="rounded-md border px-2.5 py-1.5">
                      <p className="text-muted-foreground">ATC ganados</p>
                      <p className="font-semibold tabular-nums text-claro-blue">{bonus}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Última actualización: {ultima ? formatearFecha(ultima) : '—'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Aclaración */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p>
            <strong>¿Cómo funcionan las rachas?</strong> Cada vez que mantienes una racha activa,
            el sistema te otorga <strong>ATC bonus</strong> en hitos específicos (cada 3, 5, 7
            días/semanas). Sigue atendiendo con calidad para no romper la cadena.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
