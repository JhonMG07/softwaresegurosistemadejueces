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
 * GET /api/audit/tokens
 *
 * Retorna estadísticas de tokens efímeros para el rol admin.
 *
 * Seguridad:
 * - Solo accesible por admin o super_admin
 * - Solo estadísticas agregadas por día
 * - NUNCA expone contenido del token ni identidades
 * - Rate limiting: 50 req/min
 *
 * Query params:
 * - startDate: fecha inicio (YYYY-MM-DD, default: -30 días)
 * - endDate: fecha fin (YYYY-MM-DD, default: hoy)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Verificar rol y permiso
        const { user } = await requireAdminWithPermission(ATTRIBUTES.AUDIT_TOKENS_VIEW);

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

        // 3. Sanitizar parámetros de fecha
        const { searchParams } = new URL(request.url);
        const sanitized = sanitizeSearchParams({
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        });

        // Defaults: últimos 30 días
        const endDate = sanitized.endDate || new Date().toISOString().split('T')[0];
        const startDate = sanitized.startDate || (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d.toISOString().split('T')[0];
        })();

        // 4. Registrar acceso
        await logAuditAccess(user.id, 'audit_token_stats', { startDate, endDate });

        // 5. Consultar estadísticas de tokens
        const supabase = await createClient();

        const { data: tokenStats, error: statsError } = await supabase
            .from('audit_token_stats')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (statsError) {
            console.error('[Audit API] Token stats query error:', statsError);
            return NextResponse.json(
                { error: 'Failed to retrieve token statistics' },
                { status: 500 }
            );
        }

        // 6. Calcular resumen agregado
        const summary = (tokenStats || []).reduce((acc, day) => ({
            totalEmitted: acc.totalEmitted + (Number(day.tokens_emitted) || 0),
            totalUsed: acc.totalUsed + (Number(day.tokens_used) || 0),
            totalExpiredUnused: acc.totalExpiredUnused + (Number(day.tokens_expired_unused) || 0),
            totalPending: acc.totalPending + (Number(day.tokens_pending) || 0),
        }), {
            totalEmitted: 0,
            totalUsed: 0,
            totalExpiredUnused: 0,
            totalPending: 0,
        });

        // Calcular tasa de uso
        const usageRate = summary.totalEmitted > 0
            ? ((summary.totalUsed / summary.totalEmitted) * 100).toFixed(2)
            : '0.00';

        // Calcular tiempo promedio de uso (de los días que tienen datos)
        const daysWithAvg = (tokenStats || []).filter(d => d.avg_hours_to_use !== null);
        const avgHoursToUse = daysWithAvg.length > 0
            ? (daysWithAvg.reduce((sum, d) => sum + (Number(d.avg_hours_to_use) || 0), 0) / daysWithAvg.length).toFixed(2)
            : null;

        // 7. Respuesta con estadísticas agregadas
        return NextResponse.json({
            period: {
                startDate,
                endDate,
                daysIncluded: tokenStats?.length || 0
            },
            summary: {
                ...summary,
                usageRate: `${usageRate}%`,
                avgHoursToUse: avgHoursToUse ? `${avgHoursToUse}h` : 'N/A'
            },
            daily: tokenStats || [],
            generatedAt: new Date().toISOString()
        }, {
            headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        });

    } catch (error) {
        return createSecureErrorResponse(error);
    }
}
