'use client';

/**
 * v3.0.9 — Ventana de novedades que se muestra una vez por usuario
 * después de la actualización v3.0.7+.
 *
 * Usa localStorage 'atc-novedades-v307' para recordar que el usuario ya la vio.
 * NO se puede cerrar con ESC ni click fuera — solo con el botón "Leído y aceptar".
 *
 * Si el usuario ya la vio (localStorage === 'v307'), llama onCerrado inmediatamente.
 * Si no, muestra el diálogo y llama onCerrado cuando el usuario presiona el botón.
 */
import { useEffect, useState } from 'react';
import { Flame, Gamepad2, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'atc-novedades-v307';
const VERSION = 'v307';

export function NovedadesDialog({ onCerrado }: { onCerrado?: () => void }) {
  // Lazy initializer: lee localStorage UNA vez al montar para decidir si abrir.
  // 'pendiente' = no visto (abrir diálogo), 'visto' = ya visto (cerrar inmediatamente).
  const [estado, setEstado] = useState<'pendiente' | 'visto'>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === VERSION ? 'visto' : 'pendiente';
    } catch {
      return 'visto';
    }
  });

  useEffect(() => {
    if (estado === 'visto') {
      // Defer para evitar cascading renders
      Promise.resolve().then(() => onCerrado?.());
    }
  }, [estado, onCerrado]);

  function aceptar() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      // ignore
    }
    setEstado('visto');
    onCerrado?.();
  }

  if (estado === 'visto') return null;

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-fino"
        aria-describedby="novedades-desc"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">
            🆕 ¡Novedades de la actualización!
          </DialogTitle>
          <DialogDescription id="novedades-desc" className="text-center">
            Hemos añadido nuevas funcionalidades para que ganes más ATC y te diviertas mientras trabajas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 1. Rachas de promotores */}
          <Card className="border-orange-400/40 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="p-4 flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-orange-500" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-orange-900 dark:text-orange-200">
                  🔥 Rachas de Promotores
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ahora puedes canjear premios por racha de promotores. Consigue 3 promotores seguidos en
                  el día (sin detractor ni pasivo en medio) y desbloquea premios especiales.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Formularios de aprendizaje */}
          <Card className="border-claro-blue/40 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-blue-500" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-900 dark:text-blue-200">
                  📝 Formularios de Aprendizaje
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Responde formularios de capacitación y gana ATC por cada respuesta correcta.
                  ¡Completa todo el formulario para recibir un bonus!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Juegos en tiempo de ocio */}
          <Card className="border-promotor/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-4 flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Gamepad2 className="h-5 w-5 text-emerald-500" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                  🎮 Juegos en tiempo de ocio
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ¿Tienes tiempo libre? Juega Culebrita, Breakout, Sudoku o Solitario y gana ATC mientras
                  te diviertes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Aviso sobre preguntas de seguridad */}
          <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-amber-500" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  🔐 Preguntas de seguridad
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Después de esta ventana, se te pedirá configurar 2 preguntas de seguridad para poder
                  restablecer tu contraseña si la olvidas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button type="button" className="w-full gap-2" onClick={aceptar}>
            <ShieldCheck className="h-4 w-4" />
            Leído y aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
