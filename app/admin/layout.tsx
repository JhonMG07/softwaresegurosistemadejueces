import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminNavbar } from "@/components/admin/admin-navbar";

/**
 * Layout para el panel de administración (auditoría)
 *
 * Protecciones de seguridad:
 * - Verifica autenticación
 * - Verifica rol admin o super_admin
 * - Verifica cuenta activa
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
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // No autenticado
    if (!user) {
        redirect('/auth/login?redirect=/admin');
    }

    // Verificar perfil y rol
    const { data: profile } = await supabase
        .from('users_profile')
        .select('role, status')
        .eq('id', user.id)
        .single();

    // Sin perfil o cuenta inactiva
    if (!profile || profile.status !== 'active') {
        redirect('/unauthorized');
    }

    // Solo admin y super_admin pueden acceder
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        redirect('/unauthorized');
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <AdminNavbar />
            <main className="container mx-auto px-6 py-8">
                {children}
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
