'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface LogEntry {
    id: string;
    user_hash: string;
    action: string;
    resource_type: string;
    result: 'allow' | 'deny';
    reason_sanitized: string | null;
    timestamp: string;
    hour_of_day: number;
    day_of_week: number;
}

interface LogsResponse {
    data: LogEntry[];
    pagination: {
        total: number;
    };
}

export function RecentLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        async function fetchLogs() {
            try {
                const response = await fetch('/api/audit/logs?limit=5');
                if (!response.ok) {
                    throw new Error('Failed to fetch logs');
                }
                const result: LogsResponse = await response.json();
                setLogs(result.data);
                setTotal(result.pagination.total);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchLogs();
    }, []);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
                        ))}
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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-slate-600" />
                    Últimas Actividades
                </CardTitle>
                <Link
                    href="/admin/logs"
                    className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400"
                >
                    Ver todos ({total.toLocaleString()})
                </Link>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No hay logs disponibles</p>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                            >
                                <div className="flex items-center gap-3">
                                    {log.result === 'allow' ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {log.action}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Usuario: {log.user_hash} • {log.resource_type}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge
                                        variant={log.result === 'allow' ? 'default' : 'destructive'}
                                        className="mb-1"
                                    >
                                        {log.result === 'allow' ? 'Permitido' : 'Denegado'}
                                    </Badge>
                                    <p className="text-xs text-slate-500">{formatTime(log.timestamp)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
