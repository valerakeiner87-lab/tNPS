'use client';

import { useState } from 'react';
import { AlertCircle, BarChart3, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/lib/store';
import type { AuthSession } from '@/lib/session';
import { RestablecerPasswordDialog } from './restablecer-password-dialog';

/**
 * LoginPanel — Pantalla de inicio de sesión directa.
 *
 * v3.4.1: Se eliminó la pantalla de "Fuera de servicio" / modo mantenimiento
 * con código oculto. El panel de login se muestra directamente al cargar la app.
 */
export function LoginPanel() {
  const setSesionNeon = useStore((s) => s.setSesionNeon);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, password, area: 'digital' }),
      });
      const resultado = await resp.json();
      if (!resultado.ok) {
        setError(resultado.error || 'Error al iniciar sesión.');
        return;
      }
      if (resultado.session) {
        setSesionNeon(resultado.session as AuthSession);
      }
    } catch (err) {
      setError((err as Error).message || 'Error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  const tituloApp = 'ATC Digital';
  const descripcionApp = 'Plataforma de análisis de satisfacción y gamificación del contact center de Claro Guatemala.';

  return (
    <div className="min-h-screen flex flex-col header-claro text-white">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-5">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/20 shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-white/70 tracking-[0.25em] uppercase">Claro Guatemala</p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{tituloApp}</h1>
              <p className="text-sm text-white/70 mt-2 max-w-sm mx-auto">{descripcionApp}</p>
            </div>
          </div>

          <Card className="shadow-2xl">
            <CardContent className="p-6 space-y-4">
              {error && (
                <div
                  className="flex items-start gap-2 rounded-md border border-detractor/30 bg-detractor/10 p-3 text-sm text-detractor"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={manejarLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="login">Usuario</Label>
                  <Input
                    id="login"
                    autoComplete="username"
                    placeholder="nombre.apellido"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Asesores: tu contraseña es tu número de cédula. Supervisores: tu contraseña asignada.
                  </p>
                </div>
                <Button type="submit" className="w-full gap-2 text-base py-5" disabled={cargando}>
                  {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Iniciar sesión</>}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => setResetOpen(true)}
                >
                  <KeyRound className="h-3 w-3" /> ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="flex items-center gap-2 text-center text-[11px] text-muted-foreground border-t pt-3">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mx-auto" />
                <span>Autenticación segura · Acceso restringido</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="text-center text-white/60 text-xs pb-4">
        {tituloApp} · Claro Guatemala © {new Date().getFullYear()}
      </footer>

      <RestablecerPasswordDialog open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  );
}
