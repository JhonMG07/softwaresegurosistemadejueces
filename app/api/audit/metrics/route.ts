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
 * GET /api/audit/metrics
 *
 * Retorna métricas AGREGADAS del sistema para el rol admin.
 *
 * Seguridad:
 * - Solo accesible por admin o super_admin
 * - Solo conteos, NUNCA identidades individuales
 * - Rate limiting: 50 req/min
 * - Datos provienen de vista materializada (no en tiempo real)
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

        // 4. Registrar acceso
        await logAuditAccess(user.id, 'audit_daily_metrics', { startDate, endDate });

        // 5. Consultar métricas desde vista materializada
        const supabase = await createClient();

        const { data: dailyMetrics, error: metricsError } = await supabase
            .from('audit_daily_metrics')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (metricsError) {
            console.error('[Audit API] Metrics query error:', metricsError);
            return NextResponse.json(
                { error: 'Failed to retrieve metrics' },
                { status: 500 }
            );
        }

        // 6. Calcular resumen agregado
        const summary = (dailyMetrics || []).reduce((acc, day) => ({
            totalActions: acc.totalActions + (Number(day.total_actions) || 0),
            accessAllowed: acc.accessAllowed + (Number(day.access_allowed) || 0),
            accessDenied: acc.accessDenied + (Number(day.access_denied) || 0),
            caseOperations: acc.caseOperations + (Number(day.case_operations) || 0),
            userOperations: acc.userOperations + (Number(day.user_operations) || 0),
            documentOperations: acc.documentOperations + (Number(day.document_operations) || 0),
            adminOperations: acc.adminOperations + (Number(day.admin_operations) || 0),
        }), {
            totalActions: 0,
            accessAllowed: 0,
            accessDenied: 0,
            caseOperations: 0,
            userOperations: 0,
            documentOperations: 0,
            adminOperations: 0,
        });

        // Calcular tasa de denegación
        const denyRate = summary.totalActions > 0
            ? ((summary.accessDenied / summary.totalActions) * 100).toFixed(2)
            : '0.00';

        // 7. Respuesta con métricas agregadas
        return NextResponse.json({
            period: {
                startDate,
                endDate,
                daysIncluded: dailyMetrics?.length || 0
            },
            summary: {
                ...summary,
                denyRate: `${denyRate}%`
            },
            daily: dailyMetrics || [],
            generatedAt: new Date().toISOString()
        }, {
            headers: getRateLimitHeaders(rateLimit.remaining, rateLimit.resetIn)
        });

    } catch (error) {
        return createSecureErrorResponse(error);
    }
}
