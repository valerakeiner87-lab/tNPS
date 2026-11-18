'use server';

/**
 * Server Actions de autenticación.
 * Usa Prisma (compatible SQLite dev / PostgreSQL prod).
 *
 * Flujo:
 * - Asesor: login = login_normalizado, password = cédula
 * - Supervisor/Admin: login = username o email, password = su contraseña
 *
 * La sesión se guarda en una cookie httpOnly (JWT firmado).
 */

import { createSession, getSession, logout as logoutSession, type AuthSession, type Rol } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { db } from '@/lib/db';

export interface LoginResult {
  ok: boolean;
  error?: string;
  session?: AuthSession;
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: Rol;
  area: 'digital';
  documento: string;
  email: string | null;
  loginNormalizado: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

/**
 * Login unificado para asesor y supervisor.
 */
export async function loginAction(
  username: string,
  password: string,
  area: 'digital'
): Promise<LoginResult> {
  if (!username?.trim() || !password) {
    return { ok: false, error: 'Usuario y contraseña son obligatorios.' };
  }

  const user = username.trim().toLowerCase();
  try {
    // Buscar por username O email O login_normalizado (case insensitive)
    const u = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: user } },
          { email: { equals: user } },
          { loginNormalizado: { equals: user } },
        ],
        activo: true,
      },
    });

    if (!u) {
      return { ok: false, error: 'Usuario no encontrado. Verifica tu login.' };
    }

    // Verificar password
    const passwordValid = verifyPassword(password, u.passwordHash);
    if (!passwordValid) {
      return { ok: false, error: 'Contraseña incorrecta.' };
    }

    // Actualizar último ingreso
    await db.user.update({
      where: { id: u.id },
      data: { ultimoIngreso: new Date() },
    });

    // Crear sesión (el área la define el usuario en el login, no la BD)
    const session: Omit<AuthSession, 'iat' | 'exp'> = {
      userId: u.id,
      username: u.username,
      role: u.role as Rol,
      area: 'digital',
      name: u.name || '',
      debeCambiarPassword: !!u.debeCambiarPassword,
    };
    await createSession(session);

    return {
      ok: true,
      session: {
        ...session,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 8 * 3600,
      },
    };
  } catch (err) {
    console.error('Error en loginAction:', err);
    return { ok: false, error: 'Error al iniciar sesión. Intenta de nuevo.' };
  }
}

/**
 * Cierra la sesión eliminando la cookie JWT.
 */
export async function logoutAction(): Promise<{ ok: boolean }> {
  await logoutSession();
  return { ok: true };
}

/**
 * Obtiene la sesión actual (para hidratar el estado del cliente).
 */
export async function getCurrentUserAction(): Promise<AuthSession | null> {
  return await getSession();
}

/**
 * Obtiene información completa del usuario actual (para el perfil).
 */
export async function getUserInfoAction(): Promise<UserInfo | null> {
  const session = await getSession();
  if (!session) return null;

  const u = await db.user.findUnique({ where: { id: session.userId } });
  if (!u) return null;

  return {
    id: u.id,
    username: u.username,
    name: u.name || '',
    role: u.role as Rol,
    area: 'digital',
    documento: u.documento || '',
    email: u.email,
    loginNormalizado: u.loginNormalizado || '',
    avatarUrl: u.avatarUrl,
    bio: u.bio,
  };
}

/**
 * Crea un nuevo usuario SUPERVISOR (solo ADMIN puede hacerlo).
 */
export async function createSupervisorAction(
  username: string,
  password: string,
  name: string,
  email: string,
  _area: 'digital' = 'digital'
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { ok: false, error: 'Solo un administrador puede crear supervisores.' };
  }
  if (!username?.trim() || !password || password.length < 6) {
    return { ok: false, error: 'Username obligatorio y password mínimo 6 caracteres.' };
  }

  try {
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    const hash = hashPassword(password);
    await db.user.upsert({
      where: { username: username.trim().toLowerCase() },
      create: {
        id,
        username: username.trim().toLowerCase(),
        passwordHash: hash,
        name: name || '',
        role: 'SUPERVISOR',
        area: 'digital',
        email: email || null,
        activo: true,
      },
      update: {
        passwordHash: hash,
        name: name || '',
        role: 'SUPERVISOR',
        email: email || null,
        activo: true,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error('Error createSupervisorAction:', err);
    return { ok: false, error: 'Error al crear supervisor.' };
  }
}

/**
 * Cambia la contraseña del usuario actual.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No hay sesión.' };
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }

  try {
    const u = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!u) return { ok: false, error: 'Usuario no encontrado.' };

    const valid = verifyPassword(currentPassword, u.passwordHash);
    if (!valid) return { ok: false, error: 'Contraseña actual incorrecta.' };

    const hash = hashPassword(newPassword);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hash },
    });
    return { ok: true };
  } catch (err) {
    console.error('Error changePasswordAction:', err);
    return { ok: false, error: 'Error al cambiar contraseña.' };
  }
}

/**
 * Cambia la contraseña del usuario actual y limpia la bandera
 * `debeCambiarPassword`. Se usa en el flujo de primer login (cuando el
 * supervisor resetea la contraseña al documento del asesor y este debe
 * cambiarla al ingresar).
 *
 * A diferencia de `changePasswordAction`, NO pide la contraseña actual
 * porque el usuario acaba de iniciar sesión con la contraseña reseteada.
 *
 * IMPORTANTE: después de actualizar la BD, regenera el JWT para que la
 * cookie de sesión refleje `debeCambiarPassword: false`. Sin esto, el
 * usuario entraría en bucle: cambia la contraseña, la BD se actualiza,
 * pero al recargar la página el JWT viejo (con debeCambiarPassword: true)
 * sigue presente y el diálogo vuelve a aparecer.
 */
export async function cambiarPasswordAction(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'No hay sesión.' };
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  try {
    const hash = hashPassword(newPassword);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hash, debeCambiarPassword: false },
    });
    // Regenerar el JWT con debeCambiarPassword: false para que la cookie
    // se actualice y el diálogo no vuelva a aparecer al recargar.
    await createSession({
      userId: session.userId,
      username: session.username,
      role: session.role,
      area: session.area,
      name: session.name,
      debeCambiarPassword: false,
    });
    return { ok: true };
  } catch (err) {
    console.error('Error cambiarPasswordAction:', err);
    return { ok: false, error: 'Error al cambiar contraseña.' };
  }
}
