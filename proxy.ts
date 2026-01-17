import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  // First update session
  let response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/auth/login', '/auth/signup', '/auth/callback', '/auth/signout'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Si es ruta pública, retornar directamente
  if (isPublicRoute) {
    return response;
  }

  // Crear cliente Supabase para verificar autenticación y roles
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si no está autenticado, redirigir a login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Obtener rol del usuario para protección de rutas
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role, status')
    .eq('id', user.id)
    .single();

  // Verificar que la cuenta esté activa
  if (profile?.status !== 'active') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('error', 'account_inactive');
    return NextResponse.redirect(url);
  }

  // Proteger rutas de Supreme Court
  if (pathname.startsWith('/supreme-court')) {
    if (profile?.role !== 'super_admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Proteger rutas de Admin (Auditor)
  // Solo admin y super_admin pueden acceder
  if (pathname.startsWith('/admin')) {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }
  }

  // Proteger rutas de jueces
  if (pathname.startsWith('/judge')) {
    if (profile?.role !== 'judge') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Proteger APIs de admin (Supreme Court)
  if (pathname.startsWith('/api/admin')) {
    if (profile?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }
  }

  // Proteger APIs de auditoria
  // Solo admin y super_admin pueden acceder
  if (pathname.startsWith('/api/audit')) {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
  }

  // Proteger APIs de jueces
  if (pathname.startsWith('/api/judge')) {
    if (profile?.role !== 'judge' && profile?.role !== 'secretary') {
      return NextResponse.json(
        { error: 'Forbidden - Judge access required' },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
