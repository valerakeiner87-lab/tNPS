'use client';

import { useEffect, useState } from 'react';
import { Database, HardDriveDownload, HardDriveUpload, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cacheEstadisticas, cacheLimpiarTodo } from '@/lib/cache';
import { useStore } from '@/lib/store';
import { useATCStore } from '@/lib/atc-store';

/** Panel visible del estado del caché Dexie (usado en el dashboard del admin) */
export function CacheStatusPanel() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof cacheEstadisticas>> | null>(null);
  const [cargando, setCargando] = useState(false);
  const forzarSincronizacion = useStore((s) => s.forzarSincronizacion);
  const sincronizarATC = useATCStore((s) => s.sincronizar);

  useEffect(() => {
    cacheEstadisticas().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-claro-red" /> Caché local Dexie
        </CardTitle>
        <CardDescription>
          Estrategia cache-first con sincronización inteligente para máxima velocidad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Encuestas</p>
            <p className="font-bold tabular-nums">{stats.encuestas.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Asesores</p>
            <p className="font-bold tabular-nums">{stats.asesoresHC.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">TMO</p>
            <p className="font-bold">{stats.tmo ? 'Sí' : '—'}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Reads ahorrados</p>
            <p className="font-bold tabular-nums text-promotor">{stats.readsAhorradas.toLocaleString('es-GT')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Wallets ATC</p>
            <p className="font-bold tabular-nums">{stats.atcWallets.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="font-bold tabular-nums">{stats.atcTransacciones.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Premios</p>
            <p className="font-bold tabular-nums">{stats.atcPremios.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Canjes</p>
            <p className="font-bold tabular-nums">{stats.atcCanjes.toLocaleString('es-GT')}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Apelaciones</p>
            <p className="font-bold tabular-nums">{stats.atcApelaciones.toLocaleString('es-GT')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={cargando}
            onClick={async () => {
              setCargando(true);
              await forzarSincronizacion();
              await sincronizarATC(true).catch(() => undefined);
              setCargando(false);
              setStats(await cacheEstadisticas());
            }}
            className="gap-2"
          >
            {cargando ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <HardDriveDownload className="h-3.5 w-3.5" />}
            Forzar sincronización completa
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await cacheLimpiarTodo();
              setStats(await cacheEstadisticas());
              toast.info('Caché local vaciado. La próxima carga re-descargará todo.');
            }}
            className="gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" /> Vaciar caché
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
