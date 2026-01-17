'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck, Clock, Archive, XCircle, Briefcase } from 'lucide-react';

interface CaseSummary {
    totalResolved: number;
    totalPending: number;
    totalInReview: number;
    totalArchived: number;
    totalRejected: number;
    totalCases: number;
    resolutionRate: string;
}

interface DailyCaseStat {
    date: string;
    cases_resolved: number;
    cases_pending: number;
    cases_in_review: number;
    cases_archived: number;
    cases_rejected: number;
}

interface CaseData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: CaseSummary;
    daily: DailyCaseStat[];
    generatedAt: string;
}

export function CaseStats() {
    const [data, setData] = useState<CaseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCaseStats() {
            try {
                const response = await fetch('/api/audit/cases');
                if (!response.ok) {
                    throw new Error('Failed to fetch case statistics');
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchCaseStats();
    }, []);

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48" />
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

    const statusItems = [
        {
            label: 'Resueltos',
            value: summary.totalResolved,
            icon: FileCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-50 dark:bg-green-950',
        },
        {
            label: 'Pendientes',
            value: summary.totalPending,
            icon: Clock,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50 dark:bg-amber-950',
        },
        {
            label: 'En Revision',
            value: summary.totalInReview,
            icon: Briefcase,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 dark:bg-blue-950',
        },
        {
            label: 'Archivados',
            value: summary.totalArchived,
            icon: Archive,
            color: 'text-slate-600',
            bgColor: 'bg-slate-100 dark:bg-slate-800',
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5 text-emerald-600" />
                    Estado de Casos
                </CardTitle>
                <p className="text-sm text-slate-500">
                    {data.period.startDate} a {data.period.endDate}
                </p>
            </CardHeader>
            <CardContent>
                {/* Tasa de resolución destacada */}
                <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 mb-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Tasa de Resolucion</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        {summary.resolutionRate}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                        {summary.totalResolved.toLocaleString()} de {summary.totalCases.toLocaleString()} casos
                    </p>
                </div>

                {/* Grid de estados */}
                <div className="grid grid-cols-2 gap-3">
                    {statusItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.label}
                                className={`text-center p-3 rounded-lg ${item.bgColor}`}
                            >
                                <Icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                    {item.value.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500">{item.label}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Rechazados aparte (si hay) */}
                {summary.totalRejected > 0 && (
                    <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-700 dark:text-red-300">Rechazados</span>
                        </div>
                        <span className="font-medium text-red-600">{summary.totalRejected}</span>
                    </div>
                )}

                <p className="text-xs text-slate-400 mt-4 text-center">
                    Solo conteos - Sin contenido de casos
                </p>
            </CardContent>
        </Card>
    );
}
