'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface BDStatus {
  index: number;
  host: string;
  region: string;
  ok: boolean;
  ms: number;
  error?: string;
  activa: boolean;
}

interface DBStatusResponse {
  ok: boolean;
  total: number;
  activas: number;
  faltan: number;
  activaIndex: number;
  bdActiva: string;
  alertaCrearMas: boolean;
  nivelAlerta: 'ok' | 'advertencia' | 'urgente' | 'critico';
  bds: BDStatus[];
  verificadoEn: string;
  error?: string;
}

export function BDStatusPanel() {
  const [data, setData] = useState<DBStatusResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch('/api/db-status', { cache: 'no-store' });
      const json = await r.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || 'Error desconocido');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Refrescar cada 60s
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const pct = data ? Math.round((data.activas / data.total) * 100) : 0;
  const nivel = data?.nivelAlerta || 'ok';
  const nivelColor = {
    ok: 'text-emerald-600',
    advertencia: 'text-amber-600',
    urgente: 'text-orange-600',
    critico: 'text-red-600',
  }[nivel];

  const nivelBg = {
    ok: 'from-emerald-500 to-emerald-600',
    advertencia: 'from-amber-500 to-amber-600',
    urgente: 'from-orange-500 to-orange-600',
    critico: 'from-red-500 to-red-600',
  }[nivel];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className={`h-8 w-8 rounded-lg bg-gradient-to-br ${nivelBg} flex items-center justify-center text-white`} aria-hidden>
                <Database className="h-4 w-4" />
              </span>
              Bases de datos Neon
              {data && (
                <Badge variant="outline" className={`ml-1 ${nivelColor}`}>
                  {data.activas}/{data.total} activas
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Estado de las BDs PostgreSQL · Failover automático activo
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={cargar}
            disabled={cargando}
            className="gap-1.5"
            title="Refrescar estado"
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error al cargar estado</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* ----- Barra de progreso global ----- */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-medium">BDs operativas</span>
                <span className={`text-2xl font-bold tabular-nums ${nivelColor}`}>
                  {data.activas}<span className="text-base text-muted-foreground font-normal">/{data.total}</span>
                </span>
              </div>
              <Progress
                value={pct}
                className={`h-2.5 ${
                  nivel === 'critico' ? '[&>div]:bg-red-500' :
                  nivel === 'urgente' ? '[&>div]:bg-orange-500' :
                  nivel === 'advertencia' ? '[&>div]:bg-amber-500' :
                  '[&>div]:bg-emerald-500'
                }`}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>BD activa: <span className="font-mono text-foreground/80">{data.bdActiva.split('.')[0].replace(/^ep-/, '')}</span></span>
                <span>Actualizado: {new Date(data.verificadoEn).toLocaleTimeString('es-GT')}</span>
              </div>
            </div>

            {/* ----- Alerta: crear más BDs ----- */}
            {data.alertaCrearMas && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                nivel === 'critico'
                  ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300'
              }`}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {nivel === 'critico'
                      ? '⚠️ CRÍTICO: Crear nuevas BDs inmediatamente'
                      : '⚠️ Crear nuevas BDs pronto'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    {data.activas === 0
                      ? 'No hay BDs operativas. La app no puede funcionar.'
                      : `Solo ${data.activas} de ${data.total} BDs responden. Cuando se agote la cuota de las activas, la app dejará de funcionar.`}
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    Recomendación: crear {Math.max(3, 5 - data.activas)} BDs nuevas en <a href="https://console.neon.tech" target="_blank" rel="noreferrer" className="underline">console.neon.tech</a> y agregar las URLs en <code className="text-[10px] bg-black/10 dark:bg-white/10 px-1 rounded">src/lib/db.ts</code>.
                  </p>
                </div>
              </div>
            )}

            {/* ----- Lista detallada de BDs ----- */}
            <div className="space-y-1.5">
              {data.bds.map((bd) => (
                <div
                  key={bd.index}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    bd.activa
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300 dark:ring-emerald-800'
                      : bd.ok
                        ? 'hover:bg-accent/60'
                        : 'bg-red-50/50 dark:bg-red-950/20'
                  }`}
                >
                  <span className="shrink-0">
                    {bd.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate flex items-center gap-1.5">
                      BD {bd.index + 1}
                      {bd.activa && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 gap-0.5">
                          <Zap className="h-2.5 w-2.5" /> ACTIVA
                        </Badge>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {bd.host.split('.')[0].replace(/^ep-/, '').replace(/-pooler$/, '')} · {bd.region}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {bd.ok ? (
                      <span className="text-[10px] text-muted-foreground tabular-nums">{bd.ms}ms</span>
                    ) : (
                      <span className="text-[10px] text-red-500 truncate max-w-[120px] block" title={bd.error}>
                        {bd.error?.substring(0, 40) || 'Error'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ----- Resumen ----- */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Operativas</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{data.activas}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Caídas</p>
                <p className="text-lg font-bold text-red-600 tabular-nums">{data.faltan}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-lg font-bold tabular-nums">{data.total}</p>
              </div>
            </div>
          </>
        )}

        {!data && !error && cargando && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando BDs…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
