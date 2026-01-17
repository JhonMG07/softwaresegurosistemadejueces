'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface DailyMetric {
    date: string;
    access_allowed: number;
    access_denied: number;
    total_actions: number;
    case_operations: number;
    user_operations: number;
    document_operations: number;
    admin_operations: number;
}

interface MetricsData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: {
        totalActions: number;
        accessAllowed: number;
        accessDenied: number;
        caseOperations: number;
        userOperations: number;
        documentOperations: number;
        adminOperations: number;
        denyRate: string;
    };
    daily: DailyMetric[];
    generatedAt: string;
}

/**
 * Página de métricas detalladas
 *
 * Muestra:
 * - Gráfico de actividad diaria
 * - Desglose por tipo de operación
 * - Tendencias
 *
 * Solo datos agregados, sin identidades.
 */
export default function AdminMetricsPage() {
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const response = await fetch(`/api/audit/metrics?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Error al cargar métricas');
            }
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const calculateTrend = (daily: DailyMetric[]) => {
        if (daily.length < 2) return { direction: 'neutral', percentage: 0 };

        const recent = daily.slice(0, Math.min(7, daily.length));
        const older = daily.slice(Math.min(7, daily.length), Math.min(14, daily.length));

        if (older.length === 0) return { direction: 'neutral', percentage: 0 };

        const recentAvg = recent.reduce((sum, d) => sum + d.total_actions, 0) / recent.length;
        const olderAvg = older.reduce((sum, d) => sum + d.total_actions, 0) / older.length;

        if (olderAvg === 0) return { direction: 'up', percentage: 100 };

        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        return {
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
            percentage: Math.abs(change).toFixed(1),
        };
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Métricas del Sistema
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Estadísticas agregadas de actividad
                    </p>
                </div>
                <Button onClick={fetchMetrics} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            {/* Filtros de fecha */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Desde:</span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Hasta:</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <Button onClick={fetchMetrics} variant="outline">
                            Aplicar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                    <CardContent className="pt-6">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Contenido principal */}
            {data && (
                <>
                    {/* Resumen */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Total de Acciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.summary.totalActions.toLocaleString()}
                                </div>
                                {(() => {
                                    const trend = calculateTrend(data.daily);
                                    return (
                                        <div className={`flex items-center text-sm mt-1 ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                                            {trend.direction === 'up' ? (
                                                <TrendingUp className="h-4 w-4 mr-1" />
                                            ) : trend.direction === 'down' ? (
                                                <TrendingDown className="h-4 w-4 mr-1" />
                                            ) : (
                                                <Activity className="h-4 w-4 mr-1" />
                                            )}
                                            {trend.percentage}% vs período anterior
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Tasa de Denegación
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-600">
                                    {data.summary.denyRate}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    {data.summary.accessDenied.toLocaleString()} denegaciones
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Días Analizados
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.period.daysIncluded}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    {data.period.startDate} - {data.period.endDate}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Promedio Diario
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {data.period.daysIncluded > 0
                                        ? Math.round(data.summary.totalActions / data.period.daysIncluded).toLocaleString()
                                        : 0}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    acciones por día
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Desglose por tipo de operación */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Desglose por Tipo de Operación</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[
                                    { label: 'Operaciones de Casos', value: data.summary.caseOperations, color: 'bg-blue-500' },
                                    { label: 'Operaciones de Usuarios', value: data.summary.userOperations, color: 'bg-green-500' },
                                    { label: 'Operaciones de Documentos', value: data.summary.documentOperations, color: 'bg-amber-500' },
                                    { label: 'Operaciones de Admin', value: data.summary.adminOperations, color: 'bg-purple-500' },
                                ].map((item) => {
                                    const percentage = data.summary.totalActions > 0
                                        ? (item.value / data.summary.totalActions) * 100
                                        : 0;
                                    return (
                                        <div key={item.label}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                                                <span className="font-medium">{item.value.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${item.color} transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actividad diaria */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actividad Diaria (Últimos {data.daily.length} días)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <div className="min-w-[600px] h-64 flex items-end gap-1">
                                    {data.daily.slice().reverse().map((day, index) => {
                                        const maxActions = Math.max(...data.daily.map(d => d.total_actions));
                                        const height = maxActions > 0 ? (day.total_actions / maxActions) * 100 : 0;
                                        return (
                                            <div
                                                key={day.date}
                                                className="flex-1 flex flex-col items-center group"
                                            >
                                                <div
                                                    className="w-full bg-blue-500 hover:bg-blue-600 transition-all rounded-t cursor-pointer"
                                                    style={{ height: `${Math.max(height, 2)}%` }}
                                                    title={`${day.date}: ${day.total_actions} acciones`}
                                                />
                                                {index % 7 === 0 && (
                                                    <span className="text-xs text-slate-500 mt-1 transform -rotate-45 origin-top-left">
                                                        {day.date.slice(5)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
