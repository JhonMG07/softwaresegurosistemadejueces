'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ShieldCheck, ShieldX, TrendingUp } from 'lucide-react';

interface MetricsSummary {
    totalActions: number;
    accessAllowed: number;
    accessDenied: number;
    caseOperations: number;
    userOperations: number;
    documentOperations: number;
    adminOperations: number;
    denyRate: string;
}

interface MetricsData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: MetricsSummary;
    generatedAt: string;
}

export function MetricsOverview() {
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const response = await fetch('/api/audit/metrics');
                if (!response.ok) {
                    throw new Error('Failed to fetch metrics');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                <CardContent className="pt-6">
                    <p className="text-red-600 dark:text-red-400">Error: {error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const { summary } = data;

    const cards = [
        {
            title: 'Acciones Totales',
            value: summary.totalActions.toLocaleString(),
            description: `Últimos ${data.period.daysIncluded} días`,
            icon: Activity,
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-950',
        },
        {
            title: 'Accesos Permitidos',
            value: summary.accessAllowed.toLocaleString(),
            description: 'Solicitudes autorizadas',
            icon: ShieldCheck,
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-950',
        },
        {
            title: 'Accesos Denegados',
            value: summary.accessDenied.toLocaleString(),
            description: summary.denyRate + ' del total',
            icon: ShieldX,
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-50 dark:bg-red-950',
        },
        {
            title: 'Operaciones de Casos',
            value: summary.caseOperations.toLocaleString(),
            description: 'Acciones sobre casos',
            icon: TrendingUp,
            color: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-50 dark:bg-amber-950',
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Resumen de Métricas
                </h2>
                <span className="text-xs text-slate-500">
                    {data.period.startDate} a {data.period.endDate}
                </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.title} className={card.bgColor}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    {card.title}
                                </CardTitle>
                                <Icon className={`h-4 w-4 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${card.color}`}>
                                    {card.value}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                    {card.description}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
