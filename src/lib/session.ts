// ============================================================
// tNPS Digital — Sesión JWT (sin jose, sin firebase)
// Archivo: src/lib/session.ts
// ============================================================
// JWT nativo con crypto de Node.js. No usa jose (que causaba
// stack overflow en el Edge Runtime). No usa firebase.
// ============================================================
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'tnps-digital-claro-gt-secret-key-change-in-production-2026';
const SESSION_COOKIE = 'tnps-session-v2';
const SESSION_DURATION = 8 * 60 * 60; // 8 horas

export type Rol = 'ASESOR' | 'SUPERVISOR' | 'ADMIN';

export interface AuthSession {
  userId: string;
  username: string;
  role: Rol;
  area: 'digital';
  name: string;
  /** Número de cédula/documento del usuario (vital para cruce de métricas). */
  documento?: string;
  /** LOB / Campaña del asesor (cargado desde AsesorHC al hacer login). */
  lob?: string;
  /** Supervisor asignado al asesor. */
  supervisor?: string;
  /** Indica si el usuario debe cambiar su contraseña en el próximo ingreso. */
  debeCambiarPassword?: boolean;
  iat?: number;
  exp?: number;
}

// --- Base64URL helpers ---
function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

function base64UrlDecode(str: string): unknown {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

// --- JWT sign/verify (HS256 con crypto nativo) ---
function sign(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verify(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const data = `${header}.${body}`;
    const expectedSig = createHmac('sha256', JWT_SECRET).update(data).digest('base64url');

    // Comparación segura en tiempo constante
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = base64UrlDecode(body) as Record<string, unknown>;

    // Verificar expiración
    if (payload.exp && typeof payload.exp === 'number') {
      if (Date.now() / 1000 > payload.exp) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// --- API pública ---

export async function createSession(session: Omit<AuthSession, 'iat' | 'exp'>): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    userId: session.userId,
    username: session.username,
    role: session.role,
    area: session.area,
    name: session.name,
    documento: session.documento ?? '',
    lob: session.lob ?? '',
    supervisor: session.supervisor ?? '',
    debeCambiarPassword: session.debeCambiarPassword ?? false,
    iat: now,
    exp: now + SESSION_DURATION,
  };
  const token = sign(payload);

  const cookieStore = await cookies();
  // ⚠️ SameSite=None es OBLIGATORIO para que la cookie se envíe en POSTs
  // (Server Actions) cuando la app está embebida en un iframe cross-site,
  // como ocurre en Hugging Face Spaces (huggingface.co → *.hf.space).
  // Con SameSite=Lax, los POSTs del iframe no incluyen la cookie y las
  // Server Actions fallan con "No autenticado" / "Solo supervisores...".
  // Requiere secure=true, que ya está seteado en producción.
  const isProduction = process.env.NODE_ENV === 'production';
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    // 1) Intentar leer desde la cookie (flujo normal)
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE)?.value;

    // 2) Fallback: si no hay cookie (ej. iframe cross-site con cookies
    //    bloqueadas), intentar leer el token del header Authorization.
    //    El cliente puede enviarlo manualmente vía fetch().
    if (!token) {
      try {
        const { headers } = await import('next/headers');
        const h = await headers();
        const authHeader = h.get('authorization') || h.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim();
        }
      } catch {
        // headers() no disponible en este contexto, ignorar
      }
    }

    if (!token) return null;

    const payload = verify(token);
    if (!payload) return null;

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as Rol,
      area: 'digital',
      name: payload.name as string,
      documento: (payload.documento as string | undefined) ?? '',
      lob: (payload.lob as string | undefined) ?? '',
      supervisor: (payload.supervisor as string | undefined) ?? '',
      debeCambiarPassword: (payload.debeCambiarPassword as boolean | undefined) ?? false,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function verifySessionFromToken(token: string): Promise<AuthSession | null> {
  try {
    if (!token) return null;
    const payload = verify(token);
    if (!payload) return null;

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as Rol,
      area: 'digital',
      name: payload.name as string,
      documento: (payload.documento as string | undefined) ?? '',
      lob: (payload.lob as string | undefined) ?? '',
      supervisor: (payload.supervisor as string | undefined) ?? '',
      debeCambiarPassword: (payload.debeCambiarPassword as boolean | undefined) ?? false,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
