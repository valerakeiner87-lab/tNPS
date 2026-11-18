// Proxy (antes middleware) MÍNIMO: solo verifica si hay cookie, no procesa JWT.
// La verificación real la hacen las API routes y el store del cliente.
//
// Nota: Next.js 16 renombró "middleware" → "proxy". El archivo debe llamarse
// proxy.ts (no middleware.ts) y la función exportada debe llamarse `proxy`
// (o ser un export default) para evitar errores de compilación.
//
// IMPORTANTE: NO redirigir POSTs. Las Server Actions de Next.js son POSTs a la
// URL de la página actual con el header `Next-Action`. Si el proxy los
// redirige, la acción falla con un 301/302 y el cliente nunca recibe la
// respuesta esperada. Por eso solo aplicamos la redirección a GETs.
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'tnps-session-v2';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas que NO necesitan sesión
  if (pathname === '/' || pathname === '/login' ||
      pathname.startsWith('/_next/') || pathname.startsWith('/api/') ||
      pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff2?)$/)) {
    return NextResponse.next();
  }

  // Las Server Actions (POST con header Next-Action) se dejan pasar sin
  // redirigir. Si la sesión no es válida, la propia Server Action devuelve
  // un error claro (ej. "No autenticado"), que el cliente puede manejar.
  if (req.method === 'POST') {
    return NextResponse.next();
  }

  // Para GETs: si no hay cookie, redirigir al login
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
