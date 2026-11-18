'use client';

/**
 * v3.0.6 — Diálogo unificado para:
 * 1. Cambio de contraseña (primer login o reset)
 * 2. Asignación de preguntas de seguridad (si no las tiene)
 *
 * Si el usuario tiene debeCambiarPassword=true Y no tiene preguntas → muestra ambos
 * Si solo tiene debeCambiarPassword=true → solo cambio de contraseña
 * Si solo le faltan preguntas → solo preguntas
 */
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { cambiarPasswordAction } from '@/app/actions/auth-actions';
import {
  guardarPreguntasSeguridadAction,
  tienePreguntasSeguridadAction,
} from '@/app/actions/security-actions';
import { PREGUNTAS_PREDETERMINADAS } from '@/lib/preguntas-predeterminadas';

const MIN_LEN = 4;

export function CambiarPasswordDialog() {
  const perfil = useStore((s) => s.perfil);
  const limpiarDebeCambiarPassword = useStore((s) => s.limpiarDebeCambiarPassword);

  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preguntas de seguridad
  const [necesitaPreguntas, setNecesitaPreguntas] = useState(false);
  const [pregunta1, setPregunta1] = useState('');
  const [pregunta2, setPregunta2] = useState('');
  const [respuesta1, setRespuesta1] = useState('');
  const [respuesta2, setRespuesta2] = useState('');

  const abierto = !!perfil?.debeCambiarPassword;

  // Verificar si necesita preguntas de seguridad
  useEffect(() => {
    if (abierto && perfil) {
      tienePreguntasSeguridadAction()
        .then((tiene) => {
          setNecesitaPreguntas(!tiene);
        })
        .catch(() => setNecesitaPreguntas(true));
    }
  }, [abierto, perfil]);

  function validar(): string | null {
    if (!nueva || nueva.length < MIN_LEN) {
      return `La contraseña debe tener al menos ${MIN_LEN} caracteres.`;
    }
    if (nueva !== confirmar) {
      return 'Las contraseñas no coinciden.';
    }
    if (necesitaPreguntas) {
      if (!pregunta1 || !respuesta1.trim() || !pregunta2 || !respuesta2.trim()) {
        return 'Debes completar las dos preguntas de seguridad.';
      }
      if (pregunta1 === pregunta2) {
        return 'Las dos preguntas deben ser diferentes.';
      }
      if (respuesta1.trim().length < 2 || respuesta2.trim().length < 2) {
        return 'Las respuestas deben tener al menos 2 caracteres.';
      }
    }
    return null;
  }

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      // 1. Cambiar contraseña
      const res = await cambiarPasswordAction(nueva);
      if (!res.ok) {
        toast.error(res.error || 'Error al cambiar la contraseña.');
        setError(res.error || 'Error al cambiar la contraseña.');
        return;
      }
      // 2. Guardar preguntas de seguridad si necesita
      if (necesitaPreguntas) {
        const resP = await guardarPreguntasSeguridadAction({
          pregunta1,
          respuesta1,
          pregunta2,
          respuesta2,
        });
        if (!resP.ok) {
          toast.error(resP.error || 'Error al guardar preguntas de seguridad.');
          setError(resP.error || 'Error al guardar preguntas.');
          return;
        }
      }
      toast.success('¡Contraseña y preguntas configuradas! Bienvenido.');
      limpiarDebeCambiarPassword();
      setNueva('');
      setConfirmar('');
      setPregunta1('');
      setPregunta2('');
      setRespuesta1('');
      setRespuesta2('');
    } catch (e) {
      console.error('Error:', e);
      toast.error('Error inesperado.');
      setError('Error inesperado.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        aria-describedby="cambiar-password-desc"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center">Configura tu cuenta</DialogTitle>
          <DialogDescription id="cambiar-password-desc" className="text-center">
            {necesitaPreguntas
              ? 'Por seguridad, define una contraseña nueva y dos preguntas de seguridad.'
              : 'Por seguridad, define una contraseña nueva antes de continuar.'}
            {perfil?.rol === 'asesor'
              ? ' Si acabas de ingresar con tu cédula, elige una contraseña que recuerdes.'
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarSubmit} className="space-y-4">
          {/* Sección: Contraseña */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" /> Contraseña
            </div>
            <div className="space-y-2">
              <Label htmlFor="nueva-pass">Nueva contraseña</Label>
              <Input
                id="nueva-pass"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                autoFocus
                required
                minLength={MIN_LEN}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-pass">Confirma la contraseña</Label>
              <Input
                id="confirmar-pass"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                minLength={MIN_LEN}
              />
              <p className="text-[11px] text-muted-foreground">Mínimo {MIN_LEN} caracteres.</p>
            </div>
          </div>

          {/* Sección: Preguntas de seguridad */}
          {necesitaPreguntas && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <ShieldQuestion className="h-4 w-4" /> Preguntas de seguridad
              </div>
              <p className="text-xs text-muted-foreground">
                Estas preguntas te permitirán restablecer tu contraseña si la olvidas.
                Elige respuestas que recuerdes fácilmente.
              </p>

              <div className="space-y-2">
                <Label htmlFor="pregunta1">Pregunta 1</Label>
                <Select value={pregunta1} onValueChange={setPregunta1}>
                  <SelectTrigger id="pregunta1">
                    <SelectValue placeholder="Selecciona una pregunta" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREGUNTAS_PREDETERMINADAS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Tu respuesta"
                  value={respuesta1}
                  onChange={(e) => setRespuesta1(e.target.value)}
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pregunta2">Pregunta 2</Label>
                <Select value={pregunta2} onValueChange={setPregunta2}>
                  <SelectTrigger id="pregunta2">
                    <SelectValue placeholder="Selecciona una pregunta" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREGUNTAS_PREDETERMINADAS.filter((p) => p !== pregunta1).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Tu respuesta"
                  value={respuesta2}
                  onChange={(e) => setRespuesta2(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md border border-detractor/30 bg-detractor/10 p-2.5 text-xs text-detractor"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={guardando || !nueva || !confirmar}
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Guardar y continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
