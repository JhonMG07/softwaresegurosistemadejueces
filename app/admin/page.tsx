import { MetricsOverview } from "@/components/admin/metrics-overview";
import { TokenStats } from "@/components/admin/token-stats";
import { RecentLogs } from "@/components/admin/recent-logs";
import { JudgeStats } from "@/components/admin/judge-stats";
import { CaseStats } from "@/components/admin/case-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield } from "lucide-react";

/**
 * Dashboard principal del panel de auditoría
 *
 * Muestra:
 * - Resumen de métricas (solo conteos agregados)
 * - Estadísticas de tokens (sin contenido)
 * - Últimas actividades (logs anonimizados)
 *
 * IMPORTANTE: Ningún dato sensible es expuesto
 * - No hay user_id reales (solo hashes de 8 caracteres)
 * - No hay contenido de casos
 * - No hay identidades de jueces/secretarios
 */
export default function AdminDashboardPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    Dashboard de Auditoría
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Métricas y logs del sistema (datos anonimizados)
                </p>
            </div>

            {/* Aviso de seguridad */}
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm">
                        <Shield className="h-4 w-4" />
                        Información de Seguridad
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-amber-700 dark:text-amber-300">
                    <p>
                        Este panel muestra únicamente datos <strong>anonimizados</strong> y{" "}
                        <strong>métricas agregadas</strong>. Los identificadores de usuario
                        han sido reemplazados por hashes parciales (8 caracteres) que permiten
                        correlacionar acciones sin revelar identidades reales.
                    </p>
                </CardContent>
            </Card>

            {/* Métricas principales */}
            <MetricsOverview />

            {/* Grid de cuatro columnas: Jueces, Casos, Tokens, Logs */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Estadísticas de jueces activos */}
                <JudgeStats />

                {/* Estadísticas de casos */}
                <CaseStats />

                {/* Estadísticas de tokens */}
                <TokenStats />

                {/* Últimos logs */}
                <RecentLogs />
            </div>

            {/* Nota sobre limitaciones */}
            <Card className="border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="flex items-start gap-3 pt-6">
                    <AlertTriangle className="h-5 w-5 text-slate-500 mt-0.5" />
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        <p className="font-medium mb-1">Rol de Auditor - Acceso limitado:</p>
                        <div className="grid md:grid-cols-2 gap-4 mt-2">
                            <div>
                                <p className="font-medium text-green-700 dark:text-green-400 mb-1">Puede ver:</p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                    <li>Numero de jueces activos por dia</li>
                                    <li>Cantidad de casos resueltos</li>
                                    <li>Accesos al sistema (logs)</li>
                                    <li>Tokens emitidos/usados/expirados</li>
                                    <li>Metricas agregadas del sistema</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-medium text-red-700 dark:text-red-400 mb-1">NO puede ver:</p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                    <li>Contenido de casos judiciales</li>
                                    <li>Identidades reales de jueces</li>
                                    <li>Identidades de secretarias</li>
                                    <li>Identity Vault</li>
                                    <li>Dictamenes ni su contenido</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
