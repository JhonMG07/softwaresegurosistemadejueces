'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, TrendingUp } from 'lucide-react';

interface JudgeSummary {
    totalActiveJudges: number;
    totalJudgeActions: number;
    daysWithActivity: number;
    avgDailyJudges: string;
}

interface DailyJudgeStat {
    date: string;
    active_judges: number;
    total_judge_actions: number;
}

interface JudgeData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: JudgeSummary;
    daily: DailyJudgeStat[];
    generatedAt: string;
}

export function JudgeStats() {
    const [data, setData] = useState<JudgeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchJudgeStats() {
            try {
                const response = await fetch('/api/audit/judges');
                if (!response.ok) {
                    throw new Error('Failed to fetch judge statistics');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchJudgeStats();
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Actividad de Jueces
                </CardTitle>
                <p className="text-sm text-slate-500">
                    {data.period.startDate} a {data.period.endDate}
                </p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950">
                        <Users className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {summary.avgDailyJudges}
                        </p>
                        <p className="text-xs text-slate-500">Promedio diario</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                        <Activity className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {summary.totalJudgeActions.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">Acciones totales</p>
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Dias con actividad</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                            {summary.daysWithActivity} de {data.period.daysIncluded}
                        </span>
                    </div>
                </div>

                {/* Mini gráfico de barras */}
                {data.daily.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-slate-500 mb-2">Actividad reciente (jueces/día)</p>
                        <div className="flex items-end gap-1 h-16">
                            {data.daily.slice(0, 14).reverse().map((day, idx) => {
                                const maxJudges = Math.max(...data.daily.map(d => d.active_judges || 0), 1);
                                const height = ((day.active_judges || 0) / maxJudges) * 100;
                                return (
                                    <div
                                        key={day.date}
                                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 transition-colors rounded-t cursor-pointer"
                                        style={{ height: `${Math.max(height, 4)}%` }}
                                        title={`${day.date}: ${day.active_judges} jueces`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                <p className="text-xs text-slate-400 mt-4 text-center">
                    Solo conteos agregados - Sin identidades
                </p>
            </CardContent>
        </Card>
    );
}
