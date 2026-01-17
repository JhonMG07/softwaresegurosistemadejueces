'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { RefreshCw, Key, Info } from 'lucide-react';

interface DailyTokenStat {
    date: string;
    tokens_emitted: number;
    tokens_used: number;
    tokens_expired_unused: number;
    tokens_pending: number;
    avg_hours_to_use: number | null;
}

interface TokenData {
    period: {
        startDate: string;
        endDate: string;
        daysIncluded: number;
    };
    summary: {
        totalEmitted: number;
        totalUsed: number;
        totalExpiredUnused: number;
        totalPending: number;
        usageRate: string;
        avgHoursToUse: string;
    };
    daily: DailyTokenStat[];
    generatedAt: string;
}

/**
 * Página de estadísticas de tokens efímeros
 *
 * Muestra:
 * - Resumen de tokens emitidos/usados
 * - Tasa de uso
 * - Detalle diario
 *
 * NO muestra:
 * - Contenido de tokens
 * - Identidades asociadas
 * - Casos específicos
 */
export default function AdminTokensPage() {
    const [data, setData] = useState<TokenData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchTokenStats = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const response = await fetch(`/api/audit/tokens?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Error al cargar estadísticas');
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
        fetchTokenStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Estadísticas de Tokens
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Credenciales efímeras del sistema
                    </p>
                </div>
                <Button onClick={fetchTokenStats} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            {/* Info sobre tokens */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <CardContent className="flex items-start gap-3 pt-6">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Sobre los tokens efímeros:</p>
                        <p>
                            Los tokens efímeros son credenciales de un solo uso que se envían a los
                            jueces para acceder a casos asignados. Esta vista muestra solo
                            estadísticas agregadas: cuántos tokens se emitieron, cuántos se usaron,
                            y el tiempo promedio hasta su uso. No se muestra el contenido del token
                            ni la identidad del usuario asociado.
                        </p>
                    </div>
                </CardContent>
            </Card>

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
                        <Button onClick={fetchTokenStats} variant="outline">
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
                        <Card className="bg-blue-50 dark:bg-blue-950">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                                    <Key className="h-4 w-4" />
                                    Tokens Emitidos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {data.summary.totalEmitted.toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-green-50 dark:bg-green-950">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Tokens Usados
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {data.summary.totalUsed.toLocaleString()}
                                </div>
                                <p className="text-sm text-green-600 mt-1">
                                    Tasa: {data.summary.usageRate}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-red-50 dark:bg-red-950">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Expirados sin Usar
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {data.summary.totalExpiredUnused.toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50 dark:bg-amber-950">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-600">
                                    Tiempo Promedio de Uso
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-600">
                                    {data.summary.avgHoursToUse}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabla de detalle diario */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle Diario</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Emitidos</TableHead>
                                            <TableHead className="text-right">Usados</TableHead>
                                            <TableHead className="text-right">Expirados</TableHead>
                                            <TableHead className="text-right">Pendientes</TableHead>
                                            <TableHead className="text-right">Prom. Uso (h)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.daily.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                    No hay datos para el período seleccionado
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.daily.map((day) => (
                                                <TableRow key={day.date}>
                                                    <TableCell className="font-medium">{day.date}</TableCell>
                                                    <TableCell className="text-right">{day.tokens_emitted}</TableCell>
                                                    <TableCell className="text-right text-green-600">{day.tokens_used}</TableCell>
                                                    <TableCell className="text-right text-red-600">{day.tokens_expired_unused}</TableCell>
                                                    <TableCell className="text-right text-amber-600">{day.tokens_pending}</TableCell>
                                                    <TableCell className="text-right">
                                                        {day.avg_hours_to_use !== null ? `${day.avg_hours_to_use}h` : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
