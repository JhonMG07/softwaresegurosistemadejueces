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
 * GET /api/audit/cases
 *
 * Retorna estadísticas de casos por estado y día (SOLO CONTEOS).
 *
 * Seguridad:
 * - Solo accesible por admin o super_admin
 * - NUNCA expone contenido de casos ni IDs
 * - Solo conteos agregados por día y estado
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
        await logAuditAccess(user.id, 'audit_cases_resolved_daily', { startDate, endDate });

        // 5. Consultar vista de casos resueltos
        const supabase = await createClient();

        const { data: caseStats, error: statsError } = await supabase
            .from('audit_cases_resolved_daily')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (statsError) {
            console.error('[Audit API] Case stats query error:', statsError);
            return NextResponse.json(
                { error: 'Failed to retrieve case statistics' },
                { status: 500 }
            );
        }

        // 6. Calcular resumen agregado
        const summary = (caseStats || []).reduce((acc, day) => ({
            totalResolved: acc.totalResolved + (Number(day.cases_resolved) || 0),
            totalPending: acc.totalPending + (Number(day.cases_pending) || 0),
            totalInReview: acc.totalInReview + (Number(day.cases_in_review) || 0),
            totalArchived: acc.totalArchived + (Number(day.cases_archived) || 0),
            totalRejected: acc.totalRejected + (Number(day.cases_rejected) || 0),
        }), {
            totalResolved: 0,
            totalPending: 0,
            totalInReview: 0,
            totalArchived: 0,
            totalRejected: 0,
        });

        // Calcular tasa de resolución
        const totalCases = summary.totalResolved + summary.totalPending +
                          summary.totalInReview + summary.totalArchived + summary.totalRejected;
        const resolutionRate = totalCases > 0
            ? ((summary.totalResolved / totalCases) * 100).toFixed(1)
            : '0';

        // 7. Respuesta con estadísticas agregadas (sin contenido de casos)
        return NextResponse.json({
            period: {
                startDate,
                endDate,
                daysIncluded: caseStats?.length || 0
            },
            summary: {
                ...summary,
                totalCases,
                resolutionRate: `${resolutionRate}%`
            },
            daily: caseStats || [],
            generatedAt: new Date().toISOString()
        }, {
            headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        });

    } catch (error) {
        return createSecureErrorResponse(error);
    }
}
