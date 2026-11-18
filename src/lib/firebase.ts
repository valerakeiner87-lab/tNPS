// ============================================================
// tNPS Digital — firebase.ts (DEPRECATED — stub vacío)
// ============================================================
// ESTE ARCHIVO YA NO USA FIREBASE. Se mantiene solo para no romper
// los imports existentes. Las funciones devuelven valores vacíos.
// Toda la lógica de autenticación ahora está en src/lib/auth.ts
// y src/app/actions/auth-actions.ts.
// ============================================================

// Mock de `auth` para compatibilidad con código legacy
export const auth = {
  onAuthStateChanged: () => () => undefined,
  signInAnonymously: async () => null,
  signInWithEmailAndPassword: async () => null,
  signOut: async () => undefined,
} as unknown;

// Mock de `db` para compatibilidad
export const db = {} as unknown;

/** @deprecated Usar src/lib/auth.ts */
export function traducirErrorAuth(_codigo: string): string {
  return 'Autenticación migrada a Neon. Esta función ya no se usa.';
}
