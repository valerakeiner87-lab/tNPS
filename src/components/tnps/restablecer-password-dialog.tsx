'use client';

/**
 * v3.0.6 — Diálogo para restablecer contraseña desde el login.
 * Flujo: usuario + cédula → preguntas de seguridad → nueva contraseña
 */
import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Lock, ShieldQuestion } from 'lucide-react';
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
import {
  getPreguntasSeguridadAction,
  verificarRespuestasYCambiarPasswordAction,
} from '@/app/actions/security-actions';

interface RestablecerPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Paso = 'datos' | 'preguntas' | 'exito';

export function RestablecerPasswordDialog({ open, onOpenChange }: RestablecerPasswordDialogProps) {
  const [paso, setPaso] = useState<Paso>('datos');
  const [username, setUsername] = useState('');
  const [documento, setDocumento] = useState('');
  const [userId, setUserId] = useState('');
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [respuesta1, setRespuesta1] = useState('');
  const [respuesta2, setRespuesta2] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPaso('datos');
    setUsername('');
    setDocumento('');
    setUserId('');
    setPreguntas([]);
    setRespuesta1('');
    setRespuesta2('');
    setNuevaPassword('');
    setConfirmarPassword('');
    setCargando(false);
    setError(null);
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function manejarBuscarPreguntas(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const res = await getPreguntasSeguridadAction(username, documento);
      if (!res.ok || !res.preguntas || !res.userId) {
        setError(res.error || 'Error al buscar preguntas.');
        return;
      }
      setUserId(res.userId);
      setPreguntas(res.preguntas);
      setPaso('preguntas');
    } catch (err) {
      setError('Error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  async function manejarCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!respuesta1.trim() || !respuesta2.trim()) {
      setError('Debes responder ambas preguntas.');
      return;
    }
    if (!nuevaPassword || nuevaPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setCargando(true);
    try {
      const res = await verificarRespuestasYCambiarPasswordAction({
        userId,
        respuestas: [respuesta1, respuesta2],
        nuevaPassword,
      });
      if (!res.ok) {
        setError(res.error || 'Error al cambiar contraseña.');
        return;
      }
      toast.success('Contraseña cambiada exitosamente. Ya puedes iniciar sesión.');
      setPaso('exito');
    } catch (err) {
      setError('Error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center">Restablecer contraseña</DialogTitle>
          <DialogDescription className="text-center">
            {paso === 'datos' && 'Ingresa tu usuario y cédula para ver tus preguntas de seguridad.'}
            {paso === 'preguntas' && 'Responde tus preguntas de seguridad y define una nueva contraseña.'}
            {paso === 'exito' && 'Tu contraseña fue restablecida correctamente.'}
          </DialogDescription>
        </DialogHeader>

        {paso === 'datos' && (
          <form onSubmit={manejarBuscarPreguntas} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-username">Usuario</Label>
              <Input
                id="reset-username"
                placeholder="nombre.apellido"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-documento">Cédula (documento)</Label>
              <Input
                id="reset-documento"
                placeholder="1234567890"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-detractor/30 bg-detractor/10 p-2.5 text-xs text-detractor">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" className="w-full gap-2" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldQuestion className="h-4 w-4" />}
                Ver preguntas
              </Button>
            </DialogFooter>
          </form>
        )}

        {paso === 'preguntas' && (
          <form onSubmit={manejarCambiarPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>{preguntas[0]}</Label>
              <Input
                placeholder="Tu respuesta"
                value={respuesta1}
                onChange={(e) => setRespuesta1(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{preguntas[1]}</Label>
              <Input
                placeholder="Tu respuesta"
                value={respuesta2}
                onChange={(e) => setRespuesta2(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 border-t pt-3">
              <Label htmlFor="new-pass">Nueva contraseña</Label>
              <Input
                id="new-pass"
                type="password"
                placeholder="••••••••"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                required
                minLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirma la contraseña</Label>
              <Input
                id="confirm-pass"
                type="password"
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                required
                minLength={4}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-detractor/30 bg-detractor/10 p-2.5 text-xs text-detractor">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" className="w-full gap-2" disabled={cargando}>
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Cambiar contraseña
              </Button>
            </DialogFooter>
          </form>
        )}

        {paso === 'exito' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-promotor/10 flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-promotor" />
            </div>
            <p className="text-sm text-muted-foreground">
              Ya puedes cerrar esta ventana e iniciar sesión con tu nueva contraseña.
            </p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
