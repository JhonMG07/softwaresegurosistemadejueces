import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    requireAdminWithPermission,
    checkRateLimit,
    createSecureErrorResponse,
    sanitizeSearchParams,
    logAuditAccess,
    getRateLimitHeaders
} from '@/lib/vault/middleware';
import { ATTRIBUTES } from '@/lib/abac/types';

/**
 * GET /api/audit/logs
 *
 * Retorna logs de auditoría ANONIMIZADOS para el rol admin.
 *
 * Seguridad:
 * - Solo accesible por admin o super_admin
 * - user_id reemplazado por hash MD5 de 8 caracteres
 * - resource_id NO se expone
 * - Rate limiting: 50 req/min
 * - Todos los accesos quedan registrados en audit_access_log
 *
 * Query params:
 * - page: número de página (default: 1)
 * - limit: registros por página (default: 20, max: 100)
 * - action: filtrar por tipo de acción
 * - result: filtrar por resultado (allow/deny)
 * - startDate: fecha inicio (YYYY-MM-DD)
 * - endDate: fecha fin (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Verificar rol y permiso
        const { user, profile } = await requireAdminWithPermission(ATTRIBUTES.AUDIT_LOGS_VIEW);

        // 2. Rate limiting
        const rateLimit = checkRateLimit(user.id);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait before trying again.' },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
                }
            );
        }

        // 3. Sanitizar parámetros
        const { searchParams } = new URL(request.url);
        const sanitized = sanitizeSearchParams({
            page: searchParams.get('page'),
            limit: searchParams.get('limit'),
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        });

        // Parámetros adicionales
        const action = searchParams.get('action')?.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 50) || null;
        const result = searchParams.get('result');
        const validResult = result === 'allow' || result === 'deny' ? result : null;

        // 4. Registrar acceso (meta-auditoría)
        await logAuditAccess(user.id, 'audit_logs_sanitized', {
            page: sanitized.page,
            limit: sanitized.limit,
            action,
            result: validResult,
            startDate: sanitized.startDate,
            endDate: sanitized.endDate
        });

        // 5. Consultar vista segura (anonimizada)
        const supabase = await createClient();
        const offset = (sanitized.page - 1) * sanitized.limit;

        // Construir query base
        let query = supabase
            .from('audit_logs_sanitized')
            .select('*', { count: 'exact' });

        // Aplicar filtros
        if (action) {
            query = query.ilike('action', `%${action}%`);
        }
        if (validResult) {
            query = query.eq('result', validResult);
        }
        if (sanitized.startDate) {
            query = query.gte('timestamp', `${sanitized.startDate}T00:00:00Z`);
        }
        if (sanitized.endDate) {
            query = query.lte('timestamp', `${sanitized.endDate}T23:59:59Z`);
        }

        // Ordenar y paginar
        query = query
            .order('timestamp', { ascending: false })
            .range(offset, offset + sanitized.limit - 1);

        const { data: logs, error, count } = await query;

        if (error) {
            console.error('[Audit API] Query error:', error);
            return NextResponse.json(
                { error: 'Failed to retrieve logs' },
                { status: 500 }
            );
        }

        // 6. Respuesta con datos anonimizados
        return NextResponse.json({
            data: logs || [],
            pagination: {
                page: sanitized.page,
                limit: sanitized.limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / sanitized.limit)
            },
            filters: {
                action,
                result: validResult,
                startDate: sanitized.startDate,
                endDate: sanitized.endDate
            }
        }, {
            headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        });

    } catch (error) {
        return createSecureErrorResponse(error);
    }
}
