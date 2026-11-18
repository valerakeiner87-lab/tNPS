'use client';

/**
 * v3.0.9 — Diálogo standalone para configurar preguntas de seguridad.
 *
 * Aparece cuando el usuario NO tiene preguntas de seguridad pero tampoco
 * necesita cambiar contraseña (ya la cambió en otro momento).
 *
 * NO se puede cerrar sin completar (no ESC, no click fuera).
 */
import { useState } from 'react';
import { Loader2, ShieldCheck, ShieldQuestion } from 'lucide-react';
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
import { guardarPreguntasSeguridadAction } from '@/app/actions/security-actions';
import { PREGUNTAS_PREDETERMINADAS } from '@/lib/preguntas-predeterminadas';

export function ConfigurarPreguntasDialog({ onGuardado }: { onGuardado?: () => void }) {
  const [pregunta1, setPregunta1] = useState('');
  const [pregunta2, setPregunta2] = useState('');
  const [respuesta1, setRespuesta1] = useState('');
  const [respuesta2, setRespuesta2] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validar(): string | null {
    if (!pregunta1 || !respuesta1.trim() || !pregunta2 || !respuesta2.trim()) {
      return 'Debes completar las dos preguntas de seguridad.';
    }
    if (pregunta1 === pregunta2) {
      return 'Las dos preguntas deben ser diferentes.';
    }
    if (respuesta1.trim().length < 2 || respuesta2.trim().length < 2) {
      return 'Las respuestas deben tener al menos 2 caracteres.';
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
      const res = await guardarPreguntasSeguridadAction({
        pregunta1,
        respuesta1,
        pregunta2,
        respuesta2,
      });
      if (!res.ok) {
        toast.error(res.error || 'Error al guardar preguntas de seguridad.');
        setError(res.error || 'Error al guardar preguntas.');
        return;
      }
      toast.success('Preguntas configuradas correctamente.');
      onGuardado?.();
    } catch (e) {
      console.error('Error:', e);
      toast.error('Error inesperado.');
      setError('Error inesperado.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        aria-describedby="config-preguntas-desc"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center">🔐 Configura tus preguntas de seguridad</DialogTitle>
          <DialogDescription id="config-preguntas-desc" className="text-center">
            Para poder restablecer tu contraseña de forma autogestionada si la olvidas, necesitas
            configurar 2 preguntas de seguridad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <ShieldQuestion className="h-4 w-4" /> Preguntas de seguridad
            </div>
            <p className="text-xs text-muted-foreground">
              Estas preguntas te permitirán restablecer tu contraseña si la olvidas. Elige respuestas
              que recuerdes fácilmente.
            </p>

            <div className="space-y-2">
              <Label htmlFor="cp-pregunta1">Pregunta 1</Label>
              <Select value={pregunta1} onValueChange={setPregunta1}>
                <SelectTrigger id="cp-pregunta1">
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
              <Label htmlFor="cp-pregunta2">Pregunta 2</Label>
              <Select value={pregunta2} onValueChange={setPregunta2}>
                <SelectTrigger id="cp-pregunta2">
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
              disabled={
                guardando ||
                !pregunta1 ||
                !pregunta2 ||
                !respuesta1.trim() ||
                !respuesta2.trim()
              }
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
