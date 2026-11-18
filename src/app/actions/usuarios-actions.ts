'use server';

/**
 * Server Actions para gestión de usuarios (CRUD).
 * Usa Prisma (compatible SQLite dev / PostgreSQL prod).
 * Solo SUPERVISOR y ADMIN pueden crear/editar/eliminar usuarios.
 */

import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export type Rol = 'ASESOR' | 'SUPERVISOR' | 'ADMIN';

export interface UsuarioGestion {
  id: string;
  username: string;
  name: string;
  role: Rol;
  area: string;
  documento: string;
  email: string | null;
  loginNormalizado: string;
  activo: boolean;
  ultimoIngreso: string | null;
  createdAt: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

function canManageUsers(role: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'SUPERVISOR' || r === 'ADMIN';
}

/**
 * Lista todos los usuarios (solo supervisor/admin).
 */
export async function listarUsuariosGestionAction(): Promise<UsuarioGestion[]> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) return [];

  try {
    const users = await db.user.findMany({
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    });
    return users.map((u: any) => ({
      id: u.id,
      username: u.username,
      name: u.name || '',
      role: u.role as Rol,
      area: u.area,
      documento: u.documento || '',
      email: u.email,
      loginNormalizado: u.loginNormalizado || u.username,
      activo: u.activo,
      ultimoIngreso: u.ultimoIngreso?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      avatarUrl: u.avatarUrl,
      bio: u.bio,
    }));
  } catch (err) {
    console.error('Error listarUsuariosGestionAction:', err);
    return [];
  }
}

/**
 * Crea un nuevo usuario con correo y contraseña.
 */
export async function crearUsuarioAction(params: {
  username: string;
  password: string;
  name: string;
  role: Rol;
  area: 'digital' | 'telefonico';
  email?: string;
  documento?: string;
  avatarUrl?: string;
  bio?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden crear usuarios.' };
  }

  if (!params.username?.trim() || !params.password) {
    return { ok: false, error: 'Username y contraseña son obligatorios.' };
  }
  if (params.password.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }

  const username = params.username.trim().toLowerCase();
  try {
    const existe = await db.user.findUnique({ where: { username } });
    if (existe) {
      return { ok: false, error: `Ya existe un usuario con username "${username}".` };
    }

    const id = randomUUID();
    const hash = hashPassword(params.password);
    await db.user.create({
      data: {
        id,
        username,
        passwordHash: hash,
        name: params.name?.trim() || '',
        role: params.role,
        area: params.area,
        documento: params.documento?.trim() || '',
        email: params.email?.trim() || null,
        loginNormalizado: username,
        activo: true,
        avatarUrl: params.avatarUrl || null,
        bio: params.bio || null,
        // Forzar cambio de contraseña en el primer login del usuario
        debeCambiarPassword: true,
      },
    });

    // v3.1.0: Auditoría
    try {
      const { audit } = await import('@/lib/audit');
      await audit({
        userId: session.userId,
        username: session.username,
        accion: 'create',
        tabla: 'users',
        registroId: id,
        descripcion: `Usuario creado: ${username} (${params.role}/${params.area}) — por ${session.username}`,
      });
    } catch {}

    return { ok: true, id };
  } catch (err) {
    console.error('Error crearUsuarioAction:', err);
    return { ok: false, error: 'Error al crear el usuario.' };
  }
}

/**
 * Actualiza un usuario existente.
 * Si password viene vacío, no se cambia.
 */
export async function actualizarUsuarioAction(params: {
  id: string;
  name?: string;
  role?: Rol;
  area?: 'digital' | 'telefonico';
  email?: string;
  documento?: string;
  activo?: boolean;
  password?: string;
  avatarUrl?: string;
  bio?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden editar usuarios.' };
  }

  try {
    const data: any = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.role !== undefined) data.role = params.role;
    if (params.area !== undefined) data.area = params.area;
    if (params.email !== undefined) data.email = params.email || null;
    if (params.documento !== undefined) data.documento = params.documento;
    if (params.activo !== undefined) data.activo = params.activo;
    if (params.avatarUrl !== undefined) data.avatarUrl = params.avatarUrl || null;
    if (params.bio !== undefined) data.bio = params.bio || null;
    if (params.password) data.passwordHash = hashPassword(params.password);

    if (Object.keys(data).length === 0) return { ok: true };

    await db.user.update({ where: { id: params.id }, data });
    return { ok: true };
  } catch (err) {
    console.error('Error actualizarUsuarioAction:', err);
    return { ok: false, error: 'Error al actualizar el usuario.' };
  }
}

/**
 * Elimina (desactiva) un usuario.
 */
export async function eliminarUsuarioAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden eliminar usuarios.' };
  }
  if (session.userId === id) {
    return { ok: false, error: 'No puedes eliminar tu propia cuenta.' };
  }

  try {
    // Soft delete: marcar como inactivo
    const user = await db.user.findUnique({ where: { id }, select: { username: true } });
    await db.user.update({ where: { id }, data: { activo: false } });

    // v3.1.0: Auditoría
    try {
      const { audit } = await import('@/lib/audit');
      await audit({
        userId: session.userId,
        username: session.username,
        accion: 'delete',
        tabla: 'users',
        registroId: id,
        descripcion: `Usuario desactivado: ${user?.username || id} — por ${session.username}`,
      });
    } catch {}

    return { ok: true };
  } catch (err) {
    console.error('Error eliminarUsuarioAction:', err);
    return { ok: false, error: 'Error al eliminar el usuario.' };
  }
}

/**
 * Resetea la contraseña de un usuario a su documento (cédula) y marca la
 * bandera `debeCambiarPassword` para que el asesor deba cambiarla al
 * ingresar. Solo SUPERVISOR y ADMIN pueden ejecutar esta acción.
 *
 * El documento del usuario es la contraseña inicial por defecto de los
 * asesores en Claro Guatemala, así que esta acción equivale a "dejar la
 * contraseña como vino de fábrica".
 */
export async function resetPasswordAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) {
    return { ok: false, error: 'Solo supervisores y administradores pueden resetear contraseñas.' };
  }

  try {
    const u = await db.user.findUnique({ where: { id }, select: { documento: true } });
    if (!u) {
      return { ok: false, error: 'Usuario no encontrado.' };
    }
    const documento = u.documento?.trim() || '';
    if (!documento) {
      return {
        ok: false,
        error:
          'El usuario no tiene documento (cédula) registrado. Registra el documento primero.',
      };
    }
    const hash = hashPassword(documento);
    await db.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        debeCambiarPassword: true,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error('Error resetPasswordAction:', err);
    return { ok: false, error: 'Error al resetear la contraseña.' };
  }
}
