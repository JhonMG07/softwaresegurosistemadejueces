import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware de Next.js para protección de rutas
 *
 * Funcionalidades:
 * 1. Rate limiting básico para rutas de auditoría
 * 2. Verificación de autenticación para rutas protegidas
 * 3. Redirección según rol del usuario
 *
 * Rutas protegidas:
 * - /admin/* → Solo rol admin o super_admin
 * - /dashboard/* → Solo roles autenticados (judge, secretary, etc.)
 * - /api/audit/* → Solo rol admin o super_admin
 */

// Rate limiting simple en memoria (para producción usar Redis)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_ADMIN = 50; // 50 requests por minuto para admin
const RATE_LIMIT_MAX_GENERAL = 100; // 100 requests por minuto general

function checkRateLimit(identifier: string, maxRequests: number): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(identifier);

    if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(identifier, { count: 1, timestamp: now });
        return true;
    }

    record.count++;
    return record.count <= maxRequests;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Crear cliente de Supabase
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Obtener sesión del usuario
    const { data: { user } } = await supabase.auth.getUser();

    // ====================================
    // PROTECCIÓN: Rutas de Admin (/admin/*)
    // ====================================
    if (pathname.startsWith('/admin')) {
        // No autenticado → Login
        if (!user) {
            const loginUrl = new URL('/auth/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Rate limiting para admin
        const rateLimitKey = `admin:${user.id}`;
        if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_ADMIN)) {
            return NextResponse.json(
                { error: 'Too many requests' },
                { status: 429 }
            );
        }

        // Verificar rol
        const { data: profile } = await supabase
            .from('users_profile')
            .select('role, status')
            .eq('id', user.id)
            .single();

        if (!profile || profile.status !== 'active') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        // Solo admin y super_admin pueden acceder a /admin/*
        if (profile.role !== 'admin' && profile.role !== 'super_admin') {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        // Usuario admin autorizado
        return response;
    }

    // ====================================
    // PROTECCIÓN: API de Auditoría (/api/audit/*)
    // ====================================
    if (pathname.startsWith('/api/audit')) {
        // No autenticado
        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Rate limiting
        const rateLimitKey = `audit-api:${user.id}`;
        if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_ADMIN)) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': '60',
                        'X-RateLimit-Limit': RATE_LIMIT_MAX_ADMIN.toString(),
                    }
                }
            );
        }

        // Nota: La verificación de rol se hace en cada endpoint de API
        // para mayor seguridad (defense in depth)
        return response;
    }

    // ====================================
    // PROTECCIÓN: Dashboard (/dashboard/*)
    // ====================================
    if (pathname.startsWith('/dashboard')) {
        if (!user) {
            const loginUrl = new URL('/auth/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Rate limiting general
        const rateLimitKey = `dashboard:${user.id}`;
        if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_GENERAL)) {
            return NextResponse.json(
                { error: 'Too many requests' },
                { status: 429 }
            );
        }

        return response;
    }

    // ====================================
    // PROTECCIÓN: APIs de Admin (/api/admin/*)
    // ====================================
    if (pathname.startsWith('/api/admin')) {
        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Rate limiting
        const rateLimitKey = `api-admin:${user.id}`;
        if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_GENERAL)) {
            return NextResponse.json(
                { error: 'Too many requests' },
                { status: 429 }
            );
        }

        return response;
    }

    // Rutas públicas - permitir acceso
    return response;
}

/**
 * Configurar qué rutas procesa este middleware
 */
export const config = {
    matcher: [
        // Rutas de admin
        '/admin/:path*',
        // APIs de admin
        '/api/admin/:path*',
        // APIs de auditoría
        '/api/audit/:path*',
        // Dashboard
        '/dashboard/:path*',
    ],
};
