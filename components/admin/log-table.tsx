'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Search, Filter, RefreshCw } from 'lucide-react';

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

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface LogsResponse {
    data: LogEntry[];
    pagination: Pagination;
    filters: {
        action: string | null;
        result: string | null;
        startDate: string | null;
        endDate: string | null;
    };
}

export function LogTable() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [actionFilter, setActionFilter] = useState('');
    const [resultFilter, setResultFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchLogs = useCallback(async (page: number = 1) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('limit', '20');

            if (actionFilter) params.set('action', actionFilter);
            if (resultFilter !== 'all') params.set('result', resultFilter);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const response = await fetch(`/api/audit/logs?${params.toString()}`);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Demasiadas solicitudes. Por favor, espera un momento.');
                }
                throw new Error('Error al cargar los logs');
            }

            const result: LogsResponse = await response.json();
            setLogs(result.data);
            setPagination(result.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [actionFilter, resultFilter, startDate, endDate]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const handleApplyFilters = () => {
        fetchLogs(1);
    };

    const handleClearFilters = () => {
        setActionFilter('');
        setResultFilter('all');
        setStartDate('');
        setEndDate('');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Logs de Auditoría</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLogs(pagination.page)}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Filtros */}
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Filtrar por acción..."
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-48"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <Select value={resultFilter} onValueChange={setResultFilter}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Resultado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="allow">Permitido</SelectItem>
                                <SelectItem value="deny">Denegado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-40"
                            placeholder="Desde"
                        />
                        <span className="text-slate-500">-</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-40"
                            placeholder="Hasta"
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={handleClearFilters}>
                            Limpiar
                        </Button>
                        <Button size="sm" onClick={handleApplyFilters}>
                            Aplicar Filtros
                        </Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Tabla */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha/Hora</TableHead>
                                <TableHead>Usuario (Hash)</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Recurso</TableHead>
                                <TableHead>Resultado</TableHead>
                                <TableHead>Razón</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        {[...Array(6)].map((_, j) => (
                                            <TableCell key={j}>
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                        No se encontraron logs con los filtros aplicados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            {formatTimestamp(log.timestamp)}
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                {log.user_hash}
                                            </code>
                                        </TableCell>
                                        <TableCell className="font-medium">{log.action}</TableCell>
                                        <TableCell>{log.resource_type}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={log.result === 'allow' ? 'default' : 'destructive'}
                                            >
                                                {log.result === 'allow' ? 'Permitido' : 'Denegado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                                            {log.reason_sanitized || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-slate-500">
                        Mostrando {logs.length} de {pagination.total.toLocaleString()} registros
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLogs(pagination.page - 1)}
                            disabled={pagination.page <= 1 || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <span className="text-sm text-slate-600 dark:text-slate-400 px-2">
                            Página {pagination.page} de {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || loading}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
