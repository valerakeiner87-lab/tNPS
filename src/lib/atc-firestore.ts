// ============================================================
// ATC Digital — Wrapper de datos ATC (delegado a Server Actions)
// Archivo: src/lib/atc-firestore.ts
// ============================================================
// Este archivo ya NO usa Firebase. Todas las funciones delegan
// a las Server Actions en src/app/actions/neon-actions.ts, que
// ejecutan contra la BD real (SQLite en dev, PostgreSQL/Neon en prod).
// ============================================================

'use client';

import type {
  ApelacionATC,
  CanjeATC,
  ConfigATC,
  NotificacionATC,
  PremioATC,
  TransaccionATC,
  WalletATC,
} from './atc-types';
import { CONFIG_ATC_DEFAULT } from './atc-types';
import {
  getWallets as actionGetWallets,
  saveWallet as actionSaveWallet,
  reiniciarWalletsAction,
  getTransacciones as actionGetTransacciones,
  saveTransaccion as actionSaveTransaccion,
  getPremios as actionGetPremios,
  savePremio as actionSavePremio,
  removePremio as actionRemovePremio,
  getCanjes as actionGetCanjes,
  crearCanje as actionCrearCanje,
  resolverCanje as actionResolverCanje,
  getApelaciones as actionGetApelaciones,
  crearApelacion as actionCrearApelacion,
  resolverApelacion as actionResolverApelacion,
  getNotificaciones as actionGetNotificaciones,
  crearNotificacion as actionCrearNotificacion,
  marcarNotificacionLeida as actionMarcarNotificacionLeida,
  marcarTodasLeidas as actionMarcarTodasLeidas,
  getConfig as actionGetConfig,
  saveConfig as actionSaveConfig,
  getBeacon as actionGetBeacon,
  actualizarBeacon as actionActualizarBeacon,
} from '@/app/actions/neon-actions';

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

export async function leerAdmins(): Promise<string[]> {
  // La verificación de admin se hace con la sesión JWT (role en users)
  return [];
}

export async function esAdmin(_uid: string): Promise<boolean> {
  // La verificación de admin ahora se hace con la sesión JWT
  return false;
}

export async function guardarPerfilUsuario(_uid: string, _data: { email?: string; ultimoIngreso?: string }): Promise<void> {
  // No-op: la sesión ahora se maneja con JWT
}

// ------------------------------------------------------------
// Wallets
// ------------------------------------------------------------

export async function guardarWallet(wallet: WalletATC): Promise<void> {
  await actionSaveWallet(wallet);
}

export async function leerWallet(_login: string): Promise<WalletATC | null> {
  const all = await actionGetWallets();
  return all.find((w) => w.loginNormalizado === _login) ?? null;
}

export async function leerWallets(): Promise<WalletATC[]> {
  return await actionGetWallets();
}

export async function leerWalletsDesde(_cursor: string): Promise<WalletATC[]> {
  // Por simplicidad, devolvemos todos y dejamos que el store dedupe
  return await actionGetWallets();
}

export async function guardarWalletsDiferencial(
  wallets: WalletATC[],
  _anteriores?: WalletATC[] | Record<string, WalletATC>
): Promise<{ nuevas: number; omitidas: number }> {
  let nuevas = 0;
  let omitidas = 0;
  for (const w of wallets) {
    try {
      await actionSaveWallet(w);
      nuevas++;
    } catch {
      omitidas++;
    }
  }
  return { nuevas, omitidas };
}

export async function reiniciarWallets(saldo: number): Promise<WalletATC[]> {
  await reiniciarWalletsAction(saldo);
  return await actionGetWallets();
}

// ------------------------------------------------------------
// Transacciones
// ------------------------------------------------------------

export async function guardarTransacciones(txs: TransaccionATC[]): Promise<void> {
  for (const t of txs) {
    try { await actionSaveTransaccion(t); } catch (err) { console.error('Error guardando tx', err); }
  }
}

export async function leerTransacciones(login?: string): Promise<TransaccionATC[]> {
  return await actionGetTransacciones(login);
}

export async function leerTransaccionesDesde(_cursor: string): Promise<TransaccionATC[]> {
  return await actionGetTransacciones();
}

// ------------------------------------------------------------
// Premios
// ------------------------------------------------------------

export async function guardarPremio(premio: PremioATC): Promise<void> {
  await actionSavePremio(premio);
}

export async function borrarPremio(id: string): Promise<void> {
  await actionRemovePremio(id);
}

export async function leerPremios(): Promise<PremioATC[]> {
  return await actionGetPremios();
}

export async function leerPremiosDesde(_cursor: string): Promise<PremioATC[]> {
  return await actionGetPremios();
}

export async function actualizarStockPremio(_id: string, _delta: number): Promise<void> {
  const premios = await actionGetPremios();
  const p = premios.find((x) => x.id === _id);
  if (!p) return;
  if (p.stock >= 0) {
    p.stock = Math.max(0, p.stock + _delta);
    await actionSavePremio(p);
  }
}

// ------------------------------------------------------------
// Canjes
// ------------------------------------------------------------

export async function crearCanje(canje: CanjeATC): Promise<void> {
  await actionCrearCanje(canje);
}

export async function leerCanjes(login?: string): Promise<CanjeATC[]> {
  return await actionGetCanjes(login);
}

export async function leerCanjesDe(login: string): Promise<CanjeATC[]> {
  return await actionGetCanjes(login);
}

export async function leerCanjesDesde(_cursor: string): Promise<CanjeATC[]> {
  return await actionGetCanjes();
}

export async function resolverCanje(
  id: string,
  estado: 'aprobado' | 'rechazado',
  _resueltoPor: string,
  comentario?: string
): Promise<void> {
  // La Server Action obtiene el resueltoPor de la sesión
  await actionResolverCanje(id, estado, comentario);
}

// ------------------------------------------------------------
// Apelaciones
// ------------------------------------------------------------

export async function crearApelacion(apelacion: ApelacionATC): Promise<void> {
  await actionCrearApelacion(apelacion);
}

export async function leerApelaciones(login?: string): Promise<ApelacionATC[]> {
  return await actionGetApelaciones(login);
}

export async function leerApelacionesDe(login: string): Promise<ApelacionATC[]> {
  return await actionGetApelaciones(login);
}

export async function leerApelacionesDesde(_cursor: string): Promise<ApelacionATC[]> {
  return await actionGetApelaciones();
}

export async function resolverApelacion(
  id: string,
  estado: 'aprobada' | 'rechazada',
  _resueltoPor: string,
  respuesta: string,
  puntosAplicados?: number
): Promise<void> {
  await actionResolverApelacion(id, estado === 'aprobada', respuesta, puntosAplicados);
}

// ------------------------------------------------------------
// Notificaciones
// ------------------------------------------------------------

export async function crearNotificacion(notif: NotificacionATC): Promise<void> {
  await actionCrearNotificacion(notif);
}

export async function leerNotificaciones(paraAdmin: boolean, paraLogin?: string): Promise<NotificacionATC[]> {
  return await actionGetNotificaciones(paraAdmin, paraLogin);
}

export async function leerNotificacionesDe(login: string): Promise<NotificacionATC[]> {
  return await actionGetNotificaciones(false, login);
}

export async function leerNotificacionesDesde(_cursor: string): Promise<NotificacionATC[]> {
  return await actionGetNotificaciones(false);
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  await actionMarcarNotificacionLeida(id);
}

export async function marcarTodasLeidas(paraAdminONotifs: boolean | NotificacionATC[], paraLogin?: string): Promise<void> {
  if (typeof paraAdminONotifs === 'boolean') {
    await actionMarcarTodasLeidas(paraLogin, paraAdminONotifs);
  } else {
    // Para cada notificación en la lista, marcarla como leída
    for (const n of paraAdminONotifs) {
      if (!n.leida) await actionMarcarNotificacionLeida(n.id);
    }
  }
}

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------

export async function leerConfig(): Promise<ConfigATC> {
  const c = await actionGetConfig();
  return c ?? { ...CONFIG_ATC_DEFAULT };
}

export async function guardarConfig(config: ConfigATC): Promise<void> {
  await actionSaveConfig(config);
}

// ------------------------------------------------------------
// Beacon
// ------------------------------------------------------------

export async function leerBeaconATC(): Promise<string> {
  const b = await actionGetBeacon();
  return b.ts ?? '';
}

export async function tocarBeaconATC(): Promise<void> {
  await actionActualizarBeacon(new Date().toISOString());
}

// ------------------------------------------------------------
// Admin management
// ------------------------------------------------------------

export async function agregarAdmin(_uid: string): Promise<void> {
  // El rol se gestiona vía la tabla users con la columna role
  // La gestión real se hace en gestion-usuarios-view.tsx
}

export async function quitarAdmin(_uid: string): Promise<void> {
  // Igual que arriba
}

export function esErrorPermisos(_error: unknown): boolean { return false; }
