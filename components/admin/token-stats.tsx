'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TokenSummary {
    totalEmitted: number;
    totalUsed: number;
    totalExpiredUnused: number;
    totalPending: number;
    usageRate: string;
    avgHoursToUse: string;
}

interface TokenData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: TokenSummary;
    generatedAt: string;
}

export function TokenStats() {
    const [data, setData] = useState<TokenData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTokenStats() {
            try {
                const response = await fetch('/api/audit/tokens');
                if (!response.ok) {
                    throw new Error('Failed to fetch token statistics');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchTokenStats();
    }, []);

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    </div>
                </CardContent>
            </Card>
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

    const stats = [
        {
            label: 'Tokens Emitidos',
            value: summary.totalEmitted,
            icon: Key,
            color: 'text-blue-600',
        },
        {
            label: 'Tokens Usados',
            value: summary.totalUsed,
            icon: CheckCircle,
            color: 'text-green-600',
        },
        {
            label: 'Expirados sin Usar',
            value: summary.totalExpiredUnused,
            icon: XCircle,
            color: 'text-red-600',
        },
        {
            label: 'Pendientes',
            value: summary.totalPending,
            icon: Clock,
            color: 'text-amber-600',
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Key className="h-5 w-5 text-amber-600" />
                    Estadísticas de Tokens Efímeros
                </CardTitle>
                <p className="text-sm text-slate-500">
                    {data.period.startDate} a {data.period.endDate}
                </p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                                <Icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {stat.value.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500">{stat.label}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                        <p className="text-sm text-slate-500">Tasa de Uso</p>
                        <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                            {summary.usageRate}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-slate-500">Tiempo Promedio de Uso</p>
                        <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                            {summary.avgHoursToUse}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
