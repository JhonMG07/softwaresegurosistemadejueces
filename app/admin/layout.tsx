
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { Suspense } from "react";

/**
 * Layout para el panel de administración (auditoría)
 *
 * Protecciones de seguridad:
 * - Verifica autenticación (delegado a AdminAuthGuard)
 * - Verifica rol admin o super_admin (delegado a AdminAuthGuard)
 * - Verifica cuenta activa (delegado a AdminAuthGuard)
 *
 * El admin solo puede:
 * - Ver logs anonimizados
 * - Ver métricas agregadas
 * - Ver estadísticas de tokens
 *
 * El admin NO puede:
 * - Acceder al Identity Vault
 * - Ver contenido de casos
 * - Ver identidades reales
 */
export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

            <Suspense fallback={<div className="h-16 bg-white dark:bg-slate-900 border-b" />}>
                <AdminNavbar />
            </Suspense>
            <main className="container mx-auto px-6 py-8">
                <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-500">Cargando panel de auditoría...</div>}>
                    <AdminAuthGuard>
                        {children}
                    </AdminAuthGuard>
                </Suspense>
            </main>

            <footer className="border-t bg-white dark:bg-slate-950 py-4 mt-auto">
                <div className="container mx-auto px-6 text-center text-sm text-slate-500">
                    Panel de Auditoría - Sistema de Gestión Judicial
                    <span className="mx-2">•</span>
                    Solo datos anonimizados y métricas agregadas
                </div>
            </footer>
        </div>
    );
}
