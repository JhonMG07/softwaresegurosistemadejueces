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
 * GET /api/audit/judges
 *
 * Retorna estadísticas de jueces activos por día (SOLO CONTEOS).
 *
 * Seguridad:
 * - Solo accesible por admin o super_admin
 * - NUNCA expone identidades de jueces
 * - Solo conteos agregados por día
 * - Rate limiting: 50 req/min
 *
 * Query params:
 * - startDate: fecha inicio (YYYY-MM-DD, default: -30 días)
 * - endDate: fecha fin (YYYY-MM-DD, default: hoy)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Verificar rol y permiso
        const { user } = await requireAdminWithPermission(ATTRIBUTES.AUDIT_METRICS_VIEW);

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

        // 4. Registrar acceso (meta-auditoría)
        await logAuditAccess(user.id, 'audit_active_judges_daily', { startDate, endDate });

        // 5. Consultar vista de jueces activos
        const supabase = await createClient();

        const { data: judgeStats, error: statsError } = await supabase
            .from('audit_active_judges_daily')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (statsError) {
            console.error('[Audit API] Judge stats query error:', statsError);
            return NextResponse.json(
                { error: 'Failed to retrieve judge statistics' },
                { status: 500 }
            );
        }

        // 6. Calcular resumen agregado
        const summary = (judgeStats || []).reduce((acc, day) => ({
            totalActiveJudges: acc.totalActiveJudges + (Number(day.active_judges) || 0),
            totalJudgeActions: acc.totalJudgeActions + (Number(day.total_judge_actions) || 0),
            daysWithActivity: acc.daysWithActivity + ((Number(day.active_judges) || 0) > 0 ? 1 : 0),
        }), {
            totalActiveJudges: 0,
            totalJudgeActions: 0,
            daysWithActivity: 0,
        });

        // Calcular promedio diario de jueces activos
        const avgDailyJudges = summary.daysWithActivity > 0
            ? (summary.totalActiveJudges / summary.daysWithActivity).toFixed(1)
            : '0';

        // 7. Respuesta con estadísticas agregadas (sin identidades)
        return NextResponse.json({
            period: {
                startDate,
                endDate,
                daysIncluded: judgeStats?.length || 0
            },
            summary: {
                ...summary,
                avgDailyJudges
            },
            daily: judgeStats || [],
            generatedAt: new Date().toISOString()
        }, {
            headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        });

    } catch (error) {
        return createSecureErrorResponse(error);
    }
}
