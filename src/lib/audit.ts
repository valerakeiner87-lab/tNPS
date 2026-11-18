// ============================================================
// v3.0.5 — Sistema de Auditoría
// ============================================================
import { db } from './db';
import { randomUUID } from 'crypto';

export interface AuditEntry {
  userId?: string;
  username: string;
  accion: string; // 'create' | 'update' | 'delete' | 'login' | 'logout' | 'upload' | 'canje' | 'config'
  tabla?: string;
  registroId?: string;
  descripcion: string;
  ipOrigen?: string;
  userAgent?: string;
}

/**
 * Registra una acción en el audit_log.
 * No lanza error si falla (best-effort).
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        id: randomUUID(),
        userId: entry.userId ?? null,
        username: entry.username,
        accion: entry.accion,
        tabla: entry.tabla ?? null,
        registroId: entry.registroId ?? null,
        descripcion: entry.descripcion,
        ipOrigen: entry.ipOrigen ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.warn('Audit log falló (no crítico):', err);
  }
}

/**
 * Lee el audit log con filtros.
 */
export async function leerAuditLog(filtros: {
  username?: string;
  accion?: string;
  limite?: number;
}): Promise<any[]> {
  const where: any = {};
  if (filtros.username) where.username = filtros.username;
  if (filtros.accion) where.accion = filtros.accion;
  return await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filtros.limite ?? 100,
  });
}
