// API Route para login
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { verifyPassword } from '@/lib/password';
import type { Rol } from '@/lib/session';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // v3.0.5: Rate limiting
    const ip = getClientIP(req.headers);
    const rateKey = `${ip}:${username || 'unknown'}`;
    const rate = checkRateLimit('login', rateKey);
    if (!rate.allowed) {
      return NextResponse.json({
        ok: false,
        error: rate.message || `Demasiados intentos. Espera ${rate.retryAfter}s.`,
      }, { status: 429 });
    }

    if (!username?.trim() || !password) {
      return NextResponse.json({ ok: false, error: 'Usuario y contraseña son obligatorios.' });
    }

    const user = username.trim().toLowerCase();

    // v3.1.3: Reintentar conexión a BD (Neon puede estar suspendido temporalmente)
    let u: any = null;
    let lastError: any = null;
    for (let intento = 1; intento <= 3; intento++) {
      try {
        u = await db.user.findFirst({
          where: {
            OR: [
              { username: user },
              { email: user },
              { loginNormalizado: user },
            ],
            activo: true,
          },
        });
        break; // éxito
      } catch (dbErr: any) {
        lastError = dbErr;
        console.warn(`Intento ${intento}/3 — Error BD en login:`, dbErr.message?.substring(0, 150));
        if (intento < 3) {
          await new Promise(r => setTimeout(r, 2000 * intento)); // backoff
        }
      }
    }

    if (!u && lastError) {
      // La BD no responde después de 3 intentos
      const errMsg = lastError.message || '';
      if (errMsg.includes('Can\'t reach database server') || errMsg.includes('Timed out') || errMsg.includes('connect')) {
        return NextResponse.json({
          ok: false,
          error: 'No se puede conectar a la base de datos. El servidor podría estar reiniciándose. Intenta de nuevo en unos segundos.',
        }, { status: 503 });
      }
      throw lastError; // Otro error, dejar que el catch lo maneje
    }

    if (!u) {
      await audit({
        username: user,
        accion: 'login',
        descripcion: 'Login fallido: usuario no encontrado',
        ipOrigen: ip,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado.' });
    }

    const passwordValid = verifyPassword(password, u.passwordHash);
    if (!passwordValid) {
      await audit({
        userId: u.id,
        username: user,
        accion: 'login',
        descripcion: 'Login fallido: contraseña incorrecta',
        ipOrigen: ip,
        userAgent: req.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ ok: false, error: 'Contraseña incorrecta.' });
    }

    await db.user.update({
      where: { id: u.id },
      data: { ultimoIngreso: new Date() },
    });

    // v3.4.3: Cargar documento / LOB / supervisor desde AsesorHC para
    // que la sesión los tenga disponibles inmediatamente (sin esperar a
    // cargarDesdeFirestore). Esto resuelve el error "(sin documento)".
    let documento = u.documento || '';
    let lob = '';
    let supervisor = '';
    if (u.role === 'ASESOR' || u.role === 'asesor') {
      try {
        const login = u.loginNormalizado || u.username;
        const hc = await db.asesorHC.findFirst({
          where: {
            OR: [
              { loginNormalizado: login },
              { usuarioCic: login },
            ],
          },
        });
        if (hc) {
          documento = documento || hc.documento || '';
          lob = hc.lob || '';
          supervisor = hc.supervisor || '';
        }
      } catch (hcErr: any) {
        console.warn('No se pudo cargar AsesorHC en login:', hcErr.message?.substring(0, 100));
      }
    }

    const sessionData = {
      userId: u.id,
      username: u.username,
      role: u.role as Rol,
      area: 'digital' as const,
      name: u.name || '',
      documento,
      lob,
      supervisor,
      debeCambiarPassword: !!u.debeCambiarPassword,
    };
    await createSession(sessionData);

    // v3.0.5: Auditoría
    await audit({
      userId: u.id,
      username: u.username,
      accion: 'login',
      descripcion: `Login exitoso (área: ${sessionData.area})`,
      ipOrigen: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      session: {
        ...sessionData,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 8 * 3600,
      },
      debeCambiarPassword: !!u.debeCambiarPassword,
    });
  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    const msg = err instanceof Error ? err.message : String(err);
    // v3.1.3: Si es error de BD, devolver 503 con mensaje claro
    if (msg.includes("Can't reach database") || msg.includes('Timed out') || msg.includes('connect')) {
      return NextResponse.json({
        ok: false,
        error: 'No se puede conectar a la base de datos. Intenta de nuevo en unos segundos.',
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: `Error al iniciar sesión: ${msg.substring(0, 100)}` }, { status: 500 });
  }
}
