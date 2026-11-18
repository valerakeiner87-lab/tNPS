'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  getConfigReinicioMonedaAction,
  saveConfigReinicioMonedaAction,
} from '@/app/actions/learning-actions';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function ConfigReinicioView() {
  const [tipo, setTipo] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [valor, setValor] = useState<number>(50);
  const [diaSemana, setDiaSemana] = useState<number>(0);
  const [hora, setHora] = useState<number>(0);
  const [diaMes, setDiaMes] = useState<number>(1);
  const [activo, setActivo] = useState<boolean>(true);
  const [ultimoReinicio, setUltimoReinicio] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfigReinicioMonedaAction();
        if (cfg) {
          setTipo((cfg.tipo as any) || 'semana');
          setValor(Number(cfg.valor ?? 50));
          setDiaSemana(Number(cfg.diaSemana ?? 0));
          setHora(Number(cfg.hora ?? 0));
          setDiaMes(Number(cfg.diaMes ?? 1));
          setActivo(Boolean(cfg.activo ?? true));
          setUltimoReinicio(cfg.ultimoReinicio ?? null);
        }
      } catch (err) {
        console.error('Error cargando config de reinicio:', err);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function guardar() {
    setGuardando(true);
    try {
      const res = await saveConfigReinicioMonedaAction({
        tipo,
        valor: Math.max(0, Math.floor(valor)),
        diaSemana: Math.max(0, Math.min(6, Math.floor(diaSemana))),
        hora: Math.max(0, Math.min(23, Math.floor(hora))),
        diaMes: Math.max(1, Math.min(31, Math.floor(diaMes))),
        activo,
      });
      if (res.ok) {
        toast.success('Configuración de reinicio guardada.');
      } else {
        toast.error(res.error || 'Error al guardar la configuración.');
      }
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const etiquetaTipo =
    tipo === 'dia' ? 'Diario' : tipo === 'semana' ? 'Semanal' : 'Mensual';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" /> Reinicio de ATC
          </CardTitle>
          <CardDescription>
            Configura cuándo y cómo se reinician los ATC de los asesores. Al reiniciar, cada asesor
            recibe el valor configurado como nuevo saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-tipo">Tipo de reinicio</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as 'dia' | 'semana' | 'mes')}
              >
                <SelectTrigger id="cfg-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Diario</SelectItem>
                  <SelectItem value="semana">Semanal</SelectItem>
                  <SelectItem value="mes">Mensual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Cada cuánto se ejecuta el reinicio automático.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-valor">Valor del reinicio (ATC)</Label>
              <Input
                id="cfg-valor"
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                ATC que reciben los asesores al reiniciar (default 50).
              </p>
            </div>
          </div>

          {tipo === 'semana' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-dia-semana">Día de la semana</Label>
                <Select
                  value={String(diaSemana)}
                  onValueChange={(v) => setDiaSemana(Number(v))}
                >
                  <SelectTrigger id="cfg-dia-semana">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((d, i) => (
                      <SelectItem key={d} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-hora">Hora (0-23)</Label>
                <Input
                  id="cfg-hora"
                  type="number"
                  min={0}
                  max={23}
                  value={hora}
                  onChange={(e) => setHora(Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Hora del día en que se ejecuta el reinicio (formato 24h).
                </p>
              </div>
            </div>
          )}

          {tipo === 'mes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-dia-mes">Día del mes (1-31)</Label>
                <Input
                  id="cfg-dia-mes"
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Se ejecutará ese día cada mes. Si el mes no tiene ese día, se ejecuta el último día del mes.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Activo</p>
              <p className="text-xs text-muted-foreground">
                Si está activo, el reinicio se ejecutará automáticamente según la programación.
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Button onClick={guardar} disabled={guardando} className="gap-2">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar configuración
            </Button>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {etiquetaTipo}
            </Badge>
            {ultimoReinicio && (
              <p className="text-xs text-muted-foreground">
                Último reinicio: {new Date(ultimoReinicio).toLocaleString('es-GT')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
