import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ============================================
// Rate Limiting Storage (en memoria para demo)
// En producción usar Redis o similar
// ============================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Constantes de rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const ADMIN_RATE_LIMIT = 50; // 50 requests por minuto para admin
const GENERAL_RATE_LIMIT = 100; // 100 requests por minuto general

// Regex para validar UUIDs (v4)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware: Verificar que el usuario autenticado es Super Admin
 *
 * @throws Error si no está autenticado o no es super_admin
 * @returns Usuario autenticado si es Super Admin
 */
export async function requireSuperAdmin() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized - No authenticated user');
    }

    console.log('[Middleware] Checking profile for user:', user.id);

    const { data: profile, error } = await supabase
        .from('users_profile')
        .select('role, status')
        .eq('id', user.id)
        .single();

    console.log('[Middleware] Profile query result:', { profile, error });

    if (!profile) {
        throw new Error('User profile not found');
    }

    if (profile.status !== 'active') {
        throw new Error('Account is not active');
    }

    if (profile.role !== 'super_admin') {
        throw new Error('Forbidden - Super Admin access required');
    }

    return user;
}

/**
 * Middleware: Verificar que el usuario autenticado es Admin (Auditor)
 *
 * El rol admin solo puede acceder a logs anonimizados y métricas agregadas.
 * NO tiene acceso al Identity Vault ni a contenido de casos.
 *
 * @throws Error si no está autenticado o no es admin/super_admin
 * @returns Objeto con usuario y perfil
 */
export async function requireAdmin() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
        .from('users_profile')
        .select('id, role, status, real_name')
        .eq('id', user.id)
        .single();

    if (!profile) {
        throw new Error('Unauthorized');
    }

    if (profile.status !== 'active') {
        throw new Error('Account suspended');
    }

    // Admin o Super Admin pueden acceder
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        throw new Error('Forbidden');
    }

    return { user, profile };
}

/**
 * Middleware: Verificar admin con permiso ABAC específico
 *
 * @param requiredAttribute - Atributo ABAC requerido (ej: 'audit.logs.view')
 * @throws Error si no tiene el permiso
 * @returns Objeto con usuario y perfil
 */
export async function requireAdminWithPermission(requiredAttribute: string) {
    const { user, profile } = await requireAdmin();

    const supabase = await createClient();

    // Super admin tiene todos los permisos
    if (profile.role === 'super_admin') {
        return { user, profile };
    }

    // Verificar atributo ABAC para admin regular
    const { data: hasAttribute } = await supabase
        .from('user_attributes')
        .select(`
            id,
            abac_attributes!inner(name)
        `)
        .eq('user_id', user.id)
        .eq('abac_attributes.name', requiredAttribute)
        .or('expires_at.is.null,expires_at.gt.now()')
        .maybeSingle();

    if (!hasAttribute) {
        throw new Error('Forbidden - Missing permission');
    }

    return { user, profile };
}

/**
 * Rate Limiter para proteger APIs de auditoría
 *
 * @param identifier - Identificador único (user_id o IP)
 * @param maxRequests - Máximo de requests permitidas (default: ADMIN_RATE_LIMIT)
 * @returns true si está dentro del límite, false si excede
 */
export function checkRateLimit(
    identifier: string,
    maxRequests: number = ADMIN_RATE_LIMIT
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const key = `rate:${identifier}`;

    const current = rateLimitStore.get(key);

    // Si no hay registro o expiró, crear nuevo
    if (!current || current.resetAt < now) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS
        });
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetIn: RATE_LIMIT_WINDOW_MS
        };
    }

    // Incrementar contador
    current.count++;

    const allowed = current.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - current.count);
    const resetIn = current.resetAt - now;

    return { allowed, remaining, resetIn };
}

/**
 * Crear respuesta de error segura
 * NUNCA expone detalles internos del error
 *
 * @param error - Error capturado
 * @param defaultStatus - Código HTTP por defecto (500)
 * @returns NextResponse con mensaje seguro
 */
export function createSecureErrorResponse(
    error: unknown,
    defaultStatus: number = 500
): NextResponse {
    // Mapeo de mensajes conocidos a respuestas seguras
    const errorMap: Record<string, { status: number; message: string }> = {
        'Unauthorized': { status: 401, message: 'Authentication required' },
        'Unauthorized - No authenticated user': { status: 401, message: 'Authentication required' },
        'Account suspended': { status: 403, message: 'Account suspended' },
        'Forbidden': { status: 403, message: 'Access denied' },
        'Forbidden - Super Admin access required': { status: 403, message: 'Access denied' },
        'Forbidden - Missing permission': { status: 403, message: 'Insufficient permissions' },
        'User profile not found': { status: 401, message: 'Authentication required' },
        'Account is not active': { status: 403, message: 'Account suspended' },
    };

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const mapped = errorMap[errorMessage];

    if (mapped) {
        return NextResponse.json(
            { error: mapped.message },
            { status: mapped.status }
        );
    }

    // Error genérico - NUNCA exponer detalles internos
    console.error('[Security] Unmapped error:', errorMessage);
    return NextResponse.json(
        { error: 'Internal server error' },
        { status: defaultStatus }
    );
}

/**
 * Sanitizar parámetros de búsqueda
 * Previene inyección y asegura valores válidos
 *
 * @param params - Parámetros a sanitizar
 * @returns Parámetros sanitizados
 */
export function sanitizeSearchParams(params: {
    search?: string | null;
    page?: string | null;
    limit?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}): {
    search: string;
    page: number;
    limit: number;
    startDate: string | null;
    endDate: string | null;
} {
    // Sanitizar búsqueda: solo alfanuméricos, espacios y algunos caracteres seguros
    let search = '';
    if (params.search) {
        search = params.search
            .replace(/[^a-zA-Z0-9\s\-_.]/g, '') // Solo caracteres seguros
            .substring(0, 100) // Máximo 100 caracteres
            .trim();
    }

    // Sanitizar paginación
    const page = Math.max(1, Math.min(1000, parseInt(params.page || '1', 10) || 1));
    const limit = Math.max(1, Math.min(100, parseInt(params.limit || '20', 10) || 20));

    // Sanitizar fechas (formato ISO)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const startDate = params.startDate && dateRegex.test(params.startDate)
        ? params.startDate
        : null;
    const endDate = params.endDate && dateRegex.test(params.endDate)
        ? params.endDate
        : null;

    return { search, page, limit, startDate, endDate };
}

/**
 * Validar UUID v4
 *
 * @param uuid - String a validar
 * @returns true si es UUID v4 válido
 */
export function isValidUUID(uuid: string): boolean {
    return UUID_REGEX.test(uuid);
}

/**
 * Registrar acceso a recursos de auditoría (meta-auditoría)
 *
 * @param userId - ID del usuario que accede
 * @param viewAccessed - Nombre de la vista/recurso accedido
 * @param queryParams - Parámetros de la consulta (opcional)
 */
export async function logAuditAccess(
    userId: string,
    viewAccessed: string,
    queryParams?: Record<string, unknown>
): Promise<void> {
    try {
        const supabase = await createClient();

        await supabase
            .from('audit_access_log')
            .insert({
                accessed_by: userId,
                view_accessed: viewAccessed,
                query_params: queryParams || null,
                accessed_at: new Date().toISOString()
            });
    } catch (error) {
        // No fallar si el log falla, solo registrar
        console.error('[Audit] Failed to log access:', error);
    }
}

/**
 * Obtener headers de rate limit para la respuesta
 *
 * @param remaining - Requests restantes
 * @param resetIn - Tiempo hasta reset en ms
 * @returns Headers para agregar a la respuesta
 */
export function getRateLimitHeaders(remaining: number, resetIn: number): HeadersInit {
    return {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
    };
}
