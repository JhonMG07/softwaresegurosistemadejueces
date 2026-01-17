import { LogTable } from "@/components/admin/log-table";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

/**
 * Página de logs de auditoría
 *
 * Muestra tabla paginada de logs con filtros.
 * Todos los datos están anonimizados:
 * - user_id → hash MD5 de 8 caracteres
 * - resource_id → NO se muestra
 * - reason → sanitizada (sin UUIDs)
 */
export default function AdminLogsPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    Logs de Auditoría
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Registro de actividades del sistema (datos anonimizados)
                </p>
            </div>

            {/* Info sobre anonimización */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <CardContent className="flex items-start gap-3 pt-6">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Sobre los identificadores de usuario:</p>
                        <p>
                            La columna &quot;Usuario (Hash)&quot; muestra los primeros 8 caracteres del hash MD5
                            del identificador original. Esto permite correlacionar acciones de un mismo
                            usuario sin revelar su identidad real. Por ejemplo, si ves varios registros
                            con el hash <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">a1b2c3d4</code>,
                            corresponden al mismo usuario.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de logs */}
            <LogTable />
        </div>
    );
}
