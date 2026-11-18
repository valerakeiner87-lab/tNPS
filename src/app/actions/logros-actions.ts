'use server';

/**
 * Server Actions para logros, perfiles sociales y búsqueda de usuarios.
 * Usa Prisma (compatible SQLite dev / PostgreSQL prod).
 */

import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { semanaISOActual } from '@/lib/atc-types';
import type { Logro, UsuarioLogro } from '@/lib/atc-types';

// ============================================================
// Logros
// ============================================================

export async function leerLogrosAction(): Promise<any[]> {
  try {
    const logros = await db.logro.findMany({ orderBy: { puntosRecompensa: "asc" } });
    return logros.map((r: any) => ({
      id: r.id,
      clave: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      emoji: r.emoji,
      categoria: r.categoria,
      puntosRecompensa: r.puntosRecompensa,
    }));
  } catch (err) {
    console.error('Error leerLogrosAction:', err);
    return [];
  }
}

export async function leerLogrosUsuarioAction(userId?: string): Promise<UsuarioLogro[]> {
  const session = await getSession();
  if (!session) return [];
  const uid = userId || session.userId;

  try {
    const rows = await db.usuarioLogro.findMany({
      where: { usuarioId: uid },
      orderBy: { otorgado: 'desc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.usuarioId,
      logroId: r.logroId,
      otorgadoEn: r.otorgado,
      logro: {
        id: r.logroId,
        clave: r.logroId,
        nombre: r.logroNombre,
        descripcion: r.logroDescripcion,
        emoji: r.logroEmoji,
        categoria: 'general',
        puntosRecompensa: r.puntosRecompensa,
      },
    }));
  } catch (err) {
    console.error('Error leerLogrosUsuarioAction:', err);
    return [];
  }
}

/**
 * Otorga un logro a un usuario (si no lo tiene ya).
 * Lanza notificación a todos los usuarios (paraAdmin = true).
 * Actualiza el saldo Y stats.totalGanado (bug fix).
 */
export async function otorgarLogroAction(userId: string, logroClave: string): Promise<{ ok: boolean; otorgado: boolean }> {
  try {
    // Buscar el logro por id (clave = id en este schema)
    const logro = await db.logro.findUnique({ where: { id: logroClave } });
    if (!logro) return { ok: false, otorgado: false };

    // Verificar si ya lo tiene
    const existe = await db.usuarioLogro.findFirst({
      where: { usuarioId: userId, logroId: logro.id },
    });
    if (existe) return { ok: true, otorgado: false };

    // Otorgar
    const id = randomUUID();
    await db.usuarioLogro.create({
      data: {
        id,
        usuarioId: userId,
        logroId: logro.id,
        logroNombre: logro.nombre,
        logroEmoji: logro.emoji || '',
        logroDescripcion: logro.descripcion || '',
        puntosRecompensa: logro.puntosRecompensa,
        otorgado: new Date().toISOString(),
      },
    });

    // Recompensa de ATC — actualizar saldo Y stats.totalGanado (FIX)
    if (logro.puntosRecompensa > 0) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        const loginNormalizado = user.loginNormalizado || user.username;
        const existente = await db.walletATC.findUnique({ where: { loginNormalizado } });
        if (existente) {
          // Update existing wallet — preserve stats, add to saldo + totalGanado
          const statsOld = typeof existente.stats === 'string'
            ? JSON.parse(existente.stats as string || '{}')
            : (existente.stats || {});
          statsOld.totalGanado = (statsOld.totalGanado ?? 0) + logro.puntosRecompensa;
          await db.walletATC.update({
            where: { loginNormalizado },
            data: {
              saldo: existente.saldo + logro.puntosRecompensa,
              stats: JSON.stringify(statsOld),
              actualizado: new Date().toISOString(),
            },
          });
        } else {
          // Crear nueva wallet
          const stats = { totalPromotores: 0, totalPasivos: 0, totalDetractores: 0, totalGanado: logro.puntosRecompensa, totalGastado: 0, mejorRacha: 0 };
          await db.walletATC.create({
            data: {
              loginNormalizado,
              nombre: user.name || user.username,
              saldo: logro.puntosRecompensa,
              semanaActual: semanaISOActual(),
              stats: JSON.stringify(stats),
              rachaActual: 0,
              metricasSemanales: '[]',
              actualizado: new Date().toISOString(),
            },
          });
        }

        // Registrar transacción con tipo específico
        await db.transaccionATC.create({
          data: {
            id: randomUUID(),
            loginNormalizado,
            tipo: 'LOGRO',
            monto: logro.puntosRecompensa,
            descripcion: `Logro desbloqueado: ${logro.nombre} ${logro.emoji}`,
            semanaISO: semanaISOActual(),
            fecha: new Date().toISOString(),
            creado: new Date().toISOString(),
            procesadoPor: 'sistema-logros',
          },
        });
      }
    }

    // Notificación a todos (campana del supervisor)
    const user = await db.user.findUnique({ where: { id: userId } });
    const nombre = user?.name || user?.username || 'Asesor';
    await db.notificacionATC.create({
      data: {
        id: randomUUID(),
        tipo: 'info',
        titulo: `🏆 ${nombre} obtuvo un logro`,
        mensaje: `${nombre} desbloqueó "${logro.nombre}" ${logro.emoji}. ¡Felicidades!`,
        paraAdmin: true,
        leida: false,
        creado: new Date().toISOString(),
        data: JSON.stringify({ tipo: 'logro', userId, logroClave, logroNombre: logro.nombre }),
      },
    });

    return { ok: true, otorgado: true };
  } catch (err) {
    console.error('Error otorgarLogroAction:', err);
    return { ok: false, otorgado: false };
  }
}

// ============================================================
// Perfil social
// ============================================================

export interface PerfilUsuario {
  id: string;
  username: string;
  name: string;
  role: string;
  area: string;
  documento: string;
  email: string | null;
  loginNormalizado: string;
  avatarUrl: string | null;
  bio: string | null;
  saldo: number;
  rachaActual: number;
  statsPromotores: number;
  statsPasivos: number;
  statsDetractores: number;
  totalGanado: number;
  logros: UsuarioLogro[];
}

export async function getPerfilUsuarioAction(userId?: string): Promise<PerfilUsuario | null> {
  const session = await getSession();
  if (!session) return null;
  const uid = userId || session.userId;

  try {
    const u = await db.user.findUnique({ where: { id: uid } });
    if (!u) return null;

    const loginNormalizado = u.loginNormalizado || u.username;
    const w = await db.walletATC.findUnique({ where: { loginNormalizado } });

    let stats: any = {};
    if (w?.stats) {
      try {
        stats = typeof w.stats === 'string' ? JSON.parse(w.stats) : w.stats;
      } catch { stats = {}; }
    }

    const logros = await db.usuarioLogro.findMany({
      where: { usuarioId: uid },
      orderBy: { otorgado: 'desc' },
    });
    const logrosList: UsuarioLogro[] = logros.map((r: any) => ({
      id: r.id,
      userId: r.usuarioId,
      logroId: r.logroId,
      otorgadoEn: r.otorgado,
      logro: {
        id: r.logroId,
        clave: r.logroId,
        nombre: r.logroNombre,
        descripcion: r.logroDescripcion || '',
        emoji: r.logroEmoji || '',
        categoria: 'general',
        puntosRecompensa: r.puntosRecompensa,
      },
    }));

    return {
      id: u.id,
      username: u.username,
      name: u.name || '',
      role: u.role,
      area: u.area,
      documento: u.documento || '',
      email: u.email,
      loginNormalizado,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      saldo: w?.saldo ?? 0,
      rachaActual: w?.rachaActual ?? 0,
      statsPromotores: stats.totalPromotores ?? 0,
      statsPasivos: stats.totalPasivos ?? 0,
      statsDetractores: stats.totalDetractores ?? 0,
      totalGanado: stats.totalGanado ?? 0,
      logros: logrosList,
    };
  } catch (err) {
    console.error('Error getPerfilUsuarioAction:', err);
    return null;
  }
}

export async function actualizarPerfilAction(
  avatarUrl?: string | null,
  bio?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No hay sesión.' };

  try {
    const data: any = {};
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (bio !== undefined) data.bio = bio;
    if (Object.keys(data).length === 0) return { ok: true };

    await db.user.update({ where: { id: session.userId }, data });
    return { ok: true };
  } catch (err) {
    console.error('Error actualizarPerfilAction:', err);
    return { ok: false, error: 'Error al actualizar perfil.' };
  }
}

// ============================================================
// Búsqueda social
// ============================================================

export interface UsuarioBusqueda {
  id: string;
  username: string;
  name: string;
  role: string;
  area: string;
  avatarUrl: string | null;
  saldo: number;
  totalLogros: number;
}

export async function buscarUsuariosAction(query: string, limite: number = 20): Promise<UsuarioBusqueda[]> {
  const session = await getSession();
  if (!session) return [];

  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  try {
    // Prisma doesn't support LIKE in findMany, use $queryRaw for SQLite
    const users = await db.user.findMany({
      where: {
        activo: true,
        OR: [
          { name: { contains: q } },
          { username: { contains: q } },
          { loginNormalizado: { contains: q } },
        ],
      },
      take: limite,
      orderBy: [{ name: 'asc' }],
    });

    const resultado: UsuarioBusqueda[] = [];
    for (const u of users) {
      const loginNormalizado = u.loginNormalizado || u.username;
      const w = await db.walletATC.findUnique({ where: { loginNormalizado } });
      const totalLogros = await db.usuarioLogro.count({ where: { usuarioId: u.id } });
      resultado.push({
        id: u.id,
        username: u.username,
        name: u.name || '',
        role: u.role,
        area: u.area,
        avatarUrl: u.avatarUrl,
        saldo: w?.saldo ?? 0,
        totalLogros,
      });
    }
    // Ordenar: matches exactos primero
    resultado.sort((a, b) => {
      if (a.username.toLowerCase() === q) return -1;
      if (b.username.toLowerCase() === q) return 1;
      return 0;
    });
    return resultado;
  } catch (err) {
    console.error('Error buscarUsuariosAction:', err);
    return [];
  }
}

export async function listarUsuariosAction(limite: number = 50): Promise<UsuarioBusqueda[]> {
  const session = await getSession();
  if (!session) return [];

  try {
    const users = await db.user.findMany({
      where: { activo: true },
      take: limite,
      orderBy: [{ name: 'asc' }],
    });

    const resultado: UsuarioBusqueda[] = [];
    for (const u of users) {
      const loginNormalizado = u.loginNormalizado || u.username;
      const w = await db.walletATC.findUnique({ where: { loginNormalizado } });
      const totalLogros = await db.usuarioLogro.count({ where: { usuarioId: u.id } });
      resultado.push({
        id: u.id,
        username: u.username,
        name: u.name || '',
        role: u.role,
        area: u.area,
        avatarUrl: u.avatarUrl,
        saldo: w?.saldo ?? 0,
        totalLogros,
      });
    }
    // Ordenar por totalLogros DESC
    resultado.sort((a, b) => b.totalLogros - a.totalLogros);
    return resultado;
  } catch (err) {
    console.error('Error listarUsuariosAction:', err);
    return [];
  }
}
